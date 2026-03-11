// Logger utility for renderer processes
// Sends logs to main process which writes to file

const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// Send logs to main process via IPC
const sendLogToMain = (level: string, ...args: unknown[]): void => {
  try {
    // Format the message
    const message = args
      .map((arg) =>
        typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg),
      )
      .join(" ");

    // Log to console as normal
    if (level === "error") {
      originalConsoleError(`[RENDERER]`, ...args);
    } else if (level === "warn") {
      originalConsoleWarn(`[RENDERER]`, ...args);
    } else {
      originalConsoleLog(`[RENDERER]`, ...args);
    }

    // Also send to main process for file logging
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.send("renderer-log", { level, message });
    }
  } catch (err) {
    originalConsoleError("Logger error:", err);
  }
};

export const setupRendererLogging = (): void => {
  console.log = (...args: unknown[]): void => sendLogToMain("log", ...args);
  console.error = (...args: unknown[]): void => sendLogToMain("error", ...args);
  console.warn = (...args: unknown[]): void => sendLogToMain("warn", ...args);

  console.log("📝 Renderer logging initialized");
};
