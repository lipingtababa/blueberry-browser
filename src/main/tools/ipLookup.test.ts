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

// Full ip-api.com response shape
const FULL_IPAPI_RESPONSE = {
  query: "203.0.113.42",
  city: "San Francisco",
  regionName: "California",
  country: "United States",
  lat: 37.7749,
  lon: -122.4194,
  status: "success",
};

describe("fetchPublicIp", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Happy path — full geo fields present
  test("returns full IpLookupResult for valid response with all geo fields", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      mockOkResponse(FULL_IPAPI_RESPONSE),
    );

    const result = await fetchPublicIp();

    expect(result).toEqual({
      ip: "203.0.113.42",
      city: "San Francisco",
      region: "California",
      country: "United States",
      latitude: 37.7749,
      longitude: -122.4194,
    });
  });

  // Geo fields entirely absent — all return null
  test("returns null geo fields when API response omits them entirely", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      mockOkResponse({ query: "1.2.3.4", status: "success" }),
    );

    const result = await fetchPublicIp();

    expect(result).toEqual({
      ip: "1.2.3.4",
      city: null,
      region: null,
      country: null,
      latitude: null,
      longitude: null,
    });
  });

  // Geo fields partially present — present ones returned, missing ones null
  test("returns null for geo fields that are partially missing", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      mockOkResponse({ query: "1.2.3.4", city: "Berlin", status: "success" }),
    );

    const result = await fetchPublicIp();

    expect(result).toEqual({
      ip: "1.2.3.4",
      city: "Berlin",
      region: null,
      country: null,
      latitude: null,
      longitude: null,
    });
  });

  // Service error — ip-api.com returns 200 with { status: "fail", message: "..." }
  test("throws when API returns status: fail with a reason message", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      mockOkResponse({ status: "fail", message: "private range" }),
    );

    await expect(fetchPublicIp()).rejects.toThrow(
      "IP lookup service error: private range",
    );
  });

  // Non-OK HTTP status
  test("throws when HTTP response is not ok (503 Service Unavailable)", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("Service Unavailable", {
        status: 503,
        statusText: "Service Unavailable",
      }),
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
  test("throws when the request times out", async () => {
    vi.useFakeTimers();

    vi.spyOn(global, "fetch").mockImplementation(
      (_url: RequestInfo | URL, options?: RequestInit) => {
        return new Promise((_resolve, _reject) => {
          const signal = (options as RequestInit & { signal?: AbortSignal })
            ?.signal;
          if (!signal) {
            return;
          }
          if (signal.aborted) {
            _reject(
              new DOMException("The operation was aborted.", "AbortError"),
            );
            return;
          }
          signal.addEventListener("abort", () => {
            _reject(
              new DOMException("The operation was aborted.", "AbortError"),
            );
          });
        });
      },
    );

    try {
      const promise = fetchPublicIp();
      const assertion = expect(promise).rejects.toThrow(/timed out|aborted/i);
      await vi.advanceTimersByTimeAsync(3000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  }, 5000);

  // Bad shape — missing query field
  test("throws when response body is missing the query field", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(mockOkResponse({}));

    await expect(fetchPublicIp()).rejects.toThrow(
      "IP lookup returned unexpected response shape",
    );
  });

  // Bad shape — query is not a string
  test("throws when response body query field is not a string", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      mockOkResponse({ query: 42, status: "success" }),
    );

    await expect(fetchPublicIp()).rejects.toThrow(
      "IP lookup returned unexpected response shape",
    );
  });

  // Invalid IPv4 — garbage string
  test("throws when response ip is not a valid IPv4 address", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      mockOkResponse({ query: "not-an-ip", status: "success" }),
    );

    await expect(fetchPublicIp()).rejects.toThrow(
      "IP lookup returned an invalid IPv4 address",
    );
  });

  // Invalid IPv4 — IPv6 address
  test("throws when response ip is an IPv6 address (not IPv4)", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      mockOkResponse({ query: "2001:db8::1", status: "success" }),
    );

    await expect(fetchPublicIp()).rejects.toThrow(
      "IP lookup returned an invalid IPv4 address",
    );
  });

  // Redirect followed — fetch is called with redirect: "error" so redirects should throw
  test("throws when fetch follows a redirect (redirect: error)", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(
      new TypeError("Failed to fetch: redirect not allowed"),
    );

    await expect(fetchPublicIp()).rejects.toThrow(/redirect|fetch/i);
  });
});
