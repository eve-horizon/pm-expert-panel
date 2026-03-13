# Scenario 01: API Smoke & Project Setup

**Time:** ~2 minutes
**Parallel Safe:** Yes
**LLM Required:** No

Verifies the API is alive, auth works, and creates the test project that all subsequent scenarios use.

## Prerequisites

- Staging deployment is up (`eve env show sandbox`)

## Setup

```bash
TOKEN="${EVE_TOKEN:-$(eve auth token --raw)}"
api() { curl -sf -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" "$@"; }
api_code() { curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$@"; }
```

## Steps

### 1. Health Check

```bash
CODE=$(api_code "$EDEN_URL/api/health")
echo "Health: $CODE"
```

**Expected:** HTTP 200

### 2. Create Test Project

```bash
PROJECT=$(api -X POST "$EDEN_URL/api/projects" \
  -d "{\"name\": \"Manual Test — Eden Scenarios\", \"slug\": \"$PROJECT_SLUG\"}")
export PROJECT_ID=$(echo "$PROJECT" | jq -r '.id')
echo "Project: $PROJECT_ID"
```

**Expected:**
- HTTP 201
- Returns JSON with `id`, `name`, `slug`
- `slug` is `$PROJECT_SLUG`

> If project already exists (409), fetch it:
> ```bash
> PROJECT_ID=$(api "$EDEN_URL/api/projects" | jq -r --arg slug "$PROJECT_SLUG" '.[] | select(.slug==$slug) | .id')
> ```

### 3. Verify Project Appears in List

```bash
api "$EDEN_URL/api/projects" | jq '.[].slug'
```

**Expected:** `"$PROJECT_SLUG"` appears in the list

### 4. Verify Empty Map

```bash
MAP=$(api "$EDEN_URL/api/projects/$PROJECT_ID/map")
echo "$MAP" | jq '{activities: (.activities | length), personas: (.personas | length)}'
```

**Expected:** Both counts are 0 — clean slate.

## Success Criteria

- [ ] API health returns 200
- [ ] Project created with correct slug
- [ ] Project listed in projects endpoint
- [ ] Empty map returned for new project
