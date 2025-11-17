import { WebContents } from "electron";
import { streamText, type LanguageModel, type CoreMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import * as dotenv from "dotenv";
import { join } from "path";

// Load environment variables from .env file
dotenv.config({ path: join(__dirname, "../../.env") });

interface ChatRequest {
  message: string;
  messageId: string;
}

interface StreamChunk {
  content: string;
  isComplete: boolean;
}

type LLMProvider = "openai" | "anthropic" | "google";

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  openai: "gpt-4o", // Try standard gpt-4o
  anthropic: "claude-3-5-sonnet-20241022",
  google: "gemini-2.5-flash",
};

const DEFAULT_TEMPERATURE = 0.7;

export class LLMClient {
  private readonly webContents: WebContents;
  private readonly provider: LLMProvider;
  private readonly modelName: string;
  private readonly model: LanguageModel | null;
  private messages: CoreMessage[] = [];

  constructor(webContents: WebContents) {
    this.webContents = webContents;
    this.provider = this.getProvider();
    this.modelName = this.getModelName();
    this.model = this.initializeModel();

    this.logInitializationStatus();
  }

  private getProvider(): LLMProvider {
    const provider = process.env.LLM_PROVIDER?.toLowerCase();
    if (provider === "anthropic") return "anthropic";
    if (provider === "google") return "google";
    return "openai"; // Default to OpenAI
  }

  private getModelName(): string {
    return process.env.LLM_MODEL || DEFAULT_MODELS[this.provider];
  }

  private initializeModel(): LanguageModel | null {
    const apiKey = this.getApiKey();
    if (!apiKey) return null;

    switch (this.provider) {
      case "anthropic":
        return anthropic(this.modelName);
      case "openai":
        return openai(this.modelName);
      case "google":
        return google(this.modelName);
      default:
        return null;
    }
  }

  private getApiKey(): string | undefined {
    switch (this.provider) {
      case "anthropic":
        return process.env.ANTHROPIC_API_KEY;
      case "openai":
        return process.env.OPENAI_API_KEY;
      case "google":
        return process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      default:
        return undefined;
    }
  }

  private logInitializationStatus(): void {
    if (this.model) {
      console.log(
        `✅ LLM Client initialized with ${this.provider} provider using model: ${this.modelName}`
      );
    } else {
      const keyName =
        this.provider === "anthropic" ? "ANTHROPIC_API_KEY" :
        this.provider === "google" ? "GOOGLE_GENERATIVE_AI_API_KEY" : "OPENAI_API_KEY";
      console.error(
        `❌ LLM Client initialization failed: ${keyName} not found in environment variables.\n` +
          `Please add your API key to the .env file in the project root.`
      );
    }
  }

  async sendChatMessage(request: ChatRequest): Promise<void> {
    console.log("🔵 [DEBUG] sendChatMessage called with:", {
      messageId: request.messageId,
      messageLength: request.message.length,
      provider: this.provider,
      model: this.modelName,
      hasModel: !!this.model
    });

    try {
      // Clear messages for testing to ensure we start fresh
      console.log("🔵 [DEBUG] TEST: Clearing message history before request");
      this.messages = [];

      // TEST A: Screenshot disabled for testing
      console.log("🔵 [DEBUG] TEST A: Screenshot disabled for testing");

      // TEST B: Use simple string content like getCompletion() which works
      console.log("🔵 [DEBUG] TEST B: Using simple string content (no array, no image)");

      // Create user message in CoreMessage format - SIMPLE TEXT ONLY
      const userMessage: CoreMessage = {
        role: "user",
        content: request.message, // Simple string, not array
      };

      this.messages.push(userMessage);

      // Send updated messages to renderer
      this.sendMessagesToRenderer();

      if (!this.model) {
        console.log("🔴 [DEBUG] Model is not initialized!");
        this.sendErrorMessage(
          request.messageId,
          "LLM service is not configured. Please add your API key to the .env file."
        );
        return;
      }

      // TEST D: Try using getCompletion() instead to see if THAT works
      console.log("🔵 [DEBUG] TEST D: Using getCompletion() instead of streamResponse");
      try {
        const completion = await this.getCompletion(request.message);
        console.log("🔵 [DEBUG] getCompletion() returned:", completion.substring(0, 100));

        // Add assistant message to history
        this.messages.push({
          role: "assistant",
          content: completion,
        });
        this.sendMessagesToRenderer();

        // Send to renderer
        this.sendStreamChunk(request.messageId, {
          content: completion,
          isComplete: true,
        });
      } catch (error) {
        console.error("🔴 [DEBUG] getCompletion() failed:", error);
        throw error;
      }
      console.log("🟢 [DEBUG] Stream response completed successfully");
    } catch (error) {
      console.error("Error in LLM request:", error);
      this.handleStreamError(error, request.messageId);
    }
  }

  /**
   * Get a completion without streaming or message history
   * Useful for one-off requests like content formatting
   */
  async getCompletion(prompt: string): Promise<string> {
    if (!this.model) {
      throw new Error("LLM service is not configured. Please add your API key to the .env file.");
    }

    try {
      console.log("🔵 [DEBUG getCompletion] Calling streamText with model:", this.modelName);
      const result = await streamText({
        model: this.model,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: DEFAULT_TEMPERATURE,
        maxRetries: 3,
      });

      console.log("🔵 [DEBUG getCompletion] streamText returned");

      // Try to get response metadata
      try {
        const response = await result.response;
        console.log("🔵 [DEBUG getCompletion] Response metadata:", {
          id: response.id,
          model: response.modelId,
          timestamp: response.timestamp
        });
      } catch (e) {
        console.error("🔴 [DEBUG getCompletion] Error getting response metadata:", e);
      }

      let fullText = "";
      let chunkCount = 0;
      for await (const chunk of result.textStream) {
        chunkCount++;
        fullText += chunk;
        console.log("🔵 [DEBUG getCompletion] Chunk", chunkCount, "length:", chunk.length);
      }

      console.log("🔵 [DEBUG getCompletion] Total chunks:", chunkCount, "Total length:", fullText.length);
      return fullText;
    } catch (error) {
      console.error("🔴 [DEBUG getCompletion] Error:", error);
      console.error("🔴 [DEBUG getCompletion] Error stack:", error instanceof Error ? error.stack : 'No stack');
      throw new Error(this.getErrorMessage(error));
    }
  }

  clearMessages(): void {
    this.messages = [];
    this.sendMessagesToRenderer();
  }

  getMessages(): CoreMessage[] {
    return this.messages;
  }

  private sendMessagesToRenderer(): void {
    console.log("📤 [LLM] Sending chat-messages-updated event with", this.messages.length, "messages");
    this.webContents.send("chat-messages-updated", this.messages);
  }


  private handleStreamError(error: unknown, messageId: string): void {
    console.error("Error streaming from LLM:", error);

    const errorMessage = this.getErrorMessage(error);
    this.sendErrorMessage(messageId, errorMessage);
  }

  private getErrorMessage(error: unknown): string {
    if (!(error instanceof Error)) {
      return "An unexpected error occurred. Please try again.";
    }

    const message = error.message.toLowerCase();

    if (message.includes("401") || message.includes("unauthorized")) {
      return "Authentication error: Please check your API key in the .env file.";
    }

    if (message.includes("429") || message.includes("rate limit")) {
      return "Rate limit exceeded. Please try again in a few moments.";
    }

    if (
      message.includes("network") ||
      message.includes("fetch") ||
      message.includes("econnrefused")
    ) {
      return "Network error: Please check your internet connection.";
    }

    if (message.includes("timeout")) {
      return "Request timeout: The service took too long to respond. Please try again.";
    }

    return "Sorry, I encountered an error while processing your request. Please try again.";
  }

  private sendErrorMessage(messageId: string, errorMessage: string): void {
    this.sendStreamChunk(messageId, {
      content: errorMessage,
      isComplete: true,
    });
  }

  private sendStreamChunk(messageId: string, chunk: StreamChunk): void {
    this.webContents.send("chat-response", {
      messageId,
      content: chunk.content,
      isComplete: chunk.isComplete,
    });
  }
}
