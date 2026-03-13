# Eden Phase 3 — Intelligence Layer

> **Status**: Proposed
> **Date**: 2026-03-12
> **Phase**: 3 of 5
> **Depends on**: Phase 2 (Changeset System & Ingestion Pipeline)
> **Parent plan**: `eden-evolution.md`
> **Estimated effort**: 3–4 weeks
>
> **Delivers**: The full AI feedback loop — conversational map editing via
> chat, automatic alignment detection after changeset acceptance, question
> evolution (answered questions trigger map updates), and the expert panel
> feeding changesets back into the map. After this phase, Eden's AI is fully
> autonomous: documents go in, intelligence comes out, humans review.

---

## Scope

### What Ships

1. **Event wiring** — Changeset accept and question answer emit `app.*`
   events to the Eve event spine (prerequisite for all workflows).
2. **Map Chat agent** — conversational map editing via child job dispatch.
   User says "add an admin approval step" → changeset proposed.
3. **Alignment agent + workflow** — runs after every changeset acceptance,
   scans for conflicts, gaps, duplicates, assumptions. Creates questions.
4. **Question agent + workflow** — when a question is answered, checks if
   the answer implies a map change. Proposes changeset if needed.
5. **Coordinator skill update** — new triage categories (map edits →
   map-chat, alignment → alignment agent). Post-synthesis: create changeset
   from expert panel feedback.
6. **Web chat UI** — slide-in chat panel (560px), SSE streaming, chat ↔ map
   integration. Eve-proxied — no local chat persistence.
7. **Cross-cutting questions panel** — slide-in panel for cross-cutting
   questions that span multiple activities.
8. **Question modal** — answer questions, trigger "Evolve Map" to invoke the
   question agent.
9. **Question evolve endpoint** — combines answer + event emission in one
   call.

### What Does NOT Ship

- No drag-and-drop reordering (Phase 4).
- No release slice view (Phase 4).
- No source traceability UI (Phase 4).
- No export or search (Phase 4).
- No local chat persistence — chat is Eve-platform only, tested on staging.

---

## Prerequisites

- Phase 2 complete — changeset system working, ingestion pipeline functional,
  3 ingestion agents synced.
- `EveEventsService` exists (it does) but is **not yet called** from any
  service method. Step 3.0 wires it up.
- Eve platform features:
  - Chat routing via Eve Gateway (already working for Slack)
  - SSE job streams for real-time chat
  - Child job creation by coordinator agent

---

## Implementation Steps

### 3.0 Wire Event Emission (Small — prerequisite for all workflows)

The `EveEventsService` is injectable but never called. Two places need wiring:

**`changesets.service.ts` → `accept()` method:**

After the changeset status is set to `accepted`, emit:
```typescript
await this.events.emit('app.changeset.accepted', {
  changeset_id: changeset.id,
  project_id: changeset.project_id,
  title: changeset.title,
  items_accepted: items.length,
});
```

**`questions.service.ts` → new `evolve()` method** (see step 3f):

After answer is saved and status set to `answered`, emit:
```typescript
await this.events.emit('app.question.answered', {
  question_id: question.id,
  project_id: question.project_id,
  display_id: question.display_id,
  answer: input.answer,
});
```

**Inject `EveEventsService`** into both `ChangesetsService` and
`QuestionsService` via their respective modules. The events service is
already exported from `CommonModule`.

**Local dev behavior**: When `EVE_API_URL` is unset (local Docker), events
are logged to stdout but not sent. This is safe — the service already
handles this gracefully.

### 3a. Map Chat Agent (Medium)

```yaml
# eve/agents.yaml addition
map-chat:
  slug: map-chat
  name: "Map Chat"
  description: "Conversational map editing — interprets natural language requests and proposes changesets"
  skill: map-chat
  harness_profile: coordinator
  workflow: assistant
  context:
    memory:
      agent: shared
      categories: [decisions, conventions, context]
      max_items: 20
  gateway:
    policy: none
  policies:
    permission_policy: auto_edit
    git:
      commit: never
      push: never
```

**Skill** (`skills/map-chat/SKILL.md`):

1. Always reads current map state (`GET /api/projects/:projectId/map`) before proposing
2. Matches user intent to operations: create, update, delete, move
3. Prefers updating existing entities over creating duplicates
4. Raises questions when intent is ambiguous
5. Includes reasoning for every proposed change
6. References entities by display_id (`TSK-1.2.1`, `ACT-3`)
7. Structures changeset items to match entity_type/operation pairs supported
   by `applyItem()`: task/create, task/update, task/delete, question/create,
   question/update, activity/create, step/create, persona/create
8. Includes `device` badge when creating tasks (default: `all`)
9. Creates changeset via `POST /api/projects/:projectId/changesets` with source
   `"map-chat"` and actor `"map-chat-agent"`

**Capabilities:**

| Request Type | Example | Action |
|---|---|---|
| Add structure | "Add a mobile onboarding flow" | Creates activity + steps + tasks |
| Add requirements | "Users need password reset via email" | Creates task with story + ACs |
| Modify existing | "Change checkout to support guest users" | Updates task, adds ACs |
| Ask about map | "What happens after registration?" | Reads map, describes flow (no changeset) |
| Bulk operations | "Move all admin tasks to a new activity" | Multi-item changeset |
| Generate from conversation | "Based on our discussion, create stories" | Extracts from chat history |

### 3b. Coordinator Skill Update (Medium)

Update `skills/coordinator/SKILL.md` with new triage categories:

**New triage signals:**

| Signal | Action | eve.status |
|--------|--------|------------|
| Map edit request ("add step", "move task", "create activity") | Child job → `map-chat` agent | `success` |
| "check alignment" / "find conflicts" / "scan for gaps" | Child job → `alignment` agent | `success` |
| Existing: document + review intent | Expert panel (unchanged) | `prepared` |
| Existing: simple question | Solo response (unchanged) | `success` |

**Post-synthesis enhancement**: After expert panel completes, coordinator now:
1. Synthesizes expert feedback (existing)
2. Extracts actionable requirements (new)
3. Creates changeset via `POST /api/projects/:projectId/changesets` with
   source `"expert-panel"` and actor `"pm-coordinator"`
4. Returns executive summary + "View changeset #N" link

### 3c. Web Chat UI + SSE (Medium)

```
apps/web/src/components/chat/
  ChatPanel.tsx             # Slide-in panel (560px, right side, z-index: 200)
  ChatMessage.tsx           # User (accent, right-aligned) / AI (gray, left-aligned)
  ChatInput.tsx             # Textarea + send button
  TypingIndicator.tsx       # Animated dots
```

**Chat is Eve-proxied** — no local DB tables. The API proxies requests to
Eve's job/message system. These endpoints only function when `EVE_API_URL`
is configured (staging/production). Chat UI is tested via Playwright on
staging, not local Docker.

**API endpoints (proxy to Eve Gateway):**

```
GET    /api/projects/:projectId/chat/threads         # List threads for project
POST   /api/projects/:projectId/chat/threads         # Create thread + send first message
GET    /api/chat/threads/:threadId/messages           # Thread messages
POST   /api/chat/threads/:threadId/messages           # Send message → coordinator
GET    /api/chat/threads/:threadId/stream             # SSE stream (proxy to Eve job SSE)
```

Note: local Docker scripts call the API directly on port 3000 and therefore use
routes without the `/api` prefix (for example `/projects/:id/...`).

**NestJS module** (`apps/api/src/chat/`):
- `ChatModule` — new module, imported in `AppModule`
- `ChatController` — REST endpoints above
- `ChatGatewayService` — proxies to Eve Gateway API using `EVE_API_URL`
  and `EVE_SERVICE_TOKEN`. Returns 503 when Eve is unavailable (local dev).

**SSE bridge** (`chat.stream.ts` in web):
- Connects to Eden API's SSE proxy endpoint
- Normalizes events to `{ type, content, metadata }` shape
- Handles reconnection with exponential backoff + heartbeat
- Detects changeset references in AI responses → shows "Review Changeset #N" button

**Chat markdown rendering** (matching prototype lines 896–920):
- AI messages render full markdown via `marked` or similar:
  - Paragraphs, bold, italic, inline code
  - Code blocks with syntax highlighting (monospace, 6% black background)
  - Unordered/ordered lists
  - Tables (border-collapse, 11px font)
  - Blockquotes (3px left border, muted color)
  - Headings (rendered at 1em — don't blow up the chat bubble)
- User messages remain plain text (accent bg, right-aligned)

**Chat ↔ Map integration**:
- When AI proposes a changeset, the chat message includes a "Review Changeset #N"
  button that opens the existing `ChangesetReviewModal`.
- When a changeset is accepted/rejected from the review modal, the chat updates
  to reflect the outcome.

### 3d. Alignment Agent + Workflow (Medium)

```yaml
# eve/agents.yaml addition
alignment:
  slug: alignment
  name: "Alignment Agent"
  description: "Scans map for conflicts, gaps, duplicates, and assumptions after changeset acceptance"
  skill: alignment
  harness_profile: expert
  workflow: assistant
  context:
    memory:
      agent: shared
      categories: [decisions, conventions]
      max_items: 20
  gateway:
    policy: none
  policies:
    permission_policy: auto_edit
    git:
      commit: never
      push: never
```

```yaml
# eve/workflows.yaml addition
alignment-check:
  trigger:
    app:
      event: changeset.accepted
  with_apis:
    - service: api
      description: Eden Story Map API for reading map state and creating questions
  steps:
    - name: align
      agent:
        name: alignment
  hints:
    timeout_seconds: 300
    permission_policy: auto_edit
```

**Skill** (`skills/alignment/SKILL.md`):

Reads the full map via `GET /api/projects/:projectId/map` and scans for:

| Issue Type | Detection | Output |
|---|---|---|
| **Conflicts** | Contradictory ACs across tasks | Question with `category: 'conflict'`, refs both tasks |
| **Gaps** | Activities with single steps, personas without coverage | Question with `category: 'gap'`, refs activities |
| **Duplicates** | >80% semantic similarity in title + description | Question with `category: 'duplicate'`, refs both tasks |
| **Assumptions** | Implicit decisions that should be explicit | Question with `category: 'assumption'` |
| **Missing personas** | Tasks referencing undefined personas | Question with `category: 'gap'` |
| **Orphan tasks** | Tasks not placed on any step | Question with `category: 'gap'` |

Creates questions via `POST /api/projects/:projectId/questions` with:
- `category` field distinguishes issue type (used for filtering/display)
- `references[]` array links to affected entities (tasks, activities, etc.)
- Display IDs auto-generated by the API (`Q-N` sequence)

**Storm prevention**: The alignment skill includes a self-check — reads
recent questions (last 24h) and avoids duplicating issues already raised.
The workflow trigger does NOT fire for changesets created by the alignment
or question-evolution agents (filtered by `source` field).

### 3e. Question Agent + Workflow (Small)

```yaml
# eve/agents.yaml addition
question-agent:
  slug: question-agent
  name: "Question Agent"
  description: "Evaluates answered questions and proposes map changes when the answer implies an update"
  skill: question
  harness_profile: expert
  workflow: assistant
  gateway:
    policy: none
  policies:
    permission_policy: auto_edit
    git:
      commit: never
      push: never
```

```yaml
# eve/workflows.yaml addition
question-evolution:
  trigger:
    app:
      event: question.answered
  with_apis:
    - service: api
      description: Eden Story Map API for reading questions/tasks and creating changesets
  steps:
    - name: evolve
      agent:
        name: question-agent
  hints:
    timeout_seconds: 300
    permission_policy: auto_edit
```

**Skill** (`skills/question/SKILL.md`):

1. Reads the answered question via `GET /api/questions/:id` (includes references)
2. Reads affected task(s)/activities via references
3. Reads surrounding map context via `GET /api/projects/:projectId/map`
4. Determines if the answer implies a map change
5. If yes → creates changeset via `POST /api/projects/:projectId/changesets`
   with source `"question-evolution"` and actor `"question-agent"`
6. If no → no action (question already marked answered by the evolve endpoint)

### 3f. Question Evolve Endpoint (Small)

New endpoint on the existing `QuestionsController`:

```
POST   /api/questions/:id/evolve
Body:  { "answer": "string" }
```

Implementation in `QuestionsService`:

1. Validates question exists and is `status: 'open'`
2. Updates question: sets `answer`, transitions `status` → `'answered'`
3. Emits `app.question.answered` event via `EveEventsService` (see step 3.0)
4. Returns the updated question with references

The frontend's "Evolve Map" button calls this instead of `PATCH /api/questions/:id`.
The existing PATCH endpoint remains for non-evolve updates (priority, category).

### 3g. Cross-Cutting Questions Panel (Small)

```
apps/web/src/components/questions/
  CrossCuttingPanel.tsx     # Slide-in panel (480px, right side, z-index: 200)
  CrossCuttingCard.tsx      # Red-themed card with reference tags
```

- Red theme (`--cq-bg: #fef2f2`, `--cq-border: #ef4444`)
- Fetches questions via `GET /api/projects/:projectId/questions` — groups by
  `category` field with section headers (Conflicts, Gaps, Duplicates, etc.)
- Clickable reference tags use `display_id` from `question_references` to
  highlight affected tasks/activities on the map
- Toggled via "Cross-Cutting Qs" button in header toolbar
- Badge count shows total open questions with references to multiple entities

### 3h. Question Modal (Small)

```
apps/web/src/components/questions/
  QuestionModal.tsx         # Centered modal (680px, z-index: 300, backdrop blur)
```

Contents:
- Question text + metadata (priority badge, category tag, source)
- Reference tags (clickable → close modal, scroll to entity + flash animation)
- Response textarea with autosave (debounced `PATCH /api/questions/:id`)
- Save status indicator ("Saved" green / "Saving..." amber) + last saved timestamp
- "Evolve Map" button → calls `POST /api/questions/:id/evolve` with the current
  answer, then shows a toast confirming the question-evolution workflow was
  triggered
- Accessible from: task card question pills (existing QA page), cross-cutting
  panel cards, and changeset review modal question references

**Flash animation** (from prototype line 640–644):
When a reference tag is clicked, the target entity scrolls into view with a
2-second orange glow: `box-shadow: 0 0 0 4px rgba(230,81,0,.5)` → fade out.

### 3i. AI Modification Indicators (Small) ★ NEW

Visual indicators on the map when AI has modified or added entities, matching
prototype lines 746–762.

**Card-level indicators:**
```css
.card.ai-modified { border-left: 3px solid #8b5cf6; }  /* purple — AI modified */
.card.ai-added    { border-left: 3px solid #10b981; }  /* green — AI added */
```

Applied when a changeset is accepted: cards affected by changeset items get
the appropriate class. Cleared on page refresh or explicit reset.

**Header "EVOLVED" badge:**
```
components/map/
  EvolvedBadge.tsx          # Green pill badge in header
```

- Green badge: `background: rgba(16,185,129,.15); color: #10b981`
- Shows "EVOLVED" with a green dot when any AI-created changeset has been
  accepted in the current session
- Click to see a summary of AI changes (links to audit trail)
- Resets on page refresh

**Tracking**: Maintain `aiModifiedEntities: Set<string>` in map state.
When a changeset with `source` = `map-chat`, `question-evolution`, or
`expert-panel` is accepted, add affected entity display_ids to the set.

---

## Verification Loop

### Tier 1: Local Docker (API + DB — no Eve)

Tests schema, CRUD, event emission logging, and evolve endpoint. Chat
endpoints return 503 locally (Eve unavailable) — that's expected.

#### Deploy Local

```bash
docker-compose up -d                                    # DB + migrations
cd apps/api && npm run start:dev                        # API on :3000
cd apps/web && npm run dev                              # Web on :5173
```

#### Local Smoke Test (`scripts/smoke-test-local-p3.sh`)

```bash
#!/bin/bash
# scripts/smoke-test-local-p3.sh — Phase 3 local verification
# Tests: event emission, question evolve endpoint, cross-cutting questions
set -euo pipefail
BASE="http://localhost:3000"
H_JSON="Content-Type: application/json"

echo "=== Phase 3 Local: Event Wiring + Question Evolve ==="

# Create project + map scaffold
PROJECT=$(curl -sf -X POST -H "$H_JSON" \
  -d '{"name":"P3 Local","slug":"p3-local"}' \
  "$BASE/projects" | jq -r .id)

ACT=$(curl -sf -X POST -H "$H_JSON" \
  -d '{"name":"Feature","display_id":"ACT-1","sort_order":1}' \
  "$BASE/projects/$PROJECT/activities" | jq -r .id)

STEP=$(curl -sf -X POST -H "$H_JSON" \
  -d '{"name":"Step 1","display_id":"STP-1.1","sort_order":1}' \
  "$BASE/activities/$ACT/steps" | jq -r .id)

TASK=$(curl -sf -X POST -H "$H_JSON" \
  -d '{"title":"Test task","display_id":"TSK-1.1.1","priority":"medium"}' \
  "$BASE/projects/$PROJECT/tasks" | jq -r .id)
echo "✓ Map scaffold created"

# 1. Create + accept changeset (should log app.changeset.accepted event)
CS=$(curl -sf -X POST -H "$H_JSON" \
  -d '{
    "title":"P3 test changeset",
    "reasoning":"Verify event emission",
    "source":"smoke-test",
    "items":[
      {"entity_type":"task","operation":"create",
       "after_state":{"title":"Event test task","display_id":"TSK-1.1.2",
         "priority":"medium"},
       "description":"Test task","display_reference":"TSK-1.1.2"}
    ]
  }' "$BASE/projects/$PROJECT/changesets" | jq -r .id)
curl -sf -X POST "$BASE/changesets/$CS/accept" > /dev/null
echo "✓ Changeset accepted (event emitted to stdout)"

# 2. Create question with references
Q=$(curl -sf -X POST -H "$H_JSON" \
  -d "{
    \"question\":\"Should this task support guest users?\",
    \"priority\":\"high\",
    \"category\":\"assumption\",
    \"references\":[{\"entity_type\":\"task\",\"entity_id\":\"$TASK\"}]
  }" "$BASE/projects/$PROJECT/questions" | jq -r .id)
echo "✓ Question created with reference"

# 3. Evolve question (should log app.question.answered event)
EVOLVED=$(curl -sf -X POST -H "$H_JSON" \
  -d '{"answer":"Yes, support guest checkout"}' \
  "$BASE/questions/$Q/evolve")
STATUS=$(echo $EVOLVED | jq -r .status)
[ "$STATUS" = "answered" ] && echo "✓ Question evolved → status: answered"

# 4. Verify question list filtering by category
ASSUMPTIONS=$(curl -sf "$BASE/projects/$PROJECT/questions?category=assumption" | jq length)
[ "$ASSUMPTIONS" -ge 1 ] && echo "✓ Category filter works ($ASSUMPTIONS assumption questions)"

# 5. Chat endpoint returns 503 (Eve unavailable — expected locally)
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/projects/$PROJECT/chat/threads" || true)
[ "$HTTP" = "503" ] && echo "✓ Chat endpoint returns 503 (Eve not available — expected)"

# Cleanup
curl -sf -X DELETE "$BASE/projects/$PROJECT" > /dev/null
echo "✓ Cleanup done"

echo "=== Phase 3 local smoke tests passed ==="
```

### Tier 2: Staging Sandbox (Full Eve Integration)

Tests the complete intelligence loop: chat → agents → workflows → changesets → alignment.

#### Deploy Staging

```bash
eve project sync --dir .
eve agents sync --project eden --local --allow-dirty
eve env deploy sandbox --ref main --repo-dir . --watch --timeout 300
```

#### Staging Smoke Test (`scripts/smoke-test-p3.sh`)

```bash
#!/bin/bash
# scripts/smoke-test-p3.sh — Phase 3 staging verification
set -euo pipefail
BASE="https://eden-app.${ORG_SLUG}-eden-sandbox.eh1.incept5.dev"
H_AUTH="Authorization: Bearer $TOKEN"
H_JSON="Content-Type: application/json"

echo "=== Phase 3 Staging: Intelligence Loop ==="

# 0. Scaffold — use existing project or create one
PROJECT=$(curl -sf -X POST -H "$H_AUTH" -H "$H_JSON" \
  -d '{"name":"P3 Smoke","slug":"p3-smoke"}' \
  "$BASE/api/projects" | jq -r .id)

# Seed minimal map structure
ACT=$(curl -sf -X POST -H "$H_AUTH" -H "$H_JSON" \
  -d '{"name":"Onboarding","display_id":"ACT-1","sort_order":1}' \
  "$BASE/api/projects/$PROJECT/activities" | jq -r .id)
curl -sf -X POST -H "$H_AUTH" -H "$H_JSON" \
  -d '{"name":"Registration","display_id":"STP-1.1","sort_order":1}' \
  "$BASE/api/activities/$ACT/steps" > /dev/null
echo "✓ Map scaffold created"

# 1. Chat: request a map edit → creates thread + sends to coordinator
THREAD=$(curl -sf -X POST -H "$H_AUTH" -H "$H_JSON" \
  -d '{"message":"Add an admin approval step to the onboarding flow"}' \
  "$BASE/api/projects/$PROJECT/chat/threads" | jq -r .id)
echo "✓ Chat thread created: $THREAD"

# 2. Poll for AI response (coordinator → map-chat agent → changeset)
for i in $(seq 1 30); do
  MSGS=$(curl -sf -H "$H_AUTH" \
    "$BASE/api/chat/threads/$THREAD/messages" | jq length)
  if [ "$MSGS" -gt 1 ]; then
    echo "✓ AI response received after $((i * 5))s"
    break
  fi
  sleep 5
done

# 3. Check changeset was created (map-chat agent should have posted one)
DRAFTS=$(curl -sf -H "$H_AUTH" \
  "$BASE/api/projects/$PROJECT/changesets?status=draft" | jq length)
echo "✓ $DRAFTS draft changeset(s) from chat"

# 4. Accept changeset → triggers alignment-check workflow via app.changeset.accepted
CS_ID=$(curl -sf -H "$H_AUTH" \
  "$BASE/api/projects/$PROJECT/changesets?status=draft" | jq -r '.[0].id')
curl -sf -X POST -H "$H_AUTH" "$BASE/api/changesets/$CS_ID/accept" > /dev/null
echo "✓ Changeset accepted (alignment-check workflow triggered)"

# 5. Wait for alignment agent → poll for new questions
for i in $(seq 1 12); do
  QUESTIONS=$(curl -sf -H "$H_AUTH" \
    "$BASE/api/projects/$PROJECT/questions?status=open" | jq length)
  if [ "$QUESTIONS" -gt 0 ]; then
    echo "✓ $QUESTIONS open question(s) from alignment (after $((i * 5))s)"
    break
  fi
  sleep 5
done

# 6. Answer question via evolve → triggers question-evolution workflow
if [ "${QUESTIONS:-0}" -gt 0 ]; then
  Q_ID=$(curl -sf -H "$H_AUTH" \
    "$BASE/api/projects/$PROJECT/questions?status=open" | jq -r '.[0].id')
  curl -sf -X POST -H "$H_AUTH" -H "$H_JSON" \
    -d '{"answer":"Yes, require admin approval for all new accounts"}' \
    "$BASE/api/questions/$Q_ID/evolve" > /dev/null
  echo "✓ Question answered + evolve triggered"

  # 7. Wait for question-evolution → poll for new changeset
  for i in $(seq 1 12); do
    NEW_DRAFTS=$(curl -sf -H "$H_AUTH" \
      "$BASE/api/projects/$PROJECT/changesets?status=draft" | jq length)
    if [ "$NEW_DRAFTS" -gt 0 ]; then
      echo "✓ $NEW_DRAFTS new draft changeset(s) from question evolution (after $((i * 5))s)"
      break
    fi
    sleep 5
  done
fi

# Cleanup
curl -sf -X DELETE -H "$H_AUTH" "$BASE/api/projects/$PROJECT" > /dev/null
echo "✓ Cleanup done"

echo "=== Phase 3 staging smoke tests passed ==="
```

#### Playwright E2E (`tests/e2e/phase3.spec.ts`)

Full browser-driven test suite against staging. Requires:
```bash
npx playwright install chromium
```

```typescript
// tests/e2e/phase3.spec.ts — Phase 3 E2E against staging sandbox
import { test, expect } from '@playwright/test';

const BASE = `https://eden-app.${process.env.ORG_SLUG}-eden-sandbox.eh1.incept5.dev`;

test.describe('Phase 3 — Intelligence Layer', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate via stored token
    await page.goto(BASE);
    await page.evaluate((token) => {
      localStorage.setItem('eve_token', token);
    }, process.env.TOKEN);
    await page.reload();
  });

  test('V3.7 — Cross-cutting questions panel opens', async ({ page }) => {
    await page.goto(`${BASE}/projects/test-project/map`);
    await page.click('[data-testid="cross-cutting-qs-btn"]');
    const panel = page.locator('[data-testid="cross-cutting-panel"]');
    await expect(panel).toBeVisible();
    // Red theme applied
    await expect(panel).toHaveCSS('border-color', /ef4444|rgb\(239, 68, 68\)/);
  });

  test('V3.8 — Question modal opens from task card', async ({ page }) => {
    await page.goto(`${BASE}/projects/test-project/map`);
    // Click a question pill on a task card
    await page.click('[data-testid="question-pill"]');
    const modal = page.locator('[data-testid="question-modal"]');
    await expect(modal).toBeVisible();
    await expect(modal.locator('[data-testid="evolve-btn"]')).toBeVisible();
  });

  test('V3.8b — Evolve Map button triggers evolution', async ({ page }) => {
    await page.goto(`${BASE}/projects/test-project/map`);
    await page.click('[data-testid="question-pill"]');
    const modal = page.locator('[data-testid="question-modal"]');
    await modal.locator('textarea').fill('Yes, add guest checkout support');
    await modal.locator('[data-testid="evolve-btn"]').click();
    // Toast confirms evolution triggered
    await expect(page.locator('[data-testid="toast"]')).toContainText(/evolve|triggered/i);
  });

  test('V3.9 — Chat panel opens and sends message', async ({ page }) => {
    await page.goto(`${BASE}/projects/test-project/map`);
    await page.click('[data-testid="chat-toggle-btn"]');
    const panel = page.locator('[data-testid="chat-panel"]');
    await expect(panel).toBeVisible();

    // Send a message
    await panel.locator('[data-testid="chat-input"]').fill('What tasks are in the onboarding flow?');
    await panel.locator('[data-testid="chat-send-btn"]').click();

    // Typing indicator appears
    await expect(panel.locator('[data-testid="typing-indicator"]')).toBeVisible();

    // Wait for AI response (up to 60s)
    const aiMessage = panel.locator('[data-testid="chat-message-ai"]').first();
    await expect(aiMessage).toBeVisible({ timeout: 60_000 });
  });

  test('V3.11 — Chat response with changeset link opens review modal', async ({ page }) => {
    await page.goto(`${BASE}/projects/test-project/map`);
    await page.click('[data-testid="chat-toggle-btn"]');
    const panel = page.locator('[data-testid="chat-panel"]');

    // Request a map edit (should produce changeset)
    await panel.locator('[data-testid="chat-input"]').fill('Add a password reset flow');
    await panel.locator('[data-testid="chat-send-btn"]').click();

    // Wait for response with changeset link
    const changesetBtn = panel.locator('[data-testid="review-changeset-btn"]');
    await expect(changesetBtn).toBeVisible({ timeout: 90_000 });

    // Click opens the existing ChangesetReviewModal
    await changesetBtn.click();
    await expect(page.locator('[data-testid="changeset-review-modal"]')).toBeVisible();
  });

  test('V3.1 — Changes page shows agent-created changesets', async ({ page }) => {
    await page.goto(`${BASE}/projects/test-project/changes`);
    // Should have changesets with source "map-chat" or "expert-panel"
    const rows = page.locator('[data-testid="changeset-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });
  });
});
```

### Pipeline Update

Add Phase 3 smoke test to the deploy pipeline in `.eve/manifest.yaml`:

```yaml
pipelines:
  deploy:
    steps:
      # ... existing steps ...
      - name: smoke-test-p3
        depends_on: [smoke-test-p2]
        script:
          run: ./scripts/smoke-test-p3.sh
          timeout: 600    # Longer — waits for AI agent responses
```

---

## Acceptance Criteria

| # | Scenario | Tier | Steps | Expected |
|---|----------|------|-------|----------|
| **V3.0** | Event emission | Local | Accept changeset, check API logs | `app.changeset.accepted` logged to stdout |
| **V3.1** | Map chat — add structure | Staging | Chat: "add a mobile onboarding flow" | Coordinator → map-chat agent → changeset with activity + steps + tasks |
| **V3.2** | Map chat — modify | Staging | Chat: "add guest checkout to checkout task" | Changeset with updated ACs on existing task |
| **V3.3** | Map chat — query | Staging | Chat: "what happens after registration?" | Descriptive response, no changeset created |
| **V3.4** | Alignment — conflict | Staging | Accept changeset with contradictory ACs | `app.changeset.accepted` → alignment-check → question referencing conflicting tasks |
| **V3.5** | Alignment — gap | Staging | Map with activity missing persona coverage | Alignment detects gap → question with `category: 'gap'` |
| **V3.6** | Question evolution | Staging | Answer question + click Evolve Map | `app.question.answered` → question-evolution → changeset proposed |
| **V3.7** | Cross-cutting panel | Playwright | Click "Cross-Cutting Qs" button | Panel slides in with red-themed cards grouped by category |
| **V3.8** | Question modal | Playwright | Click question pill on task card | Modal with question, metadata, textarea, Evolve Map button |
| **V3.9** | Chat SSE | Playwright | Send message in chat | Typing indicator → streamed AI response |
| **V3.10** | Expert panel → changeset | Staging | Slack: `@eve pm review this` + PDF | Expert panel → synthesis → changeset in Changes sidebar |
| **V3.11** | Chat ↔ changeset link | Playwright | Chat response includes "Review Changeset #N" | Click opens ChangesetReviewModal |
| **V3.12** | Full cycle | Staging | Answer question → evolve → accept → alignment → new question | Complete autonomous loop verified |
| **V3.13** | Evolve endpoint | Local | `POST /questions/:id/evolve` with answer | Returns question with `status: 'answered'`, event logged |
| **V3.14** | Chat 503 locally | Local | `GET /projects/:id/chat/threads` | Returns 503 (Eve not available) |
| **V3.15** | Storm prevention | Staging | Alignment creates question → evolve → accept changeset | Alignment does NOT re-raise the same question |
| **V3.16** | Chat markdown | Playwright | AI responds with list + code block | Message renders markdown with styled lists and monospace code block |
| **V3.17** | AI modified card | Playwright | Accept AI changeset, view map | Affected cards show purple left border (ai-modified) |
| **V3.18** | AI added card | Playwright | Accept AI changeset that creates tasks, view map | New cards show green left border (ai-added) |
| **V3.19** | Evolved badge | Playwright | Accept AI changeset | Header shows green "EVOLVED" badge |
| **V3.20** | Question flash nav | Playwright | Open question modal, click reference tag | Modal closes, map scrolls to entity with orange flash animation |

---

## Exit Criteria

Phase 3 is complete when:

- [ ] `app.changeset.accepted` and `app.question.answered` events emitted (V3.0)
- [ ] Map Chat agent creates meaningful changesets from natural language (V3.1, V3.2)
- [ ] Map Chat agent answers queries without creating changesets (V3.3)
- [ ] Coordinator correctly triages: map edits → map-chat, alignment → alignment agent
- [ ] Web chat panel works with SSE streaming + markdown rendering (V3.9, V3.16)
- [ ] Alignment agent detects conflicts, gaps, duplicates after changeset acceptance (V3.4, V3.5)
- [ ] Question agent proposes map changes from answered questions (V3.6)
- [ ] Expert panel → changeset flow works (V3.10)
- [ ] Cross-cutting questions panel renders correctly (V3.7)
- [ ] Question modal with "Evolve Map" triggers question-evolution workflow (V3.8)
- [ ] AI modification indicators (purple/green borders) appear on affected cards (V3.17, V3.18)
- [ ] "EVOLVED" badge shows in header after AI changeset acceptance (V3.19)
- [ ] Question reference tags navigate with flash animation (V3.20)
- [ ] Full autonomous loop works without storms (V3.12, V3.15)
- [ ] Local smoke test passes (`scripts/smoke-test-local-p3.sh`)
- [ ] Staging smoke test passes (`scripts/smoke-test-p3.sh`)
- [ ] Playwright E2E passes (`tests/e2e/phase3.spec.ts`)

---

## Risks

| Risk | Mitigation |
|------|-----------|
| Map Chat agent makes low-quality proposals | Iterate on skill with real map data; always read current map before proposing |
| Alignment agent produces too many false positives | Tune detection thresholds; add confidence scoring; deduplicate against recent questions |
| Alignment storm (accept → align → question → evolve → accept → align...) | Filter workflow trigger by changeset `source` — skip alignment for changesets from `question-evolution` and `alignment` agents. Add 24h dedup window in alignment skill |
| SSE stream reliability | Exponential backoff reconnect in SPA; heartbeat events from Eve |
| Coordinator triage accuracy for new categories | Test with diverse inputs; fallback to solo response for ambiguous requests |
| Chat endpoints unavailable locally | Return 503 with clear message; document in CLAUDE.md testing strategy section |
| Eve Gateway API changes | Pin to known Eve API version; integration tests on staging catch regressions |
