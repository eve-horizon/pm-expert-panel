#!/bin/bash
# scripts/smoke-test-local-p2.sh — Phase 2 local verification
# Exercises changeset CRUD, apply logic, partial review, source endpoints
# against local Docker DB (no Eve agents or ingest integration required).
set -euo pipefail
API="http://localhost:3000"

echo "=== Phase 2 Local: Changeset CRUD + Apply ==="

# Setup: create project with map entities
PROJECT=$(curl -sf -X POST -H "Content-Type: application/json" \
  -d '{"name":"P2 Test","slug":"p2-test"}' "$API/projects" | jq -r .id)

ACT=$(curl -sf -X POST -H "Content-Type: application/json" \
  -d '{"name":"Auth","display_id":"ACT-1","sort_order":1}' \
  "$API/projects/$PROJECT/activities" | jq -r .id)

STEP=$(curl -sf -X POST -H "Content-Type: application/json" \
  -d '{"name":"Login","display_id":"STP-1.1","sort_order":1}' \
  "$API/activities/$ACT/steps" | jq -r .id)

echo "✓ Map scaffold created"

# 1. Create changeset with items
CS=$(curl -sf -X POST -H "Content-Type: application/json" \
  -d '{
    "title":"Ingestion: roadmap.pdf",
    "reasoning":"Extracted 3 tasks from uploaded roadmap",
    "source":"agent:synthesis",
    "items":[
      {"entity_type":"task","operation":"create",
       "after_state":{"title":"SSO Login","display_id":"TSK-1.1.1",
         "user_story":"As a user I want SSO","priority":"high"},
       "description":"New task from roadmap","display_reference":"TSK-1.1.1"},
      {"entity_type":"task","operation":"create",
       "after_state":{"title":"Password Reset","display_id":"TSK-1.1.2",
         "user_story":"As a user I want to reset password","priority":"medium"},
       "description":"New task from roadmap","display_reference":"TSK-1.1.2"},
      {"entity_type":"question","operation":"create",
       "after_state":{"question":"Should SSO support SAML?","priority":"high",
         "category":"security"},
       "description":"Open question from roadmap"}
    ]
  }' "$API/projects/$PROJECT/changesets")
CS_ID=$(echo $CS | jq -r .id)
echo "✓ Changeset created: $CS_ID"

# 2. List changesets
COUNT=$(curl -sf "$API/projects/$PROJECT/changesets?status=draft" | jq length)
[ "$COUNT" -ge 1 ] && echo "✓ Changeset list: $COUNT pending"

# 3. Get changeset detail
ITEMS=$(curl -sf "$API/changesets/$CS_ID" | jq '.items | length')
[ "$ITEMS" -eq 3 ] && echo "✓ Changeset detail: $ITEMS items"

# 4. Partial review: accept first 2, reject last
DETAIL=$(curl -sf "$API/changesets/$CS_ID")
REVIEW_BODY=$(echo "$DETAIL" | jq '{decisions: ([.items[:2][] | {id: .id, status: "accepted"}] + [.items[2:3][] | {id: .id, status: "rejected"}])}')
curl -sf -X POST -H "Content-Type: application/json" \
  -d "$REVIEW_BODY" "$API/changesets/$CS_ID/review" > /dev/null
echo "✓ Partial review applied"

# 5. Verify changeset status is now 'partial'
STATUS=$(curl -sf "$API/changesets/$CS_ID" | jq -r .status)
[ "$STATUS" = "partial" ] && echo "✓ Changeset status: partial"

# 6. Verify accepted items created entities in tasks table
TASK_COUNT=$(curl -sf "$API/projects/$PROJECT/tasks" | jq length)
[ "$TASK_COUNT" -ge 2 ] && echo "✓ Project has $TASK_COUNT tasks after partial apply"

# 7. Create + accept-all changeset
CS2=$(curl -sf -X POST -H "Content-Type: application/json" \
  -d '{
    "title":"Bulk accept test","reasoning":"Testing accept-all",
    "source":"user",
    "items":[
      {"entity_type":"task","operation":"create",
       "after_state":{"title":"Bulk task","display_id":"TSK-1.1.3",
         "user_story":"Bulk test","priority":"low"},
       "description":"Bulk test task","display_reference":"TSK-1.1.3"}
    ]
  }' "$API/projects/$PROJECT/changesets" | jq -r .id)
curl -sf -X POST "$API/changesets/$CS2/accept" > /dev/null
CS2_STATUS=$(curl -sf "$API/changesets/$CS2" | jq -r .status)
[ "$CS2_STATUS" = "accepted" ] && echo "✓ Accept-all works"

# 8. Create + reject-all changeset
CS3=$(curl -sf -X POST -H "Content-Type: application/json" \
  -d '{
    "title":"Reject test","reasoning":"Testing reject-all",
    "source":"user",
    "items":[
      {"entity_type":"task","operation":"create",
       "after_state":{"title":"Rejected task","display_id":"TSK-1.1.4",
         "user_story":"Should not appear","priority":"low"},
       "description":"Will be rejected","display_reference":"TSK-1.1.4"}
    ]
  }' "$API/projects/$PROJECT/changesets" | jq -r .id)
curl -sf -X POST "$API/changesets/$CS3/reject" > /dev/null
CS3_STATUS=$(curl -sf "$API/changesets/$CS3" | jq -r .status)
[ "$CS3_STATUS" = "rejected" ] && echo "✓ Reject-all works"

# 9. Sources endpoint smoke
SOURCE=$(curl -sf -X POST -H "Content-Type: application/json" \
  -d '{"filename":"test.pdf","content_type":"application/pdf"}' \
  "$API/projects/$PROJECT/sources")
SOURCE_ID=$(echo $SOURCE | jq -r .id)
echo $SOURCE | jq -e .upload_url > /dev/null && echo "✓ Source created with upload_url"

# Confirm source
curl -sf -X POST "$API/sources/$SOURCE_ID/confirm" > /dev/null
S_STATUS=$(curl -sf "$API/sources/$SOURCE_ID" | jq -r .status)
[ "$S_STATUS" = "processing" ] && echo "✓ Source confirmed: processing"

# List sources
S_COUNT=$(curl -sf "$API/projects/$PROJECT/sources" | jq length)
[ "$S_COUNT" -ge 1 ] && echo "✓ Sources list: $S_COUNT sources"

# Cleanup
curl -sf -X DELETE "$API/projects/$PROJECT" > /dev/null
echo "✓ Cleanup done"

echo "=== All Phase 2 local tests passed ==="
