import { LLMClient } from "./LLMClient";
import type { Window } from "./Window";

export interface FormatOptions {
  targetPlatform?: string; // e.g., "wechat", "generic"
  maxLength?: number;
  includeImages?: boolean;
  optimizeForSEO?: boolean;
}

export interface FormattedContent {
  title?: string;
  body: string;
  images?: Array<{
    url: string;
    alt?: string;
    optimized?: Buffer;
  }>;
  metadata?: {
    wordCount: number;
    characterCount: number;
    estimatedReadingTime: number;
  };
}

export class ContentFormatter {
  private llmClient: LLMClient;

  constructor(mainWindow: Window) {
    this.llmClient = mainWindow.sidebar.client;
  }

  /**
   * Format HTML content for a specific platform using AI
   */
  public async formatContent(
    htmlContent: string,
    options: FormatOptions = {}
  ): Promise<FormattedContent> {
    const {
      targetPlatform = "wechat",
      maxLength,
      includeImages = true,
      optimizeForSEO = false,
    } = options;

    // Extract text content and images
    const { text, images } = this.extractContentFromHTML(htmlContent);

    // Build AI prompt for formatting
    const prompt = this.buildFormattingPrompt(text, targetPlatform, maxLength, optimizeForSEO);

    // Get AI-formatted content
    const formattedText = await this.getAIFormattedContent(prompt);

    // Calculate metadata
    const metadata = {
      wordCount: formattedText.split(/\s+/).length,
      characterCount: formattedText.length,
      estimatedReadingTime: Math.ceil(formattedText.split(/\s+/).length / 200), // ~200 words per minute
    };

    return {
      body: formattedText,
      images: includeImages ? images : undefined,
      metadata,
    };
  }

  /**
   * Format content specifically for WeChat Official Accounts
   */
  public async formatForWeChat(htmlContent: string): Promise<FormattedContent> {
    return this.formatContent(htmlContent, {
      targetPlatform: "wechat",
      includeImages: true,
      optimizeForSEO: true,
    });
  }

  /**
   * Generate a title for content using AI
   */
  public async generateTitle(content: string): Promise<string> {
    const prompt = `Generate a compelling, SEO-friendly title for the following content. The title should be:
- Concise (under 60 characters)
- Engaging and click-worthy
- Accurately reflect the content
- Optimized for search engines

Content:
${content.substring(0, 1000)}...

Respond with ONLY the title, nothing else.`;

    return await this.getAIFormattedContent(prompt);
  }

  /**
   * Optimize content for WeChat's character limits and formatting rules
   */
  public optimizeForWeChat(content: string): string {
    // WeChat specific optimizations
    let optimized = content;

    // Remove unsupported HTML tags
    optimized = optimized.replace(/<script[^>]*>.*?<\/script>/gi, "");
    optimized = optimized.replace(/<style[^>]*>.*?<\/style>/gi, "");

    // Convert common formatting to WeChat-friendly format
    optimized = optimized.replace(/<h1[^>]*>(.*?)<\/h1>/gi, "**$1**\n\n");
    optimized = optimized.replace(/<h2[^>]*>(.*?)<\/h2>/gi, "**$1**\n\n");
    optimized = optimized.replace(/<h3[^>]*>(.*?)<\/h3>/gi, "**$1**\n\n");
    optimized = optimized.replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**");
    optimized = optimized.replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**");
    optimized = optimized.replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*");
    optimized = optimized.replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*");

    // Clean up multiple newlines
    optimized = optimized.replace(/\n{3,}/g, "\n\n");

    // Trim whitespace
    optimized = optimized.trim();

    return optimized;
  }

  private extractContentFromHTML(html: string): { text: string; images: Array<{ url: string; alt?: string }> } {
    // Simple HTML parsing (in a real implementation, you might use a proper HTML parser)
    const text = html
      .replace(/<script[^>]*>.*?<\/script>/gi, "")
      .replace(/<style[^>]*>.*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Extract images
    const imageRegex = /<img[^>]+src="([^">]+)"[^>]*alt="([^">]*)"[^>]*>/gi;
    const images: Array<{ url: string; alt?: string }> = [];
    let match;

    while ((match = imageRegex.exec(html)) !== null) {
      images.push({
        url: match[1],
        alt: match[2] || undefined,
      });
    }

    return { text, images };
  }

  private buildFormattingPrompt(
    text: string,
    targetPlatform: string,
    maxLength?: number,
    optimizeForSEO?: boolean
  ): string {
    let prompt = `Format the following content for ${targetPlatform}. `;

    if (targetPlatform === "wechat") {
      prompt += `Apply WeChat Official Account best practices:
- Use engaging, conversational tone
- Break content into short, scannable paragraphs
- Use emojis sparingly but effectively
- Ensure mobile-friendly formatting
- Follow WeChat's content guidelines
`;
    }

    if (maxLength) {
      prompt += `\n- Keep the content under ${maxLength} characters`;
    }

    if (optimizeForSEO) {
      prompt += `\n- Optimize for search engines with relevant keywords`;
    }

    prompt += `\n\nOriginal content:\n${text}`;
    prompt += `\n\nRespond with ONLY the formatted content, no explanations or meta-commentary.`;

    return prompt;
  }

  private async getAIFormattedContent(prompt: string): Promise<string> {
    const response = await this.llmClient.getCompletion(prompt);
    return response.trim();
  }
}
