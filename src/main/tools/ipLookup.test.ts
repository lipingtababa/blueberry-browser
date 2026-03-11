import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchPublicIp } from "./ipLookup";

// Helper to create a successful mock Response
function mockOkResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    statusText: "OK",
    headers: { "Content-Type": "application/json" },
  });
}

describe("fetchPublicIp", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Happy path
  test("returns { ip } for a valid IPv4 response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      mockOkResponse({ ip: "1.2.3.4" })
    );

    const result = await fetchPublicIp();

    expect(result).toEqual({ ip: "1.2.3.4" });
  });

  // Non-OK HTTP status
  test("throws when HTTP response is not ok (503 Service Unavailable)", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("Service Unavailable", {
        status: 503,
        statusText: "Service Unavailable",
      })
    );

    await expect(fetchPublicIp()).rejects.toThrow("IP lookup failed: 503");
  });

  // Network error (fetch rejects)
  test("throws when fetch rejects with a network error", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network error"));

    await expect(fetchPublicIp()).rejects.toThrow("network error");
  });

  // Timeout — verifies that the implementation passes an AbortSignal to fetch
  // and that the signal fires after 2500ms, rejecting with a timeout error.
  //
  // Strategy: use fake timers. Mock fetch to hang until its abort signal fires.
  // Advance fake timers by 3000ms. The implementation's AbortController must
  // have fired by then, causing fetch to reject with an AbortError. The
  // implementation must then throw an error matching /timed out|aborted/i.
  test("throws when the request times out", async () => {
    vi.useFakeTimers();

    vi.spyOn(global, "fetch").mockImplementation(
      (_url: RequestInfo | URL, options?: RequestInit) => {
        return new Promise((_resolve, _reject) => {
          const signal = (options as RequestInit & { signal?: AbortSignal })?.signal;
          if (!signal) {
            // If no signal is passed, the implementation won't be able to time out.
            // This is itself a test failure condition — but we can't fail here.
            // Just hang forever (the outer test timeout will catch it).
            return;
          }
          if (signal.aborted) {
            _reject(new DOMException("The operation was aborted.", "AbortError"));
            return;
          }
          signal.addEventListener("abort", () => {
            _reject(new DOMException("The operation was aborted.", "AbortError"));
          });
          // Hangs until signal fires
        });
      }
    );

    try {
      const promise = fetchPublicIp();
      // Attach rejection handler immediately before advancing timers,
      // so the rejection is handled before it can become unhandled.
      const assertion = expect(promise).rejects.toThrow(/timed out|aborted/i);
      // Advance past the implementation's timeout (expected: 2500ms)
      await vi.advanceTimersByTimeAsync(3000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  }, 5000); // 5s wall-clock limit; fake timers advance instantly once implementation uses AbortController

  // Bad shape — missing ip field
  test("throws when response body is missing the ip field", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(mockOkResponse({}));

    await expect(fetchPublicIp()).rejects.toThrow(
      "IP lookup returned unexpected response shape"
    );
  });

  // Bad shape — ip is not a string
  test("throws when response body ip field is not a string", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(mockOkResponse({ ip: 42 }));

    await expect(fetchPublicIp()).rejects.toThrow(
      "IP lookup returned unexpected response shape"
    );
  });

  // Invalid IPv4 — garbage string
  test("throws when response ip is not a valid IPv4 address", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      mockOkResponse({ ip: "not-an-ip" })
    );

    await expect(fetchPublicIp()).rejects.toThrow(
      "IP lookup returned an invalid IPv4 address"
    );
  });

  // Invalid IPv4 — IPv6 address
  test("throws when response ip is an IPv6 address (not IPv4)", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      mockOkResponse({ ip: "2001:db8::1" })
    );

    await expect(fetchPublicIp()).rejects.toThrow(
      "IP lookup returned an invalid IPv4 address"
    );
  });

  // Redirect followed — fetch is called with redirect: "error" so redirects should throw
  test("throws when fetch follows a redirect (redirect: error)", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(
      new TypeError("Failed to fetch: redirect not allowed")
    );

    await expect(fetchPublicIp()).rejects.toThrow(/redirect|fetch/i);
  });
});
