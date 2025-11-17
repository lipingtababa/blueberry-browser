import { ipcMain, WebContents } from "electron";
import type { Window } from "./Window";
import { ActionRecorder } from "./ActionRecorder";
import { ActionReplayer, ReplayStatus } from "./ActionReplayer";
import { SessionManager } from "./SessionManager";
import { ContentFormatter } from "./ContentFormatter";
import type { ReplayOptions } from "./types/RecorderTypes";
import type { FormatOptions } from "./ContentFormatter";

export class EventManager {
  private mainWindow: Window;
  private recorder: ActionRecorder;
  private replayer: ActionReplayer;
  private sessionManager: SessionManager;
  private contentFormatter: ContentFormatter;

  constructor(mainWindow: Window) {
    this.mainWindow = mainWindow;
    this.recorder = new ActionRecorder();
    this.sessionManager = new SessionManager();
    this.replayer = new ActionReplayer(this.sessionManager);
    this.contentFormatter = new ContentFormatter(mainWindow);
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Tab management events
    this.handleTabEvents();

    // Sidebar events
    this.handleSidebarEvents();

    // Page content events
    this.handlePageContentEvents();

    // Dark mode events
    this.handleDarkModeEvents();

    // Debug events
    this.handleDebugEvents();

    // Recorder/Replayer events
    this.handleRecorderEvents();

    // Content formatting events
    this.handleContentFormatterEvents();
  }

  private handleTabEvents(): void {
    // Create new tab
    ipcMain.handle("create-tab", (_, url?: string) => {
      const newTab = this.mainWindow.createTab(url);
      return { id: newTab.id, title: newTab.title, url: newTab.url };
    });

    // Close tab
    ipcMain.handle("close-tab", (_, id: string) => {
      this.mainWindow.closeTab(id);
    });

    // Switch tab
    ipcMain.handle("switch-tab", (_, id: string) => {
      this.mainWindow.switchActiveTab(id);
    });

    // Get tabs
    ipcMain.handle("get-tabs", () => {
      const activeTabId = this.mainWindow.activeTab?.id;
      return this.mainWindow.allTabs.map((tab) => ({
        id: tab.id,
        title: tab.title,
        url: tab.url,
        isActive: activeTabId === tab.id,
      }));
    });

    // Navigation (for compatibility with existing code)
    ipcMain.handle("navigate-to", (_, url: string) => {
      if (this.mainWindow.activeTab) {
        this.mainWindow.activeTab.loadURL(url);
      }
    });

    ipcMain.handle("navigate-tab", async (_, tabId: string, url: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        await tab.loadURL(url);
        return true;
      }
      return false;
    });

    ipcMain.handle("go-back", () => {
      if (this.mainWindow.activeTab) {
        this.mainWindow.activeTab.goBack();
      }
    });

    ipcMain.handle("go-forward", () => {
      if (this.mainWindow.activeTab) {
        this.mainWindow.activeTab.goForward();
      }
    });

    ipcMain.handle("reload", () => {
      if (this.mainWindow.activeTab) {
        this.mainWindow.activeTab.reload();
      }
    });

    // Tab-specific navigation handlers
    ipcMain.handle("tab-go-back", (_, tabId: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        tab.goBack();
        return true;
      }
      return false;
    });

    ipcMain.handle("tab-go-forward", (_, tabId: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        tab.goForward();
        return true;
      }
      return false;
    });

    ipcMain.handle("tab-reload", (_, tabId: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        tab.reload();
        return true;
      }
      return false;
    });

    ipcMain.handle("tab-screenshot", async (_, tabId: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        const image = await tab.screenshot();
        return image.toDataURL();
      }
      return null;
    });

    ipcMain.handle("tab-run-js", async (_, tabId: string, code: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        return await tab.runJs(code);
      }
      return null;
    });

    // Tab info
    ipcMain.handle("get-active-tab-info", () => {
      const activeTab = this.mainWindow.activeTab;
      if (activeTab) {
        return {
          id: activeTab.id,
          url: activeTab.url,
          title: activeTab.title,
          canGoBack: activeTab.webContents.canGoBack(),
          canGoForward: activeTab.webContents.canGoForward(),
        };
      }
      return null;
    });
  }

  private handleSidebarEvents(): void {
    // Toggle sidebar
    ipcMain.handle("toggle-sidebar", () => {
      this.mainWindow.sidebar.toggle();
      this.mainWindow.updateAllBounds();
      return true;
    });

    // Show recordings list in sidebar
    ipcMain.handle("show-recordings-list", async () => {
      // Get all recordings
      const recordings = this.recorder.getAllRecordings();

      // Send to sidebar to display
      this.mainWindow.sidebar.view.webContents.send("show-recordings", recordings);

      // Make sure sidebar is visible
      if (!this.mainWindow.sidebar.visible) {
        this.mainWindow.sidebar.toggle();
        this.mainWindow.updateAllBounds();
      }
    });

    // Chat message
    ipcMain.handle("sidebar-chat-message", async (_, request) => {
      // The LLMClient now handles getting the screenshot and context directly
      await this.mainWindow.sidebar.client.sendChatMessage(request);
    });

    // Clear chat
    ipcMain.handle("sidebar-clear-chat", () => {
      this.mainWindow.sidebar.client.clearMessages();
      return true;
    });

    // Get messages
    ipcMain.handle("sidebar-get-messages", () => {
      return this.mainWindow.sidebar.client.getMessages();
    });
  }

  private handlePageContentEvents(): void {
    // Get page content
    ipcMain.handle("get-page-content", async () => {
      if (this.mainWindow.activeTab) {
        try {
          return await this.mainWindow.activeTab.getTabHtml();
        } catch (error) {
          console.error("Error getting page content:", error);
          return null;
        }
      }
      return null;
    });

    // Get page text
    ipcMain.handle("get-page-text", async () => {
      if (this.mainWindow.activeTab) {
        try {
          return await this.mainWindow.activeTab.getTabText();
        } catch (error) {
          console.error("Error getting page text:", error);
          return null;
        }
      }
      return null;
    });

    // Get current URL
    ipcMain.handle("get-current-url", () => {
      if (this.mainWindow.activeTab) {
        return this.mainWindow.activeTab.url;
      }
      return null;
    });
  }

  private handleDarkModeEvents(): void {
    // Dark mode broadcasting
    ipcMain.on("dark-mode-changed", (event, isDarkMode) => {
      this.broadcastDarkMode(event.sender, isDarkMode);
    });
  }

  private handleDebugEvents(): void {
    // Ping test
    ipcMain.on("ping", () => console.log("pong"));

    // Renderer logging
    ipcMain.on("renderer-log", (_, data: { level: string; message: string }) => {
      if (data.level === 'error') {
        console.error(data.message);
      } else if (data.level === 'warn') {
        console.warn(data.message);
      } else {
        console.log(data.message);
      }
    });
  }

  private handleRecorderEvents(): void {
    // Start recording
    ipcMain.handle("recorder-start", async (_, name: string, description?: string) => {
      try {
        console.log("🔴 [RECORDER] Start recording requested:", { name, description });
        const activeTab = this.mainWindow.activeTab;
        console.log("🔴 [RECORDER] Active tab:", activeTab ? `Tab ${activeTab.id} - ${activeTab.url}` : "NONE");
        if (!activeTab) {
          throw new Error("No active tab");
        }
        const recording = await this.recorder.startRecording(activeTab, name, description);
        console.log("🔴 [RECORDER] Recording started successfully:", recording.id);
        return { success: true, recording };
      } catch (error) {
        console.error("🔴 [RECORDER] Failed to start recording:", error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Stop recording
    ipcMain.handle("recorder-stop", async () => {
      try {
        const recording = await this.recorder.stopRecording();
        return { success: true, recording };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Pause recording
    ipcMain.handle("recorder-pause", () => {
      try {
        this.recorder.pauseRecording();
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Resume recording
    ipcMain.handle("recorder-resume", () => {
      try {
        this.recorder.resumeRecording();
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Add manual step
    ipcMain.handle("recorder-add-manual-step", async (_, description: string) => {
      try {
        await this.recorder.addManualStep(description);
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Record action (called from injected script)
    ipcMain.handle("recorder-record-action", async (_, type, selector, value, isContentField, contentPlaceholder) => {
      try {
        await this.recorder.recordAction(type, selector, value, isContentField, contentPlaceholder);
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Get recorder state
    ipcMain.handle("recorder-get-state", () => {
      return this.recorder.getState();
    });

    // Get all recordings
    ipcMain.handle("recorder-get-recordings", () => {
      try {
        const recordings = this.recorder.getAllRecordings();
        return { success: true, recordings };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Get recording by ID
    ipcMain.handle("recorder-get-recording", (_, id: string) => {
      try {
        const recording = this.recorder.getRecording(id);
        return { success: true, recording };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Delete recording
    ipcMain.handle("recorder-delete-recording", async (_, id: string) => {
      try {
        await this.recorder.deleteRecording(id);
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Start replay
    ipcMain.handle("replayer-start", async (_, options: ReplayOptions) => {
      try {
        const activeTab = this.mainWindow.activeTab;
        if (!activeTab) {
          throw new Error("No active tab");
        }

        // Set up status update callback
        const statusCallback = (status: ReplayStatus) => {
          this.mainWindow.topBar.view.webContents.send("replayer-status-update", status);
        };

        await this.replayer.startReplay(activeTab, options, statusCallback);
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Pause replay
    ipcMain.handle("replayer-pause", () => {
      try {
        this.replayer.pause();
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Resume replay
    ipcMain.handle("replayer-resume", async () => {
      try {
        await this.replayer.resume();
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Stop replay
    ipcMain.handle("replayer-stop", () => {
      try {
        this.replayer.stop();
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Get replay status
    ipcMain.handle("replayer-get-status", () => {
      return this.replayer.getStatus();
    });

    // Session management
    ipcMain.handle("session-save", async (_, domain: string, name?: string) => {
      try {
        await this.sessionManager.saveSession(domain, name);
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    ipcMain.handle("session-restore", async (_, domain: string, name?: string) => {
      try {
        const restored = await this.sessionManager.restoreSession(domain, name);
        return { success: true, restored };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    ipcMain.handle("session-has-valid", (_, domain: string, name?: string) => {
      return this.sessionManager.hasValidSession(domain, name);
    });

    ipcMain.handle("session-delete", (_, domain: string, name?: string) => {
      try {
        this.sessionManager.deleteSession(domain, name);
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    ipcMain.handle("session-list", () => {
      return this.sessionManager.listSessions();
    });
  }

  private handleContentFormatterEvents(): void {
    // Format content
    ipcMain.handle("format-content", async (_, htmlContent: string, options?: FormatOptions) => {
      try {
        const formatted = await this.contentFormatter.formatContent(htmlContent, options);
        return { success: true, content: formatted };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Format for WeChat
    ipcMain.handle("format-content-wechat", async (_, htmlContent: string) => {
      try {
        const formatted = await this.contentFormatter.formatForWeChat(htmlContent);
        return { success: true, content: formatted };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Generate title
    ipcMain.handle("generate-title", async (_, content: string) => {
      try {
        const title = await this.contentFormatter.generateTitle(content);
        return { success: true, title };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Optimize for WeChat
    ipcMain.handle("optimize-content-wechat", (_, content: string) => {
      try {
        const optimized = this.contentFormatter.optimizeForWeChat(content);
        return { success: true, content: optimized };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });
  }

  private broadcastDarkMode(sender: WebContents, isDarkMode: boolean): void {
    // Send to topbar
    if (this.mainWindow.topBar.view.webContents !== sender) {
      this.mainWindow.topBar.view.webContents.send(
        "dark-mode-updated",
        isDarkMode
      );
    }

    // Send to sidebar
    if (this.mainWindow.sidebar.view.webContents !== sender) {
      this.mainWindow.sidebar.view.webContents.send(
        "dark-mode-updated",
        isDarkMode
      );
    }

    // Send to all tabs
    this.mainWindow.allTabs.forEach((tab) => {
      if (tab.webContents !== sender) {
        tab.webContents.send("dark-mode-updated", isDarkMode);
      }
    });
  }

  // Clean up event listeners
  public cleanup(): void {
    ipcMain.removeAllListeners();
  }
}
