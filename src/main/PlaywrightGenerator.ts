import type { RecordedAction } from "./types/RecorderTypes";

export interface PlaywrightScriptMetadata {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  targetSite?: string;
}

export class PlaywrightGenerator {
  /**
   * Generate a Playwright test script from recorded actions
   */
  public static generate(
    metadata: PlaywrightScriptMetadata,
    actions: RecordedAction[]
  ): string {
    const lines: string[] = [];

    // Header
    lines.push("import { test, expect } from '@playwright/test';");
    lines.push("");
    lines.push(`// Recording ID: ${metadata.id}`);
    lines.push(`// Created: ${new Date(metadata.createdAt).toISOString()}`);
    if (metadata.description) {
      lines.push(`// Description: ${metadata.description}`);
    }
    lines.push("");

    // Test function
    lines.push(`test('${metadata.name}', async ({ page }) => {`);

    // Navigate to starting URL
    if (metadata.targetSite) {
      lines.push(`  // Navigate to starting URL`);
      lines.push(`  await page.goto('${metadata.targetSite}');`);
      lines.push("");
    }

    // Process actions
    let lastUrl = metadata.targetSite;
    let consolidatedInputs: Map<string, string> = new Map();
    let lastInputSelector: string | null = null;

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const nextAction = i < actions.length - 1 ? actions[i + 1] : null;

      // Detect URL changes
      if (action.url !== lastUrl) {
        lines.push(`  // Page navigated to: ${action.url}`);
        lastUrl = action.url;
      }

      switch (action.type) {
        case "click":
          // Flush any pending input first
          if (lastInputSelector && consolidatedInputs.has(lastInputSelector)) {
            const value = consolidatedInputs.get(lastInputSelector)!;
            lines.push(this.generateInputCommand(lastInputSelector, value, action.selector));
            consolidatedInputs.clear();
            lastInputSelector = null;
          }

          lines.push(this.generateClickCommand(action));
          break;

        case "input":
          // Consolidate multiple input events into one
          const inputSelector = this.getSelectorString(action.selector);
          if (inputSelector !== lastInputSelector && lastInputSelector) {
            // Different input field - flush the previous one
            const value = consolidatedInputs.get(lastInputSelector)!;
            lines.push(this.generateInputCommand(lastInputSelector, value, action.selector));
            consolidatedInputs.clear();
          }
          lastInputSelector = inputSelector;
          consolidatedInputs.set(inputSelector, action.value || "");

          // If next action is not an input on the same field, flush now
          if (
            !nextAction ||
            nextAction.type !== "input" ||
            this.getSelectorString(nextAction.selector) !== inputSelector
          ) {
            const value = consolidatedInputs.get(inputSelector)!;
            lines.push(this.generateInputCommand(inputSelector, value, action.selector));
            consolidatedInputs.clear();
            lastInputSelector = null;
          }
          break;

        case "keypress":
          // Flush any pending input first
          if (lastInputSelector && consolidatedInputs.has(lastInputSelector)) {
            const value = consolidatedInputs.get(lastInputSelector)!;
            lines.push(this.generateInputCommand(lastInputSelector, value, action.selector));
            consolidatedInputs.clear();
            lastInputSelector = null;
          }

          lines.push(this.generateKeypressCommand(action));
          break;

        case "select":
          lines.push(this.generateSelectCommand(action));
          break;

        case "scroll":
          lines.push(this.generateScrollCommand(action));
          break;

        case "manual_step":
          lines.push(this.generateManualStepComment(action));
          break;

        case "wait":
          const waitMs = parseInt(action.value || "1000");
          lines.push(`  await page.waitForTimeout(${waitMs});`);
          break;
      }
    }

    // Close test function
    lines.push("});");

    return lines.join("\n");
  }

  private static generateClickCommand(action: RecordedAction): string {
    const selector = this.getPreferredSelector(action.selector);
    const comment = action.selector?.text ? ` // "${action.selector.text}"` : "";
    return `  await page.click('${this.escapeSelector(selector)}');${comment}`;
  }

  private static generateInputCommand(
    selectorStr: string,
    value: string,
    selectorObj: any
  ): string {
    const comment = selectorObj?.text ? ` // "${selectorObj.text}"` : "";
    return `  await page.fill('${this.escapeSelector(selectorStr)}', '${this.escapeValue(value)}');${comment}`;
  }

  private static generateKeypressCommand(action: RecordedAction): string {
    try {
      const keyInfo = JSON.parse(action.value || "{}");
      const key = keyInfo.key || "Enter";

      // For Enter key, add a comment about potential form submission
      if (key === "Enter") {
        return `  await page.keyboard.press('${key}'); // May trigger form submission`;
      }

      return `  await page.keyboard.press('${key}');`;
    } catch {
      return `  await page.keyboard.press('Enter');`;
    }
  }

  private static generateSelectCommand(action: RecordedAction): string {
    const selector = this.getPreferredSelector(action.selector);
    const value = action.value || "";
    return `  await page.selectOption('${this.escapeSelector(selector)}', '${this.escapeValue(value)}');`;
  }

  private static generateScrollCommand(action: RecordedAction): string {
    try {
      const scrollData = JSON.parse(action.value || "{}");
      return `  await page.evaluate(() => window.scrollTo(${scrollData.x || 0}, ${scrollData.y || 0}));`;
    } catch {
      return `  await page.evaluate(() => window.scrollTo(0, 0));`;
    }
  }

  private static generateManualStepComment(action: RecordedAction): string {
    return `  // MANUAL STEP: ${action.description || "Complete this step manually"}`;
  }

  /**
   * Get the preferred selector from the selector object
   * Priority: ID > CSS > Name > XPath
   */
  private static getPreferredSelector(selector: any): string {
    if (!selector) return "body";

    if (selector.id) {
      return `#${selector.id}`;
    }

    if (selector.css) {
      return selector.css;
    }

    if (selector.name) {
      return `[name="${selector.name}"]`;
    }

    if (selector.xpath) {
      // Playwright doesn't support XPath by default, so convert to text or use CSS
      return selector.xpath;
    }

    return "body";
  }

  /**
   * Get selector as a string (for comparison/deduplication)
   */
  private static getSelectorString(selector: any): string {
    return this.getPreferredSelector(selector);
  }

  /**
   * Escape single quotes in selectors
   */
  private static escapeSelector(selector: string): string {
    return selector.replace(/'/g, "\\'");
  }

  /**
   * Escape single quotes and newlines in values
   */
  private static escapeValue(value: string): string {
    return value.replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "\\r");
  }
}
