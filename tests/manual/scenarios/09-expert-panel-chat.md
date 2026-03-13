# Scenario 09: Expert Panel Review via Chat

**Time:** ~10 minutes
**Parallel Safe:** No
**LLM Required:** Yes (Eve agents — 1 coordinator + 7 experts)

**This is the core dogfooding scenario.** We send Eden's own PRD to the expert panel via chat, watch the staged council dispatch, and verify we get a comprehensive multi-perspective review.

## Prerequisites

- Scenarios 01–02 passed — project exists
- Eve agents synced and chat routing active

## Steps

### 1. Create a Chat Thread with PRD Review Request

The chat API creates a thread and sends the first message in one call. The field is `message` (not `content`).

```bash
PRD_EXCERPT=$(head -200 docs/prd/high-level-summary.md)
MSG_PAYLOAD=$(jq -n --arg excerpt "$PRD_EXCERPT" \
  '{message: ("Please review this requirements summary and give me a full expert panel assessment. What are we missing? What are the risks? Are we ready to build?\n\n---\n\n" + $excerpt)}')
THREAD=$(api -X POST "$EDEN_URL/api/projects/$PROJECT_ID/chat/threads" -d "$MSG_PAYLOAD")
THREAD_ID=$(echo "$THREAD" | jq -r '.thread_id')
PARENT_JOB=$(echo "$THREAD" | jq -r '.job_ids[0]')
echo "Thread: $THREAD_ID  Parent job: $PARENT_JOB"
```

**Expected:** Thread created with message. Eve chat routing activates `team:expert-panel`. Response contains `thread_id` and `job_ids` (8 jobs: 1 coordinator + 7 experts in backlog).

> **API note:** The chat API field is `message`, not `content`. The response returns `{thread_id, job_ids}`, not `{id}`.

### 2. (Combined with Step 1)

Thread creation and message sending happen in a single call to `POST /projects/:id/chat/threads`.

### 3. Monitor Coordinator and Expert Fan-Out

The job IDs are returned by step 1. The parent job is the coordinator; children `.1` through `.7` are the 7 experts.

```bash
# Poll with abort detection (see README fail-fast section)
TIMEOUT=360; START=$(date +%s)
while true; do
  ELAPSED=$(( $(date +%s) - START ))
  [ $ELAPSED -gt $TIMEOUT ] && echo "TIMEOUT" && break

  PARENT_PHASE=$(eve job show $PARENT_JOB 2>&1 | grep "Phase:" | awk '{print $2}')
  ACTIVE=0; DONE=0; CANCELLED=0
  for s in .1 .2 .3 .4 .5 .6 .7; do
    P=$(eve job show "${PARENT_JOB}${s}" 2>&1 | grep "Phase:" | awk '{print $2}')
    case $P in active) ACTIVE=$((ACTIVE+1));; done) DONE=$((DONE+1));; cancelled) CANCELLED=$((CANCELLED+1));; esac
  done
  echo "[${ELAPSED}s] Parent: $PARENT_PHASE | Experts — active:$ACTIVE done:$DONE cancelled:$CANCELLED"

  [ "$PARENT_PHASE" = "done" ] && [ "$DONE" -ge 7 ] && echo "Panel complete!" && break
  [ "$CANCELLED" -ge 7 ] && echo "Solo path — coordinator handled it alone" && break

  # Abort if agent stuck on permissions
  BLOCKS=$(eve job logs $PARENT_JOB 2>&1 | grep -c "requires approval" || true)
  [ "$BLOCKS" -gt 3 ] && echo "ABORT: permission blocks ($BLOCKS)" && break

  sleep 10
done
```

**Expected (panel path):**
- Coordinator returns `prepared` → 7 expert jobs activate in parallel
- All 8 complete within ~6 minutes

**Acceptable (solo path):**
- Coordinator returns `success` → all 7 experts auto-cancelled
- Coordinator response contains all expert perspectives inline
- This happens when the coordinator decides it can handle the request alone

### 6. Verify Review Created

```bash
REVIEWS=$(api "$EDEN_URL/api/projects/$PROJECT_ID/reviews")
REVIEW=$(echo "$REVIEWS" | jq '.[0]')
echo "$REVIEW" | jq '{id, status, expert_count: (.expert_opinions | length)}'
```

**Expected:**
- Review record created with synthesis
- 7 expert opinions attached

### 7. Read Expert Opinions

```bash
REVIEW_ID=$(echo "$REVIEW" | jq -r '.id')
api "$EDEN_URL/api/projects/$PROJECT_ID/reviews/$REVIEW_ID" | jq '.expert_opinions[] | {slug, summary: .summary[0:100]}'
```

**Expected:** 7 distinct expert opinions, each from a different perspective:
- Tech Lead: architecture, feasibility
- UX Advocate: accessibility, user journeys
- Business Analyst: process flows, success criteria
- GTM Advocate: market positioning
- Risk Assessor: timeline, dependency risks
- QA Strategist: testing gaps, edge cases
- Devil's Advocate: challenged assumptions

### 8. Read Synthesis

```bash
api "$EDEN_URL/api/projects/$PROJECT_ID/reviews/$REVIEW_ID" | jq '.synthesis'
```

**Expected:** Executive summary covering:
- Consensus across experts
- Points of dissent
- Critical risks
- Key open questions
- Recommended actions

### 9. Poll Chat Thread for Response

```bash
MESSAGES=$(api "$EDEN_URL/api/chat/threads/$THREAD_ID/messages")
echo "$MESSAGES" | jq '.[-1].content[0:500]'
```

**Expected:** Final message in thread contains the synthesized expert review.

## Debugging

```bash
# Check chat route resolution
eve job list --project eden --json | jq '.[] | {id, description, phase, close_reason}'

# Inspect coordinator decision
eve job logs $COORD_JOB 2>&1 | grep -i "prepared\|success"

# Check expert jobs
eve job list --project eden --json | jq '.[] | select(.phase != "done") | {id, description, phase}'
```

## Success Criteria

- [ ] Chat thread created via API
- [ ] Message routed to expert-panel team
- [ ] Coordinator triages and returns `prepared`
- [ ] 7 expert jobs fan out in parallel
- [ ] All expert jobs complete within timeout
- [ ] Review record created with 7 opinions
- [ ] Each opinion covers its domain-specific perspective
- [ ] Synthesis combines all perspectives coherently
- [ ] Chat thread receives synthesized response
- [ ] No secrets (API keys, tokens) appear in job logs
