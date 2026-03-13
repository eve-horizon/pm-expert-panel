# Scenario 10: Chat-Driven Map Editing

**Time:** ~5 minutes
**Parallel Safe:** No
**LLM Required:** Yes (map-chat agent)

Tests the conversational map editing flow: user describes a change in natural language via chat, the map-chat agent translates it to a changeset.

## Prerequisites

- Scenarios 01–02 passed — project has baseline map
- Eve agents synced

## Steps

### 1. Send an Edit Request via Chat

```bash
THREAD=$(api -X POST "$EDEN_URL/api/projects/$PROJECT_ID/chat/threads" \
  -d '{"title": "Map edit request"}')
THREAD_ID=$(echo "$THREAD" | jq -r '.id')

api -X POST "$EDEN_URL/api/chat/threads/$THREAD_ID/messages" \
  -d '{"content": "Add a new persona called \"DevOps Engineer\" with code DOE and color #FF6B6B. Then add a task under Document Ingestion > Upload Document for this persona: \"Configure CI/CD pipeline for document processing\" with acceptance criteria about automated deployments and monitoring."}'
```

**Expected:** Message sent. Coordinator routes to map-chat agent (solo path).

### 2. Wait for Changeset

```bash
for i in $(seq 1 24); do
  CS=$(api "$EDEN_URL/api/projects/$PROJECT_ID/changesets?source=map-chat" | jq '.[0]')
  [ "$CS" != "null" ] && break
  sleep 5
done
echo "$CS" | jq '{title, item_count: (.items | length), items: [.items[] | {entity_type, operation}]}'
```

**Expected:** Changeset with items including:
- `persona` / `create` (DevOps Engineer)
- `task` / `create` (CI/CD pipeline task)
- Possibly `step_task` / `create` (placement)

### 3. Accept and Verify

```bash
CS_ID=$(echo "$CS" | jq -r '.id')
api -X POST "$EDEN_URL/api/projects/$PROJECT_ID/changesets/$CS_ID/accept"

# Verify persona exists
api "$EDEN_URL/api/projects/$PROJECT_ID/personas" | jq '.[] | select(.code=="DOE")'

# Verify task exists
api "$EDEN_URL/api/projects/$PROJECT_ID/map" | jq '
  [.activities[].steps[].tasks[] | select(.title | test("CI/CD"; "i"))] | .[0].title
'
```

**Expected:** New persona and task appear on the map after acceptance.

## Success Criteria

- [ ] Natural language edit request routed correctly
- [ ] Map-chat agent creates changeset (not direct mutation)
- [ ] Changeset contains correct entity types and operations
- [ ] Acceptance applies changes to the map
- [ ] New persona appears in persona list
- [ ] New task placed correctly on the map
