const assert = require('node:assert/strict');
const test = require('node:test');

const { normalizeForReasoning, mergeMessages } = require('../src/agent/messageNormalizer');
const { classifyMessage, isAcknowledgement } = require('../src/agent/intentClassifier');
const state = require('../src/agent/conversationState');
const { buildConversationContext } = require('../src/agent/contextBuilder');
const memory = require('../src/memory/conversationMemory');
const { processMessage, buildSystemPrompt } = require('../src/agent/skAgent');

test('normalizes Roman Marathi without changing the original', () => {
  const original = 'tula ntr pathvte me ek vel srv college list krte brobr mg sang';
  assert.equal(normalizeForReasoning(original), 'tula nantar pathavte me ek vel sarv college list karte barobar mag sang');
  assert.equal(original, 'tula ntr pathvte me ek vel srv college list krte brobr mg sang');
});

test('normalizes direct Roman Marathi follow-ups for the LLM', () => {
  assert.equal(normalizeForReasoning('Bolav na tele kuth gela'), 'Bolav na tyala kuthe gela');
});

test('prompt prevents generic acknowledgement replies to requests', () => {
  const prompt = buildSystemPrompt('Contact', '10:00 AM');
  assert.match(prompt, /Contact is the current sender/);
  assert.match(prompt, /Only use an acknowledgement when the current message is genuinely an acknowledgement/);
  assert.match(prompt, /bolav na/);
  assert.match(prompt, /earlier assistant replies as fallible context/);
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
  assert.match(context, /OWNER\/SURAJ: final merit list kadhi ahe/);
  assert.match(context, /CURRENT CONTACT MESSAGE:\nBr/);
});

test('merges consecutive WhatsApp messages into one thought', () => {
  assert.equal(mergeMessages(['Aani college list', 'te ks kru t aata', 'seat matrix pn pahin']), 'Aani college list te ks kru t aata seat matrix pn pahin');
});

test('returns no reply for a standalone acknowledgement', async () => {
  const result = await processMessage('agent-fast-path-test', 'Contact', 'Br');
  assert.equal(result.noReply, true);
  assert.equal(result.reply, null);
  memory.clearHistory('agent-fast-path-test');
});

test('understands a date answer from the previous question', async () => {
  const chatId = 'agent-date-fast-path-test';
  memory.clearHistory(chatId);
  memory.addMessage(chatId, 'owner', 'final merit list kadhi ahe');
  const result = await processMessage(chatId, 'Contact', '11');
  assert.match(result.reply, /11/);
  assert.doesNotMatch(result.reply, /what do you mean|could you/i);
  memory.clearHistory(chatId);
});

test('answers corrections as corrections, not translations', async () => {
  const chatId = 'agent-correction-fast-path-test';
  memory.clearHistory(chatId);
  const result = await processMessage(chatId, 'Contact', 'Chukich sangte te');
  assert.match(result.reply, /chukicha hota/i);
  assert.doesNotMatch(result.reply, /means|meaning|translation/i);
  memory.clearHistory(chatId);
});
