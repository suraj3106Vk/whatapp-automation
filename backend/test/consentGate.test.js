const assert = require('node:assert/strict');
const test = require('node:test');

const consentGate = require('../src/agent/consentGate');
const skAgent = require('../src/agent/skAgent');
const memory = require('../src/memory/conversationMemory');

test.afterEach(() => consentGate.reset());

test('classifies natural agreement and disagreement without an LLM', () => {
  assert.equal(consentGate.classifyDecision('Ha'), 'AGREE');
  assert.equal(consentGate.classifyDecision('okk'), 'AGREE');
  assert.equal(consentGate.classifyDecision('chalel'), 'AGREE');
  assert.equal(consentGate.classifyDecision('Nahi'), 'DISAGREE');
  assert.equal(consentGate.classifyDecision('reply nako'), 'DISAGREE');
  assert.equal(consentGate.classifyDecision('maybe later'), 'UNCLEAR');
});

test('persists per-contact state and supports re-enable and revoke commands', () => {
  const chatId = 'consent-contact-a';
  consentGate.set(chatId, consentGate.CONSENT_STATES.DENIED);
  assert.equal(consentGate.get(chatId).state, 'DENIED');
  assert.equal(consentGate.isEnableCommand('AI on kar'), true);
  assert.equal(consentGate.isRevokeCommand('AI nako'), true);
  consentGate.set(chatId, consentGate.CONSENT_STATES.ALLOWED);
  assert.equal(consentGate.get(chatId).state, 'ALLOWED');
  assert.equal(consentGate.get('consent-contact-b').state, 'UNKNOWN');
});

test('generates short language-matched disclosure', () => {
  assert.match(consentGate.disclosure('Hi', 'english'), /AI assistant/);
  assert.match(consentGate.disclosure('Ha', ''), /Mazyashi chat continue/);
  assert.match(consentGate.disclosure('Haan nahi', ''), /chat continue/);
});

test('keeps normal conversation active and stops only after an explicit stop', async () => {
  const chatId = 'consent-runtime-test';
  memory.clearHistory(chatId);

  let result = await skAgent.processMessage(chatId, 'Contact', 'Hi');
  assert.match(result.reply, /./);
  assert.equal(consentGate.get(chatId).state, 'UNKNOWN');

  result = await skAgent.processMessage(chatId, 'Contact', 'Ha');
  assert.match(result.reply, /./);

  result = await skAgent.processMessage(chatId, 'Contact', 'stop');
  assert.equal(result.reply, null);
  assert.equal(result.reason, 'CHAT_STOPPED');

  result = await skAgent.processMessage(chatId, 'Contact', 'hello');
  assert.equal(result.reply, null);
  assert.equal(result.noReply, true);

  result = await skAgent.processMessage(chatId, 'Contact', 'start');
  assert.match(result.reply, /./);

  result = await skAgent.processMessage(chatId, 'Contact', 'hello');
  assert.match(result.reply, /./);

  memory.clearHistory(chatId);
});

test('does not start consent for promotional messages', async () => {
  const chatId = 'consent-promotion-test';
  const result = await skAgent.processMessage(chatId, 'Jio', 'Limited offer!\nApply now\nCall customer care');
  assert.equal(result.reply, null);
  assert.equal(consentGate.get(chatId).state, 'UNKNOWN');
});