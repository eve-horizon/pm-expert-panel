#!/bin/bash
# scripts/smoke-test-p3.sh — Phase 3 staging verification
set -euo pipefail
BASE="https://eden-app.${ORG_SLUG}-eden-sandbox.eh1.incept5.dev"
H_AUTH="Authorization: Bearer $TOKEN"
H_JSON="Content-Type: application/json"

echo "=== Phase 3 Staging: Intelligence Loop ==="

# 0. Scaffold — use existing project or create one
PROJECT=$(curl -sf -X POST -H "$H_AUTH" -H "$H_JSON" \
  -d '{"name":"P3 Smoke","slug":"p3-smoke"}' \
  "$BASE/api/projects" | jq -r .id)

# Seed minimal map structure
ACT=$(curl -sf -X POST -H "$H_AUTH" -H "$H_JSON" \
  -d '{"name":"Onboarding","display_id":"ACT-1","sort_order":1}' \
  "$BASE/api/projects/$PROJECT/activities" | jq -r .id)
curl -sf -X POST -H "$H_AUTH" -H "$H_JSON" \
  -d '{"name":"Registration","display_id":"STP-1.1","sort_order":1}' \
  "$BASE/api/activities/$ACT/steps" > /dev/null
echo "✓ Map scaffold created"

# 1. Chat: request a map edit → creates thread + sends to coordinator
THREAD=$(curl -sf -X POST -H "$H_AUTH" -H "$H_JSON" \
  -d '{"message":"Add an admin approval step to the onboarding flow"}' \
  "$BASE/api/projects/$PROJECT/chat/threads" | jq -r .id)
echo "✓ Chat thread created: $THREAD"

# 2. Poll for AI response (coordinator → map-chat agent → changeset)
for i in $(seq 1 30); do
  MSGS=$(curl -sf -H "$H_AUTH" \
    "$BASE/api/chat/threads/$THREAD/messages" | jq length)
  if [ "$MSGS" -gt 1 ]; then
    echo "✓ AI response received after $((i * 5))s"
    break
  fi
  sleep 5
done

# 3. Check changeset was created (map-chat agent should have posted one)
DRAFTS=$(curl -sf -H "$H_AUTH" \
  "$BASE/api/projects/$PROJECT/changesets?status=draft" | jq length)
echo "✓ $DRAFTS draft changeset(s) from chat"

# 4. Accept changeset → triggers alignment-check workflow via app.changeset.accepted
CS_ID=$(curl -sf -H "$H_AUTH" \
  "$BASE/api/projects/$PROJECT/changesets?status=draft" | jq -r '.[0].id')
curl -sf -X POST -H "$H_AUTH" "$BASE/api/changesets/$CS_ID/accept" > /dev/null
echo "✓ Changeset accepted (alignment-check workflow triggered)"

# 5. Wait for alignment agent → poll for new questions
for i in $(seq 1 12); do
  QUESTIONS=$(curl -sf -H "$H_AUTH" \
    "$BASE/api/projects/$PROJECT/questions?status=open" | jq length)
  if [ "$QUESTIONS" -gt 0 ]; then
    echo "✓ $QUESTIONS open question(s) from alignment (after $((i * 5))s)"
    break
  fi
  sleep 5
done

# 6. Answer question via evolve → triggers question-evolution workflow
if [ "${QUESTIONS:-0}" -gt 0 ]; then
  Q_ID=$(curl -sf -H "$H_AUTH" \
    "$BASE/api/projects/$PROJECT/questions?status=open" | jq -r '.[0].id')
  curl -sf -X POST -H "$H_AUTH" -H "$H_JSON" \
    -d '{"answer":"Yes, require admin approval for all new accounts"}' \
    "$BASE/api/questions/$Q_ID/evolve" > /dev/null
  echo "✓ Question answered + evolve triggered"

  # 7. Wait for question-evolution → poll for new changeset
  for i in $(seq 1 12); do
    NEW_DRAFTS=$(curl -sf -H "$H_AUTH" \
      "$BASE/api/projects/$PROJECT/changesets?status=draft" | jq length)
    if [ "$NEW_DRAFTS" -gt 0 ]; then
      echo "✓ $NEW_DRAFTS new draft changeset(s) from question evolution (after $((i * 5))s)"
      break
    fi
    sleep 5
  done
fi

# Cleanup
curl -sf -X DELETE -H "$H_AUTH" "$BASE/api/projects/$PROJECT" > /dev/null
echo "✓ Cleanup done"

echo "=== Phase 3 staging smoke tests passed ==="
