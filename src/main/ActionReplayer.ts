import type { Tab } from "./Tab";
import type { Recording, ReplayOptions } from "./types/RecorderTypes";
import { SessionManager } from "./SessionManager";
import * as path from "path";
import { app } from "electron";
import * as fs from "fs";

export type ReplayState = "idle" | "running" | "paused" | "manual_step" | "completed" | "error";

export interface ReplayStatus {
  state: ReplayState;
  currentActionIndex: number;
  totalActions: number;
  error?: string;
  message?: string;
}

export class ActionReplayer {
  private recording: Recording | null = null;
  private currentActionIndex: number = 0;
  private state: ReplayState = "idle";
  private sessionManager: SessionManager;
  private onStatusChange?: (status: ReplayStatus) => void;

  constructor(sessionManager: SessionManager) {
    this.sessionManager = sessionManager;
  }

  /**
   * Start replaying a recording by executing the Playwright script
   */
  public async startReplay(
    tab: Tab,
    options: ReplayOptions,
    onStatusChange?: (status: ReplayStatus) => void
  ): Promise<void> {
    if (this.state === "running") {
      throw new Error("Already replaying");
    }

    console.log("[Replayer] Tab:", tab.id);

    this.recording = options.recording;
    this.currentActionIndex = 0;
    this.state = "running";
    this.onStatusChange = onStatusChange;

    try {
      console.log("[Replayer] Starting Playwright execution for recording:", this.recording.id);

      // Get the script path
      const recordingsDir = path.join(app.getPath("userData"), "recordings");
      const scriptPath = path.join(recordingsDir, `${this.recording.id}.spec.ts`);

      console.log("[Replayer] Script path:", scriptPath);

      // Execute Playwright actions directly in the current tab
      await this.executePlaywrightInCurrentTab(tab, scriptPath);

      // Save session after successful replay
      if (this.recording.metadata?.targetSite) {
        const domain = new URL(this.recording.metadata.targetSite).hostname;
        await this.sessionManager.saveSession(domain);
        console.log("[Replayer] Session saved for:", domain);
      }

      this.state = "completed";
      this.emitStatus("Replay completed successfully");
    } catch (error) {
      this.state = "error";
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.emitStatus(`Replay failed: ${errorMsg}`);
      console.error("[Replayer] Replay failed:", error);
      throw error;
    }
  }

  /**
   * Pause the replay
   */
  public pause(): void {
    if (this.state === "running") {
      this.state = "paused";
      this.emitStatus("Replay paused");
    }
  }

  /**
   * Resume the replay
   */
  public async resume(): Promise<void> {
    if (this.state === "paused" || this.state === "manual_step") {
      this.state = "running";
      this.emitStatus("Replay resumed");
      // Playwright handles its own execution
    }
  }

  /**
   * Stop the replay
   */
  public stop(): void {
    this.state = "idle";
    this.recording = null;
    this.currentActionIndex = 0;
    this.emitStatus("Replay stopped");
  }

  /**
   * Get current replay status
   */
  public getStatus(): ReplayStatus {
    return {
      state: this.state,
      currentActionIndex: this.currentActionIndex,
      totalActions: 0,
    };
  }

  /**
   * Execute Playwright actions in the current browser tab
   */
  private async executePlaywrightInCurrentTab(tab: Tab, scriptPath: string): Promise<void> {
    // Read the script file and extract the commands
    const scriptContent = fs.readFileSync(scriptPath, "utf-8");
    console.log("[Replayer] Executing actions in current tab");

    // Parse and execute each Playwright command
    const lines = scriptContent.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip comments and imports
      if (trimmed.startsWith("//") || trimmed.startsWith("import") || !trimmed) {
        continue;
      }

      try {
        // Extract goto URL
        if (trimmed.includes("await page.goto(")) {
          const match = trimmed.match(/goto\('([^']+)'\)/);
          if (match) {
            const url = match[1];
            console.log("[Replayer] Navigate to:", url);
            await tab.loadURL(url);
            await this.sleep(2000); // Wait for page load
          }
        }

        // Extract click commands
        else if (trimmed.includes("await page.click(")) {
          const match = trimmed.match(/click\('([^']+)'\)/);
          if (match) {
            const selector = match[1];
            console.log("[Replayer] Click:", selector);
            await this.executeClick(tab, selector);
            await this.sleep(500);
          }
        }

        // Extract fill/input commands
        else if (trimmed.includes("await page.fill(")) {
          const match = trimmed.match(/fill\('([^']+)',\s*'([^']*)'\)/);
          if (match) {
            const selector = match[1];
            const value = match[2];
            console.log("[Replayer] Fill:", selector, "with:", value);
            await this.executeFill(tab, selector, value);
            await this.sleep(500);
          }
        }

        // Extract keyboard.press commands
        else if (trimmed.includes("await page.keyboard.press(")) {
          const match = trimmed.match(/press\('([^']+)'\)/);
          if (match) {
            const key = match[1];
            console.log("[Replayer] Press key:", key);
            await this.executeKeyPress(tab, key);
            await this.sleep(500);
          }
        }
      } catch (error) {
        console.error("[Replayer] Error executing line:", trimmed, error);
        // Continue with next line instead of failing completely
      }
    }
  }

  private async executeClick(tab: Tab, selector: string): Promise<void> {
    const script = `
      (function() {
        const element = document.querySelector('${selector.replace(/'/g, "\\'")}');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.click();
          return true;
        }
        throw new Error('Element not found: ${selector}');
      })();
    `;
    await tab.runJs(script);
  }

  private async executeFill(tab: Tab, selector: string, value: string): Promise<void> {
    const script = `
      (function() {
        const element = document.querySelector('${selector.replace(/'/g, "\\'")}');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.focus();
          element.value = '${value.replace(/'/g, "\\'")}';
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
        throw new Error('Input element not found: ${selector}');
      })();
    `;
    await tab.runJs(script);
  }

  private async executeKeyPress(tab: Tab, key: string): Promise<void> {
    const script = `
      (function() {
        const activeElement = document.activeElement;
        if (activeElement) {
          // Dispatch keyboard events
          const keydownEvent = new KeyboardEvent('keydown', {
            key: '${key}',
            code: '${key}',
            bubbles: true,
            cancelable: true
          });
          activeElement.dispatchEvent(keydownEvent);

          const keypressEvent = new KeyboardEvent('keypress', {
            key: '${key}',
            code: '${key}',
            bubbles: true,
            cancelable: true
          });
          activeElement.dispatchEvent(keypressEvent);

          const keyupEvent = new KeyboardEvent('keyup', {
            key: '${key}',
            code: '${key}',
            bubbles: true,
            cancelable: true
          });
          activeElement.dispatchEvent(keyupEvent);

          // For Enter key, try to submit the form
          if ('${key}' === 'Enter' && activeElement.form) {
            activeElement.form.submit();
          }

          return true;
        }
        throw new Error('No active element for keypress');
      })();
    `;
    await tab.runJs(script);
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private emitStatus(message?: string, error?: string): void {
    if (this.onStatusChange) {
      this.onStatusChange({
        state: this.state,
        currentActionIndex: this.currentActionIndex,
        totalActions: this.recording?.metadata?.manualSteps || 0,
        message,
        error,
      });
    }
  }
}
