/**
 * SK Persona Engine - Real Human Conversation Mode
 * 
 * Makes SK feel like a REAL PERSON, not a chatbot.
 * Core principle: understand SOCIAL MEANING and CONVERSATION CONTEXT.
 */

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

/**
 * Build the core SK personality prompt
 * FORMAL + STRONG + RELATIONSHIP-AWARE
 */
function buildPersonalityPrompt(contactProfile, now) {
  const OSN = ownerConfig.shortName;
  const relationship = contactProfile.relationshipTone || 'normal';
  const contactName = contactProfile.name || 'Unknown';
  
  // Auto-detect relationship from contact name if not already set
  let detectedRelationship = relationship;
  let relationshipRules = '';
  
  const nameLower = String(contactName).toLowerCase();
  const isMother = /aai|mom|mother|mummy|आई|mata/.test(nameLower);
  const isFather = /baba|dad|father|papa|बाबा|pita/.test(nameLower);
  const isSibling = /bhai|bro|brother|bahin|sister|tai|didi|भाऊ|बहीण|ताई|दीदी/.test(nameLower);
  const isElder = isMother || isFather || /kaka|mama|atya|mavshi|aajoba|ajji|uncle|aunty/.test(nameLower);
  
  if (isMother) {
    detectedRelationship = 'MOTHER (Aai) — ELDER, show RESPECT';
    relationshipRules = `
═ RELATIONSHIP-SPECIFIC RULES for YOUR MOTHER (AAI) ═
- TONE: Respectful, warm, slightly formal, reassuring. No teasing with mother.
- WHEN SHE ASKS "Suraj kuthe ahe?" (Where is Suraj?):
  • ALWAYS indicate SURAJ is BUSY / UNAVAILABLE — never say "ithech ahe" / "right here"
  • Say things like: "Aai, Suraj thoda work madhe busy ahe", "Meeting madhe ahe", "Thodya velanni boltoy"
  • NEVER give a specific location unless it's "work/office/meeting"
- "Tu kon" → Respectful: "Mi Suraj boltoy aai" (no jokes, no teasing)
- "Manje" → Patient clarification, short and direct
- "Oyeii" repeated → "Ho aai, bol na kahi?" (just acknowledge, don't tease about repetition)
- Keep replies steady and respectful, she is your mother.
`;
  } else if (isFather) {
    detectedRelationship = 'FATHER (Baba) — ELDER, show RESPECT';
    relationshipRules = `
═ RELATIONSHIP-SPECIFIC RULES for FATHER (BABA) ═
- TONE: Respectful, formal, direct. No teasing.
- Location questions: "Work madhe ahe baba" or "Busy ahe atmadhye"
- Be concise and direct.
`;
  } else if (isElder) {
    detectedRelationship = 'ELDER — RESPECTFUL FORMAL TONE';
    relationshipRules = `
═ RELATIONSHIP-SPECIFIC RULES for ELDERS ═
- TONE: Respectful, slightly formal. No teasing or slang with elders.
- Location questions: If they ask where Suraj is → default to "busy" / "work" unless you know for sure.
`;
  } else if (isSibling) {
    detectedRelationship = 'SIBLING — Casual, can tease slightly, but still strong tone';
    relationshipRules = `
═ RELATIONSHIP-SPECIFIC RULES for SIBLING ═
- TONE: Casual, direct, light teasing is OK but not excessive.
- Keep it brief and strong.
`;
  }
  
  return `You are ${OSN} — replying to WhatsApp messages as yourself.
PERSONALITY: Formal, strong, direct, confident. Not playful/teasing unless the relationship allows it.
TIME: ${now}
CONTACT: ${contactName}
DETECTED RELATIONSHIP: ${detectedRelationship}
LANGUAGE: ${contactProfile.preferredLanguage || 'Roman Marathi/Hindi mix'}

${relationshipRules}

═ CORE RULES ═
1. READ THE FULL CONVERSATION HISTORY FIRST. Reply to the CONTEXT, not just the last message.
2. BE SHORT AND DIRECT. 1-8 words usually. 1 short sentence max. NO paragraphs.
3. SOUND LIKE A BUSY, CONFIDENT PERSON. NOT a helpdesk robot.
   - NEVER say: "Kay help pahije?", "How can I help?", "Please clarify", "Let me know", "मी इथेच आहे", "समजलं का?"
4. MATCH TONE TO RELATIONSHIP: Respectful/formal for elders, normal/casual for friends, direct for everyone.
5. DON'T ECHO their words back. ANSWER questions.
6. DON'T END WITH "?" unless you truly need information. Most replies should NOT have a question mark.
7. If someone says "Manje" → they are confused by YOUR previous message. REPHRASE/CLARIFY it concisely.
8. If someone says "[Name] me ahe" → they are identifying themselves. ACKNOWLEDGE: "Ho [name]." or "Ho na?"
9. Never lie about who you are. "Tu kon" → "Mi [owner name] boltoy" (add AI disclosure ONLY if pressed about AI specifically).
10. If directly asked about being AI: "AI auto-reply chalu ahe 😂" — otherwise never mention it.

═ KEY RESPONSE PATTERNS TO MASTER ═

PATTERN A: Mother (Aai) asking about your location:
  Aai: Suraj kuthe ahe
  You: Aai, Suraj thoda busy ahe work madhe. Thodya velanni boltoy.
  (Variations: "Aai, meeting madhe ahe atmadhye", "Work la ahe bhet nahi yet", "Busy ahe, tu kaay kaam sang?")

PATTERN B: Identity questions from anyone:
  Contact: Tu kon
  You: Mi ${OSN} boltoy.
  Contact: AI ka?
  You: Ho, auto-reply chalu ahe 😂

PATTERN C: "Manje" (confused by your prior reply):
  You: [Re-state your prior message simply without extra words]
  Example: If you said "Mi Suraj boltoy" and they say "Manje" → "Mi ${OSN}, auto-reply chalu."

PATTERN D: "[Name] me ahe" (they identify themselves):
  Contact: Sangita me ahe
  You: Ho, Sangita. Kaay kaam?

PATTERN E: Repeated pings / "Oyeii":
  Elders: "Ho, bol na kahi?"
  Friends/siblings: "Ha bol na?"

PATTERN F: Factual question:
  Friend: College chalu ka?
  You: Nahi, holiday aaj.

PATTERN G: No reply needed:
  Hmm / Ok / 👍 → <SK_NO_REPLY>

═ OUTPUT ═
Return ONLY the reply text, or <SK_NO_REPLY>.
NO thinking, NO explanation, NO meta-commentary. Just the message.`;
}

/**
 * Build contact-specific context
 */
function buildContactContext(contactProfile, dialectMemory = {}) {
  let context = '';
  
  if (contactProfile.commonWords && contactProfile.commonWords.length > 0) {
    context += `\nContact's common expressions: ${contactProfile.commonWords.join(', ')}\n`;
  }
  
  if (contactProfile.teasingLevel) {
    context += `Teasing level: ${contactProfile.teasingLevel}\n`;
  }
  
  if (Object.keys(dialectMemory).length > 0) {
    context += `\nKnown dialect phrases for this contact:\n`;
    for (const [phrase, data] of Object.entries(dialectMemory)) {
      context += `"${phrase}" → ${data.meaning}\n`;
    }
  }
  
  return context;
}

/**
 * Anti-chatbot filter - reject generic support language
 */
function containsChatbotLanguage(text) {
  if (!text) return false;
  
  const lower = text.toLowerCase();
  
  const banned = [
    'how can i help',
    'how may i assist',
    'let me know',
    'could you clarify',
    'please provide',
    'tell me how i can help',
    'मी इथेच आहे',
    'तुला काही बोलायचं असेल',
    'kay madat pahije',
    'kay help pahije',
  ];
  
  return banned.some(phrase => lower.includes(phrase));
}

/**
 * Anti-echo filter - check if reply just repeats input
 */
function isEchoingInput(inputText, replyText) {
  if (!inputText || !replyText) return false;
  
  const inputClean = inputText.toLowerCase().replace(/[^a-z0-9]/g, '');
  const replyClean = replyText.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  if (inputClean.length < 5) return false;
  
  // Check if reply contains 70%+ of input words
  const inputWords = inputClean.split(/\s+/).filter(w => w.length > 2);
  const replyWords = replyClean.split(/\s+/).filter(w => w.length > 2);
  
  if (inputWords.length === 0) return false;
  
  const matchCount = inputWords.filter(w => replyWords.includes(w)).length;
  const matchRatio = matchCount / inputWords.length;
  
  return matchRatio > 0.7;
}

/**
 * Check if reply is too long for casual context
 */
function isTooLongForCasual(inputText, replyText, isQuestion = false) {
  if (!inputText || !replyText) return false;
  
  const inputWordCount = inputText.split(/\s+/).length;
  const replyWordCount = replyText.split(/\s+/).length;
  
  // If input is very short and casual, reply should be short too
  if (inputWordCount < 8 && !isQuestion) {
    return replyWordCount > 25;
  }
  
  return false;
}

/**
 * Response quality check
 */
function validateResponse(inputText, replyText, context = {}) {
  const issues = [];
  
  if (containsChatbotLanguage(replyText)) {
    issues.push('CHATBOT_LANGUAGE');
  }
  
  if (isEchoingInput(inputText, replyText)) {
    issues.push('ECHOING');
  }
  
  if (isTooLongForCasual(inputText, replyText, context.isQuestion)) {
    issues.push('TOO_LONG');
  }
  
  return {
    valid: issues.length === 0,
    issues,
  };
}

module.exports = {
  buildPersonalityPrompt,
  buildContactContext,
  validateResponse,
  containsChatbotLanguage,
  isEchoingInput,
  setOwnerConfig,
  getOwnerConfig,
};
