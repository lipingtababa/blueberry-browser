import { describe, test, expect, beforeEach } from "vitest";

// The server module exports the handler logic for testing without starting
// a real HTTP server. We import the pure functions and the request/response
// helpers separately from the HTTP server bootstrap.
//
// Expected exports from server/index.js:
//   - categorizeError(event) — pure function, returns { category, label, fixable, fixReason }
//   - createApp()            — returns a { handleRequest, resetBuckets, getBuckets } object
//                             (or similar test-friendly API)
//
// The HTTP layer (listen) is NOT tested here — only the business logic.

import { categorizeError, createApp } from "./index.js";

// ---------------------------------------------------------------------------
// categorizeError — pure function tests
// ---------------------------------------------------------------------------

describe("categorizeError", () => {
  // Tool errors — getMyIpAddress

  test("getMyIpAddress timed out → tool.ip-lookup.timeout, fixable", () => {
    const result = categorizeError({
      toolName: "getMyIpAddress",
      message: "IP lookup timed out",
    });
    expect(result.category).toBe("tool.ip-lookup.timeout");
    expect(result.fixable).toBe(true);
  });

  test("getMyIpAddress HTTP 503 → tool.ip-lookup.http-error, fixable", () => {
    const result = categorizeError({
      toolName: "getMyIpAddress",
      message: "IP lookup failed: 503 Service Unavailable",
    });
    expect(result.category).toBe("tool.ip-lookup.http-error");
    expect(result.fixable).toBe(true);
  });

  test("getMyIpAddress unexpected response shape → tool.ip-lookup.invalid-shape, fixable", () => {
    const result = categorizeError({
      toolName: "getMyIpAddress",
      message: "IP lookup returned unexpected response shape",
    });
    expect(result.category).toBe("tool.ip-lookup.invalid-shape");
    expect(result.fixable).toBe(true);
  });

  test("getMyIpAddress invalid IPv4 → tool.ip-lookup.invalid-ip, fixable", () => {
    const result = categorizeError({
      toolName: "getMyIpAddress",
      message: "IP lookup returned an invalid IPv4 address",
    });
    expect(result.category).toBe("tool.ip-lookup.invalid-ip");
    expect(result.fixable).toBe(true);
  });

  // Non-fixable LLM stream errors

  test("401 unauthorized → fixable: false", () => {
    const result = categorizeError({
      toolName: null,
      message: "401 unauthorized",
    });
    expect(result.fixable).toBe(false);
  });

  test("429 rate limit → fixable: false", () => {
    const result = categorizeError({
      toolName: null,
      message: "429 rate limit exceeded",
    });
    expect(result.fixable).toBe(false);
  });

  test("network error econnrefused → fixable: false", () => {
    const result = categorizeError({
      toolName: null,
      message: "network error: econnrefused",
    });
    expect(result.fixable).toBe(false);
  });

  // Fixable LLM stream errors

  test("Request timed out (no toolName) → llm.stream.timeout, fixable", () => {
    const result = categorizeError({
      toolName: null,
      message: "Request timed out",
    });
    expect(result.category).toBe("llm.stream.timeout");
    expect(result.fixable).toBe(true);
  });

  test("unknown message (no toolName) → llm.stream.unknown, fixable", () => {
    const result = categorizeError({
      toolName: null,
      message: "something weird happened",
    });
    expect(result.category).toBe("llm.stream.unknown");
    expect(result.fixable).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// HTTP API — using createApp() test helper
// ---------------------------------------------------------------------------

describe("log server app", () => {
  let app;

  const validPayload = {
    toolName: "getMyIpAddress",
    errorType: "Error",
    message: "IP lookup timed out",
    signature: "IP lookup timed out",
    stack: null,
    appVersion: "1.0.0",
    platform: "darwin",
    timestamp: "2026-03-11T10:00:00.000Z",
  };

  beforeEach(() => {
    app = createApp();
  });

  // POST /errors returns 204
  test("POST /errors with valid payload returns 204", async () => {
    const status = await app.postError(validPayload);
    expect(status).toBe(204);
  });

  // POST /errors increments count for same category + signature
  test("POST /errors increments bucket count for same category+signature", async () => {
    await app.postError(validPayload);
    await app.postError(validPayload);
    await app.postError(validPayload);

    const buckets = app.getBuckets();
    // All three events share the same category (tool.ip-lookup.timeout) and signature
    const bucket = buckets.find((b) => b.category === "tool.ip-lookup.timeout");
    expect(bucket).toBeDefined();
    expect(bucket.count).toBe(3);
  });

  // POST /errors with different signatures creates separate buckets
  test("POST /errors with different signatures creates separate buckets", async () => {
    const payloadA = {
      ...validPayload,
      message: "IP lookup timed out",
      signature: "IP lookup timed out",
    };
    const payloadB = {
      ...validPayload,
      message: "IP lookup returned unexpected response shape",
      signature: "IP lookup returned unexpected response shape",
    };

    await app.postError(payloadA);
    await app.postError(payloadB);

    const buckets = app.getBuckets();
    const timeoutBucket = buckets.find(
      (b) => b.category === "tool.ip-lookup.timeout",
    );
    const shapeBucket = buckets.find(
      (b) => b.category === "tool.ip-lookup.invalid-shape",
    );

    expect(timeoutBucket).toBeDefined();
    expect(shapeBucket).toBeDefined();
    expect(timeoutBucket.count).toBe(1);
    expect(shapeBucket.count).toBe(1);
    expect(buckets.length).toBe(2);
  });

  // GET /errors returns array of all buckets
  test("GET /errors returns array of all buckets", async () => {
    await app.postError(validPayload);

    const buckets = app.getBuckets();
    expect(Array.isArray(buckets)).toBe(true);
    expect(buckets.length).toBe(1);

    const bucket = buckets[0];
    expect(bucket).toMatchObject({
      category: expect.any(String),
      signature: expect.any(String),
      label: expect.any(String),
      fixable: expect.any(Boolean),
      count: 1,
      firstSeen: expect.any(String),
      lastSeen: expect.any(String),
      samples: expect.any(Array),
    });
  });

  // GET /errors returns empty array when no errors posted
  test("GET /errors returns empty array when no errors have been posted", () => {
    const buckets = app.getBuckets();
    expect(Array.isArray(buckets)).toBe(true);
    expect(buckets.length).toBe(0);
  });

  // DELETE /errors resets all buckets to empty
  test("DELETE /errors resets all buckets to empty", async () => {
    await app.postError(validPayload);
    expect(app.getBuckets().length).toBe(1);

    app.resetBuckets();

    expect(app.getBuckets().length).toBe(0);
  });

  // samples cap at 5
  test("samples array is capped at 5 entries even after more injections", async () => {
    for (let i = 0; i < 8; i++) {
      await app.postError({
        ...validPayload,
        timestamp: `2026-03-11T10:0${i}:00.000Z`,
      });
    }

    const buckets = app.getBuckets();
    const bucket = buckets.find((b) => b.category === "tool.ip-lookup.timeout");
    expect(bucket.count).toBe(8);
    expect(bucket.samples.length).toBeLessThanOrEqual(5);
  });

  // firstSeen and lastSeen timestamps
  test("firstSeen is set on first event and lastSeen updates on subsequent events", async () => {
    const first = { ...validPayload, timestamp: "2026-03-11T10:00:00.000Z" };
    const second = { ...validPayload, timestamp: "2026-03-11T11:00:00.000Z" };

    await app.postError(first);
    await app.postError(second);

    const bucket = app
      .getBuckets()
      .find((b) => b.category === "tool.ip-lookup.timeout");
    expect(bucket.firstSeen).toBe("2026-03-11T10:00:00.000Z");
    expect(bucket.lastSeen).toBe("2026-03-11T11:00:00.000Z");
  });
});
