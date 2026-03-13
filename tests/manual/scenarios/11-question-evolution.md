# Scenario 11: Question Evolution Workflow

**Time:** ~5 minutes
**Parallel Safe:** No
**LLM Required:** Yes (question-agent)

Tests the question evolution flow: answering an open question triggers the question-agent, which may create a changeset if the answer implies map changes.

## Prerequisites

- Scenario 03 passed — questions exist, Q2 is cross-cutting and still open

## Steps

### 1. Evolve the Cross-Cutting Question

The `/evolve` endpoint answers the question and triggers the workflow in one call. Routes are **not** project-scoped — use `/questions/:id/evolve`.

```bash
# Q2: "Should the expert panel run for every document or only on explicit request?"
EVOLVE=$(api -X POST "$EDEN_URL/api/questions/$Q2_ID/evolve" \
  -d '{"answer": "The expert panel should run automatically for any document over 5 pages. For shorter documents, the coordinator should handle it solo. Users can always explicitly request a full panel review regardless of document length."}')
echo "$EVOLVE" | jq '{status, answer}'
```

**Expected:** Question status changes to `answered`. Eve `question.answered` event fires. Question-agent job starts.

> **API note:** The evolve endpoint is `POST /questions/:id/evolve` (not project-scoped). It only accepts `{answer}` — it sets status to `answered` automatically. Using the project-scoped route will return 404.

### 2. Wait for Agent Response

```bash
for i in $(seq 1 24); do
  Q_JOBS=$(eve job list --project eden --json 2>/dev/null | jq '[.jobs[] | select(.title | test("question"; "i"))]')
  [ "$(echo "$Q_JOBS" | jq 'length')" -gt 0 ] && break
  sleep 5
done

JOB_ID=$(echo "$Q_JOBS" | jq -r '.[0].id')
eve job follow $JOB_ID
```

**Expected:** Question-agent evaluates the answer and decides whether to create a changeset.

### 3. Check for Resulting Changeset

```bash
CS=$(api "$EDEN_URL/api/projects/$PROJECT_ID/changesets?source=question-evolution" | jq '.[0]')
if [ "$CS" != "null" ]; then
  echo "Changeset created:"
  echo "$CS" | jq '{title, reasoning, item_count: (.items | length)}'
else
  echo "No changeset — answer was informational only (also valid)"
fi
```

**Expected:** Either:
- **Changeset created** — answer implies new requirements (e.g., "add page count threshold logic")
- **No changeset** — answer is informational, no map changes needed (both outcomes are valid)

## Success Criteria

- [ ] Question evolution triggers question-agent workflow
- [ ] Agent evaluates the answer in context of the map
- [ ] If answer implies changes: changeset created with source `question-evolution`
- [ ] If answer is informational: no changeset, no error
- [ ] Question status updated
