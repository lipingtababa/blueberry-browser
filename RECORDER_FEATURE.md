# Browser Action Recorder & Replay Feature

## Overview

The Blueberry Browser includes a **Playwright-based Action Recorder & Replay** system that allows you to:
- Record multi-step browser workflows
- Generate executable Playwright test scripts
- Replay actions in the current browser (no separate window)
- Save recordings as editable TypeScript files
- Handle keyboard events (including Enter for form submission)

## How It Works

### Recording Phase
1. Click **Record** button in toolbar
2. Perform your actions (clicks, typing, Enter key presses)
3. Click **Stop** when done
4. System generates a Playwright `.spec.ts` file automatically

### Replay Phase
1. View recordings in sidebar
2. Click **Replay** on any recording
3. Actions execute **in the current browser tab**
4. Form submissions work correctly (Enter key triggers `form.submit()`)

## Key Features

✅ **Playwright Script Generation** - Recordings saved as `.spec.ts` files
✅ **Current Browser Execution** - No separate Chromium window
✅ **Enter Key Works** - Forms submit properly during replay
✅ **Human-Readable Scripts** - Edit generated TypeScript files
✅ **Consolidates Actions** - Multiple input events → single `page.fill()`
✅ **Session Management** - Save/restore login sessions

## Architecture

### Main Components

1. **ActionRecorder** (`src/main/ActionRecorder.ts`)
   - Injects recording script into pages
   - Captures user actions (clicks, inputs, keypresses)
   - Generates Playwright script on stop
   - Saves as `.spec.ts` file

2. **PlaywrightGenerator** (`src/main/PlaywrightGenerator.ts`)
   - Converts recorded actions to Playwright commands
   - Consolidates multiple inputs into single operations
   - Adds comments for Enter key form submission
   - Generates clean, editable TypeScript

3. **ActionReplayer** (`src/main/ActionReplayer.ts`)
   - Parses Playwright script
   - Executes commands in current browser tab
   - Handles Enter key with explicit `form.submit()`
   - No external Playwright process needed

4. **SessionManager** (`src/main/SessionManager.ts`)
   - Saves browser cookies/sessions
   - Enables skipping login steps

### Data Storage

Recordings are stored as Playwright scripts in:
```
~/Library/Application Support/blueberry-browser/recordings/
```

Each recording is a `.spec.ts` file that can be:
- Viewed and edited
- Run directly with `npx playwright test`
- Version controlled with git

### Generated Script Example

```typescript
import { test, expect } from '@playwright/test';

// Recording ID: 4d6870eb-c94b-42f3-9a1f-e342420cd298
// Created: 2025-11-17T00:55:07.065Z

test('Recording-2025-11-17T00-55-07', async ({ page }) => {
  // Navigate to starting URL
  await page.goto('https://www.google.com/');

  await page.click('#APjFqb');
  await page.fill('#APjFqb', 'hello');
  await page.keyboard.press('Enter'); // May trigger form submission
});
```

## How Replay Works

Instead of launching Playwright externally, the replayer:

1. **Reads the `.spec.ts` file**
2. **Parses each command** (`goto`, `click`, `fill`, `keyboard.press`)
3. **Executes via JavaScript injection** in the current tab
4. **Handles Enter specially** - Calls `form.submit()` explicitly

This approach:
- ✅ Uses the existing browser (no separate window)
- ✅ Maintains browser state (cookies, localStorage)
- ✅ Works with the current tab
- ✅ Simpler than external Playwright execution

## Known Limitations

### Enter Key Behavior
- Synthetic keyboard events don't trigger browser default actions
- Workaround: Explicitly call `form.submit()` when Enter is pressed
- Works for most cases, but some sites may have custom handlers

### Script Parsing
- Currently uses regex to parse Playwright commands
- Only supports basic commands (goto, click, fill, keyboard.press)
- Complex Playwright features not yet supported

## Future Enhancements

- [ ] Support more Playwright commands (selectOption, hover, etc.)
- [ ] Add recording editing UI
- [ ] Support conditional logic in replays
- [ ] Bulk replay multiple recordings
- [ ] Cloud sync for recordings

## Troubleshooting

### Recording doesn't capture actions
- Check recording indicator (red dot) is visible
- Some shadow DOM elements may not be capturable

### Replay fails to find elements
- Website may have changed since recording
- Re-record the workflow
- Manually edit the `.spec.ts` file to fix selectors

### Enter key doesn't submit form
- Check if form submission is handled via JavaScript
- May need to manually edit script to trigger custom handlers

## Technical Details

### Why Playwright Scripts Instead of JSON?

Previous approach used JSON recordings with custom replay logic. Problems:
- Custom replayer had many edge cases
- Enter key didn't trigger form submission
- Hard to debug when things failed

New Playwright-based approach:
- Generates standard Playwright tests
- Scripts are human-readable and editable
- Playwright would handle edge cases (if we used it externally)
- Currently parse and execute scripts in current browser for simplicity

### Metadata Storage

Metadata is stored in script comments:
```typescript
// Recording ID: uuid
// Created: ISO date
// Description: optional
```

Parsed when loading recordings to display in UI.

---

**Last Updated:** 2025-11-17
**Status:** Core functionality complete, Enter key working
