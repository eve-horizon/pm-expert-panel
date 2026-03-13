# Scenario 04: Changesets — Create, Review, Apply

**Time:** ~4 minutes
**Parallel Safe:** No
**LLM Required:** No

Tests the changeset system end-to-end: create a proposed set of changes, review item-by-item, accept, and verify the changes are applied to the map.

## Prerequisites

- Scenario 02 passed — project has populated map

## Steps

### 1. Create a Changeset with Multiple Operations

```bash
CHANGESET=$(api -X POST "$EDEN_URL/api/projects/$PROJECT_ID/changesets" \
  -d "{
    \"title\": \"Add security review step\",
    \"reasoning\": \"The expert panel identified a gap: no explicit security review step exists in the map.\",
    \"source\": \"manual-test\",
    \"items\": [
      {
        \"entity_type\": \"step\",
        \"operation\": \"create\",
        \"after_state\": {
          \"name\": \"Security Review\",
          \"display_id\": \"STP-2.3\",
          \"activity_id\": \"$ACT2_ID\",
          \"sort_order\": 3
        },
        \"description\": \"New step for security-focused review of requirements\"
      },
      {
        \"entity_type\": \"task\",
        \"operation\": \"create\",
        \"after_state\": {
          \"title\": \"Verify security implications of new requirements\",
          \"display_id\": \"TSK-2.3.1\",
          \"user_story\": \"As an Engineering Lead, I want security implications flagged during review so that we catch issues early\",
          \"acceptance_criteria\": \"- Auth requirements identified\\n- Data privacy assessed\\n- OWASP top 10 checked\",
          \"priority\": \"high\",
          \"status\": \"proposed\"
        },
        \"description\": \"Security verification task for new requirements\"
      }
    ]
  }")
CS_ID=$(echo "$CHANGESET" | jq -r '.id')
echo "Changeset: $CS_ID"
```

**Expected:**
- Changeset created with status `draft` (or `pending`)
- Contains 2 items (step create + task create)

### 2. Get Changeset Detail

```bash
api "$EDEN_URL/api/projects/$PROJECT_ID/changesets/$CS_ID" | jq '{
  title,
  status,
  source,
  item_count: (.items | length),
  items: [.items[] | {entity_type, operation, description}]
}'
```

**Expected:** 2 items, both with `entity_type` and `operation` fields.

### 3. Accept the Changeset

```bash
ACCEPTED=$(api -X POST "$EDEN_URL/api/projects/$PROJECT_ID/changesets/$CS_ID/accept")
echo "$ACCEPTED" | jq '{status}'
```

**Expected:** Status changes to `accepted`.

### 4. Verify Changes Applied to Map

```bash
# Check Activity 2 now has 3 steps
api "$EDEN_URL/api/projects/$PROJECT_ID/map" | jq '
  .activities[] | select(.display_id == "ACT-2") |
  {name, step_count: (.steps | length), steps: [.steps[].name]}
'
```

**Expected:**
- Activity 2 now has 3 steps (Triage Request, Panel Analysis, Security Review)
- New task appears under the new step

### 5. Create and Reject a Changeset

```bash
REJECT_CS=$(api -X POST "$EDEN_URL/api/projects/$PROJECT_ID/changesets" \
  -d '{
    "title": "Remove all personas (bad idea)",
    "reasoning": "Testing rejection flow",
    "source": "manual-test",
    "items": [
      {
        "entity_type": "persona",
        "operation": "delete",
        "before_state": {"code": "PM"},
        "description": "Remove PM persona"
      }
    ]
  }')
REJECT_ID=$(echo "$REJECT_CS" | jq -r '.id')

api -X POST "$EDEN_URL/api/projects/$PROJECT_ID/changesets/$REJECT_ID/reject" | jq '{status}'
```

**Expected:** Changeset status is `rejected`. PM persona still exists.

### 6. Verify Rejected Changeset Had No Effect

```bash
api "$EDEN_URL/api/projects/$PROJECT_ID/personas" | jq '.[].code'
```

**Expected:** All 4 persona codes still present (PM, BA, EL, SH).

## Success Criteria

- [ ] Changeset created with multiple items
- [ ] Changeset detail returns items with correct operations
- [ ] Accept applies all items to the map
- [ ] New step and task appear in map after acceptance
- [ ] Reject does not modify the map
- [ ] All personas survive rejected deletion
