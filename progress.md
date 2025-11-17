# Progress

**Last Updated:** 2025-11-17

## Current Status
- Action recorder/replayer functional (Playwright-based)
- Core features working: record, replay, session save/restore
- Enter key form submission fixed
- Recordings stored at: `~/Library/Application Support/blueberry-browser/recordings/*.spec.ts`

## Architecture
**Main Components:**
- `ActionRecorder.ts` - Injects recording script, captures actions
- `PlaywrightGenerator.ts` - Converts actions to `.spec.ts` files
- `ActionReplayer.ts` - Parses and executes scripts in current tab
- `SessionManager.ts` - Save/restore browser sessions
- `RecorderControls.tsx` - Record/Stop UI buttons

**How it works:**
1. Recording: Captures clicks/typing → generates `.spec.ts` file
2. Replay: Parses script → executes via JS injection in current tab
3. Enter key: Explicitly calls `form.submit()` (synthetic events don't trigger defaults)

## Recent Changes (Nov 17)
- Switched from JSON to Playwright `.spec.ts` format
- Fixed Enter key triggering form submission
- Cleaned up legacy action counting code
- Simplified documentation (removed RECORDER_FEATURE.md, TODO.md)

## Known Issues
**Critical:**
- Shadow DOM elements not capturable
- iframes need special handling

**UI/UX:**
- No visual feedback during replay
- No confirmation dialog before deleting recordings
- Recordings list doesn't auto-refresh after deletion
- No pulse animation on record button

**Technical:**
- Limited Playwright commands (only goto/click/fill/keyboard.press)
- Uses regex parsing instead of AST
- Custom form handlers may not work with Enter key

## Next Priorities

**High Priority:**
1. Test thoroughly with multi-step workflows (login → navigate → form → submit)
2. Add visual feedback during replay (progress indicator, highlight elements)
3. UX polish (record button animation, action count, elapsed time)

**Medium Priority:**
- Expand Playwright command support (selectOption, hover, waitForSelector, screenshot)
- Add "View Script" button to open `.spec.ts` in editor
- Session management UI (save/restore sessions, skip login checkbox)
- Content substitution (parameterized inputs for replay)

**Low Priority:**
- Export/import recordings
- Recording metadata (tags, success rate)
- Variable replay speed
- Better error recovery (retry failed actions)

## Future Ideas
- AI-powered: Auto-fix broken selectors, generate descriptions, optimize workflows
- Advanced: Visual workflow editor, multi-tab recording, cloud sync
- Analytics: Usage tracking, success rates, time saved metrics

## Code Cleanup
- [ ] Remove unused imports (spawn in ActionReplayer)
- [ ] Add JSDoc comments to public methods
- [ ] Write unit tests for PlaywrightGenerator
- [ ] Add error boundary to RecorderControls
- [ ] Document IPC event contracts

## Blockers
None currently
