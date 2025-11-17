export type ActionType =
  | "click"
  | "input"
  | "select"
  | "navigate"
  | "scroll"
  | "wait"
  | "keypress" // For keyboard events like Enter, Escape, Tab
  | "manual_step"; // For QR code scans and other manual interventions

export interface ElementSelector {
  css?: string;
  xpath?: string;
  text?: string;
  id?: string;
  name?: string;
}

export interface RecordedAction {
  id: string;
  type: ActionType;
  timestamp: number;
  url: string;
  selector?: ElementSelector;
  value?: string;
  description?: string;
  screenshot?: string; // Base64 screenshot at this step
  isContentField?: boolean; // Mark fields where content should be replaced
  contentPlaceholder?: string; // e.g., "article-title", "article-body"
}

export interface Recording {
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

export interface ReplayOptions {
  recording: Recording;
  content?: {
    [placeholderName: string]: string | Buffer; // Allow text or binary data like images
  };
  skipLogin?: boolean;
  speed?: number; // Playback speed multiplier
}

export interface RecorderState {
  isRecording: boolean;
  isPaused: boolean;
  currentRecording: Recording | null;
  recordings: Recording[];
}
