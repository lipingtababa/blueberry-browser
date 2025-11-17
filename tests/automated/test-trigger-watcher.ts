/**
 * Test Trigger Watcher
 *
 * This module watches for test trigger files and automatically processes them.
 * Import this in the main Electron process to enable automated testing.
 *
 * Usage in src/main/index.ts:
 *   import { TestTriggerWatcher } from '../tests/automated/test-trigger-watcher'
 *   if (process.env.ENABLE_TEST_TRIGGERS === 'true') {
 *     const watcher = new TestTriggerWatcher(mainWindow)
 *     watcher.start()
 *   }
 */

import * as fs from 'fs'
import * as path from 'path'
import type { Window } from '../../src/main/Window'

export interface TriggerData {
  type: 'chat-message' | 'recorder-action'
  message: string
  messageId: string
  timestamp: number
  verifyUI?: boolean // If true, verify UI after sending message
}

export class TestTriggerWatcher {
  private window: Window
  private triggerDir = '/tmp/blueberry/triggers'
  private resultDir = '/tmp/blueberry/results'
  private processedTriggers = new Set<string>()
  private watchInterval: NodeJS.Timeout | null = null
  private isRunning = false

  constructor(window: Window) {
    this.window = window
    this.ensureTriggerDir()
    this.ensureResultDir()
  }

  private ensureResultDir() {
    if (!fs.existsSync(this.resultDir)) {
      fs.mkdirSync(this.resultDir, { recursive: true })
      console.log(`📁 [TEST WATCHER] Created result directory: ${this.resultDir}`)
    }
  }

  private ensureTriggerDir() {
    if (!fs.existsSync(this.triggerDir)) {
      fs.mkdirSync(this.triggerDir, { recursive: true })
      console.log(`📁 [TEST WATCHER] Created trigger directory: ${this.triggerDir}`)
    }
  }

  start() {
    if (this.isRunning) {
      console.log('⚠️  [TEST WATCHER] Already running')
      return
    }

    console.log('👀 [TEST WATCHER] Starting trigger watcher...')
    console.log(`   Watching: ${this.triggerDir}`)

    this.isRunning = true

    // Check for triggers every 500ms
    this.watchInterval = setInterval(() => {
      this.checkForTriggers()
    }, 500)

    console.log('✅ [TEST WATCHER] Trigger watcher started')
  }

  stop() {
    if (!this.isRunning) {
      return
    }

    console.log('🛑 [TEST WATCHER] Stopping trigger watcher...')

    if (this.watchInterval) {
      clearInterval(this.watchInterval)
      this.watchInterval = null
    }

    this.isRunning = false
    console.log('✅ [TEST WATCHER] Trigger watcher stopped')
  }

  private checkForTriggers() {
    try {
      const files = fs.readdirSync(this.triggerDir)

      // Filter for unprocessed trigger files
      const triggerFiles = files.filter(file => {
        return file.startsWith('chat-') &&
               file.endsWith('.json') &&
               !this.processedTriggers.has(file)
      })

      if (triggerFiles.length > 0) {
        console.log(`📨 [TEST WATCHER] Found ${triggerFiles.length} new trigger(s)`)
      }

      triggerFiles.forEach(file => {
        this.processTriggerFile(file)
      })

    } catch (error) {
      console.error('❌ [TEST WATCHER] Error checking triggers:', error)
    }
  }

  private processTriggerFile(filename: string) {
    const filePath = path.join(this.triggerDir, filename)

    try {
      console.log(`📝 [TEST WATCHER] Processing: ${filename}`)

      // Read trigger data
      const content = fs.readFileSync(filePath, 'utf-8')
      const trigger: TriggerData = JSON.parse(content)

      // Validate trigger
      if (trigger.type !== 'chat-message') {
        console.log(`  ⚠️  Unknown trigger type: ${trigger.type}`)
        return
      }

      // Process the trigger
      this.processChatMessage(trigger)

      // Mark as processed
      this.processedTriggers.add(filename)

      // Optionally delete the trigger file
      fs.unlinkSync(filePath)
      console.log(`  ✅ Trigger processed and deleted`)

    } catch (error) {
      console.error(`  ❌ Error processing trigger ${filename}:`, error)
    }
  }

  private async processChatMessage(trigger: TriggerData) {
    try {
      console.log(`💬 [TEST WATCHER] Sending chat message: "${trigger.message}"`)

      // Send the message through the LLM client
      await this.window.sidebar.client.sendChatMessage({
        message: trigger.message,
        messageId: trigger.messageId,
      })

      console.log(`  ✅ Message sent with ID: ${trigger.messageId}`)

      // If UI verification requested, verify after a delay
      if (trigger.verifyUI) {
        console.log(`  🔍 UI verification requested, waiting 2s for UI to update...`)
        await this.sleep(2000)
        await this.verifyMessageInUI(trigger.messageId)
      }

    } catch (error) {
      console.error(`  ❌ Error sending message:`, error)
      // Write error result
      if (trigger.verifyUI) {
        this.writeVerificationResult(trigger.messageId, false, `Error: ${error}`)
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private async verifyMessageInUI(messageId: string): Promise<void> {
    try {
      // Execute JavaScript in the sidebar renderer to check if message exists
      const script = `
        (() => {
          const userMessage = document.querySelector('[data-message-id="${messageId}"]');
          if (!userMessage) {
            return { exists: false, reason: 'Message not found in DOM' };
          }

          const role = userMessage.getAttribute('data-message-role');
          const hasContent = userMessage.textContent.trim().length > 0;

          // Also count all messages to provide context
          const allMessages = document.querySelectorAll('[data-message-role]');
          const userMessages = document.querySelectorAll('[data-message-role="user"]');
          const assistantMessages = document.querySelectorAll('[data-message-role="assistant"]');

          return {
            exists: true,
            role,
            hasContent,
            messageCount: {
              total: allMessages.length,
              user: userMessages.length,
              assistant: assistantMessages.length
            }
          };
        })()
      `

      const result = await this.window.sidebar.view.webContents.executeJavaScript(script)

      if (!result.exists) {
        console.log(`  ❌ UI Verification FAILED: ${result.reason}`)
        this.writeVerificationResult(messageId, false, result.reason)
        return
      }

      if (!result.hasContent) {
        console.log(`  ❌ UI Verification FAILED: Message has no content`)
        this.writeVerificationResult(messageId, false, 'Message has no content')
        return
      }

      console.log(`  ✅ UI Verification PASSED: Message found (role: ${result.role})`)
      console.log(`     Total messages in UI: ${result.messageCount.total} (${result.messageCount.user} user, ${result.messageCount.assistant} assistant)`)
      this.writeVerificationResult(messageId, true, 'Message found in UI', result.messageCount)

    } catch (error) {
      console.error(`  ❌ UI Verification ERROR:`, error)
      this.writeVerificationResult(messageId, false, `Verification error: ${error}`)
    }
  }

  private writeVerificationResult(messageId: string, success: boolean, message: string, data?: any) {
    const resultFile = path.join(this.resultDir, `${messageId}.json`)
    const result = {
      messageId,
      success,
      message,
      data,
      timestamp: Date.now()
    }

    fs.writeFileSync(resultFile, JSON.stringify(result, null, 2))
    console.log(`  📝 Verification result written to: ${resultFile}`)
  }

  // Utility method to manually trigger a test message
  async triggerTestMessage(message: string) {
    const trigger: TriggerData = {
      type: 'chat-message',
      message,
      messageId: `manual-${Date.now()}`,
      timestamp: Date.now(),
    }

    console.log(`🚀 [TEST WATCHER] Manual trigger: "${message}"`)
    await this.processChatMessage(trigger)
  }
}
