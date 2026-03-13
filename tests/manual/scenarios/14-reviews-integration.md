# Scenario 14: Reviews Integration — Chat to Map

**Time:** ~8 minutes
**Parallel Safe:** No
**LLM Required:** Yes

Verifies that expert panel review findings can be acted on — closing the loop from review → changeset → map update.

## Prerequisites

- Scenario 09 passed — expert panel review exists with identified issues

## Steps

### 1. Read Expert Recommendations

```bash
REVIEW_ID=$(api "$EDEN_URL/api/projects/$PROJECT_ID/reviews" | jq -r '.[0].id')
RECS=$(api "$EDEN_URL/api/projects/$PROJECT_ID/reviews/$REVIEW_ID" | jq '.synthesis')
echo "Recommendations:"
echo "$RECS" | head -50
```

### 2. Act on a Recommendation via Chat

```bash
THREAD=$(api -X POST "$EDEN_URL/api/projects/$PROJECT_ID/chat/threads" \
  -d '{"title": "Act on review recommendation"}')
THREAD_ID=$(echo "$THREAD" | jq -r '.id')

# Use one of the actual recommendations from the review
api -X POST "$EDEN_URL/api/chat/threads/$THREAD_ID/messages" \
  -d '{"content": "Based on the expert review, the QA strategist identified that we have no explicit testing requirements. Please add a Testing & Validation activity with steps for unit testing, integration testing, and e2e testing, with appropriate tasks for each."}'
```

### 3. Wait for Changeset

```bash
for i in $(seq 1 24); do
  CS=$(api "$EDEN_URL/api/projects/$PROJECT_ID/changesets" | jq '[.[] | select(.status == "draft" or .status == "pending")] | .[0]')
  [ "$CS" != "null" ] && break
  sleep 5
done
echo "$CS" | jq '{title, item_count: (.items | length)}'
```

### 4. Review and Accept

```bash
CS_ID=$(echo "$CS" | jq -r '.id')
echo "Changeset items:"
api "$EDEN_URL/api/projects/$PROJECT_ID/changesets/$CS_ID" | jq '.items[] | {entity_type, operation, description}'

api -X POST "$EDEN_URL/api/projects/$PROJECT_ID/changesets/$CS_ID/accept"
```

### 5. Verify Loop Closed

```bash
# Map should now have the testing activity
api "$EDEN_URL/api/projects/$PROJECT_ID/map" | jq '.activities[] | select(.name | test("[Tt]est")) | {name, step_count: (.steps | length)}'
```

**Expected:** New "Testing & Validation" activity appears with testing-related steps.

## Success Criteria

- [ ] Review recommendations are actionable
- [ ] Chat request based on recommendation creates changeset
- [ ] Changeset contains testing-related entities
- [ ] Acceptance adds testing activity to the map
- [ ] Full loop: review → chat → changeset → map update
