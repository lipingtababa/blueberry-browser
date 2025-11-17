import { app, BrowserWindow } from "electron";
import { electronApp } from "@electron-toolkit/utils";
import { Window } from "./Window";
import { AppMenu } from "./Menu";
import { EventManager } from "./EventManager";
import { TestTriggerWatcher } from "../../tests/automated/test-trigger-watcher";
import * as fs from "fs";
import * as path from "path";

// Setup logging to file
const logDir = "/tmp/blueberry";
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}
const logFile = path.join(logDir, "console.log");
const logStream = fs.createWriteStream(logFile, { flags: "a" });

const originalConsoleLog = console.log;
const originalConsoleError = console.error;

console.log = (...args: any[]) => {
  const timestamp = new Date().toISOString();
  const message = `[${timestamp}] ${args.join(" ")}\n`;
  logStream.write(message);
  originalConsoleLog(...args);
};

console.error = (...args: any[]) => {
  const timestamp = new Date().toISOString();
  const message = `[${timestamp}] ERROR: ${args.join(" ")}\n`;
  logStream.write(message);
  originalConsoleError(...args);
};

console.log("📝 Logging to:", logFile);

let mainWindow: Window | null = null;
let eventManager: EventManager | null = null;
let menu: AppMenu | null = null;
let testWatcher: TestTriggerWatcher | null = null;

const createWindow = (): Window => {
  const window = new Window();
  menu = new AppMenu(window);
  eventManager = new EventManager(window);
  return window;
};

app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.electron");

  mainWindow = createWindow();

  // Enable automated testing if requested
  if (process.env.ENABLE_TEST_TRIGGERS === 'true') {
    console.log('🧪 Automated testing enabled');
    testWatcher = new TestTriggerWatcher(mainWindow);
    testWatcher.start();

    // Send a test message after 5 seconds to verify everything works
    setTimeout(() => {
      console.log('🚀 Sending startup test message...');
      testWatcher?.triggerTestMessage('Automated test: Application started successfully');
    }, 5000);
  }

  app.on("activate", () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (testWatcher) {
    testWatcher.stop();
    testWatcher = null;
  }

  if (eventManager) {
    eventManager.cleanup();
    eventManager = null;
  }

  // Clean up references
  if (mainWindow) {
    mainWindow = null;
  }
  if (menu) {
    menu = null;
  }

  if (process.platform !== "darwin") {
    app.quit();
  }
});
