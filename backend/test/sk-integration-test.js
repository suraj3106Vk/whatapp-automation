/**
 * SK Integration Test
 * 
 * Tests the complete message processing pipeline with real scenarios
 */

const skAgent = require('../src/agent/skAgent');
const memory = require('../src/memory/conversationMemory');

console.log('═══════════════════════════════════════════════════════════════════');
console.log('SK INTEGRATION TEST');
console.log('═══════════════════════════════════════════════════════════════════\n');

// Set owner config
skAgent.setOwnerConfig({
  name: 'Suraj Zalke',
  shortName: 'Suraj',
  number: '8554096571',
  chatId: '8554096571@s.whatsapp.net',
});

console.log('✓ Owner config set\n');

// Test scenarios
const scenarios = [
  {
    name: 'Owner Control - Stop',
    chatId: 'test_owner',
    fromNumber: '8554096571',
    message: 'stop',
    expectReply: true,
    expectPattern: /stopped|disabled/i,
  },
  {
    name: 'Message while stopped',
    chatId: 'test_user_1',
    fromNumber: '9876543210',
    message: 'Hi, how are you?',
    expectReply: false,
    expectNoReply: true,
  },
  {
    name: 'Owner Control - Start',
    chatId: 'test_owner',
    fromNumber: '8554096571',
    message: 'start',
    expectReply: true,
    expectPattern: /started|enabled/i,
  },
  {
    name: 'Simple acknowledgement',
    chatId: 'test_user_2',
    fromNumber: '9876543210',
    message: 'br',
    expectReply: false,
    expectNoReply: true,
  },
  {
    name: 'Emoji only',
    chatId: 'test_user_3',
    fromNumber: '9876543210',
    message: '👍',
    expectReply: false,
    expectNoReply: true,
  },
  {
    name: 'Time query (fast path)',
    chatId: 'test_user_4',
    fromNumber: '9876543210',
    message: 'kitne baje hain',
    expectReply: true,
    expectPattern: /\d{1,2}:\d{2}/,
  },
  {
    name: 'List tasks (fast path)',
    chatId: 'test_user_5',
    fromNumber: '9876543210',
    message: 'show my tasks',
    expectReply: true,
    expectPattern: /no tasks|tasks:/i,
  },
  {
    name: 'Owner Control - Status',
    chatId: 'test_owner',
    fromNumber: '8554096571',
    message: 'status',
    expectReply: true,
    expectPattern: /status|enabled|disabled/i,
  },
];

async function runScenarios() {
  let passed = 0;
  let failed = 0;
  
  for (const scenario of scenarios) {
    console.log(`\n${scenario.name}`);
    console.log('─'.repeat(60));
    console.log(`From: ${scenario.fromNumber}`);
    console.log(`Message: "${scenario.message}"`);
    
    try {
      const result = await skAgent.processMessage(
        scenario.chatId,
        'Test User',
        scenario.message,
        scenario.fromNumber
      );
      
      console.log(`Result: ${JSON.stringify({
        reply: result.reply,
        noReply: result.noReply,
        reason: result.reason,
        controlAction: result.controlAction,
      }, null, 2)}`);
      
      // Validate expectations
      let testPassed = true;
      let failReason = '';
      
      if (scenario.expectReply && !result.reply) {
        testPassed = false;
        failReason = 'Expected reply but got none';
      }
      
      if (scenario.expectNoReply && result.reply) {
        testPassed = false;
        failReason = 'Expected NO_REPLY but got reply';
      }
      
      if (scenario.expectPattern && result.reply && !scenario.expectPattern.test(result.reply)) {
        testPassed = false;
        failReason = `Reply doesn't match pattern: ${scenario.expectPattern}`;
      }
      
      if (testPassed) {
        console.log('✅ PASSED');
        passed++;
      } else {
        console.log(`❌ FAILED: ${failReason}`);
        failed++;
      }
      
    } catch (err) {
      console.log(`❌ ERROR: ${err.message}`);
      failed++;
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`Total: ${passed + failed}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);
  console.log(`Success rate: ${Math.round(passed / (passed + failed) * 100)}%`);
  console.log();
  
  if (failed === 0) {
    console.log('🎉 ALL INTEGRATION TESTS PASSED!');
  } else {
    console.log('⚠️  Some tests failed - check logs above');
  }
}

// Run tests
runScenarios().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
