import { v4 as uuidv4 } from "uuid";
import type { Tab } from "./Tab";
import type {
  Recording,
  RecordedAction,
  ActionType,
  ElementSelector,
  RecorderState,
} from "./types/RecorderTypes";
import * as fs from "fs";
import * as path from "path";
import { app } from "electron";
import { PlaywrightGenerator } from "./PlaywrightGenerator";

export class ActionRecorder {
  private state: RecorderState;
  private recordingsDir: string;
  private currentTab: Tab | null = null;

  constructor() {
    this.state = {
      isRecording: false,
      isPaused: false,
      currentRecording: null,
      recordings: [],
    };

    // Set up recordings directory
    this.recordingsDir = path.join(app.getPath("userData"), "recordings");
    this.ensureRecordingsDir();
    this.loadRecordings();
  }

  private ensureRecordingsDir(): void {
    if (!fs.existsSync(this.recordingsDir)) {
      fs.mkdirSync(this.recordingsDir, { recursive: true });
    }
  }

  private loadRecordings(): void {
    try {
      const files = fs.readdirSync(this.recordingsDir);
      this.state.recordings = files
        .filter((file) => file.endsWith(".spec.ts"))
        .map((file) => {
          const content = fs.readFileSync(
            path.join(this.recordingsDir, file),
            "utf-8"
          );
          return this.parsePlaywrightScript(file, content);
        })
        .sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (error) {
      console.error("Error loading recordings:", error);
      this.state.recordings = [];
    }
  }

  /**
   * Parse metadata from Playwright script comments
   */
  private parsePlaywrightScript(filename: string, content: string): Recording {
    const lines = content.split("\n");
    let id = filename.replace(".spec.ts", "");
    let name = id;
    let description: string | undefined;
    let createdAt = 0;
    let targetSite: string | undefined;

    for (const line of lines) {
      if (line.includes("// Recording ID:")) {
        id = line.split("// Recording ID:")[1].trim();
      } else if (line.includes("// Created:")) {
        const dateStr = line.split("// Created:")[1].trim();
        createdAt = new Date(dateStr).getTime();
      } else if (line.includes("// Description:")) {
        description = line.split("// Description:")[1].trim();
      } else if (line.includes("test('")) {
        const match = line.match(/test\('([^']+)'/);
        if (match) name = match[1];
      } else if (line.includes("await page.goto('")) {
        const match = line.match(/goto\('([^']+)'\)/);
        if (match) targetSite = match[1];
      }
    }

    return {
      id,
      name,
      description,
      createdAt,
      updatedAt: createdAt,
      actions: [], // Actions are in the script, not needed here
      metadata: {
        targetSite,
        manualSteps: (content.match(/\/\/ MANUAL STEP:/g) || []).length,
      },
    };
  }

  public async startRecording(tab: Tab, name: string, description?: string): Promise<Recording> {
    console.log("📹 [RECORDER] startRecording called with:", { name, description, tabUrl: tab?.url, tabId: tab?.id });

    if (this.state.isRecording) {
      console.error("📹 [RECORDER] Error: Already recording");
      throw new Error("Already recording");
    }

    console.log("📹 [RECORDER] Setting current tab:", tab.id);
    this.currentTab = tab;

    const recording: Recording = {
      id: uuidv4(),
      name,
      description,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      actions: [],
      metadata: {
        targetSite: tab.url,
        manualSteps: 0,
      },
    };

    console.log("📹 [RECORDER] Created recording object:", recording.id);

    this.state.currentRecording = recording;
    this.state.isRecording = true;
    this.state.isPaused = false;

    console.log("📹 [RECORDER] State updated, injecting script...");

    // Inject recording script into the tab
    try {
      await this.injectRecorderScript(tab);
      console.log("📹 [RECORDER] Script injected successfully");
    } catch (error) {
      console.error("📹 [RECORDER] Failed to inject script:", error);
      // Reset state on failure
      this.state.isRecording = false;
      this.state.currentRecording = null;
      this.currentTab = null;
      throw error;
    }

    console.log("📹 [RECORDER] Recording started successfully:", recording.id);
    return recording;
  }

  public pauseRecording(): void {
    if (!this.state.isRecording) {
      throw new Error("Not recording");
    }
    this.state.isPaused = true;
  }

  public resumeRecording(): void {
    if (!this.state.isRecording) {
      throw new Error("Not recording");
    }
    this.state.isPaused = false;
  }

  public async addManualStep(description: string): Promise<void> {
    if (!this.state.isRecording || !this.state.currentRecording || !this.currentTab) {
      throw new Error("Not recording");
    }

    const screenshot = await this.currentTab.screenshot();
    const action: RecordedAction = {
      id: uuidv4(),
      type: "manual_step",
      timestamp: Date.now(),
      url: this.currentTab.url,
      description,
      screenshot: screenshot.toDataURL(),
    };

    this.state.currentRecording.actions.push(action);
    if (this.state.currentRecording.metadata) {
      this.state.currentRecording.metadata.manualSteps =
        (this.state.currentRecording.metadata.manualSteps || 0) + 1;
    }
  }

  public async recordAction(
    type: ActionType,
    selector: ElementSelector,
    value?: string,
    isContentField?: boolean,
    contentPlaceholder?: string
  ): Promise<void> {
    if (!this.state.isRecording || this.state.isPaused || !this.state.currentRecording || !this.currentTab) {
      return;
    }

    const action: RecordedAction = {
      id: uuidv4(),
      type,
      timestamp: Date.now(),
      url: this.currentTab.url,
      selector,
      value,
      isContentField,
      contentPlaceholder,
    };

    this.state.currentRecording.actions.push(action);
  }

  public async stopRecording(): Promise<Recording> {
    if (!this.state.isRecording || !this.state.currentRecording) {
      throw new Error("Not recording");
    }

    const recording = this.state.currentRecording;
    recording.updatedAt = Date.now();

    // Save recording as Playwright script
    await this.saveRecording(recording);

    // Clean up recording script from tab
    if (this.currentTab) {
      await this.cleanupRecorderScript(this.currentTab);
    }

    // Reset state
    this.state.isRecording = false;
    this.state.isPaused = false;
    this.state.currentRecording = null;
    this.currentTab = null;

    // Reload recordings
    this.loadRecordings();

    return recording;
  }

  private async saveRecording(recording: Recording): Promise<void> {
    // Generate Playwright script
    const script = PlaywrightGenerator.generate(
      {
        id: recording.id,
        name: recording.name,
        description: recording.description,
        createdAt: recording.createdAt,
        targetSite: recording.metadata?.targetSite,
      },
      recording.actions
    );

    // Save as .spec.ts file
    const filePath = path.join(this.recordingsDir, `${recording.id}.spec.ts`);
    fs.writeFileSync(filePath, script, "utf-8");
  }

  public async deleteRecording(id: string): Promise<void> {
    const filePath = path.join(this.recordingsDir, `${id}.spec.ts`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      this.loadRecordings();
    }
  }

  public getRecording(id: string): Recording | null {
    return this.state.recordings.find((r) => r.id === id) || null;
  }

  public getAllRecordings(): Recording[] {
    return this.state.recordings;
  }

  public getState(): RecorderState {
    return { ...this.state };
  }

  private async injectRecorderScript(tab: Tab): Promise<void> {
    console.log("📹 [RECORDER] injectRecorderScript starting for tab:", tab.id);

    // Inject script that captures user interactions
    const script = `
      (function() {
        if (window.__blueberryRecorder) return; // Already injected
        window.__blueberryRecorder = true;

        // Helper function to generate selector
        function generateSelector(element) {
          const selectors = {};

          // ID selector
          if (element.id) {
            selectors.id = element.id;
            selectors.css = '#' + element.id;
          }

          // Name attribute
          if (element.name) {
            selectors.name = element.name;
          }

          // Generate CSS selector
          if (!selectors.css) {
            const path = [];
            let current = element;
            while (current && current.nodeType === Node.ELEMENT_NODE) {
              let selector = current.nodeName.toLowerCase();
              if (current.id) {
                selector += '#' + current.id;
                path.unshift(selector);
                break;
              } else if (current.className) {
                selector += '.' + current.className.trim().split(/\\s+/).join('.');
              }
              path.unshift(selector);
              current = current.parentNode;
              if (path.length > 5) break; // Limit depth
            }
            selectors.css = path.join(' > ');
          }

          // Generate XPath
          function getXPath(node) {
            if (node.id) return '//*[@id="' + node.id + '"]';
            if (node === document.body) return '/html/body';

            let ix = 0;
            const siblings = node.parentNode?.childNodes || [];
            for (let i = 0; i < siblings.length; i++) {
              const sibling = siblings[i];
              if (sibling === node) {
                return getXPath(node.parentNode) + '/' + node.tagName.toLowerCase() + '[' + (ix + 1) + ']';
              }
              if (sibling.nodeType === 1 && sibling.tagName === node.tagName) {
                ix++;
              }
            }
          }
          selectors.xpath = getXPath(element);

          // Text content for buttons/links
          if (element.textContent && element.textContent.trim().length < 50) {
            selectors.text = element.textContent.trim();
          }

          return selectors;
        }

        // Click event listener
        document.addEventListener('click', (e) => {
          if (e.isTrusted) {
            const selector = generateSelector(e.target);
            window.tabAPI?.recordAction?.('click', selector);
          }
        }, true);

        // Input event listener
        document.addEventListener('input', (e) => {
          if (e.isTrusted && e.target.tagName) {
            const selector = generateSelector(e.target);
            const value = e.target.value;
            window.tabAPI?.recordAction?.('input', selector, value);
          }
        }, true);

        // Select change listener
        document.addEventListener('change', (e) => {
          if (e.isTrusted && e.target.tagName === 'SELECT') {
            const selector = generateSelector(e.target);
            const value = e.target.value;
            window.tabAPI?.recordAction?.('select', selector, value);
          }
        }, true);

        // Scroll listener (debounced)
        let scrollTimeout;
        window.addEventListener('scroll', (e) => {
          clearTimeout(scrollTimeout);
          scrollTimeout = setTimeout(() => {
            window.tabAPI?.recordAction?.('scroll', {}, JSON.stringify({
              x: window.scrollX,
              y: window.scrollY
            }));
          }, 500);
        }, true);

        // Keyboard event listener for important keys
        document.addEventListener('keydown', (e) => {
          if (e.isTrusted) {
            // Only record important keys: Enter, Escape, Tab
            const importantKeys = ['Enter', 'Escape', 'Tab'];
            if (importantKeys.includes(e.key)) {
              const selector = generateSelector(e.target);
              const keyInfo = JSON.stringify({
                key: e.key,
                code: e.code,
                ctrlKey: e.ctrlKey,
                shiftKey: e.shiftKey,
                altKey: e.altKey,
                metaKey: e.metaKey
              });
              window.tabAPI?.recordAction?.('keypress', selector, keyInfo);
            }
          }
        }, true);

        console.log('[Blueberry Recorder] Recording script injected');
      })();
    `;

    console.log("📹 [RECORDER] Executing script via tab.runJs...");
    try {
      await tab.runJs(script);
      console.log("📹 [RECORDER] tab.runJs completed successfully");
    } catch (error) {
      console.error("📹 [RECORDER] tab.runJs failed:", error);
      throw error;
    }
  }

  private async cleanupRecorderScript(tab: Tab): Promise<void> {
    const script = `
      delete window.__blueberryRecorder;
      console.log('[Blueberry Recorder] Recording script cleaned up');
    `;
    await tab.runJs(script);
  }
}
