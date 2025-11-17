import { ElectronAPI } from "@electron-toolkit/preload";

interface TabInfo {
  id: string;
  title: string;
  url: string;
  isActive: boolean;
}

// Recorder/Replayer types (matching src/main/types/RecorderTypes.ts)
type ActionType =
  | "click"
  | "input"
  | "select"
  | "navigate"
  | "scroll"
  | "wait"
  | "manual_step";

interface ElementSelector {
  css?: string;
  xpath?: string;
  text?: string;
  id?: string;
  name?: string;
}

interface RecordedAction {
  id: string;
  type: ActionType;
  timestamp: number;
  url: string;
  selector?: ElementSelector;
  value?: string;
  description?: string;
  screenshot?: string;
  isContentField?: boolean;
  contentPlaceholder?: string;
}

interface Recording {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  actions: RecordedAction[];
  metadata?: {
    targetSite?: string;
    duration?: number;
    manualSteps?: number;
  };
}

interface ReplayOptions {
  recording: Recording;
  content?: {
    [placeholderName: string]: string | Buffer;
  };
  skipLogin?: boolean;
  speed?: number;
}

interface RecorderState {
  isRecording: boolean;
  isPaused: boolean;
  currentRecording: Recording | null;
  recordings: Recording[];
}

interface ReplayStatus {
  isReplaying: boolean;
  isPaused: boolean;
  currentAction?: RecordedAction;
  progress: number;
  totalActions: number;
}

interface SessionInfo {
  domain: string;
  name?: string;
  expiresAt: number;
}

interface TopBarAPI {
  // Tab management
  createTab: (
    url?: string
  ) => Promise<{ id: string; title: string; url: string } | null>;
  closeTab: (tabId: string) => Promise<boolean>;
  switchTab: (tabId: string) => Promise<boolean>;
  getTabs: () => Promise<TabInfo[]>;

  // Tab navigation
  navigateTab: (tabId: string, url: string) => Promise<void>;
  goBack: (tabId: string) => Promise<void>;
  goForward: (tabId: string) => Promise<void>;
  reload: (tabId: string) => Promise<void>;

  // Tab actions
  tabScreenshot: (tabId: string) => Promise<string | null>;
  tabRunJs: (tabId: string, code: string) => Promise<any>;

  // Sidebar
  toggleSidebar: () => Promise<void>;
  showRecordingsList: () => Promise<void>;

  // Recorder
  recorderStart: (name: string, description?: string) => Promise<{ success: boolean; recording?: Recording; error?: string }>;
  recorderStop: () => Promise<{ success: boolean; recording?: Recording; error?: string }>;
  recorderPause: () => Promise<{ success: boolean; error?: string }>;
  recorderResume: () => Promise<{ success: boolean; error?: string }>;
  recorderAddManualStep: (description: string) => Promise<{ success: boolean; error?: string }>;
  recorderGetState: () => Promise<{ success: boolean; state?: RecorderState; error?: string }>;
  recorderGetRecordings: () => Promise<{ success: boolean; recordings?: Recording[]; error?: string }>;
  recorderGetRecording: (id: string) => Promise<{ success: boolean; recording?: Recording; error?: string }>;
  recorderDeleteRecording: (id: string) => Promise<{ success: boolean; error?: string }>;

  // Replayer
  replayerStart: (options: ReplayOptions) => Promise<{ success: boolean; error?: string }>;
  replayerPause: () => Promise<{ success: boolean; error?: string }>;
  replayerResume: () => Promise<{ success: boolean; error?: string }>;
  replayerStop: () => Promise<{ success: boolean; error?: string }>;
  replayerGetStatus: () => Promise<{ success: boolean; status?: ReplayStatus; error?: string }>;

  // Session Manager
  sessionSave: (domain: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  sessionRestore: (domain: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  sessionHasValid: (domain: string, name?: string) => Promise<{ success: boolean; hasValid?: boolean; error?: string }>;
  sessionDelete: (domain: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  sessionList: () => Promise<{ success: boolean; sessions?: SessionInfo[]; error?: string }>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    topBarAPI: TopBarAPI;
  }
}

