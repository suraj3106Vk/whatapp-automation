const assert = require('node:assert/strict');
const test = require('node:test');

const { extractMessageContent, unwrapMessageContent } = require('../src/whatsapp/messageExtractor');
const { classifyReplyPolicy } = require('../src/agent/messagePolicy');
const { createInboundGuard, isStaleIncomingMessage } = require('../src/whatsapp/inboundGuard');

test('extracts wrapped text and hydrated business template content', () => {
  const result = extractMessageContent({ message: { ephemeralMessage: { message: { templateMessage: { hydratedTemplate: {
    hydratedTitleText: 'Watch your favourite sports LIVE on Jio Set-top box!',
    hydratedContentText: 'Aapka TV ban gaya Stadium. Multi-language commentary.',
    hydratedFooterText: 'Terms apply',
  } } } } } });
  assert.equal(result.type, 'template');
  assert.equal(result.isBusinessTemplate, true);
  assert.match(result.text, /Watch your favourite sports LIVE/);
  assert.match(result.text, /Multi-language commentary/);
  assert.match(result.text, /Terms apply/);
});

test('extracts common interactive, media, location, contact and poll structures', () => {
  const fixtures = [
    [{ conversation: 'hello' }, 'hello'],
    [{ extendedTextMessage: { text: 'extended' } }, 'extended'],
    [{ imageMessage: { caption: 'photo caption', mimetype: 'image/jpeg' } }, 'photo caption'],
    [{ documentMessage: { caption: 'pdf caption', fileName: 'list.pdf', mimetype: 'application/pdf' } }, 'pdf caption'],
    [{ listMessage: { title: 'Title', description: 'Description', footerText: 'Footer' } }, 'Title'],
    [{ listResponseMessage: { singleSelectReply: { selectedRowId: 'row-1' } } }, 'row-1'],
    [{ buttonsMessage: { contentText: 'Choose', footerText: 'Footer' } }, 'Choose'],
    [{ buttonsResponseMessage: { selectedDisplayText: 'Selected' } }, 'Selected'],
    [{ templateButtonReplyMessage: { selectedId: 'button-1' } }, 'button-1'],
    [{ interactiveMessage: { body: { text: 'Interactive body' }, footer: { text: 'Footer' } } }, 'Interactive body'],
    [{ nativeFlowResponseMessage: { paramsJson: '{"id":"x"}' } }, '"id":"x"'],
    [{ locationMessage: { name: 'Office', address: 'Amravati' } }, 'Office'],
    [{ contactMessage: { displayName: 'Suraj' } }, 'Suraj'],
    [{ pollCreationMessage: { name: 'Choose one', options: [{ optionName: 'A' }] } }, 'Choose one'],
  ];
  for (const [content, expected] of fixtures) {
    const result = extractMessageContent({ message: content });
    assert.match(result.text, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.equal(result.text.includes('undefined'), false);
  }
});

test('promotional Raisoni and Jio messages require no reply', () => {
  const raisoni = extractMessageContent({ message: { conversation: 'Only Last Few Days | B.Tech Admissions at Raisoni Education Amravati\nAdmissions currently open\nHelpline: 9876543210' } });
  const jio = extractMessageContent({ message: { conversation: 'Watch your favourite sports LIVE on Jio Set-top box!\nAapka TV ban gaya Stadium\nMulti-language commentary' } });
  assert.equal(classifyReplyPolicy(raisoni), 'NO_REPLY');
  assert.equal(classifyReplyPolicy(jio), 'NO_REPLY');
});

test('guard suppresses duplicate, semantic replay, stale and flood events', () => {
  const guard = createInboundGuard({ maxPerMinute: 2 });
  assert.equal(guard.check({ chatId: 'a', messageId: '1', text: 'hello', timestamp: Date.now() }).allowed, true);
  assert.equal(guard.check({ chatId: 'a', messageId: '1', text: 'hello', timestamp: Date.now() }).reason, 'duplicate');
  assert.equal(guard.check({ chatId: 'a', messageId: '2', text: 'hello', timestamp: Date.now() }).reason, 'semantic_duplicate');
  assert.equal(guard.check({ chatId: 'a', messageId: '3', text: 'different', timestamp: Date.now() }).allowed, true);
  assert.equal(guard.check({ chatId: 'a', messageId: '4', text: 'flood', timestamp: Date.now() }).reason, 'rate_limit');
  assert.equal(isStaleIncomingMessage({ messageTimestamp: Math.floor((Date.now() - 3600000) / 1000) }, Date.now()), true);
  assert.equal(unwrapMessageContent({ message: { viewOnceMessageV2: { message: { conversation: 'ok' } } } }).conversation, 'ok');
});