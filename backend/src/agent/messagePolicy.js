const PROMOTIONAL_PATTERNS = [
  /admissions?\s+(open|started)/i, /apply\s+(now|today)/i, /limited\s+(days|seats|time)/i,
  /special\s+offer|discount|buy\s+now|book\s+now/i, /follow\s+(our|the)\s+(whatsapp\s+)?channel/i,
  /click\s+here|terms\s*(and|&)\s*conditions\s*apply|unsubscribe/i, /visit\s+(our\s+)?website/i,
  /helpline|customer\s+care|career\s+support|placement\s+support|why\s+choose/i,
  /recharge|sports\s+season|watch\s+.*\blive\b|set[- ]top\s+box|multi[- ]language\s+commentary/i,
];
const SYSTEM_PATTERNS = [/\botp\b|one[- ]time password/i, /bank\s+(alert|transaction)/i, /delivery\s+(update|notification)/i];

function classifyReplyPolicy(messageData, recentContext = []) {
  if (!messageData || messageData.isSystem || messageData.type === 'reaction') return 'NO_REPLY';
  const text = String(messageData.text || '').trim();
  if (!text && !messageData.hasMedia) return 'NO_REPLY';
  const promotionalHits = PROMOTIONAL_PATTERNS.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
  const massMessageSignals = (text.match(/(?:🎓|📢|🔥|✅|\bcall\b|\bcontact\b|\bapply\b|\bvisit\b)/gi) || []).length;
  const hasManyLines = text.split(/\n/).length >= 3;
  if (SYSTEM_PATTERNS.some(pattern => pattern.test(text))) return 'NO_REPLY';
  if (promotionalHits >= 1 && (promotionalHits >= 2 || hasManyLines || massMessageSignals >= 2)) {
    const explicitlyRequested = recentContext.some(item => /\b(asked|request|follow up|check|reply|interact)\b/i.test(String(item)));
    return explicitlyRequested ? 'LLM' : 'NO_REPLY';
  }
  return 'LLM';
}

module.exports = { classifyReplyPolicy, PROMOTIONAL_PATTERNS };
