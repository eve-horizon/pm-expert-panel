# Scenario 09: Expert Panel Chat — Optimization Report

**Date:** 2026-03-14
**Runs:** 1 (passed on first attempt)

## Summary

Expert panel chat works correctly on first run. The coordinator took the solo path (inline text, no attachments), generating comprehensive reviews from all 7 expert perspectives in 10 LLM turns (~$0.18, ~2 minutes).

## Results

| Metric | Value |
|--------|-------|
| Coordinator LLM turns | 10 |
| Cost | ~$0.18 |
| Duration | ~117s |
| Path taken | Solo (no attachments) |
| Expert perspectives covered | 7/7 |
| Expert jobs cancelled | 7 (auto-cancelled on `success`) |

## Changes Made

### Scenario Test Document Fix

1. **Fixed API endpoint references** — scenario was using `$EDEN_URL/api/projects/$PROJECT_ID/chat/threads` which doesn't exist
   - Chat is on the **Eve API** (`$EVE_API_URL/projects/$EVE_PID/chat/simulate`), not Eden
   - Eden has no chat API — chat routing is a platform feature
   - Also fixed references to non-existent `/reviews` endpoint
   - Thread messages are at `$EVE_API_URL/threads/$THREAD_ID/messages`

2. **Clarified solo vs panel path expectations** — both are valid outcomes:
   - **Panel path**: Coordinator returns `prepared`, 7 experts run in parallel, synthesis generated
   - **Solo path**: Coordinator returns `success`, generates all 7 perspectives inline (faster, cheaper)
   - Solo path triggered when PRD content is inline text (no file attachments)

### Skill Updates (from Scenario 08)

The coordinator skill was already updated in Scenario 08 work:
- Switched from `node --input-type=module` to `curl` for API calls
- Added curl examples for simple API calls
- Removed "curl is NOT available" (curl is now in the container)

## Observations

1. **Solo path is efficient** — 10 turns for 7 expert reviews + synthesis is excellent. Each perspective was domain-specific and actionable.

2. **Delivery status "failed" for simulated threads** — expected behavior. Simulated chat has no real delivery target (Slack channel). The message content is stored correctly in the thread.

3. **No further optimization needed** — the coordinator skill is well-structured and the triage logic correctly identified the solo path for inline text content.

## Remaining Issues

None identified. The scenario is stable and the output quality is high.

## Verification

- Chat routed to `team:expert-panel` via `route_default`
- Coordinator produced comprehensive reviews covering: Tech Lead, UX Advocate, Business Analyst, GTM Advocate, Risk Assessor, QA Strategist, Devil's Advocate
- Synthesis included actionable blockers table with owners and urgency
- Thread messages stored correctly (inbound + outbound)
