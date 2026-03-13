# Scenario 12: Alignment Check After Changeset

**Time:** ~5 minutes
**Parallel Safe:** No
**LLM Required:** Yes (alignment agent)

Verifies that the alignment agent runs automatically after a changeset is accepted, scanning for conflicts, gaps, and duplicates.

## Prerequisites

- Scenario 10 passed — changeset accepted, map modified
- Eve `changeset.accepted` workflow trigger is active

## Steps

### 1. Verify Alignment Job Triggered

```bash
# The alignment agent should have been triggered by the changeset.accepted event in Scenario 10
for i in $(seq 1 12); do
  ALIGN_JOBS=$(eve job list --project eden --json 2>/dev/null | jq '[.[] | select(.description | test("alignment"; "i"))]')
  [ "$(echo "$ALIGN_JOBS" | jq 'length')" -gt 0 ] && break
  sleep 5
done

ALIGN_JOB=$(echo "$ALIGN_JOBS" | jq -r '.[-1].id')
echo "Alignment job: $ALIGN_JOB"
eve job follow $ALIGN_JOB
```

**Expected:** Alignment job ran (triggered by `changeset.accepted` event).

### 2. Check for Generated Questions

```bash
# Alignment agent creates questions for gaps, conflicts, duplicates
QUESTIONS=$(api "$EDEN_URL/api/projects/$PROJECT_ID/questions?category=alignment")
echo "$QUESTIONS" | jq '.[] | {question: .question[0:100], category, priority}'
```

**Expected:** One or more questions created about:
- Gaps (persona without task coverage, single-step activities)
- Potential duplicates (semantic similarity between tasks)
- Assumptions needing validation

### 3. Verify Storm Prevention

```bash
# Accept another changeset to trigger alignment again
STORM_CS=$(api -X POST "$EDEN_URL/api/projects/$PROJECT_ID/changesets" \
  -d '{
    "title": "Minor update for storm test",
    "reasoning": "Testing alignment storm prevention",
    "source": "manual-test",
    "items": [{"entity_type": "task", "operation": "update", "before_state": {"title": "Upload requirements document"}, "after_state": {"title": "Upload requirements document (v2)"}, "description": "Minor title update"}]
  }')
STORM_ID=$(echo "$STORM_CS" | jq -r '.id')
api -X POST "$EDEN_URL/api/projects/$PROJECT_ID/changesets/$STORM_ID/accept"

sleep 30

# Check that alignment doesn't create duplicate questions
NEW_Q_COUNT=$(api "$EDEN_URL/api/projects/$PROJECT_ID/questions?category=alignment" | jq 'length')
echo "Alignment questions after storm test: $NEW_Q_COUNT"
```

**Expected:** Alignment agent skips questions already raised in last 24h (storm prevention).

## Success Criteria

- [ ] Alignment job triggered automatically after changeset acceptance
- [ ] Agent identifies at least one gap, conflict, or assumption
- [ ] Questions created with category `alignment`
- [ ] Storm prevention: duplicate questions not re-created
