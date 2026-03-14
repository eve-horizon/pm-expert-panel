# Scenario 05: Audit Trail & Export

**Time:** ~2 minutes
**Parallel Safe:** No
**LLM Required:** No

Verifies that all operations from Scenarios 01–04 left an audit trail, and that export produces valid output.

## Prerequisites

- Scenarios 01–04 passed

## Steps

### 1. Fetch Audit Log

```bash
AUDIT=$(api "$EDEN_URL/projects/$PROJECT_ID/audit")
echo "$AUDIT" | jq '{
  total: (.entries | length),
  actions: [.entries[].action] | unique,
  entity_types: [.entries[].entity_type] | unique
}'
```

**Expected:**
- Multiple entries (15+ from Scenarios 01–04)
- Actions include: `create`, `update`, `accept`, `reject`
- Entity types include: `persona`, `activity`, `step`, `task`, `release`, `question`, `changeset`

### 2. Filter Audit by Entity Type

```bash
api "$EDEN_URL/projects/$PROJECT_ID/audit?entity_type=changeset" | jq '.entries[].action'
```

**Expected:** Shows `create`, `accept`, `reject` actions for changesets.

### 3. Export to JSON

```bash
JSON_EXPORT=$(api "$EDEN_URL/projects/$PROJECT_ID/export/json")
echo "$JSON_EXPORT" | jq 'keys'
```

**Expected:** Valid JSON with keys for project structure (activities, personas, tasks, etc.)

### 4. Export to Markdown

```bash
MD_EXPORT=$(api "$EDEN_URL/projects/$PROJECT_ID/export/markdown")
echo "$MD_EXPORT" | head -20
```

**Expected:** Formatted Markdown with headings for activities, steps, task descriptions.

## Success Criteria

- [ ] Audit log contains entries from all CRUD operations
- [ ] Audit filterable by entity_type
- [ ] JSON export produces valid, complete project structure
- [ ] Markdown export produces readable requirements document
