# Scenario 07b: Chat Panel UI

**Time:** ~5 minutes
**Parallel Safe:** No
**LLM Required:** No (UI chrome only) / Yes (for full agent round-trip)

Verifies the chat panel opens, accepts input, sends messages, displays typing indicator, strips routing prefixes, handles errors, and supports thread management. Tests the **chat UI itself** — separate from agent-side scenarios (09, 10, 14) which test agent behavior.

## Prerequisites

- Scenarios 01–02 passed — project exists with baseline map
- API running with `EVE_API_URL` and `EVE_PROJECT_ID` set

## Steps

### 1. Open Chat Panel

Navigate to the story map, click the **Chat** button in the toolbar.

**Expected:**
- Chat panel slides in from the right (560px width)
- Header shows "Map Chat" with New Thread and Close buttons
- Empty state shows placeholder: "Ask me to edit the story map"
- Input textbox visible with "Ask about the map or request changes..." placeholder
- Send button disabled (no text entered)

### 2. Type and Send a Message

Type "What tasks are in Document Ingestion?" and click Send (or press Enter).

**Expected:**
- User message appears as right-aligned accent-colored bubble
- **Message does NOT show `@eve pm` prefix** (stripped in display)
- Input becomes disabled during send/polling
- Typing indicator (three animated dots) appears below the user message
- After agent responds (or polling timeout), input re-enables

### 3. Agent Response Rendering (requires staging)

Wait for the PM coordinator to respond.

**Expected:**
- Agent response appears as left-aligned gray bubble
- Markdown formatting rendered (bold, lists, code blocks)
- If response references a changeset, "Review Changeset" button appears inline

### 4. New Thread

Click the **+** (New Thread) button.

**Expected:**
- Messages clear
- Active thread resets
- Empty state reappears
- Next message creates a fresh Eve thread

### 5. Close Panel

Click the **x** close button (or the backdrop overlay).

**Expected:**
- Chat panel closes
- Chat toolbar button state returns to normal (not highlighted)

### 6. Error Handling (requires EVE_PROJECT_ID unset)

If `EVE_PROJECT_ID` is not configured, opening chat and attempting to send should:

**Expected:**
- Error banner appears: "Failed to send message" or "Failed to load threads"
- No crash or unhandled exception
- Input re-enables so user can retry

### 7. Changeset Review Flow (requires agent-created changeset)

When an agent response contains a changeset reference like "Changeset #abc123":

**Expected:**
- "Review Changeset" button appears in the message bubble
- Clicking it triggers `onReviewChangeset` callback
- Parent page opens changeset detail modal

## Success Criteria

- [ ] Chat panel opens/closes from toolbar button
- [ ] Empty state shows with placeholder text and example prompts
- [ ] User messages display without `@eve pm` routing prefix
- [ ] Send button disabled when input is empty or during loading/polling
- [ ] Typing indicator appears while polling for agent response
- [ ] New Thread button clears conversation and resets state
- [ ] Error state displays gracefully (no crash)
- [ ] Agent responses render markdown correctly (bold, lists, code)
- [ ] Changeset references in messages show "Review Changeset" button
- [ ] Chat panel coexists with story map (side by side layout)
