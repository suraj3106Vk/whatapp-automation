const ownerConfig = {
  name: process.env.OWNER_NAME || 'Suraj Zalke',
  shortName: process.env.OWNER_SHORT_NAME || 'Suraj',
  number: process.env.OWNER_NUMBER || '8554096571',
  chatId: null,
  // Free-text description of how the owner actually talks — tone, favourite
  // words/emoji, language mix, things they would/wouldn't say. This gets
  // injected straight into the LLM system prompt so replies sound like the
  // real person, not a generic assistant. Set PERSONA_DESCRIPTION in .env.
  personaDescription: process.env.PERSONA_DESCRIPTION || '',
};

function setOwnerConfig(cfg) {
  if (cfg.name) ownerConfig.name = cfg.name;
  if (cfg.shortName) ownerConfig.shortName = cfg.shortName;
  if (cfg.chatId) ownerConfig.chatId = cfg.chatId;
  if (cfg.number) ownerConfig.number = cfg.number;
  if (cfg.personaDescription !== undefined) ownerConfig.personaDescription = cfg.personaDescription;
}

function getOwnerConfig() {
  return { ...ownerConfig };
}

/**
 * Default, generic "sounds like a real person texting" personality used when
 * the owner hasn't described their own style. Kept neutral/casual on purpose —
 * no forced slang, no fixed language — so it adapts to whoever it's talking to.
 */
const DEFAULT_PERSONA = [
  'Texts the way a real person on WhatsApp does: short, casual, no punctuation ceremony.',
  'Matches whatever language/script the other person is using (English, Hindi, Marathi, Hinglish, etc.) instead of forcing one.',
  'Has opinions and reacts — agrees, disagrees, jokes, gets curious — instead of staying neutral and "helpful".',
  'Does not over-explain. One or two lines is normal unless the topic actually needs more.',
].join(' ');

function getPersonaDescription() {
  return ownerConfig.personaDescription && ownerConfig.personaDescription.trim()
    ? ownerConfig.personaDescription.trim()
    : DEFAULT_PERSONA;
}

/**
 * Builds a regex that matches the owner by name/short-name (plus a couple of
 * generic fallback words), instead of a hardcoded "suraj|zalke" pattern.
 * Use this anywhere code needs to detect "the message is about the owner".
 */
function ownerNameRegex() {
  const parts = new Set(['owner', 'boss']);
  const addWords = value => String(value || '')
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length > 1)
    .forEach(w => parts.add(w.toLowerCase()));
  addWords(ownerConfig.name);
  addWords(ownerConfig.shortName);
  const escaped = [...parts].map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`\\b(${escaped.join('|')})\\b`, 'i');
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
  getPersonaDescription,
  ownerNameRegex,
};
