# PM Expert Panel — Intelligent Coordinator

> **Status**: Proposed
> **Date**: 2026-03-10
> **Author**: Adam / Claude
> **Scope**: Pack config (teams, agents, chat), agent skills, manifest
> **Platform features used**:
>   - Staged council dispatch (`staged-team-dispatch-plan.md` — implemented)
>   - Staged backlog cleanup (`e8f8de8` — implemented, cancels backlog children on solo completion)
>   - Coordination inbox on agent-runtime (`e8f8de8` — implemented, experts can read prepared content)
>   - Chat file materialization (`chat-file-materialization-plan.md` — implemented)
>   - Agent aliases (`agent-aliases-plan.md` — implemented)
>   - Chat outbound delivery (`chat-outbound-delivery-plan.md` — implemented)
>   - EveMessageRelay on agent-runtime (`b5373709` — implemented, enables progress updates to Slack)
>   - Chat progress updates (`chat-progress-updates-plan.md` — implemented)
> **Borrows from**: ingest-agentpack (whisper-cli / ffmpeg transcription patterns)

## Design Principle

**One agent. One conversation. The coordinator decides everything.**

Users talk to `@eve pm`. The coordinator reads the message and any
attachments, decides what's needed, and either handles it directly or
calls in the expert panel. Users never need to know the panel exists.

## Architecture

```
@eve pm <anything>
  │
  ▼  alias "pm" → team:expert-panel (staged council)
  │
  ▼  COORDINATOR runs first (always)
  │
  │  Reads message + .eve/attachments/ + .eve/resources/
  │  Assesses what's needed:
  │
  ├─ REVIEW: "review this spec" + PDF
  │    → pre-process files (transcribe audio, read PDF)
  │    → post prepared content to coordination thread
  │    → return eve.status = "prepared"
  │    → 7 experts fan out in parallel
  │    → coordinator wakes, synthesizes, returns executive summary
  │
  ├─ QUICK QUESTION: "is dark mode worth doing?"
  │    → answer directly from PM expertise
  │    → return eve.status = "success"
  │    → experts never start (backlog members cleaned up)
  │
  ├─ SEARCH: "find the pricing doc we reviewed"
  │    → search document catalog
  │    → return eve.status = "success"
  │
  ├─ CAPTURE: "note: we decided to use Postgres"
  │    → acknowledge and store decision context
  │    → return eve.status = "success"
  │
  └─ FILE + QUICK QUESTION: "is this architecture diagram right?" + PNG
       → read the image, answer the specific question
       → return eve.status = "success" (no need for full panel)
```

The distinction is simple: **"prepared" triggers the panel, "success" handles it solo.**

## What Changes

### 1. Teams: Staged Council

**File**: `eve/teams.yaml`

```yaml
version: 1
teams:
  expert-panel:
    lead: pm-coordinator
    members:
      - tech-lead
      - ux-advocate
      - biz-analyst
      - gtm-advocate
      - risk-assessor
      - qa-strategist
      - devils-advocate
    dispatch:
      mode: council
      staged: true
      max_parallel: 7
      lead_timeout: 3600
      member_timeout: 300
```

Current live `eve/teams.yaml` is `mode: fanout` and must be updated to `mode: council`
with `staged: true` before this plan runs correctly.

### 2. Agents: One Routable, Rest Internal

**File**: `eve/agents.yaml`

Only the coordinator is gateway-routable. Experts are internal — invoked
by the team dispatch, never addressed directly via Slack.

```yaml
version: 1
agents:
  pm-coordinator:
    slug: pm
    alias: pm
    skill: coordinator
    harness_profile: coordinator
    description: "PM coordinator — triages requests, processes files, dispatches expert panel when needed, synthesizes results"
    gateway:
      policy: routable
      clients: [slack]
    workflows: [coordinator]
    policies:
      permission_policy: auto_edit
      git:
        commit: never
        push: never

  tech-lead:
    slug: tech-lead
    skill: tech-lead
    harness_profile: expert
    description: "Technical feasibility, architecture, cost, engineering risk"
    policies:
      permission_policy: auto_edit
      git:
        commit: never
        push: never

  # ... same pattern for all 6 remaining experts
  # No gateway block → not routable via Slack
  # No alias → not addressable by name
```

Current live `eve/agents.yaml` marks non-coordinator agents as routable. To satisfy the
single-entrypoint model, make expert `gateway` entries non-routable (or omit) and remove
expert aliases where possible.

### 3. Chat Routing: One Route

**File**: `eve/chat.yaml`

```yaml
version: 1
routes:
  - id: route_default
    match: ".*"
    target: team:expert-panel
```

That's it. Every message goes to the team. The coordinator (staged lead)
decides what to do. No per-expert regex routes, no search/monitor routes.

Current config in this repo has specialist routes (search/monitor/tech/ux/etc.); either
remove those to enforce the one-route model or keep them and treat this as a
hybrid routing model.

### 4. Coordinator Skill: The Brain

**File**: `skills/coordinator/SKILL.md`

This is the core rewrite. The coordinator becomes an intelligent triage
agent with three possible execution paths:

#### Triage Logic

Read the message and any attachments. Decide:

| Signal | Action | eve.status |
|--------|--------|------------|
| Document attached + "review" intent | Full panel review | `prepared` |
| Multiple files or complex document | Full panel review | `prepared` |
| Audio/video file (any intent) | Transcribe first, then decide | depends |
| Simple question (no files or simple file) | Answer directly | `success` |
| "search" / "find" intent | Search and answer | `success` |
| "note" / "decision" / "action item" | Capture and confirm | `success` |

The coordinator should err toward `prepared` when uncertain — it's
better to get 7 expert perspectives than to miss something.

#### Phase 1: PREPARE (when panel review is needed)

1. Read `.eve/attachments/index.json` and/or `.eve/resources/index.json`
2. Emit progress update to Slack:
   ````
   ```eve-message
   Processing attached files...
   ```
   ````
3. Process files:
   - **Audio** → `whisper-cli -m /opt/whisper/models/ggml-small.en.bin -f <file> -ovtt`
   - **Video** → `ffmpeg -i <file> -vn -acodec pcm_s16le -ar 16000 -ac 1 /tmp/audio.wav` then whisper
   - **PDF/DOCX** → read natively
   - **Text/MD/CSV/JSON/YAML** → read directly
   - **Images** → note for experts to examine visually
4. Emit progress update:
   ````
   ```eve-message
   Content ready. Dispatching to 7 expert reviewers...
   ```
   ````
5. Post to coordination thread:
   ```
   ## Review Request

   **Message**: {user's message}
   **Files**: {count} attached
   **Prepared content**: {transcript / extracted text / summary}

   Original files available at .eve/attachments/ for direct examination.
   ```
6. Return `{"eve": {"status": "prepared", "summary": "Content prepared for expert review"}}`

#### Phase 2: WAIT (automatic — platform handles)

#### Phase 3: SYNTHESIZE (after children.all_done)

1. Read `.eve/coordination-inbox.md` for all 7 expert summaries
2. Write executive summary:
   - **Consensus**: what all/most experts agree on
   - **Dissent**: where experts disagree and why
   - **Critical risks**: highest-severity items from risk-assessor
   - **Key questions**: unresolved questions across all reviews
   - **Recommended actions**: prioritized next steps
3. Return `{"eve": {"status": "success", "summary": "Executive summary..."}}`

#### Solo Path (when no panel needed)

1. Handle the request directly using PM expertise
2. Return `{"eve": {"status": "success", "summary": "Your answer..."}}`

### 5. Expert Skills: Coordination-Thread-Aware

**Files**: All 7 `skills/<expert>/SKILL.md`

Each expert gets a new section (replacing any chat routing awareness):

```markdown
## Context

You are part of a staged expert panel. The coordinator has prepared
content for your review before you started.

1. Read `.eve/coordination-inbox.md` — this contains the coordinator's
   prepared content (transcripts, summaries, extracted text)
2. Check `.eve/attachments/` for files you can examine directly
   (PDFs, images, text files)
3. Analyze from your domain perspective

## Output

Return your analysis:
{"eve": {"status": "success", "summary": "Your expert analysis"}}

Your summary is automatically relayed to the coordination thread
for the coordinator's final synthesis.
```

Plus domain-specific file guidance per expert:
- **Tech Lead**: architecture diagrams, API specs, data models
- **UX Advocate**: wireframes, user flows, mockups
- **Biz Analyst**: process flows, data dictionaries, requirements
- **GTM Advocate**: market data, competitive analyses, pricing
- **Risk Assessor**: dependency maps, timelines, compliance docs
- **QA Strategist**: test plans, acceptance criteria, edge cases
- **Devil's Advocate**: assumptions in diagrams, missing alternatives

### 6. Harness Profiles

**File**: `eve/x-eve.yaml`

```yaml
agents:
  profiles:
    coordinator:
      - harness: claude
        model: sonnet
        reasoning_effort: medium
    expert:
      - harness: claude
        model: sonnet
        reasoning_effort: medium
    monitor:
      - harness: claude
        model: sonnet
        reasoning_effort: low
```

Coordinator upgraded from `low` to `medium` — it now does real work
(triage, transcription, synthesis).

### 7. Workflow

**File**: `eve/workflows.yaml`

```yaml
version: 1
workflows:
  pm-review:
    trigger:
      system:
        event: doc.ingest
    steps:
      - agent:
          name: pm-coordinator
    hints:
      timeout_seconds: 600
      permission_policy: auto_edit
```

Notes:

- `target:` is ignored by workflow execution today. Workflows run as a workflow job,
  and the invoked agent is resolved from `steps[0].agent.name` in the API service.
- Use object-form system trigger syntax: `system: { event: doc.ingest }`.
  (The ingest pathway emits `system.doc.ingest` in `apps/api/src/ingest/ingest.service.ts`.)

Ingested documents go through the same staged council flow.

## Agents Removed

**chat-monitor** and **pm-search** are absorbed into the coordinator.
The coordinator handles search queries and decision capture directly
rather than routing to specialist agents. This removes 2 agents, 2 skills,
and simplifies the pack.

If the coordinator needs to become simpler later, these can be
re-extracted as separate agents.

## What We're NOT Doing

1. **No per-expert Slack addressing** — users talk to `pm`, period.
   If someone needs a specific expert opinion, they say
   `@eve pm get the tech lead's take on this` and the coordinator
   decides whether to fan out to just that expert or the full panel.

2. **No ingest-agentpack import** — we borrow transcription patterns
   in the coordinator skill. The coordinator handles processing inline
   during its prepare phase.

3. **No worker-level extraction** — coordinator transcribes once during
   prepare. Experts get the transcript via coordination thread.

4. **No file type filtering** — unsupported files are noted, not dropped.

## Code-Reviewed Caveats

These are required behavior fixes beyond the original design:

1. `chat.service` team routing currently does not include `chat_files` in job hints.
   For attachment-aware workflow, this must be added to coordinator + member jobs so
   worker jobs can stage files into `.eve/attachments/`.
2. `chat.service` branch for `target: workflow:` / `target: pipeline:` creates a bare chat job
   (no team/agent routing) and is not suitable for this one-route expert panel design.
3. Workflow definitions must include `steps` with a concrete agent name:
   `steps[0].agent.name` is what the API uses to resolve the workflow assignee.
4. `eve/workflows.yaml` currently includes `target` but this is not consumed for workflow
   invocation. Remove reliance on `target` and rely on workflow steps.

## Implementation Order

| Step | Files | Effort |
|------|-------|--------|
| 1. Teams: staged council | `eve/teams.yaml` | Trivial |
| 2. Agents: one routable + internal experts | `eve/agents.yaml` | Small |
| 3. Chat routes: single catch-all | `eve/chat.yaml` | Trivial |
| 4. Coordinator skill rewrite | `skills/coordinator/SKILL.md` | **Medium** |
| 5. Expert skills update | 7 × `skills/<expert>/SKILL.md` | Medium |
| 6. Remove monitor + search agents | `eve/agents.yaml`, `skills/` | Small |
| 7. Harness + workflow tuning | `eve/x-eve.yaml`, `eve/workflows.yaml` | Trivial |
| 8. Chat attachments propagation fix | `apps/api/src/chat/chat.service.ts` | Small |

Steps 1–3 and 6–7 are config changes. Step 4 is the real work.

## Platform Prerequisites — Mostly met

Most platform features required for this plan are implemented; the gaps below need explicit handling.

| Feature | Commit | What it does for us |
|---------|--------|---------------------|
| Staged council dispatch | `70ccf9c1` | Coordinator prepares → experts fan out → coordinator synthesizes |
| Backlog child cleanup | `e8f8de81` | Solo path: coordinator returns `success`, 7 backlog experts auto-cancelled |
| Coordination inbox on agent-runtime | `e8f8de81` | Experts read `.eve/coordination-inbox.md` with coordinator's prepared content |
| Chat file materialization | `d4a7c0e8` | Slack file uploads staged to `.eve/attachments/` with index.json |
| Agent aliases | `ae45f6a9` | `@eve pm` instead of `@eve pmbot-pm` |
| Chat outbound delivery | `0e438411` | Agent results posted back to Slack thread |
| EveMessageRelay + progress | `b5373709` | Agents can send progress updates to Slack during execution via `eve-message` blocks |

Residual gaps that affect this plan:

- Team route (`target: team:...`) to `chat.service` needs `chat_files` passed through to hints so attachments stage.
- Workflow `target:` field is inert today; use workflow `steps` + agent names.
- Current checked-in `eve/teams.yaml` and `eve/agents.yaml` are not yet aligned to one-route/staged assumptions.

### Progress Updates

The coordinator can now send live progress to Slack during the prepare
phase using `eve-message` fenced blocks:

```
```eve-message
Transcribing meeting recording (3m 42s audio)...
```
```

```
```eve-message
Transcript ready. Dispatching to 7 expert reviewers...
```
```

These appear in the Slack thread in real-time (rate-limited to 1 per 30s).
The coordinator skill should emit progress updates during transcription
and before returning `prepared`.

## Verification

### Panel review (full flow)
```
@eve pm review this + product-spec.pdf
```
Coordinator reads PDF → `prepared` → 7 experts review → synthesis → Slack reply.

### Solo answer (no fanout)
```
@eve pm is dark mode worth doing for v1?
```
Coordinator answers directly → `success` → Slack reply. No experts invoked.

### Audio transcription + review
```
@eve pm review this + standup-recording.m4a
```
Coordinator transcribes → `prepared` → experts review transcript → synthesis → Slack reply.

### Decision capture
```
@eve pm note: we decided to go with Postgres for the event store
```
Coordinator acknowledges → `success` → Slack reply.

### Search
```
@eve pm find the pricing spec we reviewed last week
```
Coordinator searches → `success` → Slack reply with results.

### CLI ingest
```bash
eve ingest roadmap.pdf --project <proj_id>
```
`doc.ingest` → staged council → coordinator prepares → experts review → synthesis.

## End-to-End: The Full Panel Path

```
@eve pm review this + meeting.m4a
  │
  ▼  alias "pm" → team:expert-panel (staged council)
  │
  ▼  Chat service creates:
  │    coordinator job (ready, staged, supervising)
  │    7 expert jobs (backlog)
  │    coordination thread
  │
  ▼  COORDINATOR: TRIAGE
  │   reads message + .eve/attachments/index.json
  │   detects audio file → needs transcription → needs panel review
  │
  ▼  COORDINATOR: PREPARE
  │   eve-message → "Processing attached files..." → Slack thread
  │   whisper-cli → transcript
  │   posts transcript + context to coordination thread
  │   eve-message → "Content ready. Dispatching to 7 expert reviewers..." → Slack thread
  │   returns eve.status = "prepared"
  │
  ▼  Orchestrator: promotes 7 backlog → ready, wakes on children.all_done
  │
  ├── tech-lead ──── reads inbox ── reviews ── eve.summary ──┐
  ├── ux-advocate ── reads inbox ── reviews ── eve.summary ──┤
  ├── biz-analyst ── reads inbox ── reviews ── eve.summary ──┤
  ├── gtm-advocate ─ reads inbox ── reviews ── eve.summary ──┤ all parallel
  ├── risk-assessor  reads inbox ── reviews ── eve.summary ──┤
  ├── qa-strategist  reads inbox ── reviews ── eve.summary ──┤
  └── devils-adv ─── reads inbox ── reviews ── eve.summary ──┘
  │
  ▼  Orchestrator: wakes coordinator
  │
  ▼  COORDINATOR: SYNTHESIZE
  │   reads 7 summaries from .eve/coordination-inbox.md
  │   writes executive summary
  │   returns eve.status = "success"
  │
  ▼  Outbound delivery → Slack thread
```

## End-to-End: The Solo Path

```
@eve pm is dark mode worth doing?
  │
  ▼  alias "pm" → team:expert-panel (staged council)
  │
  ▼  Chat service creates:
  │    coordinator job (ready, staged, supervising)
  │    7 expert jobs (backlog)
  │
  ▼  COORDINATOR: TRIAGE
  │   reads message, no attachments, simple question
  │   decides: solo answer, no panel needed
  │
  ▼  COORDINATOR: RESPOND
  │   answers directly from PM expertise
  │   returns eve.status = "success"
  │
  ▼  Orchestrator: job done, backlog children cleaned up
  │
  ▼  Outbound delivery → Slack thread
```
