# Integration Guide

This guide shows how to integrate the automated testing system into the Blueberry Browser.

## Quick Integration (Copy-Paste)

### Step 1: Update tsconfig.node.json

Add the tests directory to TypeScript compilation:

```bash
# Open src/tsconfig.node.json and add to "include" array:
"tests/automated/**/*"
```

### Step 2: Modify src/main/index.ts

Add this code to enable test triggers:

```typescript
// Add this import near the top of the file (after other imports)
import { TestTriggerWatcher } from '../../tests/automated/test-trigger-watcher'

// Add this code after creating the mainWindow
// (Look for where `const mainWindow = new Window(app)` or similar)
if (process.env.ENABLE_TEST_TRIGGERS === 'true') {
  const watcher = new TestTriggerWatcher(mainWindow)
  watcher.start()

  // Optional: Send a test message after startup to verify it works
  setTimeout(() => {
    console.log('🧪 Sending startup test message...')
    watcher.triggerTestMessage('Automated test: App started successfully')
  }, 5000)
}
```

### Step 3: Test It

**Terminal 1** - Run app in test mode:
```bash
npm run dev:test
```

**Terminal 2** - Send a test message:
```bash
npm run test:chat:trigger "Hello from automated test"
```

**Terminal 3** - Watch the logs:
```bash
tail -f /tmp/blueberry/console.log | grep -i "test\|chat"
```

You should see:
- `👀 [TEST WATCHER] Starting trigger watcher...`
- `📨 [TEST WATCHER] Found 1 new trigger(s)`
- `💬 [TEST WATCHER] Sending chat message: "Hello from automated test"`
- `📤 [LLM] Sending chat-messages-updated event with X messages`

## Full Integration Example

Here's a complete example of `src/main/index.ts` with testing enabled:

```typescript
import { app } from 'electron'
import { Window } from './Window'
import { EventManager } from './EventManager'
import { TestTriggerWatcher } from '../../tests/automated/test-trigger-watcher'

// Existing code...

app.whenReady().then(() => {
  // Create main window
  const mainWindow = new Window(app)

  // Set up event handlers
  const eventManager = new EventManager(mainWindow)

  // Enable automated testing in development/test mode
  if (process.env.ENABLE_TEST_TRIGGERS === 'true') {
    console.log('🧪 Automated testing enabled')

    const testWatcher = new TestTriggerWatcher(mainWindow)
    testWatcher.start()

    // Optional: Send test message on startup
    setTimeout(() => {
      testWatcher.triggerTestMessage('Test: Application initialized')
    }, 5000)

    // Optional: Clean up on quit
    app.on('before-quit', () => {
      testWatcher.stop()
    })
  }

  // Existing code...
})
```

## TypeScript Configuration

Update `tsconfig.node.json`:

```json
{
  "extends": "@electron-toolkit/tsconfig/tsconfig.node.json",
  "include": [
    "electron.vite.config.*",
    "src/main/**/*",
    "src/preload/**/*",
    "tests/automated/**/*"
  ],
  "compilerOptions": {
    "composite": true,
    "types": ["node"]
  }
}
```

## Verification Checklist

After integration, verify everything works:

- [ ] TypeScript compiles without errors: `npm run typecheck`
- [ ] App starts in test mode: `npm run dev:test`
- [ ] Test watcher logs appear in console
- [ ] Trigger script creates files: `npm run test:chat:trigger "test"`
- [ ] App processes trigger files (watch logs)
- [ ] Chat messages are sent to LLM
- [ ] Responses appear in UI

## Troubleshooting Integration

### Error: Cannot find module 'test-trigger-watcher'

**Solution**: Update `tsconfig.node.json` to include tests directory:
```json
"include": ["src/main/**/*", "tests/automated/**/*"]
```

### Error: mainWindow is not defined

**Solution**: Make sure you pass the correct Window instance:
```typescript
const watcher = new TestTriggerWatcher(mainWindow) // mainWindow must be a Window instance
```

### Test watcher not starting

**Solution**: Verify environment variable:
```bash
# Should output: ENABLE_TEST_TRIGGERS=true
npm run dev:test | grep ENABLE_TEST_TRIGGERS
```

### Trigger files created but not processed

**Solution**: Check if watcher is running:
```bash
grep "TEST WATCHER" /tmp/blueberry/console.log
```

If no output, the watcher isn't starting. Check:
1. `ENABLE_TEST_TRIGGERS` is set to `'true'` (string)
2. Code is placed after `mainWindow` creation
3. No TypeScript compilation errors

## Optional: UI Verification

To enable automated UI verification, add data attributes to chat messages.

In `src/renderer/sidebar/src/components/Chat.tsx`:

```tsx
// In the UserMessage component
<div
  data-message-role="user"
  data-message-id={message.id}
  className="..."
>
  {message.content}
</div>

// In the AssistantMessage component
<div
  data-message-role="assistant"
  data-message-id={message.id}
  className="..."
>
  {message.content}
</div>
```

This allows test scripts to query and count rendered messages:
```javascript
// In test code
const messageCount = document.querySelectorAll('[data-message-role]').length
```

## Clean Up After Testing

Remove test files:
```bash
rm -rf /tmp/blueberry/triggers/*.json
rm -f /tmp/blueberry/chat-trigger.log
```

Disable test mode:
```bash
# Just run normal dev mode
npm run dev
```

## Next Steps

Once integrated, you can:

1. **Run automated tests**: `npm run test:chat:auto`
2. **Send custom messages**: `npm run test:chat:trigger "Your message"`
3. **Monitor in real-time**: `tail -f /tmp/blueberry/console.log`
4. **Debug issues**: Check logs for event flow

See `README.md` for full usage documentation.
