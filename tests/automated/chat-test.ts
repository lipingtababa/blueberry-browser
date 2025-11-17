/**
 * Automated Chat Test Script
 *
 * This script programmatically tests the chat functionality by:
 * 1. Launching the Blueberry Browser in test mode
 * 2. Sending chat messages via IPC
 * 3. Monitoring responses and UI updates
 * 4. Verifying messages are displayed correctly
 *
 * Usage:
 *   npm run test:chat
 */

import { app, BrowserWindow, ipcMain } from 'electron'
import * as fs from 'fs'

// Test configuration
const TEST_CONFIG = {
  testMessages: [
    'Hello, this is a test message',
    'Can you see this?',
    'Testing message display',
  ],
  timeout: 30000, // 30 seconds max per test
  verificationDelay: 2000, // Wait 2s after each message for UI updates
  logFile: '/tmp/blueberry/chat-test.log',
}

// Test results
interface TestResult {
  testName: string
  passed: boolean
  error?: string
  duration: number
  details?: any
}

const testResults: TestResult[] = []

// Logging utility
function log(message: string) {
  const timestamp = new Date().toISOString()
  const logMessage = `[${timestamp}] ${message}\n`
  console.log(message)

  // Ensure log directory exists
  const logDir = '/tmp/blueberry'
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true })
  }

  fs.appendFileSync(TEST_CONFIG.logFile, logMessage)
}

// Test runner
class ChatTestRunner {
  private mainWindow: BrowserWindow | null = null
  private messagesReceived: any[] = []

  async initialize() {
    log('🚀 Initializing Chat Test Runner')

    // Clear log file
    if (fs.existsSync(TEST_CONFIG.logFile)) {
      fs.unlinkSync(TEST_CONFIG.logFile)
    }

    await app.whenReady()

    // Create a minimal test window
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      show: true, // Show window for visual verification
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      }
    })

    // Set up IPC listeners to monitor chat activity
    this.setupIPCMonitoring()

    log('✅ Test window created')
  }

  private setupIPCMonitoring() {
    // Monitor chat messages being sent
    ipcMain.on('sidebar-chat-message', (_event, request) => {
      log(`📤 Chat message sent: ${request.message}`)
    })

    // Monitor chat-messages-updated events
    ipcMain.on('chat-messages-updated', (_event, messages) => {
      log(`📨 Chat messages updated - count: ${messages.length}`)
      this.messagesReceived = messages
    })

    // Monitor chat response events
    ipcMain.on('chat-response', (_event, data) => {
      log(`💬 Chat response: ${data.content.substring(0, 50)}...`)
    })
  }

  async testSendMessage(message: string): Promise<TestResult> {
    const startTime = Date.now()
    const testName = `Send message: "${message.substring(0, 30)}..."`

    log(`\n📝 Test: ${testName}`)

    try {
      // Generate a unique message ID
      const messageId = `test-${Date.now()}`

      // Send message via IPC (simulating the sidebar renderer process)
      const request = {
        message,
        messageId,
      }

      log(`  Sending message with ID: ${messageId}`)

      // Trigger the IPC handler directly
      ipcMain.emit('sidebar-chat-message', null, request)

      // Wait for response
      await this.waitForResponse(messageId)

      const duration = Date.now() - startTime
      log(`  ✅ Test passed in ${duration}ms`)

      return {
        testName,
        passed: true,
        duration,
        details: { messageId, messageLength: message.length }
      }

    } catch (error) {
      const duration = Date.now() - startTime
      log(`  ❌ Test failed: ${error}`)

      return {
        testName,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        duration,
      }
    }
  }

  private async waitForResponse(messageId: string): Promise<void> {
    const startTime = Date.now()
    const initialMessageCount = this.messagesReceived.length

    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        const elapsed = Date.now() - startTime

        // Check if we received new messages
        if (this.messagesReceived.length > initialMessageCount) {
          log(`  ✓ Received ${this.messagesReceived.length - initialMessageCount} new message(s)`)
          clearInterval(checkInterval)
          resolve()
          return
        }

        // Timeout
        if (elapsed > TEST_CONFIG.timeout) {
          clearInterval(checkInterval)
          reject(new Error(`Timeout waiting for response to ${messageId}`))
          return
        }
      }, 100) // Check every 100ms
    })
  }

  async testUIRendering(): Promise<TestResult> {
    const startTime = Date.now()
    const testName = 'Verify UI message rendering'

    log(`\n🎨 Test: ${testName}`)

    try {
      // Execute JavaScript in the renderer to count visible messages
      if (!this.mainWindow) {
        throw new Error('Main window not initialized')
      }

      // Wait a bit for React to render
      await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.verificationDelay))

      const messageCount = await this.mainWindow.webContents.executeJavaScript(`
        // Count message elements in the DOM
        document.querySelectorAll('[data-message-role]').length
      `)

      log(`  Found ${messageCount} message elements in DOM`)
      log(`  Expected at least ${this.messagesReceived.length} messages`)

      const duration = Date.now() - startTime

      if (messageCount >= this.messagesReceived.length) {
        log(`  ✅ UI rendering test passed`)
        return {
          testName,
          passed: true,
          duration,
          details: {
            domMessageCount: messageCount,
            receivedMessageCount: this.messagesReceived.length
          }
        }
      } else {
        throw new Error(
          `UI not displaying all messages. DOM: ${messageCount}, Expected: ${this.messagesReceived.length}`
        )
      }

    } catch (error) {
      const duration = Date.now() - startTime
      log(`  ❌ UI rendering test failed: ${error}`)

      return {
        testName,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        duration,
      }
    }
  }

  async runAllTests() {
    log('\n' + '='.repeat(60))
    log('🧪 Starting Automated Chat Tests')
    log('='.repeat(60))

    try {
      await this.initialize()

      // Test 1: Send multiple messages
      for (const message of TEST_CONFIG.testMessages) {
        const result = await this.testSendMessage(message)
        testResults.push(result)

        // Wait between messages
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      // Test 2: Verify UI rendering
      const uiResult = await this.testUIRendering()
      testResults.push(uiResult)

    } catch (error) {
      log(`\n❌ Fatal error during test execution: ${error}`)
    }

    this.printTestSummary()
  }

  private printTestSummary() {
    log('\n' + '='.repeat(60))
    log('📊 Test Summary')
    log('='.repeat(60))

    const passed = testResults.filter(r => r.passed).length
    const failed = testResults.filter(r => !r.passed).length
    const total = testResults.length

    log(`\nTotal Tests: ${total}`)
    log(`Passed: ${passed} ✅`)
    log(`Failed: ${failed} ❌`)
    log(`Pass Rate: ${((passed / total) * 100).toFixed(1)}%`)

    log('\n' + '-'.repeat(60))
    log('Detailed Results:')
    log('-'.repeat(60))

    testResults.forEach((result, index) => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL'
      log(`\n${index + 1}. ${result.testName}`)
      log(`   Status: ${status}`)
      log(`   Duration: ${result.duration}ms`)

      if (result.error) {
        log(`   Error: ${result.error}`)
      }

      if (result.details) {
        log(`   Details: ${JSON.stringify(result.details, null, 2)}`)
      }
    })

    log('\n' + '='.repeat(60))
    log(`Test log saved to: ${TEST_CONFIG.logFile}`)
    log('='.repeat(60))

    // Exit with appropriate code
    const exitCode = failed > 0 ? 1 : 0
    setTimeout(() => {
      app.quit()
      process.exit(exitCode)
    }, 1000)
  }
}

// Run tests when app is ready
const testRunner = new ChatTestRunner()

app.on('ready', async () => {
  await testRunner.runAllTests()
})

app.on('window-all-closed', () => {
  app.quit()
})
