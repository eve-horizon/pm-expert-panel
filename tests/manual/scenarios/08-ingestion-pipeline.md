# Scenario 08: Document Ingestion Pipeline

**Time:** ~10 minutes
**Parallel Safe:** No
**LLM Required:** Yes (Eve agents)

Uploads Eden's own high-level summary as a source document and triggers the Eve ingestion pipeline. Verifies the three-agent pipeline: ingest, extract, synthesize.

## Prerequisites

- Scenarios 01–02 passed — project exists with baseline map
- Eve agents synced to the eden project

## Steps

### 1. Create Source Record

```bash
SOURCE=$(api -X POST "$EDEN_URL/api/projects/$PROJECT_ID/sources" \
  -d '{
    "filename": "high-level-summary.md",
    "content_type": "text/markdown",
    "file_size": 4096
  }')
SOURCE_ID=$(echo "$SOURCE" | jq -r '.id')
echo "Source: $SOURCE_ID"
```

**Expected:** Source created with status `uploaded`.

### 2. Upload the Document Content

> Implementation depends on whether Eden uses presigned URLs or direct upload.
> If presigned URL:
> ```bash
> PRESIGN=$(api "$EDEN_URL/api/projects/$PROJECT_ID/sources/$SOURCE_ID/upload-url")
> UPLOAD_URL=$(echo "$PRESIGN" | jq -r '.url')
> curl -X PUT "$UPLOAD_URL" -T docs/prd/high-level-summary.md
> ```
> If direct attachment via Eve:
> ```bash
> eve ingest docs/prd/high-level-summary.md --project "$PROJECT_ID" --json
> ```

### 3. Confirm Source to Trigger Pipeline

```bash
CONFIRM=$(api -X POST "$EDEN_URL/api/projects/$PROJECT_ID/sources/$SOURCE_ID/confirm")
echo "$CONFIRM" | jq '{status}'
```

**Expected:** Status changes to `processing`. Eve `doc.ingest` event fires.

### 4. Monitor Pipeline Jobs

```bash
# Wait for Eve to create ingestion job
for i in $(seq 1 24); do
  JOBS=$(eve job list --project eden --status active --json 2>/dev/null)
  [ "$(echo "$JOBS" | jq 'length')" -gt 0 ] && break
  echo "Waiting for pipeline job... ($i)"
  sleep 5
done

# Follow the ingestion job
JOB_ID=$(echo "$JOBS" | jq -r '.[0].id')
eve job follow $JOB_ID
```

**Expected:**
- Ingestion agent reads the markdown file
- Extraction agent identifies personas, activities, steps, tasks
- Synthesis agent compares against existing map and creates changeset

### 5. Verify Changeset Created

```bash
# Poll for changeset from ingestion pipeline
for i in $(seq 1 12); do
  CS_LIST=$(api "$EDEN_URL/api/projects/$PROJECT_ID/changesets?source=ingestion")
  [ "$(echo "$CS_LIST" | jq 'length')" -gt 0 ] && break
  sleep 5
done

echo "$CS_LIST" | jq '.[0] | {title, source, item_count: (.items | length)}'
```

**Expected:** At least 1 changeset with source `ingestion`, containing multiple items (tasks, steps, activities extracted from the document).

### 6. Verify Source Status Updated

```bash
api "$EDEN_URL/api/projects/$PROJECT_ID/sources/$SOURCE_ID" | jq '{status, filename}'
```

**Expected:** Status is `synthesized` (or `extracted` if synthesis is still running).

## Debugging

```bash
# Check Eve job status
eve job list --project eden --json | jq '.[] | {id, description, phase, close_reason}'

# Diagnose stuck job
eve job diagnose $JOB_ID

# Check workflow trigger
eve job logs $JOB_ID
```

## Success Criteria

- [ ] Source record created via API
- [ ] Confirm triggers Eve doc.ingest event
- [ ] Ingestion job starts within 2 minutes
- [ ] Pipeline completes (ingest → extract → synthesize)
- [ ] Changeset created with extracted requirements
- [ ] Source status updated to reflect pipeline completion
- [ ] Extracted content relates to document contents (not hallucinated)
