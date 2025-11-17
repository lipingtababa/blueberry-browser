# Blueberry Browser - TODO

## Summary of Recent Work (2025-11-17)

### ✅ Completed Today
- Implemented Playwright-based action recorder and replayer
- Generated Playwright `.spec.ts` files instead of JSON
- Fixed Enter key form submission issue
- Configured replay to use current browser (not separate Chromium)
- Cleaned up legacy JSON-based code (action counts, duration)
- Fixed sidebar rendering paths
- Added RecorderControls UI component

### 🎯 Current Status
**Action Recorder is fully functional:**
- ✅ Recording works
- ✅ Generates Playwright scripts
- ✅ Replay works in current browser
- ✅ Enter key triggers form submission
- ✅ Recordings list displays in sidebar
- ✅ All committed and pushed to GitHub

---

## Tomorrow's Priorities

### 🔥 High Priority

#### 1. Test and Polish Recorder
- [ ] Create comprehensive test recording
  - Record a multi-step workflow (login → navigate → form → submit)
  - Test with different websites (Google, GitHub, etc.)
  - Verify Enter key form submission works consistently
- [ ] Fix any edge cases discovered during testing
- [ ] Add better error messages for failed replays

#### 2. Improve User Experience
- [ ] Add visual feedback during replay
  - Show which action is currently executing
  - Display progress indicator
  - Highlight elements being interacted with
- [ ] Better recording state indicators
  - Pulse animation on record button
  - Show action count while recording
  - Display elapsed time

#### 3. Script Editing Support
- [ ] Add "View Script" button in recordings list
  - Opens `.spec.ts` file in system editor
  - Or shows in-app code viewer
- [ ] Add "Edit" option to modify recordings
  - Allow editing script before replay
  - Validate script syntax

### 📋 Medium Priority

#### 4. Expand Playwright Command Support
Currently supports: `goto`, `click`, `fill`, `keyboard.press`

Add support for:
- [ ] `page.selectOption()` - Dropdown selections
- [ ] `page.hover()` - Mouse hover actions
- [ ] `page.waitForSelector()` - Wait for elements
- [ ] `page.screenshot()` - Capture screenshots during replay
- [ ] `page.evaluate()` - Custom JavaScript execution

#### 5. Manual Steps Implementation
- [ ] Add "Pause" button during recording
  - Mark manual intervention points
  - Add description (e.g., "Scan QR code")
- [ ] Implement pause/resume during replay
  - Show modal: "Complete this step: [description]"
  - Wait for user to click "Continue"

#### 6. Content Substitution
- [ ] Mark input fields as "content fields" during recording
  - Tag with placeholder name (e.g., "article-title")
- [ ] Prompt for values before replay
  - Input dialog: "Enter value for [placeholder]"
  - Substitute in generated script

#### 7. Session Management Integration
- [ ] UI for session save/restore
  - "Save Session" button after successful workflow
  - "Skip Login" checkbox in replay dialog
- [ ] Session validity indicator
  - Show if saved session exists for target site
  - Display expiration time

### 🔧 Low Priority

#### 8. Recording Management
- [ ] Export/import recordings
  - Share `.spec.ts` files with team
  - Import from file or clipboard
- [ ] Recording metadata
  - Tags/categories
  - Last used date
  - Success rate tracking
- [ ] Duplicate/clone recordings
  - Create variant workflows

#### 9. Advanced Replay Features
- [ ] Variable replay speed
  - Slider: 0.5x to 2x speed
  - Useful for demonstrations
- [ ] Breakpoints
  - Pause at specific actions
  - Step-through mode
- [ ] Conditional logic
  - If/else based on page state
  - Retry failed actions

#### 10. Error Handling
- [ ] Better error recovery
  - Retry failed actions (3x max)
  - Alternative selectors fallback
  - Continue on non-critical errors
- [ ] Recording validation
  - Check if script is valid Playwright
  - Warn about missing elements

---

## Known Issues to Address

### Recorder
- ⚠️ Shadow DOM elements not capturable
- ⚠️ iframes need special handling
- ⚠️ Some dynamic content may not record properly

### Replayer
- ⚠️ Custom form handlers may not work with Enter key
- ⚠️ Only basic Playwright commands supported
- ⚠️ No support for waiting/timing adjustments

### UI
- ⚠️ No confirmation dialog before deleting recordings
- ⚠️ No visual feedback during replay execution
- ⚠️ Recordings list doesn't refresh automatically

---

## Code Cleanup

- [ ] Remove unused imports (spawn in ActionReplayer)
- [ ] Add JSDoc comments to public methods
- [ ] Write unit tests for PlaywrightGenerator
- [ ] Add error boundary to RecorderControls
- [ ] Document IPC event contracts

---

## Documentation

- [x] Update RECORDER_FEATURE.md ✅ Done today
- [x] Update TODO.md ✅ Done today
- [ ] Add README section about recorder
- [ ] Create user guide with screenshots
- [ ] Add developer documentation
  - How to add new action types
  - How to extend Playwright command support
  - Recording file format specification

---

## Future Ideas (Backlog)

### AI-Powered Features
- Use LLM to generate better selectors
- Auto-fix broken selectors when replay fails
- Generate workflow descriptions from recordings
- Suggest optimizations (combine actions, reduce waits)

### Advanced Recording
- Visual workflow editor (drag-drop actions)
- Record multiple tabs simultaneously
- Conditional recording (only record if X happens)
- Smart action grouping (collapse repetitive actions)

### Collaboration
- Cloud storage for recordings
- Share recordings via URL
- Team recording library
- Version control for recordings

### Analytics
- Track recording usage
- Success/failure rates
- Most replayed workflows
- Time saved metrics

---

**Last Updated:** 2025-11-17 01:30
**Next Review:** Tomorrow morning
**Priority Focus:** Test thoroughly, polish UX, add visual feedback
