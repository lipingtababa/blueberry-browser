import { ElectronAPI } from "@electron-toolkit/preload";

interface ChatRequest {
  message: string;
  context: {
    url: string | null;
    content: string | null;
    text: string | null;
  };
  messageId: string;
}

interface ChatResponse {
  messageId: string;
  content: string;
  isComplete: boolean;
}

interface TabInfo {
  id: string;
  title: string;
  url: string;
  isActive: boolean;
}

interface CoreMessage {
  role: string;
  content: string | Array<{ type: string; text?: string }>;
}

interface RecordingData {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  actions: unknown[];
  metadata?: {
    targetSite?: string;
    duration?: number;
    manualSteps?: number;
  };
}

interface ReplayOptions {
  recording: RecordingData;
  content?: Record<string, string | Buffer>;
  skipLogin?: boolean;
  speed?: number;
}

interface SidebarAPI {
  // Chat functionality
  sendChatMessage: (request: Partial<ChatRequest>) => Promise<void>;
  clearChat: () => Promise<void>;
  getMessages: () => Promise<CoreMessage[]>;
  onChatResponse: (callback: (data: ChatResponse) => void) => void;
  onMessagesUpdated: (callback: (messages: CoreMessage[]) => void) => void;
  removeChatResponseListener: () => void;
  removeMessagesUpdatedListener: () => void;

  // Page content access
  getPageContent: () => Promise<string | null>;
  getPageText: () => Promise<string | null>;
  getCurrentUrl: () => Promise<string | null>;

  // Tab information
  getActiveTabInfo: () => Promise<TabInfo | null>;

  // Recorder APIs
  recorderGetRecording: (
    id: string,
  ) => Promise<{ success: boolean; recording?: RecordingData; error?: string }>;
  recorderDeleteRecording: (
    id: string,
  ) => Promise<{ success: boolean; error?: string }>;

  // Replayer APIs
  replayerStart: (
    options: ReplayOptions,
  ) => Promise<{ success: boolean; error?: string }>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    sidebarAPI: SidebarAPI;
  }
}
