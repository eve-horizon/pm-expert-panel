# Scenario 09: Expert Panel Review via Chat

**Time:** ~10 minutes
**Parallel Safe:** No
**LLM Required:** Yes (Eve agents — 1 coordinator + 7 experts)

**This is the core dogfooding scenario.** We send Eden's own PRD to the expert panel via chat, watch the staged council dispatch, and verify we get a comprehensive multi-perspective review.

## Prerequisites

- Scenarios 01–02 passed — project exists
- Eve agents synced and chat routing active

## Steps

### 1. Create a Chat Thread

```bash
THREAD=$(api -X POST "$EDEN_URL/api/projects/$PROJECT_ID/chat/threads" \
  -d '{"title": "Expert panel review of Eden PRD"}')
THREAD_ID=$(echo "$THREAD" | jq -r '.id')
echo "Thread: $THREAD_ID"
```

**Expected:** Thread created, ready for messages.

### 2. Send Message with Document Reference

```bash
# Read the PRD content
PRD_EXCERPT=$(cat docs/prd/high-level-summary.md | head -200)
MSG_PAYLOAD=$(jq -n --arg excerpt "$PRD_EXCERPT" '{content: ("Please review this requirements summary and give me a full expert panel assessment. What are we missing? What are the risks? Are we ready to build?\n\n---\n\n" + $excerpt)}')
MSG=$(api -X POST "$EDEN_URL/api/chat/threads/$THREAD_ID/messages" -d "$MSG_PAYLOAD")
MSG_ID=$(echo "$MSG" | jq -r '.id')
echo "Message sent: $MSG_ID"
```

**Expected:** Message accepted. Eve chat routing activates `team:expert-panel`.

### 3. Monitor Coordinator Phase 1 (Triage)

```bash
# Watch for jobs
for i in $(seq 1 12); do
  JOBS=$(eve job list --project eden --status active --json 2>/dev/null)
  JOB_COUNT=$(echo "$JOBS" | jq 'length')
  echo "Active jobs: $JOB_COUNT ($i)"
  [ "$JOB_COUNT" -gt 0 ] && break
  sleep 5
done

# Identify coordinator job
COORD_JOB=$(echo "$JOBS" | jq -r '.[] | select(.description | test("pm|coordinator"; "i")) | .id')
echo "Coordinator job: $COORD_JOB"
```

**Expected:** Coordinator job starts. It reads the message, detects substantial document + analysis intent.

### 4. Watch Expert Fan-Out (Phase 2)

```bash
# After coordinator returns "prepared", 7 expert jobs should start
for i in $(seq 1 24); do
  ALL_JOBS=$(eve job list --project eden --json 2>/dev/null)
  JOB_COUNT=$(echo "$ALL_JOBS" | jq 'length')
  echo "Total jobs: $JOB_COUNT ($i)"
  [ "$JOB_COUNT" -ge 8 ] && break  # 1 coordinator + 7 experts
  sleep 5
done

echo "$ALL_JOBS" | jq '.[] | {id, description, phase}'
```

**Expected:**
- 8 jobs total: 1 coordinator + 7 experts
- Experts run in parallel (all active simultaneously)
- Expert slugs: tech-lead, ux-advocate, business-analyst, gtm-advocate, risk-assessor, qa-strategist, devil-s-advocate

### 5. Wait for Synthesis (Phase 3)

```bash
# Wait for all jobs to complete
for i in $(seq 1 36); do
  DONE=$(eve job list --project eden --json 2>/dev/null | jq '[.[] | select(.phase == "done")] | length')
  echo "Completed jobs: $DONE ($i)"
  [ "$DONE" -ge 8 ] && break
  sleep 10
done
```

**Expected:** All 8 jobs complete within ~6 minutes (coordinator triage + 7 parallel experts + coordinator synthesis).

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
