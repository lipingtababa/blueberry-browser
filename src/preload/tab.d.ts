import { ElectronAPI } from "@electron-toolkit/preload";

interface ElementSelector {
  css?: string;
  xpath?: string;
  text?: string;
  id?: string;
  name?: string;
}

interface TabAPI {
  // Recorder functionality
  recordAction: (
    type: string,
    selector: ElementSelector,
    value?: string,
    isContentField?: boolean,
    contentPlaceholder?: string,
  ) => Promise<{ success: boolean; error?: string }>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    tabAPI: TabAPI;
  }
}
