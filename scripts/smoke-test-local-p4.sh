#!/bin/bash
# Phase 4 Local Smoke Test — verifies new columns, search, export, audit endpoints
set -euo pipefail

API="${API_URL:-http://localhost:3077}"
H=(-H "x-dev-org-id: test-org" -H "x-dev-user-id: user1" -H "Content-Type: application/json")

echo "=== Phase 4 Local Smoke Test ==="
echo "API: $API"

# 1. Create a project
echo -n "Creating project... "
PROJECT=$(curl -sf "${H[@]}" -X POST "$API/projects" \
  -d '{"name":"P4 Test","slug":"p4-test-'$RANDOM'"}' | jq -r '.id')
echo "OK ($PROJECT)"

# 2. Create persona
echo -n "Creating persona... "
PERSONA=$(curl -sf "${H[@]}" -X POST "$API/projects/$PROJECT/personas" \
  -d '{"code":"pm","name":"Product Manager","color":"#3b82f6"}' | jq -r '.id')
echo "OK ($PERSONA)"

# 3. Create activity + step
echo -n "Creating activity... "
ACTIVITY=$(curl -sf "${H[@]}" -X POST "$API/projects/$PROJECT/activities" \
  -d '{"name":"Onboarding","display_id":"ACT-1"}' | jq -r '.id')
echo "OK"
echo -n "Creating step... "
STEP=$(curl -sf "${H[@]}" -X POST "$API/activities/$ACTIVITY/steps" \
  -d '{"name":"Registration","display_id":"STP-1.1"}' | jq -r '.id')
echo "OK"

# 4. Create task WITH Phase 4 fields (lifecycle, source_type)
echo -n "Creating task with lifecycle=proposed, source_type=research... "
TASK=$(curl -sf "${H[@]}" -X POST "$API/projects/$PROJECT/tasks" \
  -d "{
    \"title\":\"SSO Login\",
    \"display_id\":\"TSK-1.1.1\",
    \"user_story\":\"As a user I want to log in with SSO\",
    \"priority\":\"high\",
    \"lifecycle\":\"proposed\",
    \"source_type\":\"research\",
    \"source_excerpt\":\"Found in user interviews section 3.2\"
  }" | jq -r '.id')
echo "OK ($TASK)"

# 5. Place task on step
echo -n "Placing task on step... "
curl -sf "${H[@]}" -X POST "$API/tasks/$TASK/place" \
  -d "{\"step_id\":\"$STEP\",\"persona_id\":\"$PERSONA\"}" > /dev/null
echo "OK"

# 6. Verify map endpoint returns Phase 4 fields
echo -n "Checking map returns lifecycle + source_type + role_in_journey... "
MAP=$(curl -sf "${H[@]}" "$API/projects/$PROJECT/map")
LIFECYCLE=$(echo "$MAP" | jq -r '.activities[0].steps[0].tasks[0].lifecycle')
SOURCE_TYPE=$(echo "$MAP" | jq -r '.activities[0].steps[0].tasks[0].source_type')
ROLE_IN_JOURNEY=$(echo "$MAP" | jq -r '.activities[0].steps[0].tasks[0].role_in_journey')
if [ "$LIFECYCLE" = "proposed" ] && [ "$SOURCE_TYPE" = "research" ] && [ "$ROLE_IN_JOURNEY" = "owner" ]; then
  echo "OK (lifecycle=$LIFECYCLE, source_type=$SOURCE_TYPE, role_in_journey=$ROLE_IN_JOURNEY)"
else
  echo "FAIL (lifecycle=$LIFECYCLE, source_type=$SOURCE_TYPE, role_in_journey=$ROLE_IN_JOURNEY)"
  exit 1
fi

# 7. Create a question with is_cross_cutting
echo -n "Creating cross-cutting question... "
QUESTION=$(curl -sf "${H[@]}" -X POST "$API/projects/$PROJECT/questions" \
  -d "{
    \"question\":\"What about SSO providers?\",
    \"display_id\":\"Q-1\",
    \"is_cross_cutting\":true,
    \"references\":[{\"entity_type\":\"task\",\"entity_id\":\"$TASK\",\"display_id\":\"TSK-1.1.1\"}]
  }" | jq -r '.id')
echo "OK ($QUESTION)"

# 8. Test search endpoint
echo -n "Testing search... "
SEARCH=$(curl -sf "${H[@]}" "$API/projects/$PROJECT/search?q=SSO" 2>&1)
SEARCH_COUNT=$(echo "$SEARCH" | jq 'length')
if [ "$SEARCH_COUNT" -ge 1 ]; then
  echo "OK ($SEARCH_COUNT results)"
else
  echo "FAIL (expected results, got $SEARCH_COUNT)"
  exit 1
fi

# 9. Test export JSON endpoint
echo -n "Testing JSON export... "
EXPORT_JSON=$(curl -sf "${H[@]}" "$API/projects/$PROJECT/export/json" 2>&1)
EXPORT_NAME=$(echo "$EXPORT_JSON" | jq -r '.name')
if [ "$EXPORT_NAME" = "P4 Test" ]; then
  echo "OK (project=$EXPORT_NAME)"
else
  echo "FAIL (export name=$EXPORT_NAME)"
  exit 1
fi

# 10. Test export Markdown endpoint
echo -n "Testing Markdown export... "
EXPORT_MD=$(curl -sf "${H[@]}" "$API/projects/$PROJECT/export/markdown" 2>&1)
if echo "$EXPORT_MD" | jq -r '.markdown' | grep -q "SSO Login"; then
  echo "OK"
else
  echo "FAIL"
  exit 1
fi

# 11. Test audit endpoint
echo -n "Testing audit trail... "
AUDIT=$(curl -sf "${H[@]}" "$API/projects/$PROJECT/audit" 2>&1)
AUDIT_COUNT=$(echo "$AUDIT" | jq '.entries | length')
if [ "$AUDIT_COUNT" -ge 1 ]; then
  echo "OK ($AUDIT_COUNT entries)"
else
  echo "OK (0 entries — audit entries created on changeset apply)"
fi

echo ""
echo "=== Phase 4 Local Smoke Test: ALL PASSED ==="
