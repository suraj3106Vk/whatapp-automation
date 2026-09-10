// Promotional/Marketing message patterns
const PROMOTIONAL_PATTERNS = [
  /admissions?\s+(open|started)/i, /apply\s+(now|today)/i, /limited\s+(days|seats|time)/i,
  /special\s+offer|discount|buy\s+now|book\s+now/i, /follow\s+(our|the)\s+(whatsapp\s+)?channel/i,
  /click\s+here|terms\s*(and|&)\s*conditions\s*apply|unsubscribe/i, /visit\s+(our\s+)?website/i,
  /helpline|customer\s+care|career\s+support|placement\s+support|why\s+choose/i,
  /recharge|sports\s+season|watch\s+.*\blive\b|set[- ]top\s+box|multi[- ]language\s+commentary/i,
];

// System/automated messages (OTP, banks, delivery)
const SYSTEM_PATTERNS = [
  /\botp\b|one[- ]time password/i, 
  /bank\s+(alert|transaction)/i, 
  /delivery\s+(update|notification)/i
];

// Business bot detection patterns
const BOT_PATTERNS = [
  /type\s+any\s+number|select\s+from\s+\d+-\d+|make\s+a\s+selection/i,
  /this\s+should\s+take\s+less\s+than\s+\d+\s+minutes/i,
  /thank\s+you\s+for\s+your\s+(response|feedback)/i,
  /we\s+(didn't|did\s+not)\s+understand|i\s+(didn't|did\s+not)\s+understand/i,
  /skip\s+the\s+queue|book\s+your\s+eticket/i,
  /welcome\s+to\s+(jio|metro|swiggy|zomato|ola|uber|irctc)/i,
  /\bhi\s+mr\.?\s+[a-z]+|dear\s+(customer|user|valued\s+customer)/i,
  /automated\s+(message|response)|this\s+is\s+an?\s+automated/i,
];

// Known business bot sender names (update based on your contacts)
const KNOWN_BOT_NAMES = [
  'JioHome', 'JioCare', 'Jio', 'Airtel', 'Vi', 'BSNL',
  'Swiggy', 'Zomato', 'Uber', 'Ola', 'Rapido',
  'Amazon', 'Flipkart', 'Myntra', 'Meesho',
  'IRCTC', 'Metro', 'MakeMyTrip', 'Goibibo',
  'PayTM', 'PhonePe', 'GooglePay', 'BHIM',
  'HDFC', 'SBI', 'ICICI', 'Axis',
  'Dominos', 'McDonalds', 'KFC', 'PizzaHut',
];

function classifyReplyPolicy(messageData, recentContext = []) {
  if (!messageData || messageData.isSystem || messageData.type === 'reaction') return 'NO_REPLY';
  
  const text = String(messageData.text || '').trim();
  const senderName = String(messageData.senderName || '').trim();
  
  if (!text && !messageData.hasMedia) return 'NO_REPLY';
  
  // 1. Detect known business bot names
  if (isKnownBot(senderName)) {
    console.log(`[Policy] Ignoring bot: ${senderName}`);
    return 'NO_REPLY';
  }
  
  // 2. Detect automated bot patterns in message
  if (BOT_PATTERNS.some(pattern => pattern.test(text))) {
    console.log(`[Policy] Bot pattern detected in message from: ${senderName}`);
    return 'NO_REPLY';
  }
  
  // 3. System messages (OTP, bank alerts, etc.)
  if (SYSTEM_PATTERNS.some(pattern => pattern.test(text))) {
    console.log(`[Policy] System message detected, ignoring`);
    return 'NO_REPLY';
  }
  
  // 4. Promotional/marketing messages
  const promotionalHits = PROMOTIONAL_PATTERNS.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
  const massMessageSignals = (text.match(/(?:🎓|📢|🔥|✅|\bcall\b|\bcontact\b|\bapply\b|\bvisit\b)/gi) || []).length;
  const hasManyLines = text.split(/\n/).length >= 3;
  
  if (promotionalHits >= 1 && (promotionalHits >= 2 || hasManyLines || massMessageSignals >= 2)) {
    const explicitlyRequested = recentContext.some(item => /\b(asked|request|follow up|check|reply|interact)\b/i.test(String(item)));
    if (!explicitlyRequested) {
      console.log(`[Policy] Promotional message detected, ignoring`);
      return 'NO_REPLY';
    }
  }
  
  // 5. Allow reply to real human conversations
  return 'LLM';
}

function isKnownBot(senderName) {
  if (!senderName) return false;
  const normalized = senderName.toLowerCase().replace(/\s+/g, '');
  return KNOWN_BOT_NAMES.some(botName => {
    const normalizedBot = botName.toLowerCase().replace(/\s+/g, '');
    return normalized.includes(normalizedBot) || normalizedBot.includes(normalized);
  });
}

module.exports = { classifyReplyPolicy, PROMOTIONAL_PATTERNS, BOT_PATTERNS, KNOWN_BOT_NAMES, isKnownBot };
