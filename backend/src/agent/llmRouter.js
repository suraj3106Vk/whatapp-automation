const { chat } = require('./llmService');

async function generateResponse({ messages, systemPrompt, temperature, maxTokens, userId, metadata } = {}) {
  const input = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...(messages || [])]
    : messages;
  return chat(input || []);
}

module.exports = { generateResponse };
