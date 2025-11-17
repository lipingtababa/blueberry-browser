# Blueberry Browser

An Electron-based browser with **workflow automation** - record, edit, and replay browser actions as Playwright scripts.

https://github.com/user-attachments/assets/bbf939e2-d87c-4c77-ab7d-828259f6d28d

---

## The Problem

Users perform repetitive browser tasks daily: filling forms, navigating workflows, testing applications. These tasks are:
- **Time-consuming** - Same clicks/typing over and over
- **Error-prone** - Manual mistakes in repetition
- **Hard to share** - Can't easily teach others your workflow
- **Not reusable** - Have to remember and redo everything

Existing solutions:
- Browser extensions: Limited access, can't automate everything
- Selenium/Playwright: Requires coding, not user-friendly
- Macro tools: Platform-specific, brittle selectors

## The Solution

**Blueberry Browser** records your actions and generates editable Playwright scripts that replay in the same browser window.

**Key Innovation:**
1. **No code required** - Just click Record, do your task, click Stop
2. **Editable scripts** - Get standard `.spec.ts` files you can modify
3. **In-browser replay** - No separate automation window
4. **Session management** - Save login state, skip repetitive auth

---

## Architecture

### High-Level Structure
```
┌─────────────────────────────────────────────┐
│           Electron Main Process              │
│  ┌──────────────┐    ┌──────────────┐       │
│  │ Window       │───▶│ TopBar       │       │
│  │ (BrowserView)│    │ (tabs/addr)  │       │
│  └──────────────┘    └──────────────┘       │
│         │                    │               │
│         ▼                    ▼               │
│  ┌──────────────┐    ┌──────────────┐       │
│  │ Tab          │    │ SideBar      │       │
│  │ (web content)│    │ (chat/list)  │       │
│  └──────────────┘    └──────────────┘       │
└─────────────────────────────────────────────┘
```

### Core Components

**Main Process** (`src/main/`):
- `index.ts` - Entry point, IPC setup
- `Window.ts` - Main window management
- `Tab.ts` - Individual tab (BrowserView) management
- `TopBar.ts` - Address bar and tab controls
- `SideBar.ts` - Chat and recordings sidebar
- `ActionRecorder.ts` - Records user actions
- `PlaywrightGenerator.ts` - Converts actions to `.spec.ts`
- `ActionReplayer.ts` - Executes Playwright scripts
- `SessionManager.ts` - Save/restore browser sessions
- `LLMClient.ts` - AI chat integration

**Renderer Process** (`src/renderer/`):
- `topbar/` - React UI for tabs, address bar, recorder controls
- `sidebar/` - React UI for chat and recordings list
- `lib/logger.ts` - Shared logging utilities

**Preload Scripts** (`src/preload/`):
- `topbar.ts` - IPC bridge for topbar renderer
- `sidebar.ts` - IPC bridge for sidebar renderer
- `tab.ts` - IPC bridge for tab content

### Data Flow: Recording

```
User Action (click/type)
    ↓
ActionRecorder injects listener script
    ↓
Capture event (selector, type, value)
    ↓
Store in memory array
    ↓
On Stop → PlaywrightGenerator
    ↓
Generate .spec.ts file
    ↓
Save to ~/Library/Application Support/blueberry-browser/recordings/
    ↓
Update sidebar recordings list
```

### Data Flow: Replay

```
User clicks Replay
    ↓
ActionReplayer reads .spec.ts file
    ↓
Parse Playwright commands (regex)
    ↓
For each command (goto/click/fill/keyboard.press):
    ↓
Execute via JS injection in current tab
    ↓
Special case: Enter key → form.submit()
    ↓
Complete or show error
```

### IPC Communication

**Main → Renderer:**
- `recording-started` - Notify recording began
- `recording-stopped` - Notify recording stopped
- `replay-complete` - Notify replay finished
- `recordings-list` - Send available recordings

**Renderer → Main:**
- `start-recording` - Begin capturing actions
- `stop-recording` - Stop and save
- `replay-recording` - Execute a recording
- `delete-recording` - Remove a recording
- `get-recordings` - Fetch recordings list

---

## Setup

### Install Dependencies
```bash
pnpm install
```

### Configure Environment
Create `.env` in project root:
```bash
# Choose one LLM provider
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...

# OR
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...

# OR
LLM_PROVIDER=google
GOOGLE_GENERATIVE_AI_API_KEY=...
```

### Development
```bash
# Standard dev mode
pnpm dev

# Dev mode with test triggers enabled
pnpm dev:test
```

### Build
```bash
# Type check + build
pnpm build

# Platform-specific builds
pnpm build:mac
pnpm build:win
pnpm build:linux
```

---

## Testing

### Available Test Commands
```bash
# Manual chat trigger
pnpm test:chat:trigger

# Automated chat test
pnpm test:chat:auto

# Chat test with verification
pnpm test:chat:verify

# Full integration test
pnpm test:chat:integration
```

### Manual Testing Workflow
1. Start browser: `pnpm dev`
2. Wait 5 seconds for full initialization
3. Click **Record** button in toolbar
4. Perform actions (navigate, click, type, press Enter)
5. Click **Stop**
6. Check sidebar for new recording
7. Click **Replay** to test

### Test Locations
- `tests/automated/` - Automated test scripts
- `tests/verify-enter-recording.js` - Enter key verification
- `test-results/` - Playwright test output

---

## Project Structure

```
blueberry-browser/
├── src/
│   ├── main/              # Electron main process
│   │   ├── index.ts       # Entry point
│   │   ├── Window.ts      # Window management
│   │   ├── Tab.ts         # Tab (BrowserView) logic
│   │   ├── ActionRecorder.ts
│   │   ├── PlaywrightGenerator.ts
│   │   ├── ActionReplayer.ts
│   │   └── SessionManager.ts
│   ├── renderer/          # React UIs
│   │   ├── topbar/        # Address bar, tabs, recorder
│   │   ├── sidebar/       # Chat, recordings list
│   │   └── lib/           # Shared utilities
│   └── preload/           # IPC bridges
│       ├── topbar.ts
│       ├── sidebar.ts
│       └── tab.ts
├── tests/                 # Test scripts
├── .env                   # Local config (not committed)
├── CLAUDE.md              # Project principles
├── progress.md            # Current status
└── README.md              # This file
```

---

## Key Features

### 1. Action Recording
- Captures clicks, typing, Enter key presses
- Generates human-readable Playwright scripts
- Stores as editable `.spec.ts` files

### 2. Action Replay
- Parses and executes Playwright commands
- Runs in current browser tab (no separate window)
- Handles form submission via Enter key

### 3. Session Management
- Save browser cookies/localStorage
- Restore sessions to skip login flows
- Per-domain session storage

### 4. AI Chat
- Sidebar chat interface
- Multi-provider support (OpenAI, Anthropic, Google)
- Context-aware responses

---

## Troubleshooting

### Recording doesn't capture actions
- Ensure recording indicator (red dot) is visible
- Shadow DOM elements may not be capturable
- Check DevTools console for errors

### Replay fails to find elements
- Website may have changed since recording
- Manually edit `.spec.ts` file to fix selectors
- Re-record if structure changed significantly

### Enter key doesn't submit form
- Custom form handlers may override default behavior
- Edit script to call specific submit function
- Add explicit `form.submit()` in generated code

### Tests fail
- Wait 5 seconds after `pnpm dev` before running tests
- Check that browser window is fully loaded
- Verify `.env` has valid API keys

---

## Documentation

- **README.md** (this file) - Architecture, setup, testing
- **CLAUDE.md** - Development principles and guidelines
- **progress.md** - Current status and next priorities

---

## Contributing

See `CLAUDE.md` for:
- Code quality guidelines
- Testing requirements
- Git commit practices
- Debugging strategies
