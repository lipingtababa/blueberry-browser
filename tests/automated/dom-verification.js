/**
 * DOM Verification Helper for Blueberry Browser Testing
 *
 * Provides utilities to verify UI state in the Electron renderer process
 * using BrowserWindow.webContents.executeJavaScript()
 */

const fs = require('fs')
const path = require('path')

const LOG_FILE = '/tmp/blueberry/dom-verification.log'

/**
 * Log helper
 */
function log(message) {
  const timestamp = new Date().toISOString()
  const logMessage = `[${timestamp}] ${message}\n`
  fs.appendFileSync(LOG_FILE, logMessage)
  console.log(logMessage.trim())
}

/**
 * Execute JavaScript in a browser window and return the result
 * @param {Electron.BrowserWindow} window - The browser window
 * @param {string} script - JavaScript code to execute
 * @returns {Promise<any>} Result of the script execution
 */
async function executeInWindow(window, script) {
  try {
    const result = await window.webContents.executeJavaScript(script)
    return { success: true, result }
  } catch (error) {
    log(`ERROR executing script: ${error.message}`)
    return { success: false, error: error.message }
  }
}

/**
 * Count messages in the chat UI
 * @param {Electron.BrowserWindow} window - The sidebar window
 * @returns {Promise<{user: number, assistant: number, total: number}>}
 */
async function countMessages(window) {
  const script = `
    (() => {
      const userMessages = document.querySelectorAll('[data-message-role="user"]');
      const assistantMessages = document.querySelectorAll('[data-message-role="assistant"]');
      return {
        user: userMessages.length,
        assistant: assistantMessages.length,
        total: userMessages.length + assistantMessages.length
      };
    })()
  `

  const response = await executeInWindow(window, script)
  if (response.success) {
    log(`Message count: ${JSON.stringify(response.result)}`)
    return response.result
  }
  return { user: 0, assistant: 0, total: 0 }
}

/**
 * Get all message IDs from the DOM
 * @param {Electron.BrowserWindow} window - The sidebar window
 * @returns {Promise<Array<{role: string, id: string}>>}
 */
async function getMessageIds(window) {
  const script = `
    (() => {
      const messages = document.querySelectorAll('[data-message-role]');
      return Array.from(messages).map(msg => ({
        role: msg.getAttribute('data-message-role'),
        id: msg.getAttribute('data-message-id')
      }));
    })()
  `

  const response = await executeInWindow(window, script)
  if (response.success) {
    log(`Found ${response.result.length} messages in DOM`)
    return response.result
  }
  return []
}

/**
 * Verify that a specific message exists in the DOM
 * @param {Electron.BrowserWindow} window - The sidebar window
 * @param {string} messageId - The message ID to look for
 * @param {string} expectedRole - Expected role ('user' or 'assistant')
 * @returns {Promise<boolean>}
 */
async function verifyMessageExists(window, messageId, expectedRole) {
  const script = `
    (() => {
      const message = document.querySelector('[data-message-id="${messageId}"]');
      if (!message) return { exists: false };

      return {
        exists: true,
        role: message.getAttribute('data-message-role'),
        hasContent: message.textContent.trim().length > 0
      };
    })()
  `

  const response = await executeInWindow(window, script)
  if (!response.success || !response.result.exists) {
    log(`❌ Message ${messageId} not found in DOM`)
    return false
  }

  if (response.result.role !== expectedRole) {
    log(`❌ Message ${messageId} has wrong role: ${response.result.role} (expected: ${expectedRole})`)
    return false
  }

  if (!response.result.hasContent) {
    log(`❌ Message ${messageId} has no content`)
    return false
  }

  log(`✅ Message ${messageId} verified (role: ${expectedRole}, has content)`)
  return true
}

/**
 * Get the text content of a specific message
 * @param {Electron.BrowserWindow} window - The sidebar window
 * @param {string} messageId - The message ID
 * @returns {Promise<string|null>}
 */
async function getMessageContent(window, messageId) {
  const script = `
    (() => {
      const message = document.querySelector('[data-message-id="${messageId}"]');
      return message ? message.textContent.trim() : null;
    })()
  `

  const response = await executeInWindow(window, script)
  if (response.success && response.result) {
    log(`Message ${messageId} content: "${response.result.substring(0, 50)}..."`)
    return response.result
  }
  return null
}

/**
 * Wait for a message to appear in the DOM
 * @param {Electron.BrowserWindow} window - The sidebar window
 * @param {string} messageId - The message ID to wait for
 * @param {number} timeout - Timeout in milliseconds (default: 10000)
 * @returns {Promise<boolean>}
 */
async function waitForMessage(window, messageId, timeout = 10000) {
  const startTime = Date.now()
  const checkInterval = 500

  log(`Waiting for message ${messageId} to appear (timeout: ${timeout}ms)...`)

  while (Date.now() - startTime < timeout) {
    const script = `
      (() => {
        const message = document.querySelector('[data-message-id="${messageId}"]');
        return message !== null;
      })()
    `

    const response = await executeInWindow(window, script)
    if (response.success && response.result === true) {
      log(`✅ Message ${messageId} appeared after ${Date.now() - startTime}ms`)
      return true
    }

    // Wait before next check
    await new Promise(resolve => setTimeout(resolve, checkInterval))
  }

  log(`❌ Message ${messageId} did not appear within ${timeout}ms`)
  return false
}

/**
 * Check if the loading indicator is visible
 * @param {Electron.BrowserWindow} window - The sidebar window
 * @returns {Promise<boolean>}
 */
async function isLoadingVisible(window) {
  const script = `
    (() => {
      // Look for loading indicator - it's a div with spinning star animation
      const loadingIndicator = document.querySelector('[class*="animate-spin"]');
      return loadingIndicator !== null;
    })()
  `

  const response = await executeInWindow(window, script)
  const isVisible = response.success && response.result === true
  log(`Loading indicator visible: ${isVisible}`)
  return isVisible
}

/**
 * Clear test logs
 */
function clearLogs() {
  if (fs.existsSync(LOG_FILE)) {
    fs.unlinkSync(LOG_FILE)
  }
  log('DOM verification logs cleared')
}

module.exports = {
  log,
  executeInWindow,
  countMessages,
  getMessageIds,
  verifyMessageExists,
  getMessageContent,
  waitForMessage,
  isLoadingVisible,
  clearLogs
}
