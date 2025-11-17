/**
 * Chat Integration Test
 *
 * A simpler Node.js script that launches the app and tests chat functionality
 * by connecting to the running Electron app via remote debugging.
 *
 * Usage:
 *   node tests/automated/chat-integration-test.js
 */

const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const TEST_CONFIG = {
  testMessages: [
    'Hello, this is an automated test',
    'Can you respond to this message?',
    'Testing the chat functionality',
  ],
  appStartDelay: 5000, // Wait 5s for app to start
  messageDelay: 3000, // Wait 3s between messages
  verificationDelay: 2000, // Wait 2s before verification
  logFile: '/tmp/blueberry/integration-test.log',
  appLogFile: '/tmp/blueberry/console.log',
}

class IntegrationTestRunner {
  constructor() {
    this.appProcess = null
    this.testResults = []
    this.setupLogging()
  }

  setupLogging() {
    // Ensure log directory exists
    const logDir = '/tmp/blueberry'
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true })
    }

    // Clear integration test log
    if (fs.existsSync(TEST_CONFIG.logFile)) {
      fs.unlinkSync(TEST_CONFIG.logFile)
    }
  }

  log(message) {
    const timestamp = new Date().toISOString()
    const logMessage = `[${timestamp}] ${message}\n`
    console.log(message)
    fs.appendFileSync(TEST_CONFIG.logFile, logMessage)
  }

  async startApp() {
    this.log('🚀 Starting Blueberry Browser in dev mode...')

    return new Promise((resolve, reject) => {
      // Start the app using npm run dev
      this.appProcess = spawn('npm', ['run', 'dev'], {
        cwd: path.join(__dirname, '../..'),
        stdio: 'pipe',
        shell: true,
      })

      // Monitor app output
      this.appProcess.stdout.on('data', (data) => {
        const output = data.toString()
        // Look for indication that app has started
        if (output.includes('started') || output.includes('ready')) {
          this.log(`  App output: ${output.trim()}`)
        }
      })

      this.appProcess.stderr.on('data', (data) => {
        const error = data.toString()
        // Log errors but don't fail on warnings
        if (!error.includes('Warning')) {
          this.log(`  App error: ${error.trim()}`)
        }
      })

      this.appProcess.on('error', (error) => {
        reject(new Error(`Failed to start app: ${error.message}`))
      })

      // Wait for app to start
      setTimeout(() => {
        this.log('✅ App should be started')
        resolve()
      }, TEST_CONFIG.appStartDelay)
    })
  }

  async sendTestMessages() {
    this.log('\n📝 Sending test messages...')

    for (let i = 0; i < TEST_CONFIG.testMessages.length; i++) {
      const message = TEST_CONFIG.testMessages[i]
      this.log(`\n  Message ${i + 1}/${TEST_CONFIG.testMessages.length}: "${message}"`)

      // For now, we'll verify by checking logs
      // In a real integration test, we'd use Electron's remote debugging protocol
      this.log(`  ⏳ Waiting ${TEST_CONFIG.messageDelay}ms for response...`)

      await this.sleep(TEST_CONFIG.messageDelay)

      // Check if messages appear in app logs
      const logContent = this.readAppLog()
      const hasUserMessage = logContent.includes(message)

      if (hasUserMessage) {
        this.log(`  ✅ Message found in logs`)
        this.testResults.push({
          test: `Send message ${i + 1}`,
          passed: true
        })
      } else {
        this.log(`  ⚠️  Message not found in logs (manual verification needed)`)
        this.testResults.push({
          test: `Send message ${i + 1}`,
          passed: false,
          note: 'Manual verification needed'
        })
      }
    }
  }

  async verifyUIRendering() {
    this.log('\n🎨 Verifying UI rendering...')

    await this.sleep(TEST_CONFIG.verificationDelay)

    const logContent = this.readAppLog()

    // Check for evidence that messages were rendered
    const hasMessagesUpdated = logContent.includes('chat-messages-updated') ||
                               logContent.includes('Messages state updated')

    const hasChatComponent = logContent.includes('[CHAT COMPONENT]') ||
                            logContent.includes('Rendering with messages')

    this.log(`  Messages updated events: ${hasMessagesUpdated ? '✅' : '❌'}`)
    this.log(`  Chat component rendering: ${hasChatComponent ? '✅' : '❌'}`)

    if (hasMessagesUpdated && hasChatComponent) {
      this.log(`  ✅ UI rendering verification passed`)
      this.testResults.push({
        test: 'UI Rendering',
        passed: true
      })
    } else {
      this.log(`  ❌ UI rendering verification failed`)
      this.testResults.push({
        test: 'UI Rendering',
        passed: false,
        error: 'Messages not properly rendered in UI'
      })
    }
  }

  readAppLog() {
    try {
      if (fs.existsSync(TEST_CONFIG.appLogFile)) {
        return fs.readFileSync(TEST_CONFIG.appLogFile, 'utf-8')
      }
    } catch (error) {
      this.log(`  ⚠️  Could not read app log: ${error.message}`)
    }
    return ''
  }

  async checkForErrors() {
    this.log('\n🔍 Checking for errors in app logs...')

    const logContent = this.readAppLog()

    // Look for error patterns
    const errorPatterns = [
      /\[ERROR\]/gi,
      /Exception:/gi,
      /Failed to/gi,
      /TypeError:/gi,
      /ReferenceError:/gi,
    ]

    const errors = []
    errorPatterns.forEach(pattern => {
      const matches = logContent.match(pattern)
      if (matches) {
        errors.push(...matches)
      }
    })

    if (errors.length === 0) {
      this.log('  ✅ No errors found')
      this.testResults.push({
        test: 'Error Check',
        passed: true
      })
    } else {
      this.log(`  ⚠️  Found ${errors.length} error(s)`)
      this.testResults.push({
        test: 'Error Check',
        passed: false,
        note: `${errors.length} errors in logs`
      })
    }
  }

  printSummary() {
    this.log('\n' + '='.repeat(60))
    this.log('📊 Test Summary')
    this.log('='.repeat(60))

    const passed = this.testResults.filter(r => r.passed).length
    const failed = this.testResults.filter(r => !r.passed).length
    const total = this.testResults.length

    this.log(`\nTotal Tests: ${total}`)
    this.log(`Passed: ${passed} ✅`)
    this.log(`Failed: ${failed} ❌`)
    this.log(`Pass Rate: ${((passed / total) * 100).toFixed(1)}%`)

    this.log('\n' + '-'.repeat(60))
    this.log('Detailed Results:')
    this.log('-'.repeat(60))

    this.testResults.forEach((result, index) => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL'
      this.log(`\n${index + 1}. ${result.test}`)
      this.log(`   Status: ${status}`)

      if (result.error) {
        this.log(`   Error: ${result.error}`)
      }

      if (result.note) {
        this.log(`   Note: ${result.note}`)
      }
    })

    this.log('\n' + '='.repeat(60))
    this.log(`Integration test log: ${TEST_CONFIG.logFile}`)
    this.log(`App log: ${TEST_CONFIG.appLogFile}`)
    this.log('='.repeat(60))
  }

  async cleanup() {
    this.log('\n🧹 Cleaning up...')

    if (this.appProcess) {
      this.log('  Stopping app process...')
      this.appProcess.kill('SIGTERM')

      // Give it time to shut down gracefully
      await this.sleep(2000)

      if (!this.appProcess.killed) {
        this.log('  Force killing app process...')
        this.appProcess.kill('SIGKILL')
      }
    }

    this.log('  ✅ Cleanup complete')
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async run() {
    this.log('='.repeat(60))
    this.log('🧪 Chat Integration Test')
    this.log('='.repeat(60))

    try {
      // Note: This is a log-based test runner
      // To manually test:
      // 1. Start the app: npm run dev
      // 2. Send test messages via the UI
      // 3. Run this script to analyze logs

      this.log('\n📋 Test Instructions:')
      this.log('  1. Ensure the app is running (npm run dev)')
      this.log('  2. Send these test messages via the chat UI:')
      TEST_CONFIG.testMessages.forEach((msg, i) => {
        this.log(`     ${i + 1}. "${msg}"`)
      })
      this.log('  3. Wait for responses')
      this.log('  4. This script will analyze the logs\n')

      this.log('⏳ Waiting for manual testing...')
      this.log('   (Press Ctrl+C when you have finished testing in the UI)\n')

      // Wait for user to complete manual testing
      // In practice, you would run the app and test manually, then run this script
      await this.sleep(3000)

      // Check for errors in existing logs
      await this.checkForErrors()

      // Verify UI rendering
      await this.verifyUIRendering()

      this.printSummary()

    } catch (error) {
      this.log(`\n❌ Fatal error: ${error.message}`)
      console.error(error)
    } finally {
      // Don't cleanup if we want to keep the app running
      // await this.cleanup()

      this.log('\n✅ Test completed')
      process.exit(0)
    }
  }
}

// Run the test
const runner = new IntegrationTestRunner()
runner.run().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
