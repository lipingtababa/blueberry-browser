/**
 * Unit tests for LLMClient.sendChatMessage()
 *
 * Tests verify the REQUIRED behavior from story-ip-lookup.md:
 * - AC-4: Non-IP questions work without tool calls
 * - AC-5: fetchPublicIp throws → graceful error response, no crash
 * - AC-6: Conversation history preserved across messages
 * - AC-7: Multiple IP queries work correctly
 * - AC-8: No model configured → clear error message, no crash
 *
 * Uses MockLanguageModelV2 from "ai/test" (Vercel AI SDK test utilities).
 *
 * NOTE: The story references "MockLanguageModelV1" but the installed version
 * (ai@5.0.44) exports "MockLanguageModelV2". Tests use MockLanguageModelV2.
 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import { WebContents } from "electron";
import { MockLanguageModelV2 } from "ai/test";
import { LLMClient } from "./LLMClient";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a minimal WebContents mock that records IPC calls.
 */
function createMockWebContents(): WebContents & {
  _sent: Array<{ channel: string; args: unknown[] }>;
} {
  const sent: Array<{ channel: string; args: unknown[] }> = [];
  const mock = {
    send: vi.fn((channel: string, ...args: unknown[]) => {
      sent.push({ channel, args });
    }),
    _sent: sent,
  } as unknown as WebContents & { _sent: typeof sent };
  return mock;
}

/**
 * Returns a ReadableStream that emits the provided stream parts and then
 * closes. Suitable for use with MockLanguageModelV2's doStream option.
 */
function makeStream<T>(parts: T[]): ReadableStream<T> {
  return new ReadableStream<T>({
    start(controller) {
      for (const part of parts) {
        controller.enqueue(part);
      }
      controller.close();
    },
  });
}

/** Build a simple text-only doStream response for MockLanguageModelV2. */
function textOnlyDoStream(text: string) {
  return async () => ({
    stream: makeStream([
      { type: "stream-start" as const, warnings: [] },
      { type: "text-start" as const, id: "t1" },
      { type: "text-delta" as const, id: "t1", delta: text },
      { type: "text-end" as const, id: "t1" },
      {
        type: "finish" as const,
        finishReason: "stop" as const,
        usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
      },
    ]),
  });
}

/**
 * Patches a freshly constructed LLMClient to use a given mock model.
 * We access the private `model` field via casting — acceptable in tests.
 */
function injectModel(
  client: LLMClient,
  mockModel: MockLanguageModelV2 | null,
): void {
  (client as unknown as Record<string, unknown>)["model"] = mockModel;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LLMClient.sendChatMessage", () => {
  let webContents: ReturnType<typeof createMockWebContents>;

  beforeEach(() => {
    webContents = createMockWebContents();
    // Suppress console output during tests
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  // -------------------------------------------------------------------------
  // AC-8: No model configured → clear error message, no crash
  // -------------------------------------------------------------------------
  test("no model configured — sends error message without crashing", async () => {
    const client = new LLMClient(webContents);
    // Force model to null (simulates missing API key)
    injectModel(client, null);

    await client.sendChatMessage({
      message: "What is my IP?",
      messageId: "msg-001",
    });

    // Should send a "chat-response" event with a message about missing config
    const chatResponses = webContents._sent.filter(
      (e) => e.channel === "chat-response",
    );
    expect(chatResponses.length).toBeGreaterThan(0);

    const lastResponse = chatResponses[chatResponses.length - 1];
    const payload = lastResponse.args[0] as {
      content: string;
      isComplete: boolean;
    };
    expect(payload.isComplete).toBe(true);
    // Should mention configuration or API key — not a blank or raw error
    expect(payload.content.toLowerCase()).toMatch(/configured|api key|set up/i);
  });

  // -------------------------------------------------------------------------
  // AC-6: Conversation history preserved across messages
  // -------------------------------------------------------------------------
  test("history preserved — two messages result in 4 entries (user, assistant, user, assistant)", async () => {
    const client = new LLMClient(webContents);
    const mockModel = new MockLanguageModelV2({
      doStream: textOnlyDoStream("Paris"),
    });
    injectModel(client, mockModel);

    await client.sendChatMessage({
      message: "What is the capital of France?",
      messageId: "msg-001",
    });

    // Swap doStream for the second message
    (mockModel as unknown as { doStream: unknown }).doStream =
      textOnlyDoStream("Berlin");

    await client.sendChatMessage({
      message: "What is the capital of Germany?",
      messageId: "msg-002",
    });

    const messages = client.getMessages();
    // After 2 round-trips: user1, assistant1, user2, assistant2
    expect(messages.length).toBe(4);
    expect(messages[0].role).toBe("user");
    expect(messages[1].role).toBe("assistant");
    expect(messages[2].role).toBe("user");
    expect(messages[3].role).toBe("assistant");
  });

  // -------------------------------------------------------------------------
  // Regression: history MUST NOT be cleared on each sendChatMessage call
  // (Bug: `this.messages = []` on line 116 of current implementation)
  // -------------------------------------------------------------------------
  test("history is not cleared when sending a second message", async () => {
    const client = new LLMClient(webContents);
    const mockModel = new MockLanguageModelV2({
      doStream: textOnlyDoStream("Hello!"),
    });
    injectModel(client, mockModel);

    await client.sendChatMessage({
      message: "Hello",
      messageId: "msg-001",
    });

    const afterFirst = client.getMessages().length;
    expect(afterFirst).toBeGreaterThan(0); // sanity check

    // Reset doStream for second call
    (mockModel as unknown as { doStream: unknown }).doStream =
      textOnlyDoStream("World!");

    await client.sendChatMessage({
      message: "World",
      messageId: "msg-002",
    });

    const afterSecond = client.getMessages().length;
    // If history was cleared, afterSecond would be 2 (just the new pair)
    // If preserved, it should be afterFirst + 2
    expect(afterSecond).toBe(afterFirst + 2);
  });

  // -------------------------------------------------------------------------
  // AC-4: Non-IP question handled normally with no tool call
  // -------------------------------------------------------------------------
  test("non-IP question returns text response without invoking IP tool", async () => {
    const client = new LLMClient(webContents);
    const mockModel = new MockLanguageModelV2({
      doStream: textOnlyDoStream("The capital of France is Paris."),
    });
    injectModel(client, mockModel);

    await client.sendChatMessage({
      message: "What is the capital of France?",
      messageId: "msg-001",
    });

    const chatResponses = webContents._sent.filter(
      (e) => e.channel === "chat-response",
    );
    expect(chatResponses.length).toBeGreaterThan(0);

    const finalResponse = chatResponses[chatResponses.length - 1];
    const payload = finalResponse.args[0] as {
      content: string;
      isComplete: boolean;
    };
    expect(payload.isComplete).toBe(true);
    // The response text should reference Paris (tool was not invoked, no IP)
    expect(payload.content).toContain("Paris");
  });

  // -------------------------------------------------------------------------
  // AC-5: fetchPublicIp throws → graceful error, no crash, response sent
  // -------------------------------------------------------------------------
  test("tool execution error — sends a graceful error response without crashing", async () => {
    // To simulate: mock model triggers a tool call, the tool throws, and the
    // LLM responds with a user-friendly explanation.
    const client = new LLMClient(webContents);

    // First doStream: LLM requests the tool
    // Second doStream: LLM responds after receiving tool error
    const firstCallStream = makeStream([
      { type: "stream-start" as const, warnings: [] },
      {
        type: "tool-input-start" as const,
        id: "call-1",
        toolName: "getMyIpAddress",
      },
      { type: "tool-input-end" as const, id: "call-1" },
      {
        type: "finish" as const,
        finishReason: "tool-calls" as const,
        usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
      },
    ]);

    const secondCallStream = makeStream([
      { type: "stream-start" as const, warnings: [] },
      { type: "text-start" as const, id: "t1" },
      {
        type: "text-delta" as const,
        id: "t1",
        delta:
          "I'm sorry, I couldn't retrieve your IP address due to a network error.",
      },
      { type: "text-end" as const, id: "t1" },
      {
        type: "finish" as const,
        finishReason: "stop" as const,
        usage: { inputTokens: 20, outputTokens: 20, totalTokens: 40 },
      },
    ]);

    let callCount = 0;
    const mockModel = new MockLanguageModelV2({
      doStream: async () => {
        callCount++;
        return callCount === 1
          ? { stream: firstCallStream }
          : { stream: secondCallStream };
      },
    });
    injectModel(client, mockModel);

    // Mock the ipLookup module to throw
    vi.doMock("./tools/ipLookup", () => ({
      fetchPublicIp: vi.fn().mockRejectedValue(new Error("Network failure")),
    }));

    // The call must not throw — it should handle the error gracefully
    await expect(
      client.sendChatMessage({
        message: "What is my IP?",
        messageId: "msg-001",
      }),
    ).resolves.toBeUndefined();

    // A chat-response must have been sent (no blank, no crash)
    const chatResponses = webContents._sent.filter(
      (e) => e.channel === "chat-response",
    );
    expect(chatResponses.length).toBeGreaterThan(0);

    const finalResponse = chatResponses[chatResponses.length - 1];
    const payload = finalResponse.args[0] as {
      content: string;
      isComplete: boolean;
    };
    expect(payload.isComplete).toBe(true);
    expect(payload.content).toBeTruthy();
    // Must not be a raw stack trace
    expect(payload.content).not.toMatch(/Error:|at \w+\s+\(/);

    vi.doUnmock("./tools/ipLookup");
  });

  // -------------------------------------------------------------------------
  // AC-7: Multiple IP queries in one session work without errors
  // -------------------------------------------------------------------------
  test("two consecutive sendChatMessage calls both complete without error", async () => {
    const client = new LLMClient(webContents);
    const mockModel = new MockLanguageModelV2({
      doStream: textOnlyDoStream("Your public IP is 1.2.3.4."),
    });
    injectModel(client, mockModel);

    await expect(
      client.sendChatMessage({
        message: "What is my IP?",
        messageId: "msg-001",
      }),
    ).resolves.toBeUndefined();

    (mockModel as unknown as { doStream: unknown }).doStream = textOnlyDoStream(
      "Your public IP is still 1.2.3.4.",
    );

    await expect(
      client.sendChatMessage({
        message: "What is my IP again?",
        messageId: "msg-002",
      }),
    ).resolves.toBeUndefined();

    // Both messages should produce chat-response events
    const chatResponses = webContents._sent.filter(
      (e) =>
        e.channel === "chat-response" &&
        (e.args[0] as { isComplete: boolean }).isComplete,
    );
    expect(chatResponses.length).toBeGreaterThanOrEqual(2);
  });

  // -------------------------------------------------------------------------
  // Regression: getCompletion() still works (ContentFormatter dependency)
  // -------------------------------------------------------------------------
  test("getCompletion returns text from the model for one-off prompts", async () => {
    const client = new LLMClient(webContents);
    const mockModel = new MockLanguageModelV2({
      doStream: textOnlyDoStream("Formatted title"),
    });
    injectModel(client, mockModel);

    const result = await client.getCompletion("Format this title: hello world");

    expect(result).toBe("Formatted title");
  });
});
