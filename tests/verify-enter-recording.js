#!/usr/bin/env node

/**
 * Verify that Enter keystroke recording works
 * This checks the most recent recording for keypress actions
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const recordingsDir = path.join(
  os.homedir(),
  'Library/Application Support/blueberry-browser/recordings'
);

console.log('🔍 Checking recordings directory:', recordingsDir);

if (!fs.existsSync(recordingsDir)) {
  console.error('❌ Recordings directory does not exist!');
  process.exit(1);
}

// Get all recording files
const files = fs.readdirSync(recordingsDir)
  .filter(f => f.endsWith('.json'))
  .map(f => ({
    name: f,
    path: path.join(recordingsDir, f),
    mtime: fs.statSync(path.join(recordingsDir, f)).mtime
  }))
  .sort((a, b) => b.mtime - a.mtime); // Sort by most recent first

console.log(`📁 Found ${files.length} recording(s)`);

if (files.length === 0) {
  console.log('ℹ️  No recordings found. Please create a recording first.');
  process.exit(0);
}

// Analyze most recent recording
const mostRecent = files[0];
console.log(`\n📝 Most recent recording: ${mostRecent.name}`);
console.log(`   Modified: ${mostRecent.mtime.toISOString()}`);

const recording = JSON.parse(fs.readFileSync(mostRecent.path, 'utf8'));

console.log(`   Name: ${recording.name}`);
console.log(`   Created: ${new Date(recording.createdAt).toISOString()}`);
console.log(`   Total actions: ${recording.actions.length}`);

// Check for keypress actions
const keypressActions = recording.actions.filter(a => a.type === 'keypress');

console.log(`\n🔍 Keypress actions: ${keypressActions.length}`);

if (keypressActions.length === 0) {
  console.log('\n⚠️  WARNING: No keypress actions found in the most recent recording!');
  console.log('   This could mean:');
  console.log('   1. The recording did not include pressing Enter/Escape/Tab');
  console.log('   2. The keypress recording is not working');
  console.log('\n   Action types in this recording:');
  const actionTypes = [...new Set(recording.actions.map(a => a.type))];
  actionTypes.forEach(type => {
    const count = recording.actions.filter(a => a.type === type).length;
    console.log(`   - ${type}: ${count}`);
  });
} else {
  console.log('\n✅ SUCCESS: Keypress recording is working!');
  console.log('\nKeypress details:');
  keypressActions.forEach((action, i) => {
    try {
      const keyInfo = JSON.parse(action.value);
      console.log(`\n   Keypress ${i + 1}:`);
      console.log(`     Key: ${keyInfo.key}`);
      console.log(`     Code: ${keyInfo.code}`);
      console.log(`     Modifiers: ${[
        keyInfo.ctrlKey && 'Ctrl',
        keyInfo.shiftKey && 'Shift',
        keyInfo.altKey && 'Alt',
        keyInfo.metaKey && 'Meta'
      ].filter(Boolean).join('+') || 'None'}`);
      console.log(`     Element: ${action.selector.css || action.selector.xpath}`);
      console.log(`     Timestamp: ${new Date(action.timestamp).toISOString()}`);
    } catch (e) {
      console.log(`   Keypress ${i + 1}: ${action.value}`);
    }
  });

  // Check specifically for Enter key
  const enterActions = keypressActions.filter(a => {
    try {
      const keyInfo = JSON.parse(a.value);
      return keyInfo.key === 'Enter';
    } catch {
      return false;
    }
  });

  if (enterActions.length > 0) {
    console.log(`\n🎯 Found ${enterActions.length} Enter key press(es) - TEST PASSED!`);
  } else {
    console.log(`\n⚠️  No Enter keys found (only ${keypressActions.map(a => JSON.parse(a.value).key).join(', ')})`);
  }
}

console.log('\n' + '='.repeat(60));
console.log('Full recording saved at:', mostRecent.path);
