/**
 * SK Agent - Core Brain (REFACTORED)
 * 
 * Natural WhatsApp conversation - feels like a REAL PERSON talking.
 * 
 * Architecture:
 * 1. Social intent classification (understand meaning)
 * 2. Reply policy (should we reply?)
 * 3. Contact style + dialect (personalize)
 * 4. Generate response (natural personality)
 * 5. Filter response (catch chatbot patterns)
 * 6. Send or execute actions
 */

const { generateResponse } = require('./llmRouter');
const memory = require('../memory/conversationMemory');
const scheduler = require('./taskScheduler');
const { normalizeForReasoning } = require('./messageNormalizer');
const { buildConversationContext } = require('./contextBuilder');
const conversationState = require('./conversationState');
const { tryReply } = require('./simpleBrain');

const { setOwnerConfig, getOwnerConfig, getPersonaDescription, ownerNameRegex } = require('./personaEngine');
const { classifySocialIntent } = require('./socialIntent');
const styleProfile = require('./styleProfile');
const dialectMemory = require('./dialectMemory');
const replyPolicy = require('./replyPolicy');
const responseFilter = require('./responseFilter');
const { classifyReplyPolicy } = require('./messagePolicy');

/**
 * Builds the system prompt fresh on every call using the CURRENT owner config
 * and persona description, so it always talks like the actual configured
 * person — not a hardcoded name. This is the single biggest lever on "sounds
 * like a real person vs sounds like a chatbot": give the model an actual
 * voice, actual rules against chatbot-speak, and worked examples instead of
 * one generic sentence.
 */
function buildSystemPrompt() {
  const owner = getOwnerConfig();
  const persona = getPersonaDescription();

  return `You are texting FROM ${owner.shortName}'s phone, replying on their behalf while they're away — not a support bot, not an assistant announcing itself. You ARE the voice in this chat.

WHO YOU SOUND LIKE:
${persona}

IDENTITY: You are ${owner.shortName}'s AI assistant/agent. Never claim to be ${owner.shortName}, never write "I am ${owner.shortName}", and never present yourself as the owner. If asked who you are, answer that you are ${owner.shortName}'s AI assistant.

THE ONE RULE THAT MATTERS MOST: before writing anything, actually read the last message and figure out what it means in context — a question, a joke, a complaint, small talk, a request. Your reply must directly relate to THAT, in your own words. Never write a generic reply that could apply to any message.

HOW TO REPLY:
- Write like a real WhatsApp text: short, plain, no essay. Most replies are one line.
- Match the sender's language and register — if they write in Hindi/Marathi/Hinglish/English, reply in kind. Don't switch them to formal English.
- React like a person: agree, disagree, tease back, ask a real follow-up only if you're actually curious — not to "keep engagement going".
- Never explain a word's meaning unless they explicitly ask what it means.
- Never repeat or paraphrase their message back at them.
- Never use customer-support phrasing: no "how can I help", "let me know if you need anything", "feel free to", "please provide", "I'm here for you", no exclamation-mark enthusiasm, no bullet lists in casual chat.
- Don't ask a question just to fill space. If nothing needs asking, don't ask.
  - Always keep the conversation moving with a brief, relevant reply. Acknowledge short messages and goodbyes naturally; never return a no-reply marker for ordinary conversation.
- If directly asked whether you're ${owner.shortName}, say you're ${owner.shortName}'s AI assistant, not ${owner.shortName} themself.
- If asked where ${owner.shortName} is, say they're busy right now, not exact details.
- Return ONLY the final reply text. No labels, no explanation of your reasoning, no quotes around it.

EXAMPLES (for calibration only, don't reuse the wording):
Them: "yaar kal wo plan cancel ho gaya"  →  You: "arre kyu, sab thik hai na"
Them: "lol you're so dead 💀"  →  You: "haha bring it on"
Them: "what time works for you tomorrow"  →  You: "afternoon works better for me, 3ish?"
  Them: "ok"  →  You: "Okay"
Them: "are you a bot"  →  You: "Ho, auto-reply chalu ahe 😂" (or the equivalent in whatever language they're using)`;
}

// ── Fast-path patterns ──────────────────────────────────────────────────────────

const TIME_KEYWORDS = /\b(what'?s?|current|abhi)\s+(time|kitne\s+baje|samay)\b|kitne\s+baje|what\s+time\s+(is\s+it|now)|kya\s+samay/i;

const TASK_KEYWORDS = [
  /remind\s+me/i, /reminder/i, /set\s+alarm/i, /yaad\s+dila/i, /yaad\s+kar/i,
  /schedule/i, /every\s+day/i, /daily\s+at/i, /har\s+roz/i,
  /follow\s+up/i, /note\s*:/i, /note\s+karo/i, /likhlo/i,
  /send\s+.*\s+at\s+\d/i, /kal\s+.*\s+bta/i, /kal\s+.*\s+bhejo/i,
];

const FILE_KEYWORDS = [
  /(?:send|share|bhej(?:o|na)?)\s+(?:me\s+|mujhe\s+)?(?:the\s+|ek\s+)?(?:.*\b(?:pdf|image|img|photo|pic|document|doc|file|catalogue|menu|invoice|brochure|card)\b)/i,
  /\b(pdf|image|img|photo|pic|document|doc|file|catalogue|menu|invoice|brochure|card)\b/i,
];

const EXPLICIT_FILE_REQUEST = /\b(?:send|share|bhej(?:o|na)?|pathav|forward|upload)\b.{0,80}\b(?:pdf|image|img|photo|pic|document|doc|file|catalogue|menu|invoice|brochure|card)\b|\b(?:pdf|image|img|photo|pic|document|doc|file|catalogue|menu|invoice|brochure|card)\b.{0,80}\b(?:send|share|bhej(?:o|na)?|pathav|forward|upload)\b/i;

const FILE_STOP_WORDS = new Set([
  'send', 'share', 'please', 'can', 'you', 'me', 'the', 'a', 'an', 'my', 'to',
  'bhejo', 'bhejna', 'mujhe', 'ek', 'do', 'na', 'file', 'document', 'image',
  'img', 'photo', 'pic', 'pdf', 'doc', 'jpg', 'jpeg', 'png', 'copy', 'karo',
]);

const LIST_KEYWORDS = [
  /show\s+(my\s+)?(tasks|reminders)/i, /what\s+tasks/i, /list\s+reminders/i,
  /mere\s+tasks/i, /meri\s+reminder/i, /kya\s+tasks/i,
];

const CANCEL_KEYWORDS = [
  /cancel\s+(all\s+)?(reminder|task|alarm)/i,
  /delete\s+(all\s+)?(reminder|task)/i,
  /(reminder|task)\s+cancel/i, /band\s+karo/i,
];

// Built lazily (not at module-load time) so it always reflects the CURRENT
// owner name/short-name from personaEngine, instead of a hardcoded person.
function buildInformOwnerPatterns() {
  const name = ownerNameRegex().source.replace(/^\\b\(|\)\\b$/g, ''); // strip outer \b(...)\b
  return [
    new RegExp(`(tell|inform|msg|message|batao|bhejo|bta|yaad\\s+dila(na|o)?|remind)\\s+(\\w+\\s+)?(${name}|owner|boss|sir|him|unhe|unko)`, 'i'),
    new RegExp(`\\b(${name})\\s+(ko|ko\\s+to|se|ke\\s+liye)`, 'i'),
    new RegExp(`(need|want|going|have|supposed)\\s+to\\s+(meet|see|call|talk\\s+to|contact)\\s+(${name})`, 'i'),
    new RegExp(`meet\\s+(${name})`, 'i'),
    new RegExp(`(${name})\\s+(to\\s+)?meet`, 'i'),
  ];
}

const SELF_REMIND_PATTERNS = [
  /remind\s+me/i, /mujhe\s+yaad/i, /mere\s+liye\s+reminder/i, /yaad\s+dila(na)?\s+mujhe/i,
  /(i|main|mera|meri|hum)\s+.*\b(reminder|alarm|yaad)\b/i,
];

// ── Helper functions ────────────────────────────────────────────────────────────

function detectIntent(text, options = {}) {
  if (LIST_KEYWORDS.some(r => r.test(text))) return 'list_tasks';
  if (CANCEL_KEYWORDS.some(r => r.test(text))) return 'cancel_tasks';
  if (TIME_KEYWORDS.test(text)) return 'time';
  if (TASK_KEYWORDS.some(r => r.test(text))) return 'task';
  if (options.hasMedia && !EXPLICIT_FILE_REQUEST.test(text)) return 'chat';
  if (EXPLICIT_FILE_REQUEST.test(text) && FILE_KEYWORDS.some(r => r.test(text))) return 'file';
  return 'chat';
}

function textMentionsOwner(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  return buildInformOwnerPatterns().some(p => p.test(t)) || ownerNameRegex().test(t);
}

function textSaysSelfRemind(text) {
  if (!text) return false;
  return SELF_REMIND_PATTERNS.some(p => p.test(text));
}

function buildLocalTaskAction(text) {
  if (!/(?:remind|alarm|schedule|send|message|msg|bhej|pathav|yaad\s+dila)/i.test(text)) return null;
  const parsed = scheduler.parseTimeExpression(text);
  if (!parsed?.triggerAt) return null;

  const shortMessage = text.match(/\b(?:msg|message)\s+(?:kar\w*\s+)?\d{1,2}(?:[:.]\d{1,2})?\s*(?:la|at)\s+(.+?)(?:\s+manun\b|\s*$)/i) ||
    text.match(/\b\d{1,2}(?:[:.]\d{1,2})?\s*(?:la|at)?\s+(?:msg|message)\s+(?:kar\w*\s+)?(.+?)(?:\s+manun\b|\s*$)/i);
  if (shortMessage) {
    const message = shortMessage[1].trim();
    return {
      type: parsed.isRecurring ? 'recurring' : 'scheduled_message',
      description: message,
      message,
      timeExpression: text,
      interval: parsed.interval || null,
    };
  }

  if (/\binform\b/i.test(text) && /\b(?:meeting|metting|meet)\b/i.test(text)) {
    return {
      type: parsed.isRecurring ? 'recurring' : 'scheduled_message',
      description: 'Suraj la college chi info sang',
      message: 'Suraj la college chi info sang',
      timeExpression: text,
      interval: parsed.interval || null,
    };
  }

  const messageMatch = text.match(/\b(?:at|la)\s+(.+?)\s+(?:msg|message)\s+(?:kar|karo|de|pathav|bhej)?\s*$/i);
  let message = messageMatch?.[1]?.trim() || text.trim();
  message = message.replace(/\s+\d{1,2}(?:[:.]\d{1,2})?\s*(?:la|at)?\s*$/i, '');
  message = message.replace(/\b(?:ani\s+)?mala\s+(?:msg|message)\s+pan\b.*$/i, '');
  if (/\binform\b/i.test(message)) {
    message = /\bmeeting\b/i.test(message)
      ? 'Suraj la college chi info sang'
      : message.replace(/\b(?:inform|karsil|karsik|karshil)\b/gi, 'inform kar');
  }
  message = message
    .replace(/\b(?:mala|please|ek\s+kam\s+kar|remind\s+me|reminder|set\s+(?:an\s+)?alarm|schedule)\b/gi, '')
    .replace(/\b(?:at|la)\s+\d{1,2}(?:[:.]\d{1,2})?\b/gi, '')
    .replace(/\b(?:send|msg|message|bhej|pathav|kar|karo|de)\b/gi, '')
    .replace(/\b(?:ani|and)\s+(?:mala\s+)?(?:msg|message)\s+pan\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!message) message = 'reminder';
  return {
    type: parsed.isRecurring ? 'recurring' : 'scheduled_message',
    description: message,
    message,
    timeExpression: text,
    interval: parsed.interval || null,
  };
}

function buildFileRequest(text) {
  const normalized = text.toLowerCase();
  const words = normalized.match(/[a-z0-9][a-z0-9._-]*/g) || [];
  const keywords = [...new Set(words.filter(word => (
    word.length > 2 && !FILE_STOP_WORDS.has(word)
  )))].slice(0, 12);

  let fileType = '';
  if (/\b(pdf)\b/i.test(text)) fileType = 'pdf';
  else if (/\b(image|img|photo|pic|jpg|jpeg|png)\b/i.test(text)) fileType = 'image';
  else if (/\b(document|doc|file)\b/i.test(text)) fileType = 'document';

  return { description: text.trim(), keywords, fileType };
}

function parseBlock(reply, tag) {
  const open = `<${tag}>`, close = `</${tag}>`;
  const selfClose = `<${tag}/>`;
  if (reply.includes(selfClose)) return { found: true, data: null, isSelfClose: true };
  const start = reply.indexOf(open);
  const end = reply.indexOf(close);
  if (start === -1 || end === -1) return { found: false };
  try {
    const json = reply.slice(start + open.length, end).trim();
    return { found: true, data: JSON.parse(json), isSelfClose: false };
  } catch {
    return { found: false };
  }
}

function cleanReply(reply) {
  return reply
    .replace(/<SK_NO_REPLY\s*\/?\s*>/gi, '')
    .replace(/<SK_TASK>[\s\S]*?<\/SK_TASK>/g, '')
    .replace(/<SK_FILE>[\s\S]*?<\/SK_FILE>/g, '')
    .replace(/<SK_LIST_TASKS\/>/g, '')
    .replace(/<SK_CANCEL_TASK>[\s\S]*?<\/SK_CANCEL_TASK>/g, '')
    .trim();
}

// ── Main process function ──────────────────────────────────────────────────────

async function processMessage(chatId, senderName, message, fromNumber = null, options = {}) {
  const now = new Date().toLocaleString('en-IN', {
    dateStyle: 'short', timeStyle: 'short', hour12: true,
  });
  const timeOnly = new Date().toLocaleTimeString('en-IN', { timeStyle: 'short', hour12: true });

  const ownerConfig = getOwnerConfig();
  
  // ══════════════════════════════════════════════════════════════════════════════
  // STEP 1: Check owner control messages (stop/start)
  // ══════════════════════════════════════════════════════════════════════════════
  
  if (replyPolicy.isOwnerControlMessage(fromNumber, ownerConfig.number)) {
    const control = replyPolicy.processOwnerControl(message);
    
    if (control.isControl) {
      console.log(`[SKAgent] Owner control: ${control.action}`);
      memory.addMessage(chatId, 'assistant', control.reply);
      return {
        reply: control.reply,
        controlAction: control.action,
        noReply: false,
      };
    }
  }
  
  // ══════════════════════════════════════════════════════════════════════════════
  // STEP 2: Get contact profile & dialect
  // ══════════════════════════════════════════════════════════════════════════════
  
  const contactProfile = styleProfile.getProfile(chatId, senderName);
  const dialectPhrases = dialectMemory.getDialectForContact(chatId);
  
  // Update profile from contact message
  styleProfile.updateFromContactMessage(chatId, senderName, message);
  
  // ══════════════════════════════════════════════════════════════════════════════
  // STEP 3: Normalize message with dialect knowledge
  // ══════════════════════════════════════════════════════════════════════════════
  
  const normalizedMessage = dialectMemory.normalizeWithDialect(chatId, 
    normalizeForReasoning(message)
  );
  
  // Add to memory
  memory.addMessage(chatId, 'contact', message);
  const history = memory.getHistory(chatId);
  
  // ══════════════════════════════════════════════════════════════════════════════
  // STEP 4: Reply policy and consent gate
  // ══════════════════════════════════════════════════════════════════════════════
  const previousMessages = history.slice(0, -1);
  
  const messageTypePolicy = classifyReplyPolicy({ text: message, senderName, type: 'chat' }, previousMessages.map(item => item.content));
  if (messageTypePolicy === 'NO_REPLY') {
    return {
      reply: null,
      noReply: true,
      reason: 'MESSAGE_POLICY_NO_REPLY',
    };
  }

  const firstInteraction = false;
  const finishFirstInteraction = reply => reply;

  // ══════════════════════════════════════════════════════════════════════════════
  // STEP 5: Social intent classification
  // ══════════════════════════════════════════════════════════════════════════════
  const previousMessage = previousMessages.length > 0
    ? previousMessages[previousMessages.length - 1]
    : null;
  const socialIntent = classifySocialIntent(message, {
    previousMessage: previousMessage?.content,
    previousSenderRole: previousMessage?.role,
    messageCount: previousMessages.length,
  });
  console.log(`[SKAgent] Social intent: ${socialIntent.intent}, mode: ${socialIntent.replyMode}`);

  const policyDecision = replyPolicy.shouldReply(message, {
    chatId,
    senderName,
    fromNumber,
    ownerNumber: ownerConfig.number,
    previousMessages,
    contactProfile,
    isGroup: Boolean(options.isGroup),
  });
  console.log(`[SKAgent] Reply policy: ${policyDecision.reason}, should reply: ${policyDecision.shouldReply}`);
  if (!policyDecision.shouldReply) {
    return { reply: null, noReply: true, reason: policyDecision.reason, socialIntent: socialIntent.intent };
  }
  
  // ══════════════════════════════════════════════════════════════════════════════
  // STEP 6: Fast-path intents (no LLM needed)
  // ══════════════════════════════════════════════════════════════════════════════
  
  const intent = detectIntent(message, options);

  const hasExtractedMediaContent = /\[MEDIA_CONTENT\]/i.test(message);
  if (options.hasMedia && !hasExtractedMediaContent && ['image', 'document', 'video', 'audio'].includes(options.mediaType) &&
      !/(?:send|share|bhej|pathav|forward|upload|save|keep|store)/i.test(message)) {
    const mediaLabel = options.mediaType === 'document' ? 'document' : options.mediaType;
    const reply = `Document milala${mediaLabel === 'document' ? '' : `, ${mediaLabel}`}.`;
    memory.addMessage(chatId, 'assistant', reply);
    return { reply, taskAction: null, fileRequest: null, socialIntent: socialIntent.intent, simpleBrain: 'media_received' };
  }
  
  // Time query
  if (intent === 'time') {
    const reply = finishFirstInteraction(`${timeOnly}`);
    memory.addMessage(chatId, 'assistant', reply);
    return { reply, taskAction: null, fileRequest: null };
  }
  
  // List tasks
  if (intent === 'list_tasks') {
    const taskList = scheduler.getTasksForChat(chatId);
    const reply = finishFirstInteraction(taskList.length === 0
      ? 'No tasks'
      : scheduler.formatTaskList(taskList));
    memory.addMessage(chatId, 'assistant', reply);
    return { reply, taskAction: null, fileRequest: null };
  }
  
  // Cancel tasks
  if (intent === 'cancel_tasks') {
    const count = scheduler.cancelAllForChat(chatId);
    const reply = finishFirstInteraction(count > 0 ? `Done, cancelled ${count}` : 'No tasks');
    memory.addMessage(chatId, 'assistant', reply);
    return { reply, taskAction: null, fileRequest: null };
  }
  
  // File request
  if (intent === 'file' && (!options.hasMedia || /(?:send|share|bhej|pathav|forward|upload|save|keep|store)\b/i.test(message))) {
    const reply = finishFirstInteraction('Checking...');
    memory.addMessage(chatId, 'assistant', reply);
    return { reply, taskAction: null, fileRequest: buildFileRequest(message) };
  }

  const localTaskAction = buildLocalTaskAction(message);
  if (localTaskAction) {
    const reply = `Barobar, ${localTaskAction.message} pathavto.`;
    memory.addMessage(chatId, 'assistant', reply);
    return { reply, taskAction: localTaskAction, fileRequest: null, socialIntent: socialIntent.intent, simpleBrain: 'local_task' };
  }
  
  // ══════════════════════════════════════════════════════════════════════════════
  // STEP 7: SIMPLE BRAIN FIRST — Deterministic pattern matching (NO LLM)
  //         Only fall back to LLM if Simple Brain has no match for the message.
  // ══════════════════════════════════════════════════════════════════════════════

  const simpleResult = tryReply({
    chatId,
    senderName,
    message,
    history,
    socialIntent: socialIntent.intent,
  });
  
  if (simpleResult.usedSimpleBrain) {
    console.log(`[SKAgent] SimpleBrain match: ${simpleResult.source}`);
    if (simpleResult.noReply || !simpleResult.reply) {
      if (firstInteraction) {
        const reply = finishFirstInteraction(null);
        memory.addMessage(chatId, 'assistant', reply);
        return { reply, taskAction: null, fileRequest: null, socialIntent: socialIntent.intent };
      }
      return { reply: null, noReply: true, reason: simpleResult.source, socialIntent: socialIntent.intent };
    }
    const reply = finishFirstInteraction(simpleResult.reply);
    memory.addMessage(chatId, 'assistant', reply);
    return { reply, taskAction: null, fileRequest: null, socialIntent: socialIntent.intent, simpleBrain: simpleResult.source };
  }
  
  console.log(`[SKAgent] SimpleBrain no match (${simpleResult.source}) → falling back to LLM`);
  
  // ══════════════════════════════════════════════════════════════════════════════
  // STEP 8: Build LLM context + chat history (FALLBACK ONLY)
  // ══════════════════════════════════════════════════════════════════════════════
  
  // Update conversation state for context analysis
  conversationState.updateState(chatId, { 
    original: message, 
    normalized: normalizedMessage, 
    role: 'contact' 
  });
  const state = conversationState.getState(chatId);
  
  const convIntel = buildConversationContext(history, state, message, normalizedMessage);
  const lowerMessage = message.toLowerCase();
  const relevantDialect = Object.entries(dialectPhrases)
    .filter(([phrase]) => lowerMessage.includes(phrase.toLowerCase()))
    .slice(0, 12)
    .map(([phrase, data]) => `${phrase} = ${data.meaning}`).join('; ');
  const systemPrompt = buildSystemPrompt();

  // Build PROPER CHAT HISTORY as alternating user/assistant messages
  // This is CRITICAL — LLMs are trained on this format, not text blobs
  // NOTE: history already includes the current message (added above), so slice up to -1
  const historyWindow = history.slice(-12, -1);
  const chatHistory = [];
  
  for (const h of historyWindow) {
    if (h.role === 'assistant') {
      chatHistory.push({ role: 'assistant', content: h.content });
    } else {
      const msgSender = h.role === 'owner' ? ownerConfig.shortName : (h.senderName || senderName);
      chatHistory.push({ role: 'user', content: `[${msgSender}]: ${h.content}` });
    }
  }
  
  // Add CURRENT message as the final user message (the one to respond to)
  chatHistory.push({ 
    role: 'user', 
    content: `[${senderName}]: ${message}` + 
             (normalizedMessage !== message ? `\n(Normalized: ${normalizedMessage})` : '')
  });
  
  // Final messages array: system prompt first, then chat history
  const mediaInstruction = hasExtractedMediaContent
    ? '\nDOCUMENT/IMAGE ANALYSIS RULE: The message contains extracted or analyzed media content. Answer the user\'s question using that content. If no question is asked, give a concise summary. Do not ask the user to send the document again and do not invent details absent from the extracted content.'
    : '';
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `CONTACT LANGUAGE: ${contactProfile.preferredLanguage || 'unknown'}\nCHAT MODE: ACTIVE${mediaInstruction}\nKNOWN RELEVANT DIALECT: ${relevantDialect || 'none'}\nSHORT CONVERSATION STATE: ${convIntel.slice(0, 1200)}\nRECENT CHAT:\n${chatHistory.slice(0, -1).map(item => `${item.role}: ${item.content}`).join('\n')}\nCURRENT MESSAGE: ${message}` },
  ];
  
  // ══════════════════════════════════════════════════════════════════════════════
  // STEP 8: Call LLM
  // ══════════════════════════════════════════════════════════════════════════════
  
  let rawReply;
  try {
    rawReply = await generateResponse({ 
      messages, 
      userId: chatId, 
      metadata: { senderName, socialIntent: socialIntent.intent } 
    });
  } catch (err) {
    console.error('[SKAgent] LLM error:', err.message);
    
    // Fallback based on social intent
    if (socialIntent.intent === 'GREETING') {
      const reply = finishFirstInteraction('Hey');
      memory.addMessage(chatId, 'assistant', reply);
      return { reply, taskAction: null, fileRequest: null };
    }
    
    return { reply: null, noReply: true, taskAction: null, fileRequest: null };
  }
  
  // Check for NO_REPLY marker
  if (/<SK_NO_REPLY\s*\/?\s*>/i.test(rawReply)) {
    console.log('[SKAgent] LLM returned NO_REPLY');
    const reply = socialIntent.intent === 'CONVERSATION_ENDING' ? 'Bye' : 'Okay';
    memory.addMessage(chatId, 'assistant', reply);
    return { reply, noReply: false, taskAction: null, fileRequest: null, socialIntent: socialIntent.intent };
  }
  
  // ══════════════════════════════════════════════════════════════════════════════
  // STEP 9: Parse special blocks (tasks, files)
  // ══════════════════════════════════════════════════════════════════════════════
  
  let taskAction = null;
  let fileRequest = null;
  
  const taskBlock = parseBlock(rawReply, 'SK_TASK');
  if (taskBlock.found && taskBlock.data) {
    const isPastTaskComplaint = /\b(?:ka\s+nahi|ka\s+nahi\s+kela|why\s+didn'?t|not\s+sent|nahi\s+kela)\b/i.test(message) &&
      !/\b(?:remind|reminder|schedule|set\s+(?:an\s+)?alarm|send\s+me|msg\s+kar|message\s+kar)\b/i.test(message);
    taskAction = isPastTaskComplaint ? null : taskBlock.data;
    if (taskAction) {
      const mentionsOwner = textMentionsOwner(message);
      const saysSelfRemind = textSaysSelfRemind(message);
      if (mentionsOwner && !saysSelfRemind) taskAction.recipients = 'owner';
      if (saysSelfRemind && !mentionsOwner) taskAction.recipients = 'self';
      if (!taskAction.recipients) taskAction.recipients = mentionsOwner ? 'owner' : 'self';
    }
  }
  
  const fileBlock = parseBlock(rawReply, 'SK_FILE');
  if (fileBlock.found && fileBlock.data) {
    fileRequest = fileBlock.data;
  }
  
  // ══════════════════════════════════════════════════════════════════════════════
  // STEP 10: Clean and filter response
  // ══════════════════════════════════════════════════════════════════════════════
  
  let reply = cleanReply(rawReply);
  
  reply = finishFirstInteraction(reply);

  if (reply) {
    // Apply response filter
    const filterResult = responseFilter.filterResponse(message, reply, {
      isQuestion: /\?/.test(message),
      socialIntent: socialIntent.intent,
    });
    
    if (filterResult.issues.length > 0) {
      console.log(`[SKAgent] Response filter issues: ${filterResult.issues.join(', ')}`);
    }
    
    // Use cleaned response
    if (filterResult.cleanedResponse) {
      reply = filterResult.cleanedResponse;
    }
    
    // If response has critical issues, return fallback
    if (filterResult.shouldRegenerate) {
      console.log('[SKAgent] Response quality too low, using fallback');
      
      if (socialIntent.intent === 'GREETING') {
        reply = 'Hey';
      } else if (socialIntent.replyMode === 'PLAYFUL') {
        reply = '😂';
      } else if (taskAction) {
        reply = 'Ok 👍';
      } else {
        reply = null;
      }
    }
  }
  
  // ══════════════════════════════════════════════════════════════════════════════
  // STEP 11: Fallback if no reply generated
  // ══════════════════════════════════════════════════════════════════════════════
  
  if (!reply && taskAction) {
    const ownerCfg = getOwnerConfig();
    if (isOwnerRecipient(taskAction.recipients)) {
      reply = `Got it 👍`;
    } else {
      reply = 'Done ✅';
    }
  }
  
  // ══════════════════════════════════════════════════════════════════════════════
  // STEP 12: Log metrics and return
  // ══════════════════════════════════════════════════════════════════════════════
  
  const wordCount = reply ? reply.split(/\s+/).length : 0;
  const hasQuestion = reply ? reply.includes('?') : false;
  
  console.log(`[SK] intent=${socialIntent.intent} lang=${contactProfile.preferredLanguage} mode=${socialIntent.replyMode} words=${wordCount} question=${hasQuestion}`);
  
  if (reply) {
    memory.addMessage(chatId, 'assistant', reply);
  }
  
  return { reply, taskAction, fileRequest, socialIntent: socialIntent.intent };
}

// ── Schedule task ───────────────────────────────────────────────────────────────

function isOwnerRecipient(recipients) {
  if (!recipients) return false;
  const r = String(recipients).toLowerCase().trim();
  return r === 'owner' || r.includes('boss') || ownerNameRegex().test(r);
}

function scheduleTask(chatId, senderName, taskAction) {
  const ownerConfig = getOwnerConfig();
  const timeExpr = taskAction.timeExpression || taskAction.message || taskAction.description || '';
  const parsed = timeExpr ? scheduler.parseTimeExpression(timeExpr) : null;
  const recipients = taskAction.recipients || 'self';

  let targetChatId = chatId;
  let isForOwner = false;

  if (isOwnerRecipient(recipients) && ownerConfig.chatId) {
    targetChatId = ownerConfig.chatId;
    isForOwner = true;
  }

  return scheduler.addTask({
    chatId: targetChatId,
    senderName,
    type: taskAction.type || 'reminder',
    description: taskAction.description || 'Task',
    message: taskAction.message || taskAction.description || 'Reminder!',
    triggerAt: parsed?.triggerAt || null,
    interval: parsed?.interval || null,
    recipients,
    isForOwner,
    originalSenderChatId: chatId,
  });
}

// ── Exports ─────────────────────────────────────────────────────────────────────

// Re-export personaEngine owner config functions
function setOwnerConfigWrapper(cfg) {
  const personaEngine = require('./personaEngine');
  personaEngine.setOwnerConfig(cfg);
  
  // Also update reply policy
  if (cfg.number) {
    replyPolicy.setAutoReply(true); // Default to enabled
  }
}

module.exports = {
  processMessage,
  runtimePrompt: buildSystemPrompt(),
  buildSystemPrompt,
  scheduleTask,
  setOwnerConfig: setOwnerConfigWrapper,
  getOwnerConfig,
  isOwnerRecipient,
  
  // Expose new modules for external use
  replyPolicy,
  styleProfile,
  dialectMemory,
  responseFilter,
};
