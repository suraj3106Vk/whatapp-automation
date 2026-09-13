const { chat } = require('./llmService');

async function generateResponse({ messages, systemPrompt, temperature, maxTokens, userId, metadata } = {}) {
  const input = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...(messages || [])]
    : messages;
  // Slightly higher default temperature than the raw provider defaults —
  // casual chat reads more natural with a bit more variation than a
  // fact-answering assistant would want. Callers can still override.
  return chat(input || [], {
    temperature: typeof temperature === 'number' ? temperature : 0.85,
    maxTokens: typeof maxTokens === 'number' ? maxTokens : undefined,
  });
}

module.exports = { generateResponse };
