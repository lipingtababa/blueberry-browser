/**
 * Test script to verify Enter keystroke recording
 * This runs in the browser's dev tools console
 */

async function testEnterRecording() {
  console.log('🧪 Starting Enter keystroke recording test...');

  // Wait for APIs to be available
  await new Promise(resolve => setTimeout(resolve, 1000));

  try {
    // Start recording
    console.log('1️⃣ Starting recording...');
    const startResult = await window.electron.ipcRenderer.invoke(
      'recorder-start',
      'Enter-Test-' + Date.now(),
      'Automated test for Enter keystroke'
    );

    if (!startResult.success) {
      throw new Error('Failed to start recording: ' + startResult.error);
    }
    console.log('✅ Recording started:', startResult.recording.id);

    // Wait for recorder script to inject
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Navigate to test page
    console.log('2️⃣ Navigating to test page...');
    await window.electron.ipcRenderer.invoke('navigate-to', 'file:///tmp/test-recorder.html');

    // Wait for page load
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('3️⃣ Test page loaded. Now manually:');
    console.log('   - Click in the input field');
    console.log('   - Type some text');
    console.log('   - Press ENTER');
    console.log('   - Wait 2 seconds');
    console.log('   - This script will stop recording automatically');

    // Wait for manual interaction
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Stop recording
    console.log('4️⃣ Stopping recording...');
    const stopResult = await window.electron.ipcRenderer.invoke('recorder-stop');

    if (!stopResult.success) {
      throw new Error('Failed to stop recording: ' + stopResult.error);
    }

    console.log('✅ Recording stopped');
    console.log('📊 Recording details:', stopResult.recording);
    console.log('📊 Total actions:', stopResult.recording.actions.length);

    // Check for keypress action
    const keypressActions = stopResult.recording.actions.filter(a => a.type === 'keypress');
    console.log('🔍 Keypress actions found:', keypressActions.length);

    if (keypressActions.length > 0) {
      console.log('✅ SUCCESS: Enter keypress was captured!');
      keypressActions.forEach((action, i) => {
        const keyInfo = JSON.parse(action.value);
        console.log(`   Keypress ${i + 1}:`, keyInfo);
      });
    } else {
      console.log('❌ FAILED: No keypress actions found');
      console.log('All actions:', stopResult.recording.actions.map(a => a.type));
    }

    return stopResult.recording;

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Auto-run if this is in the console
if (typeof window !== 'undefined' && window.electron) {
  console.log('Test function loaded. Run: testEnterRecording()');
}
