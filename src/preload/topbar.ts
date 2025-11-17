import { contextBridge } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

// TopBar specific APIs
const topBarAPI = {
  // Tab management
  createTab: (url?: string) =>
    electronAPI.ipcRenderer.invoke("create-tab", url),
  closeTab: (tabId: string) =>
    electronAPI.ipcRenderer.invoke("close-tab", tabId),
  switchTab: (tabId: string) =>
    electronAPI.ipcRenderer.invoke("switch-tab", tabId),
  getTabs: () => electronAPI.ipcRenderer.invoke("get-tabs"),

  // Tab navigation
  navigateTab: (tabId: string, url: string) =>
    electronAPI.ipcRenderer.invoke("navigate-tab", tabId, url),
  goBack: (tabId: string) =>
    electronAPI.ipcRenderer.invoke("tab-go-back", tabId),
  goForward: (tabId: string) =>
    electronAPI.ipcRenderer.invoke("tab-go-forward", tabId),
  reload: (tabId: string) =>
    electronAPI.ipcRenderer.invoke("tab-reload", tabId),

  // Tab actions
  tabScreenshot: (tabId: string) =>
    electronAPI.ipcRenderer.invoke("tab-screenshot", tabId),
  tabRunJs: (tabId: string, code: string) =>
    electronAPI.ipcRenderer.invoke("tab-run-js", tabId, code),

  // Sidebar
  toggleSidebar: () =>
    electronAPI.ipcRenderer.invoke("toggle-sidebar"),
  showRecordingsList: () =>
    electronAPI.ipcRenderer.invoke("show-recordings-list"),

  // Recorder
  recorderStart: (name: string, description?: string) =>
    electronAPI.ipcRenderer.invoke("recorder-start", name, description),
  recorderStop: () =>
    electronAPI.ipcRenderer.invoke("recorder-stop"),
  recorderPause: () =>
    electronAPI.ipcRenderer.invoke("recorder-pause"),
  recorderResume: () =>
    electronAPI.ipcRenderer.invoke("recorder-resume"),
  recorderAddManualStep: (description: string) =>
    electronAPI.ipcRenderer.invoke("recorder-add-manual-step", description),
  recorderGetState: () =>
    electronAPI.ipcRenderer.invoke("recorder-get-state"),
  recorderGetRecordings: () =>
    electronAPI.ipcRenderer.invoke("recorder-get-recordings"),
  recorderGetRecording: (id: string) =>
    electronAPI.ipcRenderer.invoke("recorder-get-recording", id),
  recorderDeleteRecording: (id: string) =>
    electronAPI.ipcRenderer.invoke("recorder-delete-recording", id),

  // Replayer
  replayerStart: (options: any) =>
    electronAPI.ipcRenderer.invoke("replayer-start", options),
  replayerPause: () =>
    electronAPI.ipcRenderer.invoke("replayer-pause"),
  replayerResume: () =>
    electronAPI.ipcRenderer.invoke("replayer-resume"),
  replayerStop: () =>
    electronAPI.ipcRenderer.invoke("replayer-stop"),
  replayerGetStatus: () =>
    electronAPI.ipcRenderer.invoke("replayer-get-status"),

  // Session Manager
  sessionSave: (domain: string, name?: string) =>
    electronAPI.ipcRenderer.invoke("session-save", domain, name),
  sessionRestore: (domain: string, name?: string) =>
    electronAPI.ipcRenderer.invoke("session-restore", domain, name),
  sessionHasValid: (domain: string, name?: string) =>
    electronAPI.ipcRenderer.invoke("session-has-valid", domain, name),
  sessionDelete: (domain: string, name?: string) =>
    electronAPI.ipcRenderer.invoke("session-delete", domain, name),
  sessionList: () =>
    electronAPI.ipcRenderer.invoke("session-list"),
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("topBarAPI", topBarAPI);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.topBarAPI = topBarAPI;
}

