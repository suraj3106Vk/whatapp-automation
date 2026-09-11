const ownerConfig = {
  name: process.env.OWNER_NAME || 'Suraj Zalke',
  shortName: process.env.OWNER_SHORT_NAME || 'Suraj',
  number: process.env.OWNER_NUMBER || '8554096571',
  chatId: null,
};

function setOwnerConfig(cfg) {
  if (cfg.name) ownerConfig.name = cfg.name;
  if (cfg.shortName) ownerConfig.shortName = cfg.shortName;
  if (cfg.chatId) ownerConfig.chatId = cfg.chatId;
  if (cfg.number) ownerConfig.number = cfg.number;
}

function getOwnerConfig() {
  return { ...ownerConfig };
}

function containsChatbotLanguage(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return [
    'how can i help', 'how may i assist', 'let me know', 'could you clarify',
    'please provide', 'tell me how i can help', 'मी इथेच आहे',
    'तुला काही बोलायचं असेल', 'kay madat pahije', 'kay help pahije',
  ].some(phrase => lower.includes(phrase));
}

function isEchoingInput(inputText, replyText) {
  if (!inputText || !replyText) return false;
  const inputWords = inputText.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(word => word.length > 2);
  const replyWords = replyText.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(word => word.length > 2);
  if (inputWords.length === 0) return false;
  return inputWords.filter(word => replyWords.includes(word)).length / inputWords.length > 0.7;
}

function isTooLongForCasual(inputText, replyText, isQuestion = false) {
  if (!inputText || !replyText || isQuestion) return false;
  return inputText.split(/\s+/).length < 8 && replyText.split(/\s+/).length > 25;
}

function validateResponse(inputText, replyText, context = {}) {
  const issues = [];
  if (containsChatbotLanguage(replyText)) issues.push('CHATBOT_LANGUAGE');
  if (isEchoingInput(inputText, replyText)) issues.push('ECHOING');
  if (isTooLongForCasual(inputText, replyText, context.isQuestion)) issues.push('TOO_LONG');
  return { valid: issues.length === 0, issues };
}

module.exports = {
  validateResponse,
  containsChatbotLanguage,
  isEchoingInput,
  setOwnerConfig,
  getOwnerConfig,
};
