/**
 * SK Personality Tests
 * 
 * Tests the new natural conversation system.
 */

const { classifySocialIntent } = require('../src/agent/socialIntent');
const { validateResponse } = require('../src/agent/personaEngine');
const { filterResponse } = require('../src/agent/responseFilter');
const dialectMemory = require('../src/agent/dialectMemory');

console.log('═══════════════════════════════════════════════════════════════════');
console.log('SK PERSONALITY TEST SUITE');
console.log('═══════════════════════════════════════════════════════════════════\n');

// ── TEST 1: Social Intent Classification ──────────────────────────────────────────

console.log('TEST 1: Social Intent Classification');
console.log('─────────────────────────────────────');

const intentTests = [
  { input: '🙂', expected: 'NO_REPLY_NEEDED', desc: 'Smiley emoji' },
  { input: 'br', expected: 'ACK', desc: 'Short acknowledgement' },
  { input: 'Pgl ahes tu👀🤣', expected: 'TEASE', desc: 'Teasing message' },
  { input: 'Ha tuzya sarkha', expected: 'CONTINUATION', desc: 'Continuation' },
  { input: '🙄', expected: 'NO_REPLY_NEEDED', desc: 'Eye roll emoji' },
  { input: '🤣', expected: 'NO_REPLY_NEEDED', desc: 'Laughing emoji' },
  { input: 'Tujh kay suru aahe', expected: 'CASUAL_QUESTION', desc: 'Casual question' },
  { input: 'Kay', expected: 'CLARIFICATION', desc: 'What (after previous message)' },
  { input: 'Hmm', expected: 'FILLER', desc: 'Filler' },
  { input: 'manje', expected: 'CLARIFICATION', desc: 'Meaning clarification' },
  { input: 'Hi', expected: 'GREETING', desc: 'Greeting' },
  { input: '..', expected: 'CONVERSATION_ENDING', desc: 'Conversation ender' },
];

let passedIntents = 0;
for (const test of intentTests) {
  const result = classifySocialIntent(test.input, {
    previousMessage: 'Some previous context',
    previousSenderRole: 'assistant',
    messageCount: 3,
  });
  
  const passed = result.intent === test.expected;
  console.log(`${passed ? '✅' : '❌'} ${test.desc}`);
  console.log(`   Input: "${test.input}"`);
  console.log(`   Expected: ${test.expected}`);
  console.log(`   Got: ${result.intent} (mode: ${result.replyMode}, should reply: ${result.shouldReply})`);
  console.log();
  
  if (passed) passedIntents++;
}

console.log(`Intent Classification: ${passedIntents}/${intentTests.length} passed\n`);

// ── TEST 2: Response Validation ──────────────────────────────────────────────────

console.log('TEST 2: Response Validation (Anti-Chatbot)');
console.log('───────────────────────────────────────────');

const validationTests = [
  {
    input: '🙂',
    response: 'हसू पाहून छान वाटलं! आधी थोडी ताणली होतास...',
    shouldFail: true,
    desc: 'Overly emotional to simple emoji',
  },
  {
    input: 'Pgl ahes tu',
    response: 'Pgl ahes tu! 😜🤣',
    shouldFail: true,
    desc: 'Echoing input',
  },
  {
    input: 'Kay',
    response: 'Kay vicharta ahes? How can I help?',
    shouldFail: true,
    desc: 'Contains chatbot language',
  },
  {
    input: 'Hi',
    response: 'Hey',
    shouldFail: false,
    desc: 'Natural short greeting',
  },
  {
    input: 'Tujh kay suru aahe',
    response: 'Kahi khas nh bhau 😂',
    shouldFail: false,
    desc: 'Natural casual response',
  },
];

let passedValidation = 0;
for (const test of validationTests) {
  const result = validateResponse(test.input, test.response);
  const failed = !result.valid;
  const passed = failed === test.shouldFail;
  
  console.log(`${passed ? '✅' : '❌'} ${test.desc}`);
  console.log(`   Input: "${test.input}"`);
  console.log(`   Response: "${test.response}"`);
  console.log(`   Valid: ${result.valid}, Issues: ${result.issues.join(', ') || 'none'}`);
  console.log();
  
  if (passed) passedValidation++;
}

console.log(`Response Validation: ${passedValidation}/${validationTests.length} passed\n`);

// ── TEST 3: Response Filter ──────────────────────────────────────────────────────

console.log('TEST 3: Response Filter');
console.log('───────────────────────');

const filterTests = [
  {
    input: 'kay',
    response: 'Reasoning Summary: User asking for clarification. Suggested Reply: Are kahi nh 😂',
    desc: 'Reasoning leaked',
  },
  {
    input: 'Tu suraj na!!!',
    response: 'Mi Suraj chi madat karat ahe. How can I help you today?',
    desc: 'Generic support language',
  },
  {
    input: 'br',
    response: 'Okay! What would you like to do? How can I assist? What are your plans?',
    desc: 'Excessive questions',
  },
];

let passedFilter = 0;
for (const test of filterTests) {
  const result = filterResponse(test.input, test.response);
  const passed = result.filtered && result.issues.length > 0;
  
  console.log(`${passed ? '✅' : '❌'} ${test.desc}`);
  console.log(`   Input: "${test.input}"`);
  console.log(`   Response: "${test.response}"`);
  console.log(`   Filtered: ${result.filtered}, Issues: ${result.issues.join(', ')}`);
  console.log(`   Should regenerate: ${result.shouldRegenerate}`);
  console.log();
  
  if (passed) passedFilter++;
}

console.log(`Response Filter: ${passedFilter}/${filterTests.length} passed\n`);

// ── TEST 4: Dialect Memory ──────────────────────────────────────────────────────

console.log('TEST 4: Dialect Memory');
console.log('──────────────────────');

const testChatId = 'test_12345';

// Test base dialect
const dialectTests = [
  { phrase: 'bati khaldo', expected: 'jevan kela ka / did you eat?', desc: 'Bati meaning' },
  { phrase: 'manje', expected: 'meaning / what do you mean', desc: 'Manje meaning' },
  { phrase: 'mg', expected: 'then / so', desc: 'Mg meaning' },
  { phrase: 'br', expected: 'ok / correct / barobar', desc: 'Br meaning' },
  { phrase: 'pgl', expected: 'pagal / mad / crazy', desc: 'Pgl meaning' },
];

let passedDialect = 0;
for (const test of dialectTests) {
  const result = dialectMemory.lookupPhrase(testChatId, test.phrase);
  const passed = result && result.meaning === test.expected;
  
  console.log(`${passed ? '✅' : '❌'} ${test.desc}`);
  console.log(`   Phrase: "${test.phrase}"`);
  console.log(`   Expected: ${test.expected}`);
  console.log(`   Got: ${result ? result.meaning : 'NOT FOUND'}`);
  console.log();
  
  if (passed) passedDialect++;
}

console.log(`Dialect Memory: ${passedDialect}/${dialectTests.length} passed\n`);

// ── TEST 5: Dialect Normalization ──────────────────────────────────────────────

console.log('TEST 5: Dialect Normalization');
console.log('──────────────────────────────');

const normalizationTests = [
  { input: 'Bati khaldo kai pgl', desc: 'Message with dialect phrase' },
  { input: 'Kay mg tu', desc: 'Multiple dialect words' },
  { input: 'Br ho na', desc: 'Acknowledgement with dialect' },
];

for (const test of normalizationTests) {
  const normalized = dialectMemory.normalizeWithDialect(testChatId, test.input);
  
  console.log(`✓ ${test.desc}`);
  console.log(`  Input: "${test.input}"`);
  console.log(`  Normalized: "${normalized}"`);
  console.log();
}

// ── SUMMARY ──────────────────────────────────────────────────────────────────

console.log('═══════════════════════════════════════════════════════════════════');
console.log('SUMMARY');
console.log('═══════════════════════════════════════════════════════════════════');

const totalTests = intentTests.length + validationTests.length + filterTests.length + dialectTests.length;
const totalPassed = passedIntents + passedValidation + passedFilter + passedDialect;

console.log(`Total: ${totalPassed}/${totalTests} tests passed (${Math.round(totalPassed/totalTests*100)}%)`);
console.log();

if (totalPassed === totalTests) {
  console.log('✅ ALL TESTS PASSED!');
} else {
  console.log(`⚠️  ${totalTests - totalPassed} tests failed`);
}

console.log();
