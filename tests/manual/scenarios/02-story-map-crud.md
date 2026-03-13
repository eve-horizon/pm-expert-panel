# Scenario 02: Story Map CRUD — Personas, Activities, Steps, Tasks

**Time:** ~5 minutes
**Parallel Safe:** No
**LLM Required:** No

Populates the test project with a realistic story map structure via the API. Establishes the data that Scenario 06+ will verify in the UI.

## Prerequisites

- Scenario 01 passed — `$PROJECT_ID` is set

## Steps

### 1. Create Personas

```bash
for p in '{"code":"PM","name":"Product Manager","color":"#4A90D9"}' \
         '{"code":"BA","name":"Business Analyst","color":"#7B68EE"}' \
         '{"code":"EL","name":"Engineering Lead","color":"#2ECC71"}' \
         '{"code":"SH","name":"Stakeholder","color":"#E67E22"}'; do
  api -X POST "$EDEN_URL/api/projects/$PROJECT_ID/personas" -d "$p" | jq '{id, code}'
done
```

**Expected:** 4 personas created, each returns `id` and `code`.

### 2. Create Activities

```bash
ACT1=$(api -X POST "$EDEN_URL/api/projects/$PROJECT_ID/activities" \
  -d '{"name": "Document Ingestion", "display_id": "ACT-1", "sort_order": 1}')
ACT1_ID=$(echo "$ACT1" | jq -r '.id')

ACT2=$(api -X POST "$EDEN_URL/api/projects/$PROJECT_ID/activities" \
  -d '{"name": "Expert Review", "display_id": "ACT-2", "sort_order": 2}')
ACT2_ID=$(echo "$ACT2" | jq -r '.id')

ACT3=$(api -X POST "$EDEN_URL/api/projects/$PROJECT_ID/activities" \
  -d '{"name": "Map Editing", "display_id": "ACT-3", "sort_order": 3}')
ACT3_ID=$(echo "$ACT3" | jq -r '.id')
```

**Expected:** 3 activities created with sequential `display_id` values.

### 3. Create Steps Under Activities

```bash
# Activity 1 steps
S1=$(api -X POST "$EDEN_URL/api/activities/$ACT1_ID/steps" \
  -d '{"name": "Upload Document", "display_id": "STP-1.1", "sort_order": 1}')
S1_ID=$(echo "$S1" | jq -r '.id')

S2=$(api -X POST "$EDEN_URL/api/activities/$ACT1_ID/steps" \
  -d '{"name": "Extract Content", "display_id": "STP-1.2", "sort_order": 2}')
S2_ID=$(echo "$S2" | jq -r '.id')

# Activity 2 steps
S3=$(api -X POST "$EDEN_URL/api/activities/$ACT2_ID/steps" \
  -d '{"name": "Triage Request", "display_id": "STP-2.1", "sort_order": 1}')
S3_ID=$(echo "$S3" | jq -r '.id')

S4=$(api -X POST "$EDEN_URL/api/activities/$ACT2_ID/steps" \
  -d '{"name": "Panel Analysis", "display_id": "STP-2.2", "sort_order": 2}')
S4_ID=$(echo "$S4" | jq -r '.id')

# Activity 3 steps
S5=$(api -X POST "$EDEN_URL/api/activities/$ACT3_ID/steps" \
  -d '{"name": "Chat Interaction", "display_id": "STP-3.1", "sort_order": 1}')
S5_ID=$(echo "$S5" | jq -r '.id')
```

**Expected:** 5 steps created across 3 activities.

### 4. Create Tasks

```bash
# Grab persona IDs
PM_ID=$(api "$EDEN_URL/api/projects/$PROJECT_ID/personas" | jq -r '.[] | select(.code=="PM") | .id')
BA_ID=$(api "$EDEN_URL/api/projects/$PROJECT_ID/personas" | jq -r '.[] | select(.code=="BA") | .id')

T1=$(api -X POST "$EDEN_URL/api/projects/$PROJECT_ID/tasks" \
  -d '{
    "title": "Upload requirements document",
    "display_id": "TSK-1.1.1",
    "user_story": "As a PM, I want to upload a requirements document so that the AI can extract structured requirements",
    "acceptance_criteria": "- Accepts PDF, DOCX, MD formats\n- Shows upload progress\n- Confirms successful upload",
    "priority": "high",
    "status": "current"
  }')
T1_ID=$(echo "$T1" | jq -r '.id')

T2=$(api -X POST "$EDEN_URL/api/projects/$PROJECT_ID/tasks" \
  -d '{
    "title": "Review expert panel synthesis",
    "display_id": "TSK-2.2.1",
    "user_story": "As a PM, I want to review the expert panel synthesis so that I can make informed decisions about requirements",
    "acceptance_criteria": "- Shows consensus and dissent\n- Highlights critical risks\n- Lists recommended actions",
    "priority": "high",
    "status": "current"
  }')
T2_ID=$(echo "$T2" | jq -r '.id')

T3=$(api -X POST "$EDEN_URL/api/projects/$PROJECT_ID/tasks" \
  -d '{
    "title": "Ask a question about a requirement",
    "display_id": "TSK-3.1.1",
    "user_story": "As a BA, I want to ask questions about requirements so that ambiguities are resolved",
    "acceptance_criteria": "- Question linked to relevant entities\n- Status tracks resolution\n- AI can evolve based on answer",
    "priority": "medium",
    "status": "current"
  }')
T3_ID=$(echo "$T3" | jq -r '.id')
```

**Expected:** 3 tasks created with user stories and acceptance criteria.

### 5. Place Tasks on Steps with Personas

```bash
# Task 1 → Step 1.1, owned by PM
api -X POST "$EDEN_URL/api/tasks/$T1_ID/place" \
  -d "{\"step_id\": \"$S1_ID\", \"persona_id\": \"$PM_ID\", \"role\": \"owner\"}" | jq '{id, role}'

# Task 2 → Step 2.2, owned by PM
api -X POST "$EDEN_URL/api/tasks/$T2_ID/place" \
  -d "{\"step_id\": \"$S4_ID\", \"persona_id\": \"$PM_ID\", \"role\": \"owner\"}" | jq '{id, role}'

# Task 3 → Step 3.1, owned by BA
api -X POST "$EDEN_URL/api/tasks/$T3_ID/place" \
  -d "{\"step_id\": \"$S5_ID\", \"persona_id\": \"$BA_ID\", \"role\": \"owner\"}" | jq '{id, role}'

# Task 3 also placed as handoff on Step 1.2 (BA reviews extracted content)
api -X POST "$EDEN_URL/api/tasks/$T3_ID/place" \
  -d "{\"step_id\": \"$S2_ID\", \"persona_id\": \"$BA_ID\", \"role\": \"handoff\"}" | jq '{id, role}'
```

**Expected:**
- 4 step_task placements created
- Task 3 appears under two different steps (deduplication test for UI)

### 6. Verify Full Map Structure

```bash
MAP=$(api "$EDEN_URL/api/projects/$PROJECT_ID/map")
echo "$MAP" | jq '{
  personas: (.personas | length),
  activities: (.activities | length),
  total_steps: [.activities[].steps | length] | add,
  total_tasks: [.activities[].steps[].tasks | length] | add
}'
```

**Expected:** `{ personas: 4, activities: 3, total_steps: 5, total_tasks: 4 }` (task 3 appears under 2 steps)

## Success Criteria

- [ ] 4 personas created with correct codes
- [ ] 3 activities with display_ids ACT-1 through ACT-3
- [ ] 5 steps distributed across activities
- [ ] 3 tasks with user stories and acceptance criteria
- [ ] Task placements include owner and handoff roles
- [ ] Map endpoint returns correct hierarchy with all entities
- [ ] Task 3 appears under two steps (multi-placement)
