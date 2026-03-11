import os from "os";

export interface ErrorEvent {
  toolName: string | null;
  errorType: string;
  message: string;
  signature: string;
  stack: string | null;
  appVersion: string;
  platform: string;
  timestamp: string;
}

export interface ErrorReporterConfig {
  endpoint: string;
  timeoutMs: number;
  enabled: boolean;
}

function normalizeSignature(message: string): string {
  // Apply replacements in order to avoid double-replacement:
  // 1. UUIDs first
  let sig = message.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    "{uuid}",
  );
  // 2. HTTP status codes (3-digit numbers at word boundary, 1xx–5xx)
  //    Optionally consume trailing HTTP reason phrase (e.g. "503 Service Unavailable")
  sig = sig.replace(
    /\b[1-5]\d{2}(?:\s+[A-Za-z][A-Za-z ]*[A-Za-z])?\b/g,
    "{status}",
  );
  // 3. Remaining standalone numbers
  sig = sig.replace(/\b\d+\b/g, "{n}");
  // 4. Quoted strings
  sig = sig.replace(/"[^"]*"/g, "{str}");
  return sig;
}

function sanitizeStack(stack: string): string {
  const home = process.env.HOME ?? os.homedir();
  // Replace home directory prefix with ~
  return stack.split(home).join("~");
}

function buildErrorEvent(
  error: unknown,
  context: { toolName?: string },
): ErrorEvent {
  const isError = error instanceof Error;
  const message = isError ? error.message : String(error);
  const rawStack = isError && error.stack ? error.stack : null;

  return {
    toolName: context.toolName ?? null,
    errorType: isError ? error.constructor.name : typeof error,
    message,
    signature: normalizeSignature(message),
    stack: rawStack ? sanitizeStack(rawStack) : null,
    appVersion: process.env.npm_package_version ?? "unknown",
    platform: process.platform,
    timestamp: new Date().toISOString(),
  };
}

export async function reportError(
  error: unknown,
  context: { toolName?: string },
  config: ErrorReporterConfig,
): Promise<void> {
  if (!config.enabled) {
    return;
  }

  try {
    const event = buildErrorEvent(error, context);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      await fetch(config.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch {
    // Never throw — fire-and-forget, swallow all errors
  }
}
