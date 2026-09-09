const WRAPPER_KEYS = [
  'ephemeralMessage',
  'viewOnceMessage',
  'viewOnceMessageV2',
  'viewOnceMessageV2Extension',
  'documentWithCaptionMessage',
  'editedMessage',
  'associatedChildMessage',
  'deviceSentMessage',
];

function unwrapMessageContent(message, maxDepth = 8) {
  let content = message?.message || message || {};
  let depth = 0;
  while (content && depth < maxDepth) {
    const wrapperKey = WRAPPER_KEYS.find(key => content[key]?.message || content[key]?.originalMessage);
    if (!wrapperKey) break;
    const wrapper = content[wrapperKey];
    content = wrapper.message || wrapper.originalMessage || {};
    depth++;
  }
  return content || {};
}

function createCollector() {
  const values = [];
  const seen = new Set();
  return {
    add(value) {
      const text = typeof value === 'string' ? value.trim() : '';
      if (!text || seen.has(text)) return;
      seen.add(text);
      values.push(text);
    },
    text() { return values.join('\n\n'); },
    values,
  };
}

function firstObject(...values) {
  return values.find(value => value && typeof value === 'object') || null;
}

function extractMessageContent(message) {
  const content = unwrapMessageContent(message);
  const collector = createCollector();
  const result = {
    text: '', type: 'unknown', caption: '', title: '', description: '', footer: '',
    selectedText: '', quotedText: '', fileName: '', mimeType: '', hasMedia: false,
    isInteractive: false, isBusinessTemplate: false, isSystem: false,
  };

  const add = value => collector.add(value);
  const addFields = (value, fields) => fields.forEach(field => add(value?.[field]));
  const mediaTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'];
  const media = firstObject(...mediaTypes.map(key => content[key]));
  if (media) {
    const mediaKey = mediaTypes.find(key => content[key] === media);
    result.type = mediaKey.replace('Message', '');
    result.hasMedia = true;
    result.mimeType = media.mimetype || '';
    result.fileName = media.fileName || '';
    result.caption = media.caption || '';
    add(media.caption);
    if (result.fileName) add(result.fileName);
  }

  if (content.conversation) { result.type = 'chat'; add(content.conversation); }
  if (content.extendedTextMessage) { result.type = 'chat'; add(content.extendedTextMessage.text); }
  if (content.buttonsMessage) {
    result.type = 'buttons'; result.isInteractive = true;
    addFields(content.buttonsMessage, ['contentText', 'text', 'footerText']);
  }
  if (content.buttonsResponseMessage) {
    result.type = 'button_response'; result.isInteractive = true;
    result.selectedText = content.buttonsResponseMessage.selectedDisplayText || content.buttonsResponseMessage.selectedButtonId || '';
    add(result.selectedText);
  }
  if (content.listMessage) {
    result.type = 'list'; result.isInteractive = true;
    addFields(content.listMessage, ['title', 'description', 'footerText', 'buttonText']);
  }
  if (content.listResponseMessage) {
    result.type = 'list_response'; result.isInteractive = true;
    addFields(content.listResponseMessage, ['title', 'description']);
    add(content.listResponseMessage.singleSelectReply?.selectedRowId);
  }
  if (content.templateMessage) {
    result.type = 'template'; result.isInteractive = true; result.isBusinessTemplate = true;
    const template = content.templateMessage.hydratedTemplate || content.templateMessage;
    addFields(template, ['hydratedContentText', 'hydratedTitleText', 'hydratedFooterText']);
    addFields(template, ['title', 'contentText', 'footerText']);
  }
  if (content.templateButtonReplyMessage) {
    result.type = 'template_response'; result.isInteractive = true;
    result.selectedText = content.templateButtonReplyMessage.selectedDisplayText || content.templateButtonReplyMessage.selectedId || '';
    add(result.selectedText);
  }
  if (content.hydratedTemplate) { result.type = 'template'; result.isInteractive = true; result.isBusinessTemplate = true; addFields(content.hydratedTemplate, ['hydratedContentText', 'hydratedTitleText', 'hydratedFooterText']); }
  if (content.hydratedContentText || content.hydratedTitleText || content.hydratedFooterText) {
    result.isBusinessTemplate = true;
    addFields(content, ['hydratedTitleText', 'hydratedContentText', 'hydratedFooterText']);
  }
  if (content.interactiveMessage) {
    result.type = 'interactive'; result.isInteractive = true;
    add(content.interactiveMessage.header?.title || content.interactiveMessage.header?.text);
    add(content.interactiveMessage.body?.text);
    add(content.interactiveMessage.footer?.text);
  }
  if (content.interactiveResponseMessage) {
    result.type = 'interactive_response'; result.isInteractive = true;
    addFields(content.interactiveResponseMessage, ['body', 'nativeFlowResponseMessage']);
    add(content.interactiveResponseMessage.nativeFlowResponseMessage?.paramsJson);
  }
  if (content.nativeFlowResponseMessage) {
    result.type = 'native_flow_response'; result.isInteractive = true;
    add(content.nativeFlowResponseMessage.paramsJson);
  }
  if (content.highlyStructuredMessage) { result.type = 'structured'; addFields(content.highlyStructuredMessage, ['title', 'body', 'description', 'footer']); }
  if (content.contactMessage) { result.type = 'contact'; add(content.contactMessage.displayName); }
  if (content.contactsArrayMessage) { result.type = 'contacts'; (content.contactsArrayMessage.contacts || []).forEach(contact => add(contact.displayName)); }
  if (content.locationMessage) { result.type = 'location'; addFields(content.locationMessage, ['name', 'address', 'comment']); }
  if (content.liveLocationMessage) { result.type = 'live_location'; add(content.liveLocationMessage.caption); }
  if (content.pollCreationMessage) { result.type = 'poll'; add(content.pollCreationMessage.name); (content.pollCreationMessage.options || []).forEach(option => add(option.optionName || option.name)); }
  if (content.reactionMessage) { result.type = 'reaction'; add(content.reactionMessage.text); }
  if (content.eventMessage) { result.type = 'event'; addFields(content.eventMessage, ['name', 'description', 'location']); }
  if (content.productMessage) { result.type = 'product'; addFields(content.productMessage.product || content.productMessage, ['title', 'description', 'productName']); }

  result.text = collector.text();
  result.title = result.title || (content.listMessage?.title || content.hydratedTitleText || '');
  result.description = result.description || (content.listMessage?.description || content.hydratedContentText || '');
  result.footer = result.footer || (content.listMessage?.footerText || content.hydratedFooterText || '');
  result.caption = result.caption || media?.caption || '';
  if (result.title) add(result.title);
  if (result.description) add(result.description);
  if (result.footer) add(result.footer);
  result.text = collector.text();
  result.isSystem = ['protocolMessage', 'senderKeyDistributionMessage', 'historySyncNotification'].some(key => Boolean(content[key]));
  if (result.type === 'unknown' && result.isSystem) result.type = 'system';
  return result;
}

module.exports = { extractMessageContent, unwrapMessageContent };
