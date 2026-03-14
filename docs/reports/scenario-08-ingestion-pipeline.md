# Scenario 08: Document Ingestion Pipeline — Optimization Report

**Date:** 2026-03-14
**Runs:** 8 iterations (3 from prior session + 5 this session)

## Summary

Reduced total LLM calls from **88 to ~37** (58% reduction) across the 3-step ingestion pipeline (ingest → extract → synthesize). Full end-to-end pipeline now works cleanly: changeset creation, accept, and map population with hierarchical display_ids (ACT-1, STP-1.1, TSK-1.1.1) all verified.

## Results

| Run | Ingest | Extract | Synthesize | Total | Key Change |
|-----|--------|---------|------------|-------|------------|
| 3   | 7      | 24      | 57         | 88    | Baseline (skill fixes from prior session) |
| 4   | 9      | 11      | 32         | 52    | Skill documentation improvements |
| 5   | 8      | 13      | 18         | 39    | Fixed missing port in resolved API URLs |
| 6   | 8      | 11      | 20         | 39    | Removed `.eve/resources/index.json` checks from extract/synthesis |
| 7   | 9      | 11      | 25         | 45    | Switched to curl, temp file for changeset JSON |
| 7b  | 9      | 13      | 22         | 44    | display_ref fix deployed; jq missing, wrong project |
| 8   | ~8     | 11      | 18         | ~37   | jq available, single project, updated skill — **clean run** |

### Run 8 Details (Final Clean Run)

| Step | LLM Calls | Harness Time | Cost |
|------|-----------|--------------|------|
| Ingest | ~8 | ~39s | minimal |
| Extract | 11 | ~124s | ~$0.15 |
| Synthesize | 18 (10 turns) | ~122s | $0.33 |
| **Total** | **~37** | **~5 min** | **~$0.48** |

**Changeset quality:** 33 items (3 personas, 4 activities, 9 steps, 17 tasks) — all with correct `display_reference` format. After accept: full map with hierarchical display_ids (ACT-1/STP-1.1/TSK-1.1.1), step_tasks junctions linking all 17 tasks to PM persona.

## Changes Made

### Platform (eve-horizon-2)

1. **Fixed missing port in API URL resolution** (prior session, commit `c6d113d7`)
   - `eve agents sync` was storing manifests without the `services` section
   - `resolveApisFromManifest()` couldn't extract port 3000, producing URLs without port suffix
   - Synthesis agent wasted ~14 calls retrying connection timeouts
   - Fix: CLI now includes `services` and `environments` in workflow manifest sync

2. **Kept curl in agent-runtime Docker image** (commit `81757952`, release v0.1.207)
   - Dockerfile was purging curl after build (`apt-get purge -y --auto-remove curl`)
   - Agents need curl for simple API calls — it's far more efficient than `node --input-type=module -e` with `fetch()`
   - Removed the purge line

3. **Restored curl examples in `buildAppApiInstructionBlock`** (same commit)
   - Previously removed curl examples thinking curl wasn't available
   - Now that curl IS available, restored the dual curl/fetch examples

4. **Added jq to agent-runtime Docker image** (release v0.1.208)
   - Agents naturally reach for `jq` to parse JSON responses from APIs
   - Was already in the worker image but missing from agent-runtime

5. **Unified `eve project sync` and `eve agents sync`** (release v0.1.208)
   - Two overlapping sync commands caused confusion — `project sync` handled manifest, `agents sync` handled agents/teams
   - Unified into single `eve project sync` that does both phases
   - `eve agents sync` now prints deprecation warning and delegates

6. **Eden changeset accept handler fixes** (3 fixes, deployed to Eden main)
   - `activity_ref` field alias: steps can now reference parent activity by `activity_ref` (not just `activity_display_id`)
   - `display_reference` as `display_id` fallback: entities get their display_id from `item.display_reference` when `after_state.display_id` is absent
   - Task→step junction creation: tasks with `step_ref` in after_state get linked via `step_tasks` junction (with persona fallback to first project persona)

### Eden Skills

7. **Removed `.eve/resources/index.json` checks from extract and synthesis skills**
   - Only the ingest step has materialized resources via `resource_refs`
   - Extract and synthesis steps were wasting 1 call each checking for a non-existent file
   - Updated skills to say "Do NOT check `.eve/resources/index.json`"

8. **Switched all skills from `node --input-type=module -e` to curl** (commit `04468f8`)
   - Simpler, fewer quoting issues, more natural for agents
   - 7 skills updated: synthesis, alignment, question, coordinator, map-chat, ingestion, extraction
   - For complex POST payloads: write JSON to temp file, then `curl -d @/tmp/payload.json`
   - Ingestion/extraction: clarified "don't call APIs" (not "no curl")

9. **Synthesis skill: display_reference format documentation**
   - Added format spec: `PER-{CODE}`, `ACT-{N}`, `STP-{A}.{S}`, `TSK-{A}.{S}.{T}`, `Q-{N}`
   - Documented `activity_ref` and `step_ref` fields for parent linking
   - Added example changeset items showing correct structure

10. **Synthesis skill: project discovery fix**
    - Changed from "pick the project with the most map data" to "if only ONE project, use it"
    - Deleted 9 stale Eden projects to avoid confusion

### Eden Skill Documentation Fixes (prior session)

11. **Removed `/api/` prefix from API endpoint docs** — agents were prepending `/api/` to all calls
12. **Removed source confirmation from ingestion skill** — was causing duplicate pipeline triggers
13. **Added explicit document discovery instructions** — agents now know exactly where to find files
14. **Added `EVE_APP_API_URL_API` env var usage** — agents no longer hardcode API URLs

## Remaining Issues

### Platform Gaps (tracked as beads)

1. **`with_apis` is workflow-level, not per-step** — The extract step gets API info it doesn't need, causing agents to waste 1 call trying the API. Should support per-step `with_apis` configuration.

### Minor Variability

- Synthesis agent still occasionally tries reading `.eve/resources/index.json` despite skill instructions saying not to (1 wasted call). Diminishing returns to fix further — this is LLM instruction following, not a skill issue.

## Verification

Run 8 produced a valid 33-item changeset accepted cleanly. Full map verified:
- 3 personas (PM, SME, Viewer)
- 4 activities (ACT-1 through ACT-4) with correct display_ids
- 9 steps (STP-1.1 through STP-4.3) with hierarchical display_ids
- 17 tasks (TSK-1.1.1 through TSK-4.3.2) linked to parent steps via step_tasks junction
- Ingest-complete webhook confirmed receipt (`matched: true`)
