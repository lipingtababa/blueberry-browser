import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { reportError } from "./errorReporter";
import type { ErrorReporterConfig } from "./errorReporter";

const BASE_CONFIG: ErrorReporterConfig = {
  endpoint: "http://localhost:4242/errors",
  timeoutMs: 1500,
  enabled: true,
};

describe("reportError", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // POSTs to the configured endpoint with correct ErrorEvent shape
  test("POSTs to the configured endpoint with correct ErrorEvent shape", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    const error = new Error("something went wrong");
    await reportError(error, { toolName: "getMyIpAddress" }, BASE_CONFIG);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("http://localhost:4242/errors");
    expect(init?.method).toBe("POST");

    const body = JSON.parse(init?.body as string);
    expect(body).toMatchObject({
      toolName: "getMyIpAddress",
      errorType: "Error",
      message: "something went wrong",
      platform: expect.any(String),
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
    expect(typeof body.signature).toBe("string");
  });

  // Includes toolName from context
  test("includes toolName from context in the posted payload", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    await reportError(
      new Error("test error"),
      { toolName: "getMyIpAddress" },
      BASE_CONFIG,
    );

    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(body.toolName).toBe("getMyIpAddress");
  });

  test("sets toolName to null when context has no toolName", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    await reportError(new Error("stream error"), {}, BASE_CONFIG);

    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(body.toolName).toBeNull();
  });

  // Signature normalization — HTTP status codes
  test("computes signature by replacing HTTP status codes with {status}", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    await reportError(
      new Error("IP lookup failed: 503 Service Unavailable"),
      {},
      BASE_CONFIG,
    );

    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(body.signature).toContain("{status}");
    expect(body.signature).not.toMatch(/\b503\b/);
  });

  test("503 and 429 errors share the same signature", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    await reportError(
      new Error("IP lookup failed: 503 Service Unavailable"),
      {},
      BASE_CONFIG,
    );
    const body503 = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);

    await reportError(new Error("IP lookup failed: 429"), {}, BASE_CONFIG);
    const body429 = JSON.parse(fetchSpy.mock.calls[1][1]?.body as string);

    expect(body503.signature).toBe(body429.signature);
  });

  // Signature normalization — UUIDs
  test("computes signature by replacing UUIDs with {uuid}", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    await reportError(
      new Error("request 550e8400-e29b-41d4-a716-446655440000 failed"),
      {},
      BASE_CONFIG,
    );

    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(body.signature).toContain("{uuid}");
    expect(body.signature).not.toContain(
      "550e8400-e29b-41d4-a716-446655440000",
    );
  });

  // Signature normalization — plain numbers
  test("computes signature by replacing plain numbers with {n}", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    // Use a message that has a plain number (not an HTTP status code)
    await reportError(new Error("retried 3 times"), {}, BASE_CONFIG);

    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(body.signature).toContain("{n}");
    expect(body.signature).not.toMatch(/\b3\b/);
  });

  // Stack trace sanitization
  test("sanitizes stack traces by replacing home directory with ~", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    const error = new Error("oops");
    // Inject a fake stack with an absolute home-dir path
    const homeDir = process.env.HOME ?? "/Users/testuser";
    error.stack = `Error: oops\n    at Object.<anonymous> (${homeDir}/projects/blueberry/src/main/tools/ipLookup.ts:45:11)`;

    await reportError(error, {}, BASE_CONFIG);

    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(body.stack).not.toContain(homeDir);
    expect(body.stack).toContain(
      "~/projects/blueberry/src/main/tools/ipLookup.ts:45:11",
    );
  });

  // Never throws when endpoint is unreachable
  test("never throws when endpoint is unreachable (network error)", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));

    // Should not throw
    await expect(
      reportError(new Error("test"), {}, BASE_CONFIG),
    ).resolves.toBeUndefined();
  });

  // Never throws when endpoint returns 500
  test("never throws when endpoint returns 500", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("Internal Server Error", { status: 500 }),
    );

    await expect(
      reportError(new Error("test"), {}, BASE_CONFIG),
    ).resolves.toBeUndefined();
  });

  // Does nothing when enabled: false
  test("does not POST when enabled is false", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    await reportError(
      new Error("test"),
      {},
      { ...BASE_CONFIG, enabled: false },
    );

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // Respects timeoutMs — does not hang if server is slow
  test("does not hang when server is slow — aborts after timeoutMs", async () => {
    vi.useFakeTimers();

    vi.spyOn(global, "fetch").mockImplementation(
      (_url: RequestInfo | URL, options?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          const signal = (options as RequestInit & { signal?: AbortSignal })
            ?.signal;
          if (!signal) {
            // No signal means implementation can't abort — hang forever
            return;
          }
          if (signal.aborted) {
            reject(
              new DOMException("The operation was aborted.", "AbortError"),
            );
            return;
          }
          signal.addEventListener("abort", () => {
            reject(
              new DOMException("The operation was aborted.", "AbortError"),
            );
          });
          // Hangs until signal fires
        });
      },
    );

    try {
      const config: ErrorReporterConfig = { ...BASE_CONFIG, timeoutMs: 1500 };
      const promise = reportError(new Error("slow server"), {}, config);
      // reportError must resolve (not reject) even after timeout — never throws
      const assertionPromise = expect(promise).resolves.toBeUndefined();
      // Advance past the configured timeout
      await vi.advanceTimersByTimeAsync(2000);
      await assertionPromise;
    } finally {
      vi.useRealTimers();
    }
  }, 5000);

  // Handles non-Error unknown values gracefully
  test("handles non-Error thrown values (strings, objects) without throwing", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );

    await expect(
      reportError("raw string error", {}, BASE_CONFIG),
    ).resolves.toBeUndefined();

    await expect(
      reportError({ code: "UNKNOWN" }, {}, BASE_CONFIG),
    ).resolves.toBeUndefined();
  });
});
