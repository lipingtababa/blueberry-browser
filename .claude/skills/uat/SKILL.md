---
name: uat
description: Run user acceptance tests — manual verification, Electron app testing, interactive flows
tools: Read, Bash, Glob, Grep
model: inherit
---

# UAT Skill - User Acceptance Testing

*Part of **MaChi & Associates** — delivery team, acceptance testing. You are the user's last advocate before release. If it doesn't work for them, nothing else matters.*

Run end-to-end user acceptance tests by launching the application, interacting with it, and verifying behavior matches acceptance criteria.

**Invocation: `/uat` (slash command) — NOT a subagent type.** Do not call via `Agent(subagent_type="uat")` — that will fail. Invoke as a skill: `/uat` or ask the main agent to run `/uat`.

## When to Use

- Testing features that require visual verification or user interaction
- Testing Electron app flows (IPC, multi-window, sidebar chat)
- Testing workflows that span multiple steps
- Validating end-to-end behavior after integration
- When automated tests can't cover the full flow (e.g., streaming UI, QR codes)

## Key Principle

**Launch the app and test it.** Some features can only be verified by running the application and interacting with it. Use the dev server, not just unit tests.

## Quick Start

```bash
cd <project-root>

# Start the application
pnpm run dev          # Electron apps (electron-vite)
npm run dev           # Node/web apps
make dev              # Go/Python apps with Makefile

# Run automated E2E tests (if available)
npx playwright test                    # Playwright
pnpm run test:chat:integration         # Project-specific test scripts
```

## UAT Workflow

### Phase 0: Ensure Latest Code is Running (ALWAYS do this first)

**Use the standard start script** — it kills stale processes, syncs dependencies, starts fresh, and waits for initialization:

```bash
~/.claude/scripts/start-app.sh [project-root]
```

The script:
1. Detects project type (Electron, Node, Go, Make)
2. Kills any stale running instance
3. Syncs dependencies (`pnpm install --frozen-lockfile`, `go mod download`, etc.)
4. Starts the app in the background
5. Waits for initialization (Electron: 6s, others: 3s)
6. Verifies the process is still alive — exits non-zero if startup failed
7. Prints the PID on success

**Do not proceed to tests until the script exits 0.**

For Electron: dev mode runs from source via electron-vite, not from `out/`. No build step needed — the script handles this correctly.

### Step 1: Prepare Test Plan from Architecture/Story

Map each acceptance criterion to a manual test:

| # | AC | Test Steps | Expected Result |
|---|-----|------------|-----------------|
| 1 | Feature works | Start app → perform action | Correct output |
| 2 | Error handling | Trigger error condition | Graceful message |
| 3 | No regression | Test existing features | Still work |

### Step 2: Start Application

```bash
# Ensure dependencies installed
pnpm install  # or npm install

# Start dev server
pnpm run dev

# Wait for initialization (Electron: ~5 seconds)
```

### Step 3: Execute Tests

For each test case:
1. Perform the user actions described in test steps
2. Observe the result
3. Record pass/fail

### Step 4: Report Results

```markdown
## UAT Results

| # | Test | Result | Notes |
|---|------|--------|-------|
| 1 | Tool invocation | PASS | Response contains valid IP |
| 2 | Error handling | PASS | Shows "couldn't look up" message |
| 3 | Non-tool question | PASS | No regression |

**Overall**: PASS (3/3)
```

## Electron App Testing

### IPC Flow Verification
```
1. Open DevTools in renderer (Cmd+Option+I)
2. Check Console for IPC errors
3. Verify main process logs (terminal where dev server runs)
4. Test both directions: renderer → main, main → renderer
```

### Multi-Window Testing
- Test sidebar and main window independently
- Verify state sync between windows
- Check window lifecycle (open/close/reopen)

### Streaming Response Testing
- Watch for progressive text rendering (not all-at-once)
- Verify loading states during streaming
- Check completion signal arrives

## Automated + Manual Hybrid

```
1. Run automated tests first (catch regressions fast)
   npx playwright test
   pnpm run test:chat:integration

2. Manual verification for:
   - Visual/UX aspects automation can't cover
   - Streaming behavior
   - Complex multi-step workflows
   - New features not yet automated

3. Document results in UAT report
```

## Test Types by Platform

| Platform | Start Command | Test Approach |
|----------|---------------|---------------|
| Electron | `pnpm run dev` | DevTools + manual interaction |
| Web app | `npm run dev` | Browser + DevTools |
| API | `make dev` / `npm start` | curl/httpie + Postman |

## Troubleshooting

### App Not Starting
```bash
# Check for port conflicts
lsof -i :5173    # Vite default
lsof -i :3000    # Common dev port

# Check logs in terminal
# For Electron: main process logs appear in terminal, renderer logs in DevTools
```

### IPC Not Working (Electron)
1. Check preload script loaded (`window.sidebarAPI` exists in DevTools console)
2. Check EventManager registered the handler
3. Check main process logs for errors
4. Verify contextBridge exposes the API

### Streaming Not Working
1. Check network tab in DevTools for API calls
2. Verify API keys in `.env`
3. Check main process console for SDK errors
4. Test API directly: `curl` the LLM provider endpoint

## Safety Rules

**NEVER:**
- Run UAT against production without explicit authorization
- Store credentials in test pages or scripts
- Skip UAT for user-facing changes
- Ignore failing tests ("it works on my machine")

**ALWAYS:**
- Kill any running app instance before starting (Phase 0) — stale processes run old code
- Wait for full initialization before executing tests (Electron: ~5 seconds)
- Document test results (pass/fail with notes)
- Test both happy path and error cases
- Verify no regressions in existing features
- Test on the target platform (Electron, not just browser)
- Clean up test state after UAT
