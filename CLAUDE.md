# Blueberry Browser Project

## Browser Startup Guidelines

- **Blueberry browser starts fast** - The browser initializes quickly; waiting for 3 seconds is sufficient for it to be ready for operations.
- **While testing** - Wait 5 seconds after browser startup before running test commands to ensure all components (UI, IPC, sidebar) are fully initialized.

## Logging Guidelines

- **Logs should be comprehensive in local dev environment** - Use verbose/detailed logging in development to make debugging easier. Include context, parameters, and intermediate states.

---

## Debugging Guidelines

### Priority Order for External API Issues

```
1. External Service (test directly first)
   - API key/credentials valid?
   - Quota/rate limits?
   - Service status?

2. Integration Layer
   - Raw API response (not SDK wrapper)
   - HTTP status codes
   - Error surfacing

3. Application Code
   - Business logic
   - Data formatting
   - State management
```

### Red Flags Requiring Immediate External Service Check

- Empty/null responses with no error thrown
- "Unknown" status/reason from APIs
- Immediate failures without proper error messages
- SDKs returning success but no data

### Remember

**Test external dependencies directly before debugging code.** Don't trust SDKs to surface all errors. The simplest explanation is usually correct.
