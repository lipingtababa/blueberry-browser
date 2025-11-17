# Automated Chat Testing

This directory contains automated testing tools for the Blueberry Browser chat functionality.

## Overview

The automated testing system allows you to:
- Programmatically trigger chat messages
- Monitor chat responses and UI updates
- Verify that messages are displayed correctly
- Debug chat-related issues without manual interaction

## Files

### 1. `trigger-chat.js`
**Main test trigger script** - Programmatically creates chat message triggers.

```bash
# Send a single test message
npm run test:chat:trigger "Hello, test message"

# Run automated test suite (sends multiple messages)
npm run test:chat:auto
```

### 2. `test-trigger-watcher.ts`
**Integration module** - Watches for trigger files and processes them automatically.

This needs to be enabled in the main Electron process. See "Integration Setup" below.

### 3. `chat-integration-test.js`
**Log-based test runner** - Analyzes application logs to verify chat functionality.

```bash
npm run test:chat:integration
```

### 4. `chat-test.ts`
**Full Electron test** - Launches app and tests chat programmatically (advanced).

## Quick Start

### Option 1: File-Based Triggers (Recommended)

This is the easiest way to automate chat testing.

**Step 1: Enable test mode**

Add the trigger watcher to `src/main/index.ts`:

```typescript
// Add import at top of file
import { TestTriggerWatcher } from '../tests/automated/test-trigger-watcher'

// After creating mainWindow, add:
if (process.env.ENABLE_TEST_TRIGGERS === 'true') {
  const watcher = new TestTriggerWatcher(mainWindow)
  watcher.start()
  console.log('✅ Test trigger watcher enabled')
}
```

**Step 2: Run app in test mode**

```bash
npm run dev:test
```

**Step 3: Trigger test messages**

In a separate terminal:

```bash
# Send single message
npm run test:chat:trigger "Your test message"

# Run automated test suite
npm run test:chat:auto
```

The app will automatically:
1. Detect the trigger files
2. Send the messages to the LLM
3. Display responses in the UI
4. Log all activity to `/tmp/blueberry/console.log`

### Option 2: Manual Testing with Log Analysis

**Step 1: Run the app**

```bash
npm run dev
```

**Step 2: Manually send test messages via the UI**

Send these test messages through the chat interface:
1. "Hello, this is an automated test"
2. "Can you respond to this message?"
3. "Testing the chat functionality"

**Step 3: Analyze the logs**

```bash
npm run test:chat:integration
```

This will analyze the application logs and report on:
- Whether messages were sent successfully
- Whether responses were received
- Whether UI updated correctly
- Any errors that occurred

## Integration Setup

### Enable Test Trigger Watcher

Edit `src/main/index.ts`:

```typescript
import { TestTriggerWatcher } from '../tests/automated/test-trigger-watcher'

// In your main window creation code:
const mainWindow = new Window(app)

// Enable test triggers in development
if (process.env.ENABLE_TEST_TRIGGERS === 'true') {
  const watcher = new TestTriggerWatcher(mainWindow)
  watcher.start()

  // Optional: Trigger a test message after 5 seconds
  setTimeout(() => {
    watcher.triggerTestMessage('This is an automated startup test')
  }, 5000)
}
```

### Mark UI Messages for Testing

To enable automated UI verification, add data attributes to message elements in `Chat.tsx`:

```tsx
<div data-message-role={message.role} data-message-id={message.id}>
  {/* message content */}
</div>
```

This allows the test scripts to count and verify rendered messages.

## Test Workflows

### Workflow 1: Continuous Testing During Development

1. **Terminal 1**: Run app in test mode
   ```bash
   npm run dev:test
   ```

2. **Terminal 2**: Trigger test messages as needed
   ```bash
   npm run test:chat:trigger "Test message here"
   ```

3. **Monitor**: Watch logs in real-time
   ```bash
   tail -f /tmp/blueberry/console.log
   ```

### Workflow 2: Automated Test Suite

Run the full automated test suite:

```bash
# Terminal 1: Start app in test mode
npm run dev:test

# Terminal 2: Run automated tests
npm run test:chat:auto
```

This will:
- Send 5 predefined test messages
- Wait 3 seconds between each message
- Create trigger files that the app processes
- Log all activity

### Workflow 3: Debug UI Rendering Issues

If messages aren't displaying:

1. Send test messages via triggers
2. Check the console log for events:
   ```bash
   grep -i "chat\|message" /tmp/blueberry/console.log
   ```
3. Look for:
   - `📤 [LLM] Sending chat-messages-updated`
   - `[CHAT] handleMessagesUpdated`
   - `[CHAT COMPONENT] Rendering with messages`

## Log Files

All test activity is logged to `/tmp/blueberry/`:

- `console.log` - Main application log (all processes)
- `chat-trigger.log` - Trigger script activity
- `integration-test.log` - Integration test results
- `triggers/` - Directory containing trigger files

## Debugging Tips

### Messages not sending?

Check if the trigger watcher is running:
```bash
grep "TEST WATCHER" /tmp/blueberry/console.log
```

Should see:
```
👀 [TEST WATCHER] Starting trigger watcher...
📨 [TEST WATCHER] Found X new trigger(s)
📝 [TEST WATCHER] Processing: chat-XXXXX.json
```

### Messages sending but not displaying?

Check the event flow:
```bash
grep -A 2 "chat-messages-updated\|handleMessagesUpdated" /tmp/blueberry/console.log
```

Should see:
```
📤 [LLM] Sending chat-messages-updated event with X messages
[CHAT] handleMessagesUpdated - received messages: X
[CHAT COMPONENT] Rendering with messages: X
```

### LLM not responding?

Check for API errors:
```bash
grep -i "error\|failed" /tmp/blueberry/console.log
```

Verify environment variables in `.env`:
```bash
cat .env | grep -i "api_key"
```

## Environment Variables

Required for chat functionality:

```bash
# .env file
LLM_PROVIDER=openai  # or anthropic, google
LLM_MODEL=gpt-4o-mini
OPENAI_API_KEY=your_key_here

# Enable test triggers
ENABLE_TEST_TRIGGERS=true
```

## Advanced Usage

### Custom Test Messages

Edit `trigger-chat.js` to customize test messages:

```javascript
const TEST_MESSAGES = [
  'Your custom test message 1',
  'Your custom test message 2',
  // Add more...
]
```

### Manual Trigger in Code

From within the Electron main process:

```typescript
import { TestTriggerWatcher } from '../tests/automated/test-trigger-watcher'

const watcher = new TestTriggerWatcher(mainWindow)
watcher.start()

// Manually trigger a message
await watcher.triggerTestMessage('Manual test message')
```

### Programmatic IPC Testing

Directly invoke IPC handlers:

```typescript
import { ipcMain } from 'electron'

// Trigger chat message
ipcMain.emit('sidebar-chat-message', null, {
  message: 'Test message',
  messageId: 'test-123'
})
```

## Troubleshooting

### Error: "Cannot find module '../tests/automated/test-trigger-watcher'"

Make sure TypeScript compilation includes the tests directory. Check `tsconfig.node.json`:

```json
{
  "include": [
    "src/**/*",
    "tests/automated/**/*"  // Add this
  ]
}
```

### Error: "ENOENT: no such file or directory '/tmp/blueberry/triggers'"

The trigger directory is created automatically. If you see this error:

```bash
mkdir -p /tmp/blueberry/triggers
```

### Trigger files not being processed

1. Check if test mode is enabled:
   ```bash
   ps aux | grep electron | grep ENABLE_TEST_TRIGGERS
   ```

2. Verify trigger files exist:
   ```bash
   ls -la /tmp/blueberry/triggers/
   ```

3. Check watcher logs:
   ```bash
   grep "TEST WATCHER" /tmp/blueberry/console.log
   ```

## Best Practices

1. **Always run in test mode** when using automated triggers:
   ```bash
   npm run dev:test
   ```

2. **Monitor logs** while testing:
   ```bash
   tail -f /tmp/blueberry/console.log
   ```

3. **Clean trigger directory** before test runs:
   ```bash
   rm -f /tmp/blueberry/triggers/*.json
   ```

4. **Use unique message IDs** to track specific messages:
   ```javascript
   const messageId = `test-${Date.now()}-${Math.random()}`
   ```

5. **Wait between messages** to avoid rate limiting:
   ```javascript
   await new Promise(resolve => setTimeout(resolve, 3000))
   ```

## Future Enhancements

Potential improvements:

- [ ] Add visual diff testing for UI rendering
- [ ] Implement screenshot comparison
- [ ] Add performance metrics (response time, etc.)
- [ ] Create CI/CD integration
- [ ] Add test result reporting dashboard
- [ ] Implement WebDriver-based E2E tests
- [ ] Add code coverage reporting

## Contributing

When adding new test functionality:

1. Document the test in this README
2. Add appropriate npm scripts to package.json
3. Include example usage
4. Update troubleshooting section if needed

## License

Same as parent project.
