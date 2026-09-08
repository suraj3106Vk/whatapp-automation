const ACKNOWLEDGEMENTS = /^(br+|barobar|brobr|ok+|okay|accha|thik|theek|ha+|ho+|hmm+|k|👍|thanks|thank you)[\s!.]*$/i;
const PROMISES = /\b(pathv(in|lin|te)?|pathav(in|lin|to|te)?|send karto|send karte|will send|nantar pathav)\b/i;
const CORRECTIONS = /\b(chukich|chukicha|wrong|incorrect|barobar nahi|galat)\b/i;
const QUESTIONS = /[?]|\b(kadhi|konta|konte|kasa|kase|kay|ka|kuthe|which|what|when|how|why|where)\b/i;
const OWNER_INFO = /\b(suraj|zalke|boss|owner)\b/i;

function classifyMessage(original, normalized, previousUserMessage = '') {
  const text = String(original || '').trim();
  const normalizedText = String(normalized || text).trim();
  if (!text) return 'UNKNOWN';
  if (ACKNOWLEDGEMENTS.test(text)) return 'ACKNOWLEDGEMENT';
  if (CORRECTIONS.test(normalizedText)) return 'CORRECTION';
  if (PROMISES.test(normalizedText) && !QUESTIONS.test(normalizedText)) return 'PROMISE_FUTURE_ACTION';
  if (/^\d{1,2}$/.test(text) && QUESTIONS.test(previousUserMessage)) return 'ANSWER_TO_PREVIOUS';
  if (QUESTIONS.test(normalizedText)) return 'NEW_QUESTION';
  if (OWNER_INFO.test(normalizedText)) return 'NEW_INFORMATION';
  if (/\b(please|send|share|add|include|tak|pathav|remind|schedule)\b/i.test(normalizedText)) return 'REQUEST';
  return 'CONTINUATION';
}

function isAcknowledgement(text) {
  return ACKNOWLEDGEMENTS.test(String(text || '').trim());
}

module.exports = { classifyMessage, isAcknowledgement };
