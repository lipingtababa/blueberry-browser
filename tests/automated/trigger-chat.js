#!/usr/bin/env node
/**
 * Programmatic Chat Trigger
 *
 * This script programmatically triggers chat messages in a running Blueberry Browser
 * instance by directly invoking IPC handlers.
 *
 * This is meant to be run as a separate process that communicates with the main app.
 *
 * Usage:
 *   node tests/automated/trigger-chat.js "Your message here"
 *   node tests/automated/trigger-chat.js --auto  (runs automated tests)
 */

const fs = require('fs')
const path = require('path')

const TEST_MESSAGES = [
  'Hello, this is an automated test message',
  'Can you help me understand how this works?',
  'What is the weather like today?',
  'Tell me a joke',
  'Explain quantum computing in simple terms',
]

class ChatTrigger {
  constructor(options = {}) {
    this.logFile = '/tmp/blueberry/chat-trigger.log'
    this.resultDir = '/tmp/blueberry/results'
    this.verifyUI = options.verifyUI || false
    this.setupLogging()
    this.setupResultDir()
  }

  setupLogging() {
    const logDir = '/tmp/blueberry'
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true })
    }

    if (fs.existsSync(this.logFile)) {
      // Append to existing log
      this.log('\n' + '='.repeat(60))
    }
  }

  setupResultDir() {
    if (!fs.existsSync(this.resultDir)) {
      fs.mkdirSync(this.resultDir, { recursive: true })
    }
  }

  log(message) {
    const timestamp = new Date().toISOString()
    const logMessage = `[${timestamp}] ${message}\n`
    console.log(message)
    fs.appendFileSync(this.logFile, logMessage)
  }

  /**
   * Creates a test file that the Electron app can watch and process
   */
  triggerMessage(message) {
    this.log(`🚀 Triggering message: "${message}"`)

    const triggerDir = '/tmp/blueberry/triggers'
    if (!fs.existsSync(triggerDir)) {
      fs.mkdirSync(triggerDir, { recursive: true })
    }

    // Create a trigger file with the message
    const triggerId = Date.now()
    const triggerFile = path.join(triggerDir, `chat-${triggerId}.json`)
    const messageId = `trigger-${triggerId}`

    const triggerData = {
      type: 'chat-message',
      message: message,
      messageId: messageId,
      timestamp: triggerId,
      verifyUI: this.verifyUI
    }

    fs.writeFileSync(triggerFile, JSON.stringify(triggerData, null, 2))

    this.log(`  ✅ Trigger file created: ${triggerFile}`)
    this.log(`  📝 Message ID: ${messageId}`)
    if (this.verifyUI) {
      this.log(`  🔍 UI verification enabled`)
    }

    return { triggerId, messageId }
  }

  /**
   * Wait for and read verification result
   */
  async waitForVerificationResult(messageId, timeout = 10000) {
    const resultFile = path.join(this.resultDir, `${messageId}.json`)
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      if (fs.existsSync(resultFile)) {
        const content = fs.readFileSync(resultFile, 'utf-8')
        const result = JSON.parse(content)
        return result
      }
      await this.sleep(500)
    }

    return null
  }

  async runAutomatedTests() {
    this.log('='.repeat(60))
    this.log('🧪 Automated Chat Trigger Test')
    if (this.verifyUI) {
      this.log('   WITH UI VERIFICATION')
    }
    this.log('='.repeat(60))
    this.log('')
    this.log('This will create trigger files that the app can process.')
    this.log('Make sure you have modified the app to watch for these triggers.')
    this.log('')

    let passedTests = 0
    let failedTests = 0

    for (let i = 0; i < TEST_MESSAGES.length; i++) {
      const message = TEST_MESSAGES[i]
      this.log(`\nTest ${i + 1}/${TEST_MESSAGES.length}`)
      this.log('-'.repeat(40))

      const { messageId } = this.triggerMessage(message)

      // If UI verification enabled, wait for result
      if (this.verifyUI) {
        this.log(`  ⏳ Waiting for UI verification result...`)
        const result = await this.waitForVerificationResult(messageId)

        if (result) {
          if (result.success) {
            this.log(`  ✅ UI VERIFICATION PASSED`)
            if (result.data && result.data.total !== undefined) {
              this.log(`     Messages in UI: ${result.data.total} (${result.data.user} user, ${result.data.assistant} assistant)`)
            }
            passedTests++
          } else {
            this.log(`  ❌ UI VERIFICATION FAILED: ${result.message}`)
            failedTests++
          }
        } else {
          this.log(`  ❌ UI VERIFICATION TIMEOUT: No result received`)
          failedTests++
        }
      }

      // Wait between messages
      this.log(`  ⏳ Waiting 3 seconds before next message...`)
      await this.sleep(3000)
    }

    this.log('\n' + '='.repeat(60))
    this.log('✅ All test messages triggered')
    if (this.verifyUI) {
      this.log(`\nTest Results:`)
      this.log(`  ✅ Passed: ${passedTests}`)
      this.log(`  ❌ Failed: ${failedTests}`)
      this.log(`  📊 Total:  ${TEST_MESSAGES.length}`)
    }
    this.log('='.repeat(60))
    this.log(`\nLog file: ${this.logFile}`)
    this.log('Trigger directory: /tmp/blueberry/triggers')
    if (this.verifyUI) {
      this.log('Result directory: /tmp/blueberry/results')
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log('Usage:')
    console.log('  node trigger-chat.js "Your message here"       - Send a single message')
    console.log('  node trigger-chat.js --auto                     - Run automated tests')
    console.log('  node trigger-chat.js --auto --verify            - Run automated tests with UI verification')
    console.log('  node trigger-chat.js --verify "Your message"    - Send message and verify UI')
    console.log('  node trigger-chat.js --help                     - Show this help')
    process.exit(0)
  }

  // Check for --verify flag
  const verifyUI = args.includes('--verify')
  const filteredArgs = args.filter(arg => arg !== '--verify')

  const trigger = new ChatTrigger({ verifyUI })

  if (filteredArgs[0] === '--auto') {
    await trigger.runAutomatedTests()
  } else {
    const message = filteredArgs.join(' ')
    const { messageId } = trigger.triggerMessage(message)

    // If verification enabled, wait for result
    if (verifyUI) {
      console.log('⏳ Waiting for UI verification result...')
      const result = await trigger.waitForVerificationResult(messageId)

      if (result) {
        if (result.success) {
          console.log('✅ UI VERIFICATION PASSED')
          if (result.data) {
            console.log(`   Messages in UI: ${result.data.total} (${result.data.user} user, ${result.data.assistant} assistant)`)
          }
        } else {
          console.log(`❌ UI VERIFICATION FAILED: ${result.message}`)
          process.exit(1)
        }
      } else {
        console.log('❌ UI VERIFICATION TIMEOUT')
        process.exit(1)
      }
    }
  }
}

main().catch(error => {
  console.error('Error:', error)
  process.exit(1)
})
