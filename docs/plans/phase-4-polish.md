# Eden Phase 4 — Polish & Production Hardening

> **Status**: Proposed (updated to align with Ade's prototype)
> **Implementation Status**: Partially aligned with current codebase
> **Date**: 2026-03-12
> **Phase**: 4 of 5
> **Depends on**: Phase 3 (Intelligence Layer)
> **Parent plan**: `eden-evolution.md`
> **Estimated effort**: 3–4 weeks
> **Reference prototype**: `docs/prd/chivo_current_story_map.html`
>
> **Delivers**: Production-grade UX aligned with Ade's living prototype —
> mini-map navigation, activity filters, enriched task cards (source/device
> badges, handoff markers, status system), cross-cutting questions panel,
> question response workflow, persona overlays, release planning, full-text
> search, JSON/Markdown export, print stylesheet, and performance
> optimization for large maps. After this phase, Eden is a complete,
> shippable product running on frontier models.

---

## Scope

### What Ships

1. **Mini-map navigation widget** — fixed bottom-right bird's-eye view of the
   entire story grid with clickable/draggable viewport indicator (prototype
   lines 978–1068).
2. **Activity filter bar** — multi-select dropdown to show/hide individual
   activities, with dimming (prototype lines 1070–1154).
3. **Enriched task cards** — source badges, device badges, handoff cards,
   shared markers, status system (current/proposed/discontinued) with visual
   treatment (prototype lines 314–366, 404–438, 1156–1177).
4. **Activity persona pills + step persona borders** — colored role pills
   in activity headers, left-border persona coloring on step headers
   (prototype lines 261–300).
5. **Cross-cutting questions panel polish** — answer progress bar, answer
   indicators, `is_cross_cutting` filter (core panel built in Phase 3).
6. **Question modal polish** — answer progress bar in header stats (core
   modal + Evolve Map button built in Phase 3).
7. **Persona overlay + filter** — complete role dimming system and persona
   tab switching from the prototype (prototype lines 119–198, 327).
8. **Release management** — release slice view on the map, task assignment,
   status tracking.
9. **Source traceability UI** — task → source links with excerpts, source
   detail page.
10. **Reviews UI** — expert panel review history, synthesis + individual
    expert opinions, SSE streaming progress.
11. **Audit trail UI** — timeline of all changes with actor, timestamp,
    changeset reference.
12. **Search** — full-text search across tasks, questions, and sources.
13. **Export** — JSON and Markdown export from header buttons, matching
    prototype's export format (prototype lines 6676–6730).
14. **Print** — comprehensive `@media print` stylesheet matching prototype
    (prototype lines 648–673).
15. **Keyboard shortcuts** — number keys for map switching, Escape for
    modals/panels (prototype lines 6732–6749).
16. **Performance** — optimize map endpoint and grid rendering for 500+ tasks.

### What Does NOT Ship

- No private model migration (Phase 5).
- No drag-and-drop reordering (future).
- No real-time collaborative editing (future).
- No AI settings modal — Eden uses Eve agents, not direct API keys
  (prototype's settings modal is Chivo-specific).

---

## Prerequisites

- Phase 3 complete — all AI loops working, chat panel functional, alignment
  and question agents operational.
- Realistic test data — at least 2 projects with 50+ tasks each for
  performance testing.

---

## Implementation Steps

### 4a. Mini-Map Navigation Widget (Medium) ★ NEW

This is the single biggest UX feature from the prototype that Eden lacks.
The story map extends horizontally off-screen; the mini-map provides spatial
orientation and quick navigation.

```
components/map/
  MiniMap.tsx              # The complete mini-map widget
  MiniMapGrid.tsx          # Activity/step/task bar rendering
  MiniMapViewport.tsx      # Draggable viewport overlay
```

**Layout (fixed bottom-right):**
- Container: `position: fixed; bottom: 16px; right: 16px; width: 800px`
- Dark header bar (activity-bg) with "Mini-Map" label and collapse toggle
- Body: miniature CSS Grid mirroring the main map structure
- Viewport indicator: orange-bordered semi-transparent rectangle showing
  the currently visible region of the main map

**Collapsible:**
- Click header to toggle between expanded (800px) and collapsed (120px)
- Collapsed state hides the body, shows only the header
- Smooth CSS transition: `width .25s ease, opacity .2s`

**Grid structure (mirrors main map):**
- Row 1: Activity labels (dark bars with abbreviated titles, spanning columns)
- Row 2: Step indicators (orange bars, 4px height)
- Row 3: Task bars (per-step vertical stack of 4px-high bars)
  - Bar left-border colored by persona
  - Status coloring: current=grey, proposed=green, discontinued=faded
  - Respects persona dimming and activity filter dimming

**Navigation:**
- Click anywhere in mini-map body → main map scrolls to that position
- Drag the viewport indicator → main map scrolls continuously
- Main map scroll → viewport indicator updates position
- Window resize → recalculates viewport proportions

**Sync with filters:**
- When persona tab active → non-matching columns dimmed in mini-map
- When activity filter active → deselected activities dimmed (opacity 0.1)
- When "Hide 2.0" active → proposed task bars hidden

**Print:** `@media print { .minimap { display: none !important; } }`

### 4b. Activity Filter Bar (Small) ★ NEW

A multi-select dropdown filter that lets users focus on specific activities,
dimming the rest.

```
components/map/
  ActivityFilterBar.tsx    # Dropdown with checkboxes
  ActivityFilterTag.tsx    # Pill tag for selected activities
```

**Layout:**
- Sticky bar below the legend row
- "Activity:" label + dropdown button + selected tags
- Dropdown: checkbox per activity ("Select All" first, then each ACT-n)
- Close on outside click

**Filter behavior:**
- All selected by default (dropdown shows "All Activities")
- Deselecting an activity → its columns (act-cell, stp-cell, task-cell)
  get `opacity: 0.1; pointer-events: none`
- Dropdown label shows: "All Activities", names (≤3), or "N of M Activities"
- Selected activities shown as dark pill tags next to dropdown
- Mini-map reflects activity dimming

**Data flow:**
- Client-side only — no API call needed
- `selectedActivities: Set<string>` maintained in map state
- Applied via data attribute: `data-act="${activityId}"`

### 4c. Enriched Task Cards (Medium) ★ NEW

Align task card design with Ade's prototype. Several new visual elements
and metadata fields.

#### 4c-i. Source Badge

Each task card shows where it came from:

```
Source Type    │ Color       │ Background
──────────────┼─────────────┼───────────
research      │ #6b7280     │ #6b728020
transcript    │ #0891b2     │ #0891b220
scope-doc     │ #7c3aed     │ #7c3aed20
both          │ #059669     │ #05966920
```

**Data model change:**
- Add `source_type` column to `tasks` table: `text CHECK (source_type IN
  ('research', 'transcript', 'scope-doc', 'both', 'ingestion'))`
- Default: `null` (no badge shown). Populated by ingestion pipeline.
- API: include in task create/update payloads.

**UI:** Small badge in card-badges row: 8px font, 700 weight, uppercase,
colored border + background, 3px radius.

#### 4c-ii. Device Badge

Enhanced device badges with distinct coloring (currently shown but plain):

```
Device   │ Background │ Text Color
─────────┼────────────┼───────────
desktop  │ #f3f4f6    │ #6b7280
mobile   │ #fef3c7    │ #92400e
all      │ #e0e7ff    │ #4338ca
```

#### 4c-iii. Status System (Current / Proposed / Discontinued)

Three-state lifecycle for tasks, enabling "current vs proposed" overlay:

**Data model change:**
- Add `lifecycle` column to `tasks` table: `text CHECK (lifecycle IN
  ('current', 'proposed', 'discontinued')) DEFAULT 'current'`
- API: include in task create/update payloads and map response.

**Card visual treatment:**

| Status | Left Border | Background | Title | Badge |
|--------|------------|------------|-------|-------|
| current | persona color (existing) | white (existing) | normal | none |
| proposed | `4px solid #10b981` | `linear-gradient(135deg, #f0fdf4, #fff)` | normal | green "2.0 PROPOSED" |
| discontinued | `4px solid #9ca3af` | `#f9fafb` | strikethrough, grey | grey "DISCONTINUED" (strikethrough) |

**Discontinued cards:** `opacity: 0.45`, reduced badge opacity (0.6).

**Step header treatment:**
- If all tasks in a step are proposed → step header gets green bg (#047857)
- If all tasks in a step are discontinued → strikethrough + reduced opacity

**Toggle button in header:**
- "Hide 2.0" / "Show 2.0" button in header actions
- Toggles visibility of all proposed cards and proposed step headers
- Visual: green border, toggles between filled (hide) and outline (show)

#### 4c-iv. Handoff Cards

Tasks that appear in multiple persona journeys via `role_in_journey`:

```
role_in_journey   │ Visual Treatment
──────────────────┼─────────────────────────────────
owner (default)   │ Normal card (solid border)
handoff           │ Dashed 2px border, #fafafa bg, 85% opacity
shared            │ Normal card + blue "⊜ Shared" badge
```

**Data model change:**
- Add `role_in_journey` column to `step_tasks` table: `text CHECK
  (role_in_journey IN ('owner', 'handoff', 'shared')) DEFAULT 'owner'`
- Add `handoff_label` column to `step_tasks` table: `text` (e.g., "Receives
  from CU → MR")

**Handoff badge:** Yellow background (#fef3c7), dark amber text (#92400e),
arrows icon (↔), persona color dot showing the handoff direction.

#### 4c-v. Activity Persona Pills

Small colored pills in each activity header showing which personas are
involved in that activity:

- Derive from task roles within the activity's steps
- Each pill: 8px font, 800 weight, 10px radius, colored bg matching persona
- Placed in activity header's right section, next to the question count badge

#### 4c-vi. Step Persona Borders

Left border on step headers colored by the primary persona of that step:

- Derive from the first task's primary role in that step
- 4px left border in persona color (transparent border-left on .stp-cell)
- CSS: `.stp-cell.persona-PM { border-left-color: var(--pm-color); }`

### 4d. Cross-Cutting Questions Panel + Question Modal Polish (Small)

> **Note:** The core components (`CrossCuttingPanel.tsx`, `QuestionModal.tsx`)
> are built in **Phase 3** (sections 3g and 3h) alongside the AI integration.
> Phase 4 adds the following polish enhancements on top of Phase 3's work.

**Phase 4 additions to Cross-Cutting Panel:**
- Widen panel from 480px → 520px (matching prototype)
- Add answer indicator: green border + checkmark on answered questions
- Add `is_cross_cutting` boolean to `questions` table for filtering
- Current API (Phase 3): `GET /api/projects/:id/questions?status=open`
- Planned Phase 4 API: `GET /api/projects/:id/questions?cross_cutting=true|false`
- Planned grouped response: `{ cross_cutting_questions: Question[], regular_questions: Question[] }`

**Phase 4 additions to Question Modal:**
- Answer progress bar component (`AnswerProgress.tsx`) in header stats area:
  - Progress bar: answered count / total count
  - Green fill bar (`var(--green)`) with percentage text
  - Updates in real-time as questions are answered
- Ensure response persistence uses the API (`PATCH /api/questions/:id`), not
  localStorage (Phase 3 may use localStorage as a quick path)

### 4e. Persona Overlay + Filter (Small)

Complete the persona tab and role filter pill interaction model per
prototype lines 119–198 and 6369–6405.

**Persona tabs** (below header, sticky):
- Each tab: persona code + colored dot (8px circle) + task count badge
- Active tab: bottom border in persona color (3px)
- Clicking a persona tab:
  - On "Overview"/"All Users" → server-side fetch, no dimming
  - On specific persona → server-side fetch filtered to that persona's tasks
  - Role filter buttons only visible on "All Users" tab
- Keyboard: number keys 1–N switch between tabs

**Role filter pills** (in header, visible only on "All Users" tab):
- Pill: `border: 2px solid <persona-color>; border-radius: 20px`
- Inactive: transparent bg, persona-colored text + border
- Active: filled bg in persona color, white text
- Hover: slight lift (`translateY(-1px)`)
- Click toggles: non-matching cards get `.role-dimmed` →
  `opacity: .12; transform: scale(.97); pointer-events: none`
- Only one pill active at a time (unlike the old plan — prototype is single-select)

### 4f. Release Slice View (Small)

**Current implementation status:** release APIs exist and map filter is already
backed by API query params (`GET /api/projects/:id/releases`, `GET /api/projects/:id/map?release=...`, `POST /api/releases/:id/tasks`, `DELETE /api/releases/:id/tasks/:taskId`), but the release selector UI and release slice styling remain to implement.

```
components/releases/
  ReleaseList.tsx           # Release cards with task count, target date, status
  ReleaseDetail.tsx         # Task assignment UI
```

**Map integration:**
- Header dropdown: "Release: [All | v1.0 | v2.0 | ...]"
- When a release is selected, the map filters to show only tasks in that release.
- Non-release tasks dimmed (same pattern as persona filter).

**API:**
```
GET    /api/projects/:id/map?release=<id-or-slug> # Filter by release
GET    /api/projects/:id/releases
POST   /api/releases/:id/tasks              # Assign tasks (bulk)
DELETE /api/releases/:id/tasks/:taskId       # Remove task
```

### 4g. Source Traceability UI (Small)

**Task card enhancement (from 4c-i):**
- Source badge on card showing provenance (research/transcript/scope-doc/etc.)

**Task detail (expanded card) enhancement:**
- When a task has `source_id`, show a "Source" section with:
  - Filename + upload date
  - `source_excerpt` (the specific text that spawned this task)
  - Link to source detail page

**Source detail page:**
- Source metadata (filename, content_type, size, uploaded_by, status)
- "Download Original" button (presigned URL via `GET /api/sources/:id/download`)
- List of tasks created from this source
- List of changesets created from this source

### 4h. Reviews UI (Medium)

```
components/reviews/
  ReviewList.tsx            # Review cards with status, expert count, date
  ReviewDetail.tsx          # Synthesis + expert opinions
  ExpertOpinion.tsx         # Individual expert card with slug badge
```

**Review denormalization** (`sync/sync.service.ts`):
- When an expert panel job completes, the NestJS backend fetches the job
  result and denormalizes it into the `reviews` and `expert_opinions` tables.
- Triggered by polling or webhook from Eve.

**SSE streaming** (Phase 3's SSE infrastructure reused):
```
GET    /api/reviews/:id/stream          # SSE stream of review progress
```
- Events: `expert.started`, `expert.completed`, `synthesis.started`,
  `synthesis.completed`
- UI shows progress bar with expert completion status.

**Sidebar entry**: "Reviews" in left nav.

### 4i. Audit Trail UI (Small)

```
components/audit/
  AuditTimeline.tsx         # Filterable timeline
  AuditEntry.tsx            # Single entry: actor, action, entity, timestamp
```

The `audit_log` table is already populated by the changeset apply logic.
This UI surfaces it:

- Filter by: entity type, actor, action, date range
- Each entry shows: who (agent or user), what (create/update/delete),
  which entity (with display_id link), when, and changeset reference

### 4j. Search (Medium)

```
GET    /api/projects/:id/search?q=<query>    # Full-text search
                                              # Searches: tasks.title, tasks.user_story,
                                              # tasks.acceptance_criteria, questions.question,
                                              # questions.answer, ingestion_sources.filename
                                              # Returns: [{ entity_type, id, display_id, title, excerpt }]
```

**Implementation**: PostgreSQL `tsvector` + `tsquery` with `ts_rank` scoring.
Add GIN indexes on searchable columns. No pgvector needed for Phase 4 —
full-text search is sufficient.

**UI**: Search bar in header → results dropdown → click navigates to entity
on map (scroll + flash animation).

### 4k. Export (Small)

Header buttons matching prototype's export pattern:

```
GET    /api/projects/:id/export/json         # Full project as structured JSON
GET    /api/projects/:id/export/markdown      # Story map as Markdown document
```

**JSON export**: Full tree — project → personas → activities → steps → tasks
→ questions → releases. Includes metadata, display_ids, acceptance criteria,
source traceability, and lifecycle status.

**Markdown export**: Formatted document following prototype's structure:
```markdown
# Project: Launch v2

## Activity: Onboarding (ACT-1)

### Step: Registration (STP-1.1)

#### TSK-1.1.1: Email Signup
- **Persona**: PM (owner)
- **Device**: All
- **Priority**: High
- **Lifecycle**: current
- **Source**: research
- **User Story**: As a new user, I want to sign up with my email...
- **Acceptance Criteria**:
  - AC-1.1.1a: Given a valid email, When I submit, Then account is created
- **Questions**: Q-1 (open): What about SSO?
```

### 4l. Print Stylesheet (Small)

Comprehensive `@media print` stylesheet matching prototype lines 648–673:

```css
@media print {
  body { background: #fff; font-size: 9px; }
  header { position: static; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .map-tabs { position: static; -webkit-print-color-adjust: exact; }
  .legend { position: static; }
  .map-wrap { padding: 12px; overflow: visible; }
  .story-grid { min-width: unset !important; }
  /* Force all cards expanded */
  .card-body { display: block !important; }
  .card-chevron { display: none; }
  /* Remove interactive elements */
  .panel, .modal-bg, .chat-panel, .minimap { display: none !important; }
  .hdr-btns { display: none; }
  .role-filters { display: none; }
  /* Preserve colors */
  .card, .us, .q-pill, .role-badge, .act-role-pill,
  .device-badge, .handoff-badge, .status-badge,
  .act-cell, .stp-cell { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  /* Avoid breaking cards */
  .card { break-inside: avoid; page-break-inside: avoid; }
  .task-cell { break-inside: avoid; }
}
```

### 4m. Keyboard Shortcuts (Small) ★ NEW

```
components/hooks/
  useKeyboardShortcuts.ts  # Global keyboard event handler
```

| Key | Action | Context |
|-----|--------|---------|
| 1–N | Switch persona tab (1=Overview, 2..N=personas) | When no modal is open |
| Escape | Close topmost overlay (review → settings → chat → modal → panel) | Always |
| E | Toggle expand all cards | When no modal is open |
| Q | Toggle questions-only filter | When no modal is open |
| P | Print (triggers browser print dialog) | When no modal is open |

### 4n. Performance Optimization (Medium)

**Backend:**
- Add composite indexes: `(project_id, org_id)` on all tables
- Optimize map endpoint: single query with joins, not N+1
- Add response caching headers (`ETag`, `Cache-Control`) for map endpoint
- Paginate sources and reviews endpoints
- Include `lifecycle` and `source_type` in map composite query

**Frontend:**
- Virtualize the map grid for 500+ tasks (react-window or similar)
- Lazy-load expanded card content (user story, acceptance criteria, questions)
- Debounce filter/search interactions (300ms)
- Memoize persona filtering calculations
- Mini-map: throttle `updateMinimapViewport` to 16ms (requestAnimationFrame)

**Benchmark targets:**
- Map endpoint: < 200ms for 500 tasks
- Grid render: < 500ms for 500 tasks
- Filter switch: < 100ms
- Mini-map viewport update: < 16ms (60fps while scrolling)

---

## Database Migrations

### Migration: `phase4_enrichments.sql`

```sql
-- Task lifecycle status (current/proposed/discontinued)
ALTER TABLE tasks ADD COLUMN lifecycle text
  CHECK (lifecycle IN ('current', 'proposed', 'discontinued'))
  DEFAULT 'current';

-- Task source provenance
ALTER TABLE tasks ADD COLUMN source_type text
  CHECK (source_type IN ('research', 'transcript', 'scope-doc', 'both', 'ingestion'));

-- Step-task handoff metadata
ALTER TABLE step_tasks ADD COLUMN role_in_journey text
  CHECK (role_in_journey IN ('owner', 'handoff', 'shared'))
  DEFAULT 'owner';
ALTER TABLE step_tasks ADD COLUMN handoff_label text;

-- Cross-cutting question flag
ALTER TABLE questions ADD COLUMN is_cross_cutting boolean DEFAULT false;

-- GIN indexes for full-text search
CREATE INDEX idx_tasks_fts ON tasks
  USING GIN (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(user_story,'')));
CREATE INDEX idx_questions_fts ON questions
  USING GIN (to_tsvector('english', coalesce(question,'') || ' ' || coalesce(answer,'')));

-- Composite performance indexes
CREATE INDEX idx_tasks_project_org ON tasks (project_id, org_id);
CREATE INDEX idx_tasks_lifecycle ON tasks (project_id, lifecycle);
CREATE INDEX idx_tasks_source_type ON tasks (project_id, source_type);
CREATE INDEX idx_steps_activity ON steps (activity_id);
CREATE INDEX idx_step_tasks_step ON step_tasks (step_id);
CREATE INDEX idx_step_tasks_role_in_journey ON step_tasks (role_in_journey);
CREATE INDEX idx_questions_project ON questions (project_id, org_id);
CREATE INDEX idx_questions_cross_cutting ON questions (project_id)
  WHERE is_cross_cutting;
CREATE INDEX idx_audit_log_project ON audit_log (project_id, org_id);
```

---

## Prototype → Eden Feature Matrix

| Prototype Feature | Prototype Lines | Eden Phase | Eden Component | Status |
|---|---|---|---|---|
| Horizontal CSS Grid map | 226–231 | Phase 1 ✓ | `StoryMap.tsx` | Already done |
| Activity headers (dark) | 233–278 | Phase 1 ✓ | `ActivityRow.tsx` | Already done |
| Step headers (orange) | 279–300 | Phase 1 ✓ | `StepHeader.tsx` | Already done |
| Task cards (expandable) | 314–386 | Phase 1 ✓ | `TaskCard.tsx` | Already done |
| Persona tabs | 119–165 | Phase 4 | `PersonaTabs.tsx` | Already done |
| Role filter pills | 167–198 | Phase 4 | `RoleFilterPills.tsx` | Already done |
| Role dimming (`.role-dimmed`) | 327 | Phase 4 | `StoryMap.tsx` | Already done |
| Legend bar | 200–221 | Phase 1 ✓ | `MapLegend.tsx` | Already done |
| Mini-map | 978–1068 | **Phase 4** ★ | NEW `MiniMap.tsx` | **Not started** |
| Activity filter bar | 1070–1154 | **Phase 4** ★ | NEW `ActivityFilterBar.tsx` | **Not started** |
| Source badges | 6171–6175 | **Phase 4** ★ | `TaskCard.tsx` | **Not started** |
| Device badges (colored) | 427–438 | **Phase 4** ★ | `TaskCard.tsx` | **Enhance** |
| Handoff cards (dashed) | 334–366 | **Phase 4** ★ | `TaskCard.tsx` | **Not started** |
| Status system (proposed/disc.) | 1157–1177 | **Phase 4** ★ | `TaskCard.tsx` | **Not started** |
| Hide/Show 2.0 toggle | 6796–6868 | **Phase 4** ★ | Header button | **Not started** |
| Activity persona pills | 261–277 | **Phase 4** ★ | `ActivityRow.tsx` | **Not started** |
| Step persona borders | 293–300 | **Phase 4** ★ | `StepHeader.tsx` | **Not started** |
| Cross-cutting panel | 509–557 | **Phase 3** (3g) | `CrossCuttingPanel.tsx` | Phase 3 scope |
| Question modal + response | 561–637 | **Phase 3** (3h) | `QuestionModal.tsx` | Phase 3 scope |
| Answer progress bar | 96–117 | **Phase 4** ★ | NEW `AnswerProgress.tsx` | **Not started** |
| AI modification indicators | 761–762 | **Phase 3** (3i) ★ | Card CSS classes | Phase 3 scope |
| "EVOLVED" badge | 746–758 | **Phase 3** (3i) ★ | `EvolvedBadge.tsx` | Phase 3 scope |
| Chat markdown rendering | 896–920 | **Phase 3** (3c) ★ | `ChatMessage.tsx` | Phase 3 scope |
| Keyboard shortcuts | 6732–6749 | **Phase 4** ★ | Hook | **Not started** |
| Chat panel | 855–953 | Phase 3 | `ChatPanel.tsx` | Phase 3 scope |
| AI evolve map | 5673+ | Phase 3 | Eve agent integration | Phase 3 scope |
| Review panel | 764–853 | Phase 3/4 | `ChangesetReviewModal.tsx` | Partially done |
| Export JSON/MD | 6676–6730 | Phase 4 | API endpoints | **Not started** |
| Print stylesheet | 648–673 | Phase 4 | CSS | **Not started** |
| AI settings modal | 680–744 | N/A | Eden uses Eve agents | Not applicable |

---

## Verification Loop (Staging)

### Deploy

```bash
eve project sync --dir .
eve agents sync --project eden --local --allow-dirty
eve env deploy sandbox --ref main --repo-dir . --watch --timeout 300
```

### Playwright Visual Parity Check (Recommended)

Validate look-and-feel against Ade's prototype:
`docs/prd/chivo_current_story_map.html`

1. Load the deployed Eden story map and the prototype page side-by-side.
2. Capture deterministic screenshots at identical viewport sizes and interaction states.
3. Compare with visual diff tooling (`toHaveScreenshot` / percy diff) for:
   - mini-map container placement and visibility
   - activity/step/task spacing and color mappings
   - role/persona pill styling and dimming states
   - cards (borders, badges, status markers, typography scale)
   - question/review panel layout
   - header controls and modal framing
4. Keep a small tolerance for non-deterministic browser rendering; require visual parity for primary UI regions.

Example Playwright script:

```ts
import { test, expect } from '@playwright/test';
import path from 'node:path';

test('phase-4-polish: prototype look-and-feel parity', async ({ page }, testInfo) => {
  const viewportStates = [
    { name: 'desktop-wide', width: 1600, height: 1100 },
    { name: 'tablet', width: 1024, height: 1365 },
    { name: 'mobile', width: 390, height: 844 },
  ];

  for (const viewport of viewportStates) {
    await page.setViewportSize(viewport);

    await page.goto(process.env.EDEN_MAP_URL ?? 'http://localhost:3000');
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: path.join(testInfo.outputDir, `eden-${viewport.name}.png`),
      fullPage: true,
    });
    await expect(page).toHaveScreenshot(`eden-${viewport.name}.png`, {
      maxDiffPixels: 2500,
      maxDiffPixelRatio: 0.02,
    });
  }
});

test('phase-4-prototype-load', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`file://${path.resolve('docs/prd/chivo_current_story_map.html')}`);
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveScreenshot('ade-prototype-reference.png', {
    maxDiffPixels: 2500,
  });
});
```

Acceptance expectation:
- Add a reviewer sign-off step: visual parity is acceptable if no high-importance region (cards, legend, filter controls, map bars) regresses in color/spacing/typography/interaction affordances.

### Acceptance Criteria

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| **V4.1** | Mini-map renders | Open a project with 10+ activities | Mini-map shows bird's-eye view with activity labels, step bars, persona-colored task bars |
| **V4.2** | Mini-map navigation | Click a position in the mini-map body | Main map scrolls to that position; viewport indicator moves |
| **V4.3** | Mini-map drag | Drag the viewport indicator across mini-map | Main map scrolls smoothly in real-time |
| **V4.4** | Mini-map collapse | Click the mini-map header | Widget collapses to 120px showing only "Mini-Map" header; click again to expand |
| **V4.5** | Activity filter | Deselect 3 activities in the dropdown | Deselected activities dim to 10% opacity in both main grid and mini-map |
| **V4.6** | Source badge | Create a task with `source_type: 'transcript'` | Card shows teal "TRANSCRIPT" badge in metadata row |
| **V4.7** | Status proposed | Create a task with `lifecycle: 'proposed'` | Card shows green left border, gradient bg, "2.0 PROPOSED" badge |
| **V4.8** | Status discontinued | Create a task with `lifecycle: 'discontinued'` | Card shows grey border, 45% opacity, strikethrough title |
| **V4.9** | Hide/Show 2.0 | Click "Hide 2.0" button | All proposed cards and proposed step headers hidden; button toggles to "Show 2.0" |
| **V4.10** | Handoff card | Place a task on a step with `role_in_journey: 'handoff'` | Card shows dashed border, reduced opacity, handoff badge |
| **V4.11** | Activity persona pills | Open map with tasks having multiple personas | Activity headers show colored persona pills (e.g., CU, MR, DI) |
| **V4.12** | Step persona border | Open map | Step headers have left border colored by primary persona |
| **V4.13** | Cross-cutting answer indicator | Answer a question in the panel | Answered question card shows green border + checkmark |
| **V4.14** | Answer progress bar | Answer 5 of 10 questions | Header shows "50%" with green progress bar |
| **V4.15** | Persona overlay | Click "PM" tab, then role filter pill "ENG" | PM tasks visible, ENG tasks highlighted, others fully dimmed |
| **V4.16** | Release slice | Create release "v1.0", assign 10 tasks, select in header | Map shows only v1.0 tasks, others dimmed |
| **V4.17** | Source traceability | Open task created by ingestion | Source section shows filename, excerpt, link to source detail |
| **V4.18** | Source download | Click "Download Original" on source detail | Presigned URL opens, original file downloads |
| **V4.19** | Review history | Complete an expert panel review via Slack | Review appears in Reviews sidebar with synthesis + expert opinions |
| **V4.20** | Audit trail | Create and accept a changeset | Audit timeline shows entries with changeset ref |
| **V4.21** | Search | Search "checkout" | Results show matching tasks, questions, sources with excerpts |
| **V4.22** | JSON export | Click Export JSON | Downloads valid JSON with full project tree (incl. lifecycle, source_type) |
| **V4.23** | Markdown export | Click Export MD | Downloads formatted Markdown with all entities |
| **V4.24** | Print | Click Print → browser print dialog | Clean layout, all cards expanded, no interactive elements, colors preserved |
| **V4.25** | Keyboard shortcuts | Press "2" key | Switches to second persona tab |
| **V4.26** | Performance | Load project with 500+ tasks | Map renders in < 500ms, filter < 100ms, mini-map viewport at 60fps |
| **V4.27** | Playwright visual parity | Run Playwright parity check vs `docs/prd/chivo_current_story_map.html` | Screenshots match across key regions (header, grid, cards, filters, legend, modals) within tolerance |

### Performance Benchmark Script

```bash
#!/bin/bash
set -euo pipefail
API="https://api.${ORG_SLUG}-eden-sandbox.eh1.incept5.dev"

echo "=== Phase 4 Performance Benchmark ==="

# Seed 500 tasks
echo "Seeding test data..."
# (seeding script omitted — would create 10 activities × 5 steps × 10 tasks)

# Benchmark map endpoint
echo "Benchmarking map endpoint..."
for i in $(seq 1 5); do
  TIME=$(curl -sf -o /dev/null -w "%{time_total}" \
    -H "Authorization: Bearer $TOKEN" \
    "$API/api/projects/$PROJECT_ID/map")
  echo "  Run $i: ${TIME}s"
done

# Benchmark with persona filter
echo "Benchmarking filtered map..."
TIME=$(curl -sf -o /dev/null -w "%{time_total}" \
  -H "Authorization: Bearer $TOKEN" \
  "$API/api/projects/$PROJECT_ID/map?persona=pm")
echo "  Filtered: ${TIME}s"

# Benchmark search
echo "Benchmarking search..."
TIME=$(curl -sf -o /dev/null -w "%{time_total}" \
  -H "Authorization: Bearer $TOKEN" \
  "$API/api/projects/$PROJECT_ID/search?q=checkout")
echo "  Search: ${TIME}s"

# Export sizes
JSON_SIZE=$(curl -sf -H "Authorization: Bearer $TOKEN" \
  "$API/api/projects/$PROJECT_ID/export/json" | wc -c)
echo "  JSON export: ${JSON_SIZE} bytes"

echo "=== Performance benchmark complete ==="
```

---

## Exit Criteria

Phase 4 is complete when:

- [ ] Mini-map renders bird's-eye view and supports click/drag navigation
- [ ] Activity filter bar shows/hides activities with dimming
- [ ] Task cards show source badges, device badges, and lifecycle status
- [ ] Handoff and shared card styles render correctly
- [ ] Activity persona pills and step persona borders are visible
- [ ] Cross-cutting panel polish: answer indicators + `is_cross_cutting` filter (core in Phase 3)
- [ ] Answer progress bar reflects answered question count in header
- [x] Persona tabs + role filter pills work correctly with dimming
- [ ] Release slice view filters the map (backend filtering works via `release` query, UI dropdown still pending)
- [ ] Hide/Show 2.0 toggle hides/shows proposed cards and steps
- [ ] Source traceability shows task → source links with excerpts
- [ ] Reviews UI shows synthesis + expert opinions with SSE progress
- [ ] Audit trail displays full change history
- [ ] Search returns results across tasks, questions, sources
- [ ] JSON and Markdown export produce valid, complete output (incl. new fields)
- [ ] Print stylesheet produces clean output with colors preserved
- [ ] Keyboard shortcuts work (number keys, Escape, E, Q, P)
- [ ] Map renders 500 tasks in < 500ms
- [ ] Map endpoint responds in < 200ms for 500 tasks
- [ ] Mini-map viewport updates at 60fps during scroll
- [ ] All V4.x acceptance criteria pass on staging

**Phase 4 = Eden v1 on frontier models.** Ready for internal use.

---

## Risks

| Risk | Mitigation |
|------|-----------|
| Mini-map performance with 500+ tasks | Throttle renders with rAF; use simplified bars not full cards |
| CSS Grid performance at 500+ cards | Test early with synthetic data; virtualize if needed |
| Activity filter + persona filter interaction complexity | Define clear precedence: activity filter → persona tab → role pill (AND chain) |
| Full-text search accuracy | Use `ts_rank` with weights; consider trigram index for fuzzy matching |
| Review denormalization lag | Poll frequently or use Eve webhooks for near-real-time sync |
| Export timeout for large projects | Stream the response; set appropriate timeout |
| Mini-map viewport drift on rapid resize | Debounce resize handler; recalc on resize end |
| Print stylesheet color loss | Use `-webkit-print-color-adjust: exact` on all colored elements |
