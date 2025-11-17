# Blueberry Browser Testing Guide

## Phase 1: Chat Testing with UI Verification ✅ COMPLETE

### What's Been Implemented

#### 1. UI Test Attributes
Added `data-message-role` and `data-message-id` attributes to chat messages in `Chat.tsx`:
- User messages: `<div data-message-role="user" data-message-id="...">`
- Assistant messages: `<div data-message-role="assistant" data-message-id="...">`

This enables automated DOM verification to confirm messages appear in the UI.

#### 2. DOM Verification Helper
Created `tests/automated/dom-verification.js` with utilities:
- `countMessages()` - Count messages in UI
- `verifyMessageExists()` - Check if specific message exists
- `getMessageContent()` - Get message text
- `waitForMessage()` - Wait for message to appear
- `isLoadingVisible()` - Check loading state

#### 3. Enhanced Test Trigger Watcher
Updated `tests/automated/test-trigger-watcher.ts`:
- Added `verifyUI` flag to trigger data
- Automatic UI verification after sending messages
- Writes verification results to `/tmp/blueberry/results/`
- Reports message counts and success/failure

#### 4. Enhanced Chat Trigger Script
Updated `tests/automated/trigger-chat.js`:
- Added `--verify` flag for UI verification
- Reads verification results from result directory
- Reports pass/fail status with message counts
- New test command: `npm run test:chat:verify`

### How to Use

#### Quick Test (Single Message with Verification)
```bash
# Terminal 1: Start app in test mode
cd /Users/machi/code/blueberry-browser
npm run dev:test

# Terminal 2: Wait 5 seconds, then send test message with UI verification
sleep 5 && npm run test:chat:trigger -- --verify "Hello, test message"
```

#### Automated Test Suite (5 messages with UI verification)
```bash
# Terminal 1: Start app in test mode
npm run dev:test

# Terminal 2: Wait 5 seconds, then run automated tests
sleep 5 && npm run test:chat:verify
```

#### Without UI Verification (Legacy mode)
```bash
# Terminal 1
npm run dev:test

# Terminal 2
sleep 5 && npm run test:chat:auto
```

### Test Output

With `--verify` flag, you'll see:
```
✅ UI VERIFICATION PASSED
   Messages in UI: 2 (1 user, 1 assistant)
```

Or if it fails:
```
❌ UI VERIFICATION FAILED: Message not found in DOM
```

### Test Directories

- **Triggers**: `/tmp/blueberry/triggers/` - Trigger files created by test script
- **Results**: `/tmp/blueberry/results/` - Verification results written by watcher
- **Logs**: `/tmp/blueberry/chat-trigger.log` - Test execution log

### Files Modified/Created

**Modified:**
- `src/renderer/sidebar/src/components/Chat.tsx` - Added data-attributes
- `tests/automated/test-trigger-watcher.ts` - Added UI verification
- `tests/automated/trigger-chat.js` - Added verification reading
- `package.json` - Added `test:chat:verify` script
- `CLAUDE.md` - Added testing wait time guideline

**Created:**
- `tests/automated/dom-verification.js` - DOM verification utilities
- `tests/automated/TESTING_GUIDE.md` - This guide

---

## Next Steps (Phase 2+)

### Immediate Next Steps
1. **Test the system** - Run the verification tests to ensure everything works
2. **Document results** - Note any issues or improvements needed

### Phase 2: Testing Infrastructure (Planned)
- Install Vitest for unit testing
- Create unit tests for LLMClient, utilities
- Install Playwright for E2E testing
- Set up test configuration files

### Phase 3: Recorder Testing (Planned)
- Create `trigger-recorder.js` for recorder automation
- E2E tests for full recording workflows
- Playback verification

### Phase 4: CI/CD Integration (Planned)
- GitHub Actions workflow
- Automated testing on push/PR
- Coverage reporting

---

## Troubleshooting

### Test messages not appearing in UI
1. Make sure app is running with `npm run dev:test`
2. Wait 5 seconds after startup before triggering tests
3. Check `/tmp/blueberry/console.log` for errors

### Verification always fails
1. Check that sidebar is visible (⌘E to toggle)
2. Verify data-attributes are in DOM (inspect element)
3. Check result files in `/tmp/blueberry/results/`

### Timeout errors
1. Increase wait time in trigger-chat.js (currently 10s)
2. Check if LLM API is responding (API key valid)
3. Look for errors in main process logs

---

## API Testing Note

Current tests use the **real LLM APIs** (OpenAI, Anthropic, Google). Make sure you have:
- Valid API keys in `.env`
- Sufficient API quota
- Network connectivity

The LLMClient is currently in **TEST mode** using `getCompletion()` instead of streaming, which makes testing more reliable.
