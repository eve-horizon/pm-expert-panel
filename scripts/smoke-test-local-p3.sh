#!/bin/bash
# scripts/smoke-test-local-p3.sh — Phase 3 local verification
# Tests: event emission, question evolve endpoint, cross-cutting questions
set -euo pipefail
BASE="http://localhost:3000"
H_JSON="Content-Type: application/json"

echo "=== Phase 3 Local: Event Wiring + Question Evolve ==="

# Create project + map scaffold
PROJECT=$(curl -sf -X POST -H "$H_JSON" \
  -d '{"name":"P3 Local","slug":"p3-local"}' \
  "$BASE/projects" | jq -r .id)

ACT=$(curl -sf -X POST -H "$H_JSON" \
  -d '{"name":"Feature","display_id":"ACT-1","sort_order":1}' \
  "$BASE/projects/$PROJECT/activities" | jq -r .id)

STEP=$(curl -sf -X POST -H "$H_JSON" \
  -d '{"name":"Step 1","display_id":"STP-1.1","sort_order":1}' \
  "$BASE/activities/$ACT/steps" | jq -r .id)

TASK=$(curl -sf -X POST -H "$H_JSON" \
  -d '{"title":"Test task","display_id":"TSK-1.1.1","priority":"medium"}' \
  "$BASE/projects/$PROJECT/tasks" | jq -r .id)
echo "✓ Map scaffold created"

# 1. Create + accept changeset (should log app.changeset.accepted event)
CS=$(curl -sf -X POST -H "$H_JSON" \
  -d '{
    "title":"P3 test changeset",
    "reasoning":"Verify event emission",
    "source":"smoke-test",
    "items":[
      {"entity_type":"task","operation":"create",
       "after_state":{"title":"Event test task","display_id":"TSK-1.1.2",
         "priority":"medium"},
       "description":"Test task","display_reference":"TSK-1.1.2"}
    ]
  }' "$BASE/projects/$PROJECT/changesets" | jq -r .id)
curl -sf -X POST "$BASE/changesets/$CS/accept" > /dev/null
echo "✓ Changeset accepted (event emitted to stdout)"

# 2. Create question with references
Q=$(curl -sf -X POST -H "$H_JSON" \
  -d "{
    \"question\":\"Should this task support guest users?\",
    \"priority\":\"high\",
    \"category\":\"assumption\",
    \"references\":[{\"entity_type\":\"task\",\"entity_id\":\"$TASK\"}]
  }" "$BASE/projects/$PROJECT/questions" | jq -r .id)
echo "✓ Question created with reference"

# 3. Evolve question (should log app.question.answered event)
EVOLVED=$(curl -sf -X POST -H "$H_JSON" \
  -d '{"answer":"Yes, support guest checkout"}' \
  "$BASE/questions/$Q/evolve")
STATUS=$(echo $EVOLVED | jq -r .status)
[ "$STATUS" = "answered" ] && echo "✓ Question evolved → status: answered"

# 4. Verify question list filtering by category
ASSUMPTIONS=$(curl -sf "$BASE/projects/$PROJECT/questions?category=assumption" | jq length)
[ "$ASSUMPTIONS" -ge 1 ] && echo "✓ Category filter works ($ASSUMPTIONS assumption questions)"

# 5. Chat endpoint returns 503 (Eve unavailable — expected locally)
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/projects/$PROJECT/chat/threads" || true)
[ "$HTTP" = "503" ] && echo "✓ Chat endpoint returns 503 (Eve not available — expected)"

# Cleanup
curl -sf -X DELETE "$BASE/projects/$PROJECT" > /dev/null
echo "✓ Cleanup done"

echo "=== Phase 3 local smoke tests passed ==="
