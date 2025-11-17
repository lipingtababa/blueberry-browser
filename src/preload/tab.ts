import { contextBridge } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

// Tab-specific APIs for recorder functionality
const tabAPI = {
  // Recorder - called by injected recorder script in web pages
  recordAction: (
    type: string,
    selector: any,
    value?: string,
    isContentField?: boolean,
    contentPlaceholder?: string
  ) =>
    electronAPI.ipcRenderer.invoke(
      "recorder-record-action",
      type,
      selector,
      value,
      isContentField,
      contentPlaceholder
    ),
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("tabAPI", tabAPI);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.tabAPI = tabAPI;
}
