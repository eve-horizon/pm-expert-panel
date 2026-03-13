# Eden Manual Test Scenarios

Fast, progressive tests designed for Claude orchestration. A new project goes from empty to fully populated via API, UI, and AI workflows — dogfooding Eden's own PRD documents as test input.

> **Phase coverage:** Foundation → Changesets → Intelligence → Polish

## Quick Start

```bash
# Authenticate
eve auth login

# Set environment
export EVE_API_URL=https://api.eh1.incept5.dev
export ORG_SLUG=incept5
export EDEN_URL=https://eden.${ORG_SLUG}-eden-sandbox.eh1.incept5.dev
export PROJECT_SLUG=manual-test
export LC_PROJECT_SLUG=lifecycle-test
export EVE_CLI_PROJECT=eden
export EVE_CLI_ENV=sandbox

# Helper functions
TOKEN="${EVE_TOKEN:-$(eve auth token --raw)}"
api() { curl -sf -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" "$@"; }
api_code() { curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$@"; }

# Playwright (for UI scenarios)
cd apps/web && npx playwright install chromium
```

## Test Scenarios

| # | Scenario | Time | Parallel | LLM | Type |
|---|----------|------|----------|-----|------|
| 01 | [API Smoke & Project Setup](scenarios/01-api-smoke.md) | ~2m | Yes | No | curl |
| 02 | [Story Map CRUD](scenarios/02-story-map-crud.md) | ~5m | No | No | curl |
| 03 | [Releases, Questions & Search](scenarios/03-releases-questions-search.md) | ~3m | No | No | curl |
| 04 | [Changesets — Create, Review, Apply](scenarios/04-changesets.md) | ~4m | No | No | curl |
| 05 | [Audit Trail & Export](scenarios/05-audit-export.md) | ~2m | No | No | curl |
| 06 | [Story Map UI](scenarios/06-story-map-ui.md) | ~5m | No | No | Playwright |
| 07 | [Q&A, Changes & Sources Pages](scenarios/07-ui-pages.md) | ~5m | No | No | Playwright |
| 07b | [Chat Panel UI](scenarios/07b-chat-panel-ui.md) | ~5m | No | No/Yes | Playwright |
| 08 | [Document Ingestion Pipeline](scenarios/08-ingestion-pipeline.md) | ~10m | No | Yes | curl + Eve |
| 09 | [Expert Panel Review via Chat](scenarios/09-expert-panel-chat.md) | ~10m | No | Yes | curl + Eve |
| 10 | [Chat-Driven Map Editing](scenarios/10-chat-map-editing.md) | ~5m | No | Yes | curl + Eve |
| 11 | [Question Evolution Workflow](scenarios/11-question-evolution.md) | ~5m | No | Yes | curl + Eve |
| 12 | [Alignment Check After Changeset](scenarios/12-alignment-check.md) | ~5m | No | Yes | curl + Eve |
| 13 | [Full Project Lifecycle](scenarios/13-full-lifecycle.md) | ~15m | Yes | Yes | All |
| 14 | [Reviews Integration — Chat to Map](scenarios/14-reviews-integration.md) | ~8m | No | Yes | curl + Eve |

**Minimum viable run:** Scenarios 01–07 (~25 minutes, no LLM cost)
**Full suite:** Scenarios 01–14 (~60 minutes, requires Eve agents)

## Running Order

Scenarios build on each other progressively:

```
Phase A: Foundation (API, no LLM)
  01 → 02 → 03 → 04 → 05

Phase B: UI Verification (Playwright, no LLM)
  06 → 07 → 07b

Phase C: Intelligence (API + Eve agents)
  08 → 09 → 10 → 11 → 12

Phase D: Integration (Full stack)
  13 → 14
```

## Running with Orchestration

```bash
# Run Phase A sequentially
for s in 01 02 03 04 05; do
  echo "=== Scenario $s ==="
  # Execute scenario steps
done

# Run a single scenario
# Follow the steps in scenarios/NN-slug.md
```

## Prerequisites

- Eve CLI authenticated (`eve auth login`)
- Staging deployment is up (`eve env show sandbox`)
- `EVE_API_URL` set to staging API
- For UI scenarios: Playwright installed (`npx playwright install chromium`)
- For intelligence scenarios: Eve agents synced (`eve agents sync`)

## Interpreting Results

Each scenario has a **Success Criteria** checklist. All checkboxes must pass for the scenario to be considered successful. Commands should complete without error, assertions should match expected output.

## Observability

### Tier 1: User CLI (Always Try First)

```bash
eve job list --project eden --json | jq '.[] | {id, description, phase}'
eve job follow $JOB_ID
eve job diagnose $JOB_ID
eve system status
```

### Tier 2: Eve Logs

```bash
eve system logs api --tail 50
eve system logs worker --tail 50
eve job logs $JOB_ID
```

### Tier 3: Direct API

```bash
# Check chat routing
api "$EDEN_URL/api/projects/$PROJECT_ID/chat/threads" | jq '.[].title'

# Check all changesets
api "$EDEN_URL/api/projects/$PROJECT_ID/changesets" | jq '.[] | {title, status, source}'

# Check map state
api "$EDEN_URL/api/projects/$PROJECT_ID/map" | jq '{
  personas: [.personas[].code],
  activities: [.activities[].name],
  task_count: [.activities[].steps[].tasks | length] | add
}'
```

## Environment Variables

```bash
# Required for all scenarios
export EVE_API_URL=https://api.eh1.incept5.dev
export ORG_SLUG=incept5
export EDEN_URL=https://eden.${ORG_SLUG}-eden-sandbox.eh1.incept5.dev
export EVE_CLI_PROJECT=eden
export EVE_CLI_ENV=sandbox
export PROJECT_SLUG=manual-test
export LC_PROJECT_SLUG=lifecycle-test

# Set by Scenario 01 (used by all subsequent)
export PROJECT_ID=<from scenario 01>

# Set by Scenario 13 (used within)
export LC_PROJECT_ID=<from scenario 13>
```
