# Scenario 03: Releases, Questions & Search

**Time:** ~3 minutes
**Parallel Safe:** No
**LLM Required:** No

Exercises the remaining CRUD entities: releases, questions, and full-text search.

## Prerequisites

- Scenario 02 passed — project populated with personas, activities, steps, tasks

## Steps

### 1. Create a Release

```bash
RELEASE=$(api -X POST "$EDEN_URL/api/projects/$PROJECT_ID/releases" \
  -d '{"name": "MVP Release", "target_date": "2026-04-15", "status": "planning"}')
RELEASE_ID=$(echo "$RELEASE" | jq -r '.id')
```

**Expected:** Release created with status `planning`.

### 2. Assign Tasks to Release

```bash
api -X POST "$EDEN_URL/api/releases/$RELEASE_ID/tasks" \
  -d "{\"task_id\": \"$T1_ID\"}" | jq '.id'

api -X POST "$EDEN_URL/api/releases/$RELEASE_ID/tasks" \
  -d "{\"task_id\": \"$T2_ID\"}" | jq '.id'
```

**Expected:** 2 tasks assigned to MVP Release.

### 3. Create Questions

```bash
Q1=$(api -X POST "$EDEN_URL/api/projects/$PROJECT_ID/questions" \
  -d '{
    "question": "What file size limit should we enforce for document uploads?",
    "category": "technical",
    "priority": "high",
    "status": "open"
  }')
Q1_ID=$(echo "$Q1" | jq -r '.id')

Q2=$(api -X POST "$EDEN_URL/api/projects/$PROJECT_ID/questions" \
  -d '{
    "question": "Should the expert panel run for every document or only on explicit request?",
    "category": "product",
    "priority": "medium",
    "status": "open",
    "is_cross_cutting": true
  }')
Q2_ID=$(echo "$Q2" | jq -r '.id')
```

**Expected:** 2 questions created. Q2 is cross-cutting.

### 4. Answer a Question

```bash
api -X PATCH "$EDEN_URL/api/projects/$PROJECT_ID/questions/$Q1_ID" \
  -d '{"answer": "50MB limit for documents, 500MB for audio/video files", "status": "answered"}' | jq '{status, answer}'
```

**Expected:** Question updated to `answered` with answer text.

### 5. Full-Text Search

```bash
# Search tasks
api "$EDEN_URL/api/projects/$PROJECT_ID/search?q=expert+panel" | jq '.[].title'

# Search questions
api "$EDEN_URL/api/projects/$PROJECT_ID/search?q=file+size" | jq '.[].question'
```

**Expected:** Search returns matching tasks and questions by keyword.

### 6. Verify Map Filters

```bash
# Filter by persona
api "$EDEN_URL/api/projects/$PROJECT_ID/map?persona=$PM_ID" | jq '[.activities[].steps[].tasks[]] | length'

# Filter by release
api "$EDEN_URL/api/projects/$PROJECT_ID/map?release=$RELEASE_ID" | jq '[.activities[].steps[].tasks[]] | length'
```

**Expected:**
- Persona filter returns only PM-owned/handoff tasks
- Release filter returns 2 tasks (those assigned to MVP Release)

## Success Criteria

- [ ] Release created and tasks assigned
- [ ] Questions created with open/answered statuses
- [ ] Cross-cutting question flagged correctly
- [ ] Full-text search returns matching results
- [ ] Map persona filter narrows task set
- [ ] Map release filter shows only assigned tasks
