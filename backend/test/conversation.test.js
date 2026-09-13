const assert = require('node:assert/strict');
const test = require('node:test');

const { normalizeForReasoning, mergeMessages } = require('../src/agent/messageNormalizer');
const { classifyMessage, isAcknowledgement } = require('../src/agent/intentClassifier');
const state = require('../src/agent/conversationState');
const { buildConversationContext } = require('../src/agent/contextBuilder');
const memory = require('../src/memory/conversationMemory');
const { processMessage, runtimePrompt } = require('../src/agent/skAgent');
const consentGate = require('../src/agent/consentGate');

test('normalizes Roman Marathi without changing the original', () => {
  const original = 'tula ntr pathvte me ek vel srv college list krte brobr mg sang';
  assert.equal(normalizeForReasoning(original), 'tula nantar pathavte me ek vel sarv college list karte barobar mag sang');
  assert.equal(original, 'tula ntr pathvte me ek vel srv college list krte brobr mg sang');
});

test('normalizes direct Roman Marathi follow-ups for the LLM', () => {
  assert.equal(normalizeForReasoning('Bolav na tele kuth gela'), 'Bolav na tyala kuthe gela');
});

test('runtime prompt is compact and conversation-focused', () => {
  assert.match(runtimePrompt, /actually read the last message/);
  assert.match(runtimePrompt, /keep the conversation moving/);
  assert.doesNotMatch(runtimePrompt, /PATTERN A|RELATIONSHIP-SPECIFIC|Example:/i);
});

test('plain greetings do not inject unrelated food dialect hints', () => {
  const agent = require('../src/agent/skAgent');
  const prompt = agent.buildSystemPrompt();
  assert.doesNotMatch(prompt, /bati khaldo/);
});

test('classifies common WhatsApp fragments contextually', () => {
  assert.equal(classifyMessage('Br', 'Br'), 'ACKNOWLEDGEMENT');
  assert.equal(classifyMessage('Pathvlin', 'pathavlin'), 'PROMISE_FUTURE_ACTION');
  assert.equal(classifyMessage('11', '11', 'final merit list kadhi ahe'), 'ANSWER_TO_PREVIOUS');
  assert.equal(classifyMessage('Chukich sangte te', 'Chukich sangte te'), 'CORRECTION');
  assert.equal(isAcknowledgement('brr'), true);
});

test('stores college topic and exclusion state', () => {
  const chatId = 'conversation-state-test';
  state.resetState(chatId);
  state.updateState(chatId, { original: 'BSc Nursing Maharashtra college list', normalized: 'BSc Nursing Maharashtra college list' });
  state.updateState(chatId, { original: 'Akolyache kontech nko gheu', normalized: 'Akolyache kontech nko gheu' });
  const current = state.getState(chatId);
  assert.equal(current.course, 'BSc Nursing');
  assert.equal(current.region, 'Maharashtra');
  assert.deepEqual(current.excludedRegions, ['Akola']);
  state.resetState(chatId);
});

test('builds role-aware context with current contact message last', () => {
  const context = buildConversationContext([
    { role: 'owner', content: 'final merit list kadhi ahe' },
    { role: 'contact', content: '11' },
    { role: 'assistant', content: 'Ha brr' },
  ], { activeTopic: 'merit list', course: '', region: '', excludedRegions: [], pendingLists: [], lastOwnerQuestion: 'final merit list kadhi ahe', lastContactAnswer: '11' }, 'Br', 'Br');
  assert.match(context, /YOU \(Suraj\): final merit list kadhi ahe/);
  assert.match(context, /Current message as typed: "Br"/);
});

test('merges consecutive WhatsApp messages into one thought', () => {
  assert.equal(mergeMessages(['Aani college list', 'te ks kru t aata', 'seat matrix pn pahin']), 'Aani college list te ks kru t aata seat matrix pn pahin');
});

test('returns a short reply for a standalone acknowledgement', async () => {
  const chatId = 'agent-fast-path-test';
  consentGate.set(chatId, consentGate.CONSENT_STATES.ALLOWED);
  const result = await processMessage(chatId, 'Contact', 'Br');
  assert.equal(result.noReply, undefined);
  assert.match(result.reply, /./);
  memory.clearHistory('agent-fast-path-test');
  consentGate.reset();
});

test('understands a date answer from the previous question', async () => {
  const chatId = 'agent-date-fast-path-test';
  consentGate.set(chatId, consentGate.CONSENT_STATES.ALLOWED);
  memory.clearHistory(chatId);
  consentGate.reset();
  memory.addMessage(chatId, 'owner', 'final merit list kadhi ahe');
  const result = await processMessage(chatId, 'Contact', '11');
  assert.match(result.reply, /11/);
  assert.doesNotMatch(result.reply, /what do you mean|could you/i);
  memory.clearHistory(chatId);
});

test('answers corrections as corrections, not translations', async () => {
  const chatId = 'agent-correction-fast-path-test';
  consentGate.set(chatId, consentGate.CONSENT_STATES.ALLOWED);
  memory.clearHistory(chatId);
  const result = await processMessage(chatId, 'Contact', 'Chukich sangte te');
  assert.match(result.reply, /chukicha hota/i);
  assert.doesNotMatch(result.reply, /means|meaning|translation/i);
  memory.clearHistory(chatId);
  consentGate.reset();
});
