# Eden Phase 5 — Private Model Migration (Qwen3.5 on Mac Mini)

> **Status**: Proposed
> **Date**: 2026-03-12
> **Phase**: 5 of 5
> **Depends on**: Phase 4 (Polish & Production Hardening)
> **Parent plan**: `eden-evolution.md`
> **Estimated effort**: 2–3 weeks
>
> **Delivers**: Full migration from frontier models (Claude/Sonnet via
> Anthropic API) to private models (Qwen3.5 multimodal via Ollama) running
> on a Mac Mini connected to Eve's staging infrastructure via Tailscale VPN.
> This eliminates API costs, enables air-gapped operation, and proves Eden
> can run entirely on self-hosted inference.

---

## The Vision

Eden Phase 4 delivers a complete product running on Claude Sonnet — fast,
capable, but dependent on Anthropic's API for every agent invocation. Phase 5
cuts that dependency.

A Mac Mini running Ollama with Qwen3.5 (multimodal, 32B+ parameters)
becomes Eden's private inference engine. Eve's Ollama inference target system
handles routing, protocol bridging, and model management. The same agents,
same skills, same workflows — just a different brain.

**Why Qwen3.5**: Multimodal (text + images for document ingestion), strong
reasoning for extraction/synthesis, open-weight for self-hosting, competitive
with frontier models on structured tasks.

**Why Mac Mini**: Apple Silicon (M4 Pro/Max) provides excellent inference
performance for models up to ~70B parameters with unified memory. Silent,
low-power, rack-mountable. Already on Tailscale.

---

## Scope

### What Ships

1. **Mac Mini inference setup** — Ollama running Qwen3.5 multimodal with
   optimized quantization, exposed via Tailscale VPN.
2. **Eve Ollama target registration** — Mac Mini registered as an
   `external_ollama` inference target with health checks.
3. **Model catalog entries** — Qwen3.5 registered as a managed model with
   install records, aliases, and route policies.
4. **Agent profile migration** — All 14 agent harness profiles updated to
   use `managed/qwen3.5` instead of Claude/Sonnet.
5. **Protocol bridge configuration** — If needed, bridge between the harness
   protocol and Ollama's API.
6. **Quality benchmarking** — Side-by-side comparison of Claude vs Qwen3.5
   output quality for each agent role.
7. **Document ingestion validation** — Qwen3.5's multimodal capabilities
   tested for PDF extraction, image analysis, and audio transcription.
8. **Fallback configuration** — Route policies with fallback to frontier
   models when private target is unavailable.

### What Does NOT Ship

- No changes to the NestJS API, React SPA, or database schema.
- No new agents or workflows.
- No changes to the changeset system.

---

## Prerequisites

- Phase 4 complete — Eden v1 running on frontier models in staging.
- Mac Mini hardware available with:
  - Apple Silicon (M4 Pro recommended, 36GB+ unified memory)
  - macOS with Ollama installed
  - Tailscale installed and connected to the same tailnet as Eve staging
- Tailscale tailnet accessible from Eve staging workers.
- Qwen3.5 model weights downloaded (via `ollama pull`).

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Eve Staging (eh1.incept5.dev)                           │
│                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────┐  │
│  │ Worker   │───▶│ Ollama   │───▶│ Route Policy     │  │
│  │ (agent)  │    │ Router   │    │ managed/qwen3.5  │  │
│  └──────────┘    └──────────┘    └────────┬─────────┘  │
│                                           │             │
└───────────────────────────────────────────┼─────────────┘
                                            │
                              Tailscale VPN │ (100.x.x.x)
                                            │
┌───────────────────────────────────────────┼─────────────┐
│ Mac Mini (private)                        │             │
│                                           ▼             │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Ollama Server (:11434)                            │  │
│  │                                                    │  │
│  │  Qwen3.5-32B (Q4_K_M quantization)               │  │
│  │  - Text generation                                 │  │
│  │  - Image understanding (multimodal)               │  │
│  │  - Structured output (JSON mode)                   │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  Apple Silicon M4 Pro · 36GB unified memory             │
│  Tailscale IP: 100.x.x.x                               │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### 5a. Mac Mini Inference Setup (Medium)

**Install and configure Ollama:**

```bash
# On the Mac Mini
brew install ollama

# Pull Qwen3.5 (use appropriate quantization for available memory)
# For 36GB M4 Pro — Q4_K_M of the 32B model fits comfortably
ollama pull qwen3.5:32b-q4_K_M

# For multimodal support, verify the model supports vision
ollama show qwen3.5:32b-q4_K_M --modelfile

# Start Ollama server (listens on 0.0.0.0:11434 for Tailscale access)
OLLAMA_HOST=0.0.0.0:11434 ollama serve
```

**Tailscale configuration:**

```bash
# Ensure Tailscale is running and connected
tailscale status

# Note the Tailscale IP (100.x.x.x)
tailscale ip -4

# Verify Ollama is accessible from the tailnet
# (from another Tailscale machine)
curl http://100.x.x.x:11434/api/tags
```

**Ollama Modelfile tuning** (if needed):

```
FROM qwen3.5:32b-q4_K_M
PARAMETER num_ctx 32768
PARAMETER temperature 0.3
PARAMETER top_p 0.9
PARAMETER num_gpu 999
```

### 5b. Register Ollama Target in Eve (Small)

```bash
# Register Mac Mini as an external Ollama target
eve ollama target add \
  --name mac-mini-qwen \
  --base-url http://100.x.x.x:11434 \
  --target-type external_ollama \
  --transport-profile ollama_api \
  --scope-kind project \
  --scope-id $EDEN_PROJECT_ID

# Test connectivity
eve ollama target test $TARGET_ID

# Verify available models on target
eve ollama target models $TARGET_ID
# Expected: qwen3.5:32b-q4_K_M
```

### 5c. Register Model + Install (Small)

```bash
# Register Qwen3.5 in Eve's model catalog
eve ollama model add \
  --canonical qwen3.5-32b \
  --provider ollama \
  --slug qwen3.5:32b-q4_K_M

# Create install record (links model to target)
eve ollama install add \
  --target-id $TARGET_ID \
  --model-id qwen3.5-32b \
  --requires-warm-start true \
  --min-target-capacity 1

# Pre-pull model on target (ensure it's cached)
eve ollama target pull $TARGET_ID --model-id qwen3.5-32b

# Set up alias for easy reference
eve ollama alias set \
  --alias qwen3.5 \
  --target-id $TARGET_ID \
  --model-id qwen3.5-32b \
  --scope-kind project \
  --scope-id $EDEN_PROJECT_ID
```

### 5d. Publish as Managed Model (Small)

```bash
# Publish to make available as managed/qwen3.5-32b
eve ollama managed publish \
  --canonical qwen3.5-32b \
  --provider ollama \
  --slug qwen3.5:32b-q4_K_M \
  --target-id $TARGET_ID \
  --requires-warm-start true \
  --enabled true

# Verify publication
eve ollama managed list
```

### 5e. Configure Route Policy (Small)

```bash
# Set route policy: prefer Mac Mini target for this project
eve ollama route-policy set \
  --scope-kind project \
  --scope-id $EDEN_PROJECT_ID \
  --preferred-target-id $TARGET_ID \
  --fallback-to-alias-target true
```

**Fallback behavior**: If the Mac Mini is unreachable (powered off, Tailscale
disconnected), requests fall back to the alias target (frontier model) if
configured. This provides graceful degradation.

### 5f. Protocol Bridge (If Needed) (Small)

Eve's harnesses (mclaude, claude, zai) speak Anthropic's API protocol.
Ollama speaks its own protocol or OpenAI-compatible. If the agent's harness
and the Ollama target have a protocol mismatch, Eve routes through a
protocol bridge automatically.

**Check if bridge is needed:**

```bash
# Diagnose a test job to see routing
eve job diagnose $TEST_JOB_ID
# Look for: direct route vs bridge route, protocol pair
```

**If bridge configuration is needed:**

```bash
# LiteLLM bridge (anthropic → openai-compat)
eve secrets set EVE_BRIDGE_LITELLM_ANTHROPIC_OPENAI_URL "http://litellm:4000"
eve secrets set EVE_BRIDGE_LITELLM_ANTHROPIC_OPENAI_KEY "<bridge-api-key>"
```

**Alternative: Use OpenAI-compatible transport:**

If Ollama is configured with `--transport-profile openai_compat`, agents
using the `code` or `codex` harness (which speak OpenAI protocol) can route
directly without a bridge. Consider switching agent profiles to a harness
with native OpenAI compatibility.

### 5g. Migrate Agent Profiles (Medium)

Update `eve/x-eve.yaml` to use the managed model:

```yaml
# eve/x-eve.yaml — updated profiles
x-eve:
  agents:
    version: 1
    profiles:
      coordinator:
        - harness: claude
          model: managed/qwen3.5-32b
          reasoning_effort: medium
      expert:
        - harness: claude
          model: managed/qwen3.5-32b
          reasoning_effort: medium
      monitor:
        - harness: claude
          model: managed/qwen3.5-32b
          reasoning_effort: low
```

**Key**: The `model: managed/qwen3.5-32b` reference tells Eve to route
inference through the managed model system, which resolves to the Mac Mini
target via the route policy.

**Sync agents after update:**

```bash
eve agents sync --project eden --local --allow-dirty
```

### 5h. Per-Agent Quality Benchmarking (Medium)

Test each agent role with the same inputs on both Claude and Qwen3.5.
Compare output quality.

**Benchmark matrix:**

| Agent | Test Input | Quality Criteria |
|---|---|---|
| **Coordinator** | "Review this spec" + 10-page PDF | Correct triage, meaningful synthesis |
| **Tech Lead** | Same PDF | Technical concerns identified, architecture risks flagged |
| **UX Advocate** | Same PDF | UX gaps found, accessibility mentioned |
| **Biz Analyst** | Same PDF | Process flows identified, success criteria defined |
| **Ingestion** | PDF + DOCX + image | Clean text extraction, page markers present |
| **Extraction** | Extracted text from ingestion | Correct persona/activity/task identification, valid JSON output |
| **Synthesis** | Extraction JSON + existing map | Meaningful changeset, correct match/new/conflict decisions |
| **Alignment** | Map with known conflicts | Conflicts detected, relevant questions created |
| **Map Chat** | "Add admin approval to onboarding" | Sensible changeset, correct entity references |
| **Question** | Answered question implying map change | Changeset proposed with correct updates |

**Benchmark script pattern:**

```bash
#!/bin/bash
# Run same job on both models, compare results
echo "=== Agent Quality Benchmark: $AGENT_SLUG ==="

# Run with Claude (baseline)
eve job create --project eden \
  --description "$TEST_PROMPT" \
  --agent $AGENT_SLUG \
  --model sonnet \
  --claim --wait --timeout 300
CLAUDE_RESULT=$(eve job result $CLAUDE_JOB_ID)

# Run with Qwen3.5
eve job create --project eden \
  --description "$TEST_PROMPT" \
  --agent $AGENT_SLUG \
  --model managed/qwen3.5-32b \
  --claim --wait --timeout 300
QWEN_RESULT=$(eve job result $QWEN_JOB_ID)

# Compare (manual review + automated checks)
echo "Claude result:" && echo "$CLAUDE_RESULT" | head -50
echo "Qwen3.5 result:" && echo "$QWEN_RESULT" | head -50

# Cost comparison
eve job receipt $CLAUDE_JOB_ID
eve job receipt $QWEN_JOB_ID
```

### 5i. Multimodal Document Ingestion Validation (Medium)

Qwen3.5's multimodal capabilities are critical for the ingestion agent.
Test specifically:

| Input Type | Test | Pass Criteria |
|---|---|---|
| **PDF** | 20-page product spec | Text extraction matches Claude quality |
| **DOCX** | Document with tables + images | Tables preserved, image descriptions generated |
| **Image** | Whiteboard photo | Text extracted via OCR, diagram described |
| **Screenshot** | UI mockup screenshot | UI elements identified, text extracted |
| **Slide deck** | 30-slide PPTX | Slide-by-slide content, speaker notes included |

**Image understanding test:**

```bash
# Test Qwen3.5 vision with a whiteboard photo
eve job create --project eden \
  --description "Describe this whiteboard and extract all text" \
  --agent ingestion \
  --model managed/qwen3.5-32b \
  --resource-refs '[{"type":"file","path":"test-fixtures/whiteboard.jpg"}]' \
  --claim --wait
```

### 5j. Fallback + Monitoring Configuration (Small)

**Fallback chain**: If Mac Mini is down, fall back to frontier models:

```yaml
# eve/x-eve.yaml — profiles with fallback
x-eve:
  agents:
    version: 1
    availability:
      drop_unavailable: true
    profiles:
      coordinator:
        - harness: claude
          model: managed/qwen3.5-32b
          reasoning_effort: medium
        - harness: claude
          model: sonnet
          reasoning_effort: medium
      expert:
        - harness: claude
          model: managed/qwen3.5-32b
          reasoning_effort: medium
        - harness: claude
          model: sonnet
          reasoning_effort: medium
```

With `drop_unavailable: true`, Eve automatically falls back to the next
profile entry if the managed model target is unreachable.

**Monitoring:**

```bash
# Check target health
eve ollama target test $TARGET_ID

# Check managed model status
eve ollama managed list --json

# Monitor inference routing in job diagnostics
eve job diagnose $JOB_ID
# Look for: route=direct, target=mac-mini-qwen, model=qwen3.5-32b
```

---

## Verification Loop (Staging)

### Deploy

```bash
# Sync agents with updated profiles
eve agents sync --project eden --local --allow-dirty

# No service redeploy needed — only agent profiles changed
# Verify target is healthy
eve ollama target test $TARGET_ID
```

### Acceptance Criteria

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| **V5.1** | Target connectivity | `eve ollama target test $TARGET_ID` | Target reachable, model available |
| **V5.2** | Managed model published | `eve ollama managed list` | `qwen3.5-32b` listed, enabled, target assigned |
| **V5.3** | Route policy active | `eve ollama route-policies --scope-kind project` | Mac Mini target preferred for eden project |
| **V5.4** | Agent uses private model | Create test job → `eve job diagnose` | Route shows: target=mac-mini-qwen, model=managed/qwen3.5-32b |
| **V5.5** | Ingestion pipeline | Upload PDF → full pipeline | Pipeline completes using Qwen3.5 for all 3 steps |
| **V5.6** | Map chat | Chat: "add a payment flow" | Coordinator triages + map-chat produces changeset via Qwen3.5 |
| **V5.7** | Expert panel | Slack: `@eve pm review this` + PDF | 7 experts complete using Qwen3.5, synthesis quality acceptable |
| **V5.8** | Alignment detection | Accept changeset with conflict | Alignment agent detects conflict using Qwen3.5 |
| **V5.9** | Multimodal ingestion | Upload whiteboard photo | Ingestion agent extracts text + describes diagram via Qwen3.5 vision |
| **V5.10** | Fallback | Power off Mac Mini → send chat message | Agent falls back to Sonnet, job succeeds |
| **V5.11** | Cost comparison | Run same workload on both models | Qwen3.5 job receipt shows $0.00, Claude shows API cost |
| **V5.12** | Latency comparison | Time 10 agent invocations on each model | Document p50/p95 latency difference |

### Full Pipeline Smoke Test (Private Models)

```bash
#!/bin/bash
set -euo pipefail
API="https://api.${ORG_SLUG}-eden-sandbox.eh1.incept5.dev"

echo "=== Phase 5: Full Pipeline on Private Models ==="

# 1. Verify target health
echo "Checking inference target..."
eve ollama target test $TARGET_ID || { echo "Target unreachable!"; exit 1; }
echo "✓ Mac Mini target healthy"

# 2. Upload + ingest (uses Qwen3.5)
SOURCE=$(curl -sf -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename":"test-spec.pdf","content_type":"application/pdf"}' \
  "$API/api/projects/$PROJECT_ID/sources")
SOURCE_ID=$(echo $SOURCE | jq -r .id)
UPLOAD_URL=$(echo $SOURCE | jq -r .upload_url)
curl -sf -X PUT -T test-fixtures/test-spec.pdf "$UPLOAD_URL"
curl -sf -X POST -H "Authorization: Bearer $TOKEN" \
  "$API/api/sources/$SOURCE_ID/confirm" > /dev/null
echo "✓ Upload confirmed, pipeline running on Qwen3.5"

# 3. Wait for pipeline
for i in $(seq 1 90); do
  STATUS=$(curl -sf -H "Authorization: Bearer $TOKEN" \
    "$API/api/sources/$SOURCE_ID" | jq -r .status)
  if [ "$STATUS" = "synthesized" ]; then
    echo "✓ Pipeline complete after $((i * 5))s (Qwen3.5)"
    break
  elif [ "$STATUS" = "failed" ]; then
    echo "✗ Pipeline failed on Qwen3.5"
    # Check job diagnostics
    JOB_ID=$(curl -sf -H "Authorization: Bearer $TOKEN" \
      "$API/api/sources/$SOURCE_ID" | jq -r .eve_job_id)
    eve job diagnose $JOB_ID
    exit 1
  fi
  sleep 5
done

# 4. Verify changeset quality
CS=$(curl -sf -H "Authorization: Bearer $TOKEN" \
  "$API/api/projects/$PROJECT_ID/changesets?status=pending" | jq '.[0]')
ITEMS=$(echo $CS | jq '.item_count')
echo "✓ Changeset with $ITEMS items generated by Qwen3.5"

# 5. Verify routing was through private model
JOB_ID=$(curl -sf -H "Authorization: Bearer $TOKEN" \
  "$API/api/sources/$SOURCE_ID" | jq -r .eve_job_id)
eve job diagnose $JOB_ID 2>&1 | grep -i "target\|route\|model"
echo "✓ Routing confirmed through Mac Mini target"

# 6. Cost check
eve job receipt $JOB_ID
echo "✓ Cost receipt (should show $0.00 for private model)"

echo "=== Phase 5 passed — full pipeline on private models ==="
```

---

## Exit Criteria

Phase 5 is complete when:

- [ ] Mac Mini running Ollama with Qwen3.5, accessible via Tailscale
- [ ] Registered as external_ollama target in Eve, passing health checks
- [ ] Managed model published and alias configured
- [ ] Route policy directs Eden project traffic to Mac Mini
- [ ] All 14 agents function correctly on Qwen3.5
- [ ] Ingestion pipeline completes end-to-end on private model
- [ ] Multimodal ingestion works (images, PDFs with images)
- [ ] Quality benchmark documented: Claude vs Qwen3.5 per agent role
- [ ] Latency benchmark documented: p50/p95 per agent role
- [ ] Fallback to frontier models works when Mac Mini is unreachable
- [ ] Zero API cost for full pipeline execution on private model
- [ ] All V5.x acceptance criteria pass on staging

**Phase 5 = Eden v1 on private infrastructure.** Zero API dependency.

---

## Risks

| Risk | Mitigation |
|------|-----------|
| Qwen3.5 quality insufficient for extraction/synthesis | Benchmark early; keep frontier fallback; try larger quantization or bigger model |
| Mac Mini memory insufficient for 32B model | Use Q4_K_M quantization; consider Q3 if tight; or use Mac Mini with 64GB |
| Tailscale latency too high for interactive chat | Measure round-trip; consider colocating Mac Mini closer to Eve staging |
| Ollama instability under sustained load | Monitor with `eve ollama target test`; set up auto-restart via launchd |
| Protocol bridge adds latency | Test direct route first; use openai_compat transport if possible |
| Model updates break quality | Pin model version in Ollama; test upgrades before switching |

---

## Cost Model

| Scenario | Claude Sonnet | Qwen3.5 (Private) |
|---|---|---|
| Single document ingestion (3-step pipeline) | ~$0.50–$2.00 | $0.00 |
| Expert panel review (8 agents) | ~$1.00–$3.00 | $0.00 |
| Map chat interaction | ~$0.05–$0.20 | $0.00 |
| Alignment check | ~$0.10–$0.50 | $0.00 |
| Monthly (50 documents, 200 chat messages) | ~$100–$300 | Electricity only (~$10) |

The Mac Mini pays for itself within the first month of active use.
