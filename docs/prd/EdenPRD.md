# Eden — Product Requirements Document

## Vision

Eden is an AI-first requirements platform that replaces the messy, lossy handoff between "what we heard" and "what we build." It ingests requirements from any source — conversations, documents, recordings, sketches — and synthesises them into a living, structured story map that stays aligned as projects evolve.

The core insight: requirements don't fail because teams lack tools. They fail because the gap between raw intent (a stakeholder interview, a PDF spec, a whiteboard sketch) and structured delivery artefacts (user stories, acceptance criteria, a prioritised backlog) is bridged manually, slowly, and imperfectly. Eden closes that gap with AI agents that do the heavy lifting while humans retain full control through a review-and-approve workflow.

---

## Problem

### The requirements gap is where projects go wrong

1. **Scattered inputs, no single source of truth.** Requirements live in meeting notes, Confluence pages, Slack threads, email attachments, recorded calls, and people's heads. Assembling them into a coherent picture is manual, error-prone, and never truly complete.

2. **Translation loss.** A stakeholder says something in a workshop. A BA writes it up. A PM reshapes it into stories. A developer interprets the story. At each stage, intent degrades. Nuance is lost. Assumptions creep in unnoticed.

3. **Static artefacts in a dynamic world.** Requirements documents are written once and immediately start decaying. When scope changes, new information surfaces, or teams ask clarifying questions, the map doesn't evolve — it just gets stale.

4. **Alignment is invisible until it's too late.** Conflicts between requirements, gaps in coverage, duplicate work, and unresolved assumptions hide in plain sight across dozens of documents. Teams discover them during development — the most expensive time to find them.

5. **No structured way to capture "why."** Tools track *what* will be built (Jira tickets, user stories) but not *why* — the stakeholder intent, business context, and reasoning that informed each decision. When "why" is lost, teams can't make good trade-off decisions later.

### Who feels this pain

- **Product managers** who spend days synthesising workshop outputs into backlogs and then days more keeping them current.
- **Business analysts** who manually map requirements across stakeholders and struggle to detect conflicts until they surface as bugs.
- **Engineering leads** who inherit incomplete, inconsistent specs and fill gaps with assumptions.
- **Stakeholders** who feel unheard because their input is simplified, reinterpreted, or lost in translation.

---

## Solution

Eden is a collaborative platform built around a **Patton-style user story map** — a visual grid that organises work by user journey (activities and steps) and persona, with tasks as the atomic unit of delivery. What makes Eden different:

### 1. AI-powered ingestion: any source becomes structured requirements

Upload a PDF spec, a recorded stakeholder interview, a slide deck, a photo of a whiteboard — Eden's agent pipeline processes it automatically:

- **Ingestion Agent** extracts raw content (text from PDFs/docs, transcription from audio/video, description from images).
- **Extraction Agent** identifies personas, user stories, acceptance criteria, and open questions from the raw content.
- **Synthesis Agent** organises extracted requirements into the story map structure — matching to existing activities/steps or proposing new ones.

The output isn't a wall of AI-generated text dumped into a backlog. It's a structured changeset — "here are 12 new tasks I'd place under these 4 steps, with these persona assignments and these acceptance criteria" — presented for human review.

### 2. The map is the product, not a view of something else

The story map isn't a visualisation layer over a Jira board. It *is* the canonical representation of what the product does, for whom, and in what order. Everything in Eden flows through the map:

- Tasks are placed on steps within activities, assigned to personas.
- Each task carries user stories, acceptance criteria, and metadata.
- Questions are linked to tasks and surface as indicators on the map.
- Releases are slices of the map grouped for delivery.
- AI conversations reference and modify the map directly.

### 3. Conversational map editing with human-in-the-loop

Users interact with the map through a chat interface backed by the **Map Chat Agent**. Natural language requests — "add an admin approval step to the onboarding flow," "change all currency references from GBP to AUD," "what happens if the user cancels mid-checkout?" — produce changesets that the user reviews and approves before they're applied.

AI never writes directly to the map. Every modification goes through a proposal → review → accept/reject flow. This gives teams the speed of AI-assisted editing with the safety of human oversight.

### 4. Continuous alignment detection

The **Alignment Agent** runs automatically after changes are accepted, scanning for:

- **Conflicts** — requirements that contradict each other across personas or activities.
- **Gaps** — user journeys with missing steps, personas without coverage in key flows.
- **Duplicates** — tasks that describe the same thing in different words.
- **Unresolved assumptions** — implicit decisions that should be made explicit.

Issues surface as cross-cutting questions with direct references to the affected tasks, so the team can resolve them before they become expensive problems downstream.

### 5. Questions as a first-class concept

Questions aren't comments buried in tickets. They're a structured, tracked entity linked to specific tasks. The **Question Agent** processes answered questions and proposes map evolution — if an answer changes requirements, the map updates (via changeset review) to reflect the new understanding.

---

## User Personas

| Persona | Role in Eden | Primary actions |
|---------|-------------|-----------------|
| **Product Manager** | Primary map author. Runs workshops, ingests source material, reviews AI-proposed changes, manages releases. | Upload sources, chat with map, review changesets, assign tasks to releases, manage team |
| **Business Analyst** | Requirements specialist. Refines tasks, writes acceptance criteria, resolves questions, checks alignment. | Edit tasks, answer questions, review alignment findings, filter by persona |
| **Engineering Lead** | Consumer of structured requirements. Uses the map to understand scope, dependencies, and delivery slices. | Browse map, read task details, check release scope, export for dev tooling |
| **Stakeholder** | Provides input (via documents, interviews) and reviews whether the map reflects their intent. | View map, answer questions, provide feedback on changesets |

---

## Core Capabilities

### Story Map
- Visual CSS Grid layout: activities (rows) → steps (columns) → tasks (cards)
- Multiple map views by persona (each persona gets their own map key)
- Task cards with progressive disclosure (title → expand for stories, ACs, questions)
- Drag-and-drop task placement (future)
- Role-based filtering (owner, handoff, shared roles per task-step relationship)
- Autosave with debounce

### AI Agents (7 specialised agents)
- **Orchestrator** — routes requests, composes multi-agent workflows
- **Map Chat** — conversational map editing, Q&A about map content
- **Question** — processes answered questions into map evolution proposals
- **Ingestion** — file processing (PDF, DOCX, PPTX, audio, image, video)
- **Extraction** — structured requirement extraction from raw content
- **Synthesis** — organises requirements into map structure
- **Alignment** — conflict/gap/duplicate detection

### Changeset Review
- All AI modifications proposed as reviewable changesets
- Summary + reasoning + itemised changes
- Accept/reject per changeset
- Full audit trail of what changed, when, and why

### Ingestion Pipeline
- Multi-modal: PDF (PyMuPDF), DOCX, PPTX, images (Claude Vision), audio (Whisper), video (frame extraction + transcription)
- Source tracking: every task traces back to its source document
- Incremental: new uploads merge into the existing map, not replace it

### Team & Access
- Project-scoped roles: owner, PM, researcher, engineer
- Invite via email
- JWT authentication

### Release Management
- Group tasks into named releases with target dates
- Status tracking (planning, in progress, released)
- Release-scoped views of the map

### Search & Export
- Cross-entity search across tasks, questions, and sources
- JSON and Markdown export of the full story map

---

## What Eden is NOT

- **Not a project management tool.** Eden captures and structures *what* to build and *why*. It doesn't track *who's doing it* or *when it's done* — that's Jira/Linear/Shortcut territory. Eden is the upstream input to those tools.
- **Not a document editor.** Eden doesn't try to replace Confluence or Notion. It *ingests* documents and extracts structured requirements from them.
- **Not an AI that writes your spec for you.** Eden's agents propose, humans decide. The AI accelerates synthesis and detects issues — it doesn't replace product thinking.
- **Not a diagramming tool.** The story map is a structured data model with a grid visualisation, not a freeform canvas.

---

## Architecture Summary

Four Docker services + two data stores:

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **eden-web** | Next.js 15, React 19, Tailwind v4, Zustand | Story map UI, chat, review, all frontend |
| **eden-api** | FastAPI (Python 3.12+) | Gateway: auth, CRUD, chat dispatch, WebSocket |
| **eden-agents** | FastAPI + BaseAgent framework | 7 AI agents with tool-use reasoning loops |
| **eden-worker** | Celery | Long-running background tasks (video, batch ingestion) |
| **PostgreSQL 16** | + pgvector | 15-table schema, semantic search embeddings |
| **Redis 7** | Streams + pub/sub | Session store, task queue, agent message bus |

LLM provider is pluggable (Anthropic Claude default, supports OpenAI, Ollama, OpenRouter). Per-project configurable.

---

## Data Model (key entities)

```
Projects
 ├── Personas (persona codes, colors, devices)
 ├── Activities (top-level journey rows)
 │    └── Steps (columns within activities)
 │         └── Step-Tasks (task placement with role: owner/handoff/shared)
 ├── Tasks (the atomic unit — stories, ACs, metadata)
 ├── Questions (task-level + cross-cutting, with responses)
 ├── Releases (task groupings for delivery)
 ├── Ingestion Sources (uploaded files + extracted text)
 ├── Chat Messages (conversation history + changesets)
 ├── Embeddings (pgvector for semantic search)
 └── Audit Log (full change history)
```

---

## Success Metrics

| Metric | Target | Why it matters |
|--------|--------|---------------|
| **Time from source to structured map** | 10x faster than manual | Core value prop — ingestion pipeline must dramatically reduce synthesis time |
| **Alignment issues caught before development** | >80% of conflicts/gaps detected | Alignment agent must surface problems early, not in sprint |
| **Changeset acceptance rate** | >70% accepted without modification | AI proposals must be high quality — low acceptance means noise, not help |
| **Source traceability** | 100% of tasks traceable to origin | Every requirement should link back to the document, recording, or conversation that spawned it |
| **Map currency** | Map reflects latest input within minutes | The map must stay alive — not a snapshot that decays |

---

## Target Market

**Phase 1: Internal tool.** Eden is built for internal use — validating the workflow on real projects before external release.

**Phase 2: Enterprise / regulated industries.** Organisations where requirements traceability, audit trails, and structured handoffs aren't optional — they're mandated. Think financial services, healthcare, government, defence. These teams already do Patton-style mapping (or should) and need the AI acceleration most.

**Phase 3: SaaS.** Broader market of product teams who want to move faster from "we talked to customers" to "here's what we're building."

---

## Deployment

- Local development: Docker Compose (all 6 containers)
- Production target: AWS ECS Fargate, multi-region
- Database: RDS PostgreSQL with pgvector
- File storage: S3 for uploaded sources
- Secrets: AWS Secrets Manager / environment variables
