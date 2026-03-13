# Eden Phase 2 — Changeset System & Ingestion Pipeline

> **Status**: Proposed
> **Date**: 2026-03-12
> **Phase**: 2 of 5
> **Depends on**: Phase 1 (Foundation & Story Map)
> **Parent plan**: `eden-evolution.md`
> **Estimated effort**: 3–4 weeks
>
> **Delivers**: The core AI loop — upload a document, AI extracts requirements,
> proposes a changeset, user reviews and accepts, map updates. This is the
> feature that transforms Eden from a manual mapping tool into an AI-powered
> requirements platform.

---

## Scope

### What Ships

1. **Schema migration** — extends Phase 1 placeholder tables with columns
   required for changeset apply logic and per-item review.
2. **Changeset system** — data model, CRUD API, apply logic (transactional),
   per-item accept/reject, audit trail.
3. **Changeset review UI** — modal with summary, bulk actions, per-item cards
   with type icons (blue=modify, green=add, amber=resolve), diff view.
4. **3 new agents** — ingestion, extraction, synthesis — with skills and
   agent definitions in `eve/agents.yaml`.
5. **Ingestion pipeline workflow** — 3-step job DAG triggered by
   `system.doc.ingest`, declared in `eve/workflows.yaml` (replaces Phase 1
   `pm-review` workflow).
6. **File upload** — Eve ingest integration (presigned upload, confirm,
   `system.doc.ingest` event).
7. **Sources UI** — upload zone (drag-and-drop), source list with processing
   status indicators.
8. **Eve events service** — NestJS service that emits `app.*` events to Eve's
   event spine.

### What Does NOT Ship

- No map chat (Phase 3).
- No alignment detection or question evolution (Phase 3).
- No coordinator changes (Phase 3).
- No web chat UI (Phase 3).

---

## Prerequisites

- Phase 1 complete — CRUD API, DB schema, SPA with story map, staging deploy.
- Eve platform features available:
  - `system.doc.ingest` event on ingest confirm
  - Workflow job graphs with `depends_on`
  - Server-side `with_apis` for agent → app API access
  - `ingest://` resource hydration in agent prompts

---

## Implementation Steps

### 2a-0. Schema Migration (Small)

The Phase 1 foundation created placeholder tables for `ingestion_sources`,
`changesets`, and `changeset_items`. Phase 2 extends them with the columns
needed for the full changeset lifecycle.

**New migration**: `db/migrations/20260313000000_phase2_changesets.sql`

```sql
-- ingestion_sources: add Eve ingest tracking + error reporting
ALTER TABLE ingestion_sources
  ADD COLUMN content_type   TEXT,
  ADD COLUMN eve_ingest_id  TEXT,
  ADD COLUMN eve_job_id     TEXT,
  ADD COLUMN file_size      BIGINT,
  ADD COLUMN error_message  TEXT;

-- Fix default: plan uses 'uploaded' not 'pending'
ALTER TABLE ingestion_sources
  ALTER COLUMN status SET DEFAULT 'uploaded';

-- changesets: link to source + track actor
ALTER TABLE changesets
  ADD COLUMN source_id UUID REFERENCES ingestion_sources(id) ON DELETE SET NULL,
  ADD COLUMN actor     TEXT;

-- changeset_items: per-item status for partial review + human-readable fields
ALTER TABLE changeset_items
  ADD COLUMN status            TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN description       TEXT,
  ADD COLUMN display_reference TEXT;

CREATE INDEX idx_changeset_items_changeset ON changeset_items (changeset_id);
CREATE INDEX idx_changesets_project_status ON changesets (project_id, status);
CREATE INDEX idx_ingestion_sources_project_status ON ingestion_sources (project_id, status);
```

### 2a. Changeset API + Apply Logic (Medium)

The changeset system is the safety mechanism. All AI writes go through here.

**Endpoints:**

```
GET    /api/projects/:id/changesets           # List (filterable by status, source)
POST   /api/projects/:id/changesets           # Create (agent or user)
GET    /api/changesets/:id                    # Detail (with items + before/after)
POST   /api/changesets/:id/accept             # Accept all → apply to map
POST   /api/changesets/:id/reject             # Reject all
POST   /api/changesets/:id/review             # Partial: per-item accept/reject
```

**Apply logic** (`changesets.service.ts`):

```typescript
// Within a single DB transaction:
// 1. Lock the changeset row
// 2. For each accepted item:
//    - resolve references (display_ids → UUIDs, activity names → IDs)
//    - validate the operation (create/update/delete/move)
//    - execute the DB operation
//    - write audit_log entry
// 3. Update changeset status (accepted/rejected/partial)
// 4. Emit app.changeset.accepted event (if any items accepted)
```

**Reference resolution**: Agents create changesets using human-readable IDs
(`TSK-1.2.1`, `ACT-3`) and entity names. The backend resolves these to UUIDs
before applying. This keeps agent prompts clean and avoids UUID leakage.

### 2b. Changeset Review UI (Medium)

Centered modal (680px wide) following Ade's prototype patterns:

```
components/changesets/
  ChangesetList.tsx              # Pending, accepted, rejected tabs
  ChangesetReviewModal.tsx       # Summary, bulk actions, item cards
  ChangesetItem.tsx              # Per-item: type icon, description, accept/reject, diff
```

**Change type icons:**
- Blue (`#3b82f6`) = modify existing entity
- Green (`#10b981`) = add new entity
- Amber (`#f59e0b`) = resolve question

**Per-item diff view**: Expandable before/after with colored additions (green)
and deletions (red). For creates, show only the proposed state.

**Sidebar entry**: "Changes" in left nav. Badge shows pending changeset count.

### 2c. Ingestion Agent (Small)

```yaml
# eve/agents.yaml addition
ingestion:
  slug: ingestion
  skill: ingestion
  harness_profile: expert
  gateway:
    policy: none
  policies:
    permission_policy: auto_edit
    git:
      commit: never
      push: never
```

**Skill** (`skills/ingestion/SKILL.md`):
- Receives hydrated `ingest://` file as input
- Detects file type (PDF, DOCX, PPTX, images, audio, video, text)
- Extracts raw content using available tools
- Outputs structured text with page/slide/timestamp markers
- Handles multi-modal: Claude Vision for images, transcription for audio

### 2d. Extraction Agent (Medium)

```yaml
extraction:
  slug: extraction
  skill: extraction
  harness_profile: expert
  gateway:
    policy: none
  policies:
    permission_policy: auto_edit
    git:
      commit: never
      push: never
```

**Skill** (`skills/extraction/SKILL.md`):
- Receives raw extracted text from ingestion step
- Identifies: personas, activities, steps, tasks, user stories, acceptance
  criteria, questions, cross-cutting questions
- Outputs structured JSON matching the extraction schema from `eden-evolution.md`
- Includes source mappings (task → source excerpt) for traceability

**Output schema** (validated by synthesis agent):

```json
{
  "personas": [{ "code": "...", "name": "...", "description": "...", "device": "..." }],
  "activities": [{
    "name": "...",
    "steps": [{
      "name": "...",
      "tasks": [{
        "title": "...", "user_story": "...",
        "acceptance_criteria": [{ "text": "Given...When...Then..." }],
        "persona": "...", "device": "...", "priority": "..."
      }]
    }]
  }],
  "questions": [{ "question": "...", "context": "...", "references": ["..."], "priority": "...", "category": "..." }],
  "cross_cutting_questions": [{ "question": "...", "references": ["..."], "priority": "...", "category": "..." }],
  "source_mappings": [{ "task": "...", "excerpt": "..." }]
}
```

### 2e. Synthesis Agent (Medium)

```yaml
synthesis:
  slug: synthesis
  skill: synthesis
  harness_profile: coordinator
  context:
    memory:
      agent: shared
      categories: [decisions, conventions, context]
      max_items: 20
    threads:
      coordination: true
      max_messages: 30
  gateway:
    policy: none
  policies:
    permission_policy: auto_edit
    git:
      commit: never
      push: never
```

**Skill** (`skills/synthesis/SKILL.md`):
- Receives extracted requirements JSON from extraction step
- Reads current map state via `GET /api/projects/:id/map` (using `with_apis`)
- Decides for each extracted entity: match, new, conflict, or duplicate
- Creates a single changeset via `POST /api/projects/:id/changesets`
- Includes reasoning for each item
- References entities by human-readable display_id

### 2f. Ingestion Pipeline Workflow (Small)

**Important**: The Phase 1 `pm-review` workflow already triggers on
`system.doc.ingest`. Phase 2 **replaces** it with the 3-step
`ingestion-pipeline`. Remove `pm-review` from `eve/workflows.yaml` to avoid
both workflows firing on every upload.

```yaml
# eve/workflows.yaml — replace pm-review with:
ingestion-pipeline:
  trigger:
    system:
      event: doc.ingest
  with_apis:
    - service: api
      description: Eden Story Map API for reading map state and creating changesets
  steps:
    - name: ingest
      agent:
        name: ingestion
    - name: extract
      depends_on: [ingest]
      agent:
        name: extraction
    - name: synthesize
      depends_on: [extract]
      agent:
        name: synthesis
  timeout: 900
```

Three-step job DAG: ingest → extract → synthesize. Each step runs as an
independent Eve job with `depends_on` edges. Context and structured outputs
carry forward through step edges. Visible in Eve's job tree views.

### 2g. Source Upload + Eve Ingest Integration (Medium)

**API endpoints:**

```
POST   /api/projects/:id/sources         # Create source + Eve ingest session
POST   /api/sources/:id/confirm           # Confirm upload → triggers pipeline
GET    /api/projects/:id/sources          # List sources (paginated)
GET    /api/sources/:id                   # Source detail (with processing status)
```

**Upload flow:**

```
Browser → POST /api/projects/:id/sources
  → NestJS creates Eve ingest record (POST /projects/{eve_id}/ingest)
  → Eve returns ingest_id + presigned upload URL
  → NestJS creates ingestion_sources row (status: uploaded)
  → Returns source_id + upload URL to browser

Browser → PUT upload URL (direct to object store)
Browser → POST /api/sources/:id/confirm
  → NestJS confirms with Eve (POST /projects/{eve_id}/ingest/{id}/confirm)
  → Eve emits system.doc.ingest → triggers ingestion-pipeline workflow
  → NestJS updates source status to 'processing'
```

### 2h. Sources UI (Small)

```
components/sources/
  SourceList.tsx            # File list with status badges
  UploadZone.tsx            # Drag-and-drop with progress bar
```

**Status badges**: uploaded → processing → extracted → synthesized → failed.
Each status maps to a color (gray → blue → amber → green → red).

Upload zone accepts: PDF, DOCX, PPTX, images (PNG/JPG), audio (MP3/WAV/M4A),
video (MP4), Markdown, CSV, JSON, YAML.

**Sidebar entry**: "Sources" in left nav.

### 2i. Eve Events Service (Small)

```typescript
// common/eve-events.service.ts
@Injectable()
export class EveEventsService {
  async emit(event: string, payload: Record<string, unknown>) {
    // POST /projects/{eve_project_id}/events
    // { event, payload }
    // Uses service credentials (EVE_API_URL + service token)
  }
}
```

Events emitted by the NestJS backend:
- `app.changeset.accepted` — when a changeset is accepted (used in Phase 3)
- `app.question.answered` — when a question is answered (used in Phase 3)

---

## Verification Loop

Verification proceeds in two stages: local Docker first, then staging sandbox.

### Stage 1 — Local Docker Verification

Exercises all Phase 2 API logic against the local DB without requiring Eve
agents or ingest integration. Validates changeset CRUD, apply logic, source
endpoints, and reference resolution before touching staging.

```bash
# Start local stack (db + migrate)
docker compose up -d
# Wait for migration
docker compose logs -f migrate

# Run local verification
./scripts/smoke-test-local-p2.sh
```

**`scripts/smoke-test-local-p2.sh`** — tests against `http://localhost:3000`:

```bash
#!/bin/bash
set -euo pipefail
API="http://localhost:3000"

echo "=== Phase 2 Local: Changeset CRUD + Apply ==="

# Setup: create project with map entities
PROJECT=$(curl -sf -X POST -H "Content-Type: application/json" \
  -d '{"name":"P2 Test","slug":"p2-test"}' "$API/projects" | jq -r .id)

ACT=$(curl -sf -X POST -H "Content-Type: application/json" \
  -d '{"name":"Auth","display_id":"ACT-1","sort_order":1}' \
  "$API/projects/$PROJECT/activities" | jq -r .id)

STEP=$(curl -sf -X POST -H "Content-Type: application/json" \
  -d '{"name":"Login","display_id":"STP-1.1","sort_order":1}' \
  "$API/activities/$ACT/steps" | jq -r .id)

echo "✓ Map scaffold created"

# 1. Create changeset with items
CS=$(curl -sf -X POST -H "Content-Type: application/json" \
  -d '{
    "title":"Ingestion: roadmap.pdf",
    "reasoning":"Extracted 3 tasks from uploaded roadmap",
    "source":"agent:synthesis",
    "items":[
      {"entity_type":"task","operation":"create",
       "after_state":{"title":"SSO Login","display_id":"TSK-1.1.1",
         "user_story":"As a user I want SSO","priority":"high"},
       "description":"New task from roadmap","display_reference":"TSK-1.1.1"},
      {"entity_type":"task","operation":"create",
       "after_state":{"title":"Password Reset","display_id":"TSK-1.1.2",
         "user_story":"As a user I want to reset password","priority":"medium"},
       "description":"New task from roadmap","display_reference":"TSK-1.1.2"},
      {"entity_type":"question","operation":"create",
       "after_state":{"question":"Should SSO support SAML?","priority":"high",
         "category":"security"},
       "description":"Open question from roadmap"}
    ]
  }' "$API/projects/$PROJECT/changesets")
CS_ID=$(echo $CS | jq -r .id)
echo "✓ Changeset created: $CS_ID"

# 2. List changesets
COUNT=$(curl -sf "$API/projects/$PROJECT/changesets?status=draft" | jq length)
[ "$COUNT" -ge 1 ] && echo "✓ Changeset list: $COUNT pending"

# 3. Get changeset detail
ITEMS=$(curl -sf "$API/changesets/$CS_ID" | jq '.items | length')
[ "$ITEMS" -eq 3 ] && echo "✓ Changeset detail: $ITEMS items"

# 4. Partial review: accept first 2, reject last
curl -sf -X POST -H "Content-Type: application/json" \
  -d "$(curl -sf "$API/changesets/$CS_ID" | jq '{
    decisions: [.items[:2][] | {id: .id, status: "accepted"}] +
               [.items[2:3][] | {id: .id, status: "rejected"}]
  }')" "$API/changesets/$CS_ID/review" > /dev/null
echo "✓ Partial review applied"

# 5. Verify changeset status is now 'partial'
STATUS=$(curl -sf "$API/changesets/$CS_ID" | jq -r .status)
[ "$STATUS" = "partial" ] && echo "✓ Changeset status: partial"

# 6. Verify accepted items created entities on map
MAP=$(curl -sf "$API/projects/$PROJECT/map")
TASK_COUNT=$(echo $MAP | jq '.stats.tasks')
[ "$TASK_COUNT" -ge 2 ] && echo "✓ Map has $TASK_COUNT tasks after apply"

# 7. Create + accept-all changeset
CS2=$(curl -sf -X POST -H "Content-Type: application/json" \
  -d '{
    "title":"Bulk accept test","reasoning":"Testing accept-all",
    "source":"user",
    "items":[
      {"entity_type":"task","operation":"create",
       "after_state":{"title":"Bulk task","display_id":"TSK-1.1.3",
         "user_story":"Bulk test","priority":"low"},
       "description":"Bulk test task","display_reference":"TSK-1.1.3"}
    ]
  }' "$API/projects/$PROJECT/changesets" | jq -r .id)
curl -sf -X POST "$API/changesets/$CS2/accept" > /dev/null
CS2_STATUS=$(curl -sf "$API/changesets/$CS2" | jq -r .status)
[ "$CS2_STATUS" = "accepted" ] && echo "✓ Accept-all works"

# 8. Create + reject-all changeset
CS3=$(curl -sf -X POST -H "Content-Type: application/json" \
  -d '{
    "title":"Reject test","reasoning":"Testing reject-all",
    "source":"user",
    "items":[
      {"entity_type":"task","operation":"create",
       "after_state":{"title":"Rejected task","display_id":"TSK-1.1.4",
         "user_story":"Should not appear","priority":"low"},
       "description":"Will be rejected","display_reference":"TSK-1.1.4"}
    ]
  }' "$API/projects/$PROJECT/changesets" | jq -r .id)
curl -sf -X POST "$API/changesets/$CS3/reject" > /dev/null
CS3_STATUS=$(curl -sf "$API/changesets/$CS3" | jq -r .status)
[ "$CS3_STATUS" = "rejected" ] && echo "✓ Reject-all works"

# Cleanup
curl -sf -X DELETE "$API/projects/$PROJECT" > /dev/null
echo "✓ Cleanup done"

echo "=== All Phase 2 local tests passed ==="
```

**Gate**: Do NOT deploy to staging until local smoke test passes.

### Stage 2 — Staging Sandbox Deployment

After local verification, deploy to Eve sandbox and run the full pipeline
including Eve agents, ingest integration, and workflow execution.

```bash
# Sync manifest + agents (includes 3 new agents + ingestion-pipeline workflow)
eve project sync --dir .
eve agents sync --project eden --local --allow-dirty
eve env deploy sandbox --ref main --repo-dir . --watch --timeout 300
```

### Acceptance Criteria

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| **V2.1** | Upload PDF | Drag roadmap.pdf onto Sources page | Upload progress → source appears with "uploaded" status |
| **V2.2** | Ingestion triggers | Confirm upload | Source status changes: uploaded → processing. Eve job tree shows: root workflow → ingest → extract → synthesize |
| **V2.3** | Pipeline completes | Wait for 3-step DAG | Source status: synthesized. Changeset appears in Changes sidebar (status: pending) |
| **V2.4** | Changeset review | Open changeset detail | Modal shows: summary, reasoning, N items with type icons. Each item has before/after state |
| **V2.5** | Accept all | Click "Accept All" | All items applied to map. Changeset status: accepted. New tasks/activities visible on story map |
| **V2.6** | Partial review | Create new changeset, accept 3 items, reject 2 | Accepted items on map, rejected items marked. Changeset status: partial. Per-item status visible |
| **V2.7** | Source traceability | Click a task created by ingestion | Task detail shows source_id link back to the uploaded file |
| **V2.8** | Job tree visibility | `eve job tree <workflow-job-id>` | Shows: root → ingest (done) → extract (done) → synthesize (done) |
| **V2.9** | Error handling | Upload a corrupt file | Ingestion agent fails gracefully. Source status: failed. error_message populated. No changeset created |
| **V2.10** | Events emitted | Accept a changeset | `app.changeset.accepted` event emitted (verify via Eve logs: `eve system logs api`) |

### Staging Smoke Test (`scripts/smoke-test-p2.sh`)

Runs as a deploy pipeline step after Phase 1 smoke test passes. Uses the
same `$BASE` URL pattern through nginx (not direct API access).

```bash
#!/bin/bash
# scripts/smoke-test-p2.sh — Phase 2 staging validation
set -euo pipefail
BASE="https://eden.${ORG_SLUG}-eden-sandbox.eh1.incept5.dev"
H_AUTH="Authorization: Bearer $TOKEN"
H_JSON="Content-Type: application/json"

echo "=== Phase 2 Smoke: Changeset CRUD ==="

# Create project + map scaffold
PROJECT=$(curl -sf -X POST -H "$H_AUTH" -H "$H_JSON" \
  -d '{"name":"P2 Smoke","slug":"p2-smoke"}' \
  "$BASE/api/projects" | jq -r .id)

ACT=$(curl -sf -X POST -H "$H_AUTH" -H "$H_JSON" \
  -d '{"name":"Feature","display_id":"ACT-1","sort_order":1}' \
  "$BASE/api/projects/$PROJECT/activities" | jq -r .id)

STEP=$(curl -sf -X POST -H "$H_AUTH" -H "$H_JSON" \
  -d '{"name":"Step 1","display_id":"STP-1.1","sort_order":1}' \
  "$BASE/api/activities/$ACT/steps" | jq -r .id)

echo "✓ Map scaffold created"

# 1. Create changeset
CS=$(curl -sf -X POST -H "$H_AUTH" -H "$H_JSON" \
  -d '{
    "title":"Smoke test changeset",
    "reasoning":"Automated staging verification",
    "source":"smoke-test",
    "items":[
      {"entity_type":"task","operation":"create",
       "after_state":{"title":"Smoke task","display_id":"TSK-1.1.1",
         "user_story":"Smoke test","priority":"medium"},
       "description":"Smoke test task","display_reference":"TSK-1.1.1"}
    ]
  }' "$BASE/api/projects/$PROJECT/changesets")
CS_ID=$(echo $CS | jq -r .id)
echo "✓ Changeset created: $CS_ID"

# 2. List + detail
curl -sf -H "$H_AUTH" "$BASE/api/projects/$PROJECT/changesets" | jq length
curl -sf -H "$H_AUTH" "$BASE/api/changesets/$CS_ID" | jq '.items | length'
echo "✓ Changeset list + detail work"

# 3. Accept
curl -sf -X POST -H "$H_AUTH" "$BASE/api/changesets/$CS_ID/accept" > /dev/null
echo "✓ Changeset accepted"

# 4. Verify map updated
TASKS=$(curl -sf -H "$H_AUTH" "$BASE/api/projects/$PROJECT/map" | jq '.stats.tasks')
[ "$TASKS" -ge 1 ] && echo "✓ Map has $TASKS tasks after apply"

# 5. Source list endpoint
curl -sf -H "$H_AUTH" "$BASE/api/projects/$PROJECT/sources" | jq length
echo "✓ Sources endpoint works"

# Cleanup
curl -sf -X DELETE -H "$H_AUTH" "$BASE/api/projects/$PROJECT" > /dev/null
echo "✓ Cleanup done"

echo "=== Phase 2 smoke tests passed ==="
```

### Full E2E Pipeline Test (Manual — requires live Eve agents)

Exercises the complete upload → ingest → extract → synthesize → review flow.
Run manually after agent skills are deployed and verified (~2-5 min runtime).

**Prerequisite**: `test-fixtures/roadmap.pdf` — create with:
`mkdir -p test-fixtures && cp <your-doc> test-fixtures/roadmap.pdf`

```bash
#!/bin/bash
# scripts/e2e-p2-pipeline.sh — Full pipeline E2E (manual, requires live agents)
set -euo pipefail
BASE="https://eden.${ORG_SLUG}-eden-sandbox.eh1.incept5.dev"
H_AUTH="Authorization: Bearer $TOKEN"
H_JSON="Content-Type: application/json"

echo "=== Phase 2 E2E: Upload → Extract → Changeset → Accept ==="

# 1. Create upload session
SOURCE=$(curl -sf -X POST -H "$H_AUTH" -H "$H_JSON" \
  -d '{"filename":"roadmap.pdf","content_type":"application/pdf"}' \
  "$BASE/api/projects/$PROJECT_ID/sources")
SOURCE_ID=$(echo $SOURCE | jq -r .id)
UPLOAD_URL=$(echo $SOURCE | jq -r .upload_url)
echo "✓ Source created: $SOURCE_ID"

# 2. Upload file (direct to presigned URL)
curl -sf -X PUT -T test-fixtures/roadmap.pdf "$UPLOAD_URL"
echo "✓ File uploaded"

# 3. Confirm → triggers ingestion-pipeline workflow
curl -sf -X POST -H "$H_AUTH" \
  "$BASE/api/sources/$SOURCE_ID/confirm" > /dev/null
echo "✓ Upload confirmed, pipeline triggered"

# 4. Poll source status until synthesized (max 5 min)
for i in $(seq 1 60); do
  STATUS=$(curl -sf -H "$H_AUTH" \
    "$BASE/api/sources/$SOURCE_ID" | jq -r .status)
  echo "  [$((i * 5))s] status: $STATUS"
  if [ "$STATUS" = "synthesized" ]; then
    echo "✓ Pipeline complete after $((i * 5))s"
    break
  elif [ "$STATUS" = "failed" ]; then
    ERROR=$(curl -sf -H "$H_AUTH" \
      "$BASE/api/sources/$SOURCE_ID" | jq -r .error_message)
    echo "✗ Pipeline failed: $ERROR"
    exit 1
  fi
  sleep 5
done

# 5. Check changeset was created
CHANGESETS=$(curl -sf -H "$H_AUTH" \
  "$BASE/api/projects/$PROJECT_ID/changesets?status=pending" | jq length)
[ "$CHANGESETS" -ge 1 ] || { echo "✗ No changesets created"; exit 1; }
echo "✓ $CHANGESETS pending changeset(s)"

# 6. Inspect changeset items
CS_ID=$(curl -sf -H "$H_AUTH" \
  "$BASE/api/projects/$PROJECT_ID/changesets?status=pending" | jq -r '.[0].id')
ITEMS=$(curl -sf -H "$H_AUTH" "$BASE/api/changesets/$CS_ID" | jq '.items | length')
echo "✓ Changeset has $ITEMS items"

# 7. Accept the changeset
curl -sf -X POST -H "$H_AUTH" \
  "$BASE/api/changesets/$CS_ID/accept" > /dev/null
echo "✓ Changeset accepted"

# 8. Verify map updated
TASKS=$(curl -sf -H "$H_AUTH" \
  "$BASE/api/projects/$PROJECT_ID/map" | jq '.stats.tasks')
echo "✓ Map now has $TASKS tasks"

# 9. Verify job tree (optional, requires eve CLI)
if command -v eve &>/dev/null; then
  JOB_ID=$(curl -sf -H "$H_AUTH" \
    "$BASE/api/sources/$SOURCE_ID" | jq -r .eve_job_id)
  if [ "$JOB_ID" != "null" ]; then
    eve job tree "$JOB_ID" 2>/dev/null || echo "  (job tree unavailable)"
  fi
fi

echo "=== Phase 2 E2E passed ==="
```

### Pipeline Integration

Update `.eve/manifest.yaml` to chain Phase 2 smoke test after Phase 1:

```yaml
pipelines:
  deploy:
    steps:
      # ... existing steps ...
      - name: smoke-test
        depends_on: [migrate]
        script:
          run: ./scripts/smoke-test.sh
          timeout: 300
      - name: smoke-test-p2
        depends_on: [smoke-test]
        script:
          run: ./scripts/smoke-test-p2.sh
          timeout: 300
```

---

## Exit Criteria

Phase 2 is complete when:

- [ ] Schema migration applies cleanly (local Docker + staging)
- [ ] Changeset create/list/detail/accept/reject/partial all work correctly
- [ ] Changeset apply executes within a single transaction with audit logging
- [ ] Per-item accept/reject with status tracking works (V2.6)
- [ ] 3 agents (ingestion, extraction, synthesis) synced and functional
- [ ] `pm-review` workflow removed; `ingestion-pipeline` triggers on `system.doc.ingest`
- [ ] File upload via presigned URL works end-to-end
- [ ] Pipeline processes PDF and produces a meaningful changeset
- [ ] Changeset review UI renders with correct type icons and diff view
- [ ] Source status tracks through full lifecycle (uploaded → synthesized)
- [ ] `app.changeset.accepted` event emits correctly
- [ ] Local smoke test passes (`scripts/smoke-test-local-p2.sh`)
- [ ] Staging smoke test passes in deploy pipeline (`scripts/smoke-test-p2.sh`)
- [ ] Full E2E pipeline test passes on staging (`scripts/e2e-p2-pipeline.sh`)

---

## Risks

| Risk | Mitigation |
|------|-----------|
| Extraction quality varies by document type | Start with PDF + DOCX; test with real roadmap docs early |
| Pipeline timeout (900s) may not suffice for large docs | Monitor job durations in staging; adjust timeout per step |
| Synthesis agent creates low-quality changesets | Include map context in prompt; iterate on skill with real outputs |
| `with_apis` not yet available | Validate Eve platform feature availability before starting 2e |
| Changeset apply race conditions | Use `SELECT ... FOR UPDATE` on changeset row; single-writer pattern |
| Dual workflow trigger on `doc.ingest` | Remove `pm-review` before deploying `ingestion-pipeline` |
