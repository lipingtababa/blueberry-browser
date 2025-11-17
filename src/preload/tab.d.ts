import { ElectronAPI } from "@electron-toolkit/preload";

interface TabAPI {
  // Recorder functionality
  recordAction: (
    type: string,
    selector: any,
    value?: string,
    isContentField?: boolean,
    contentPlaceholder?: string
  ) => Promise<{ success: boolean; error?: string }>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    tabAPI: TabAPI;
  }
}
