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
const consentGate = require('./consentGate');
const memory = require('../memory/conversationMemory');
const scheduler = require('./taskScheduler');
const { normalizeForReasoning } = require('./messageNormalizer');
const { buildConversationContext } = require('./contextBuilder');
const conversationState = require('./conversationState');
const { tryReply } = require('./simpleBrain');

const { setOwnerConfig, getOwnerConfig } = require('./personaEngine');
const { classifySocialIntent } = require('./socialIntent');
const styleProfile = require('./styleProfile');
const dialectMemory = require('./dialectMemory');
const replyPolicy = require('./replyPolicy');
const responseFilter = require('./responseFilter');
const { classifyReplyPolicy } = require('./messagePolicy');

const SK_RUNTIME_PROMPT = "You are SK, Mr. Suraj's WhatsApp AI assistant. Read the recent conversation and understand what the latest message actually means before replying. Reply naturally and directly in the sender's language/style. Keep casual replies very short. Do not explain words unless explicitly asked for their meaning. Do not repeat the sender's message. Do not behave like customer support. Do not ask unnecessary questions. Do not keep the conversation alive artificially. If no reply is naturally required, return <SK_NO_REPLY>. If directly asked whether you are Suraj, say you are Mr. Suraj's AI assistant. If asked where Suraj is, say Suraj is busy. Return only the final reply.";

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

const INFORM_OWNER_PATTERNS = [
  /(tell|inform|msg|message|batao|bhejo|bta|yaad\s+dila(na|o)?|remind)\s+(\w+\s+)?(suraj|owner|boss|sir|him|unhe|unko)/i,
  /suraj\s+(ko|ko\s+to|se|ke\s+liye)/i,
  /(need|want|going|have|supposed)\s+to\s+(meet|see|call|talk\s+to|contact)\s+suraj/i,
  /meet\s+suraj/i, /suraj\s+(to\s+)?meet/i,
];

const SELF_REMIND_PATTERNS = [
  /remind\s+me/i, /mujhe\s+yaad/i, /mere\s+liye\s+reminder/i, /yaad\s+dila(na)?\s+mujhe/i,
  /(i|main|mera|meri|hum)\s+.*\b(reminder|alarm|yaad)\b/i,
];

// ── Helper functions ────────────────────────────────────────────────────────────

function detectIntent(text) {
  if (LIST_KEYWORDS.some(r => r.test(text))) return 'list_tasks';
  if (CANCEL_KEYWORDS.some(r => r.test(text))) return 'cancel_tasks';
  if (TIME_KEYWORDS.test(text)) return 'time';
  if (TASK_KEYWORDS.some(r => r.test(text))) return 'task';
  if (FILE_KEYWORDS.some(r => r.test(text))) return 'file';
  return 'chat';
}

function textMentionsOwner(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  return INFORM_OWNER_PATTERNS.some(p => p.test(t)) || /suraj|zalke|boss/.test(t);
}

function textSaysSelfRemind(text) {
  if (!text) return false;
  return SELF_REMIND_PATTERNS.some(p => p.test(text));
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

  if (options.isGroup) {
    return { reply: null, noReply: true, reason: 'GROUP_CONSENT_DISABLED' };
  }

  let consent = consentGate.get(chatId);
  if (consentGate.isRevokeCommand(message) && consent.state === consentGate.CONSENT_STATES.ALLOWED) {
    consent = consentGate.set(chatId, consentGate.CONSENT_STATES.DENIED);
    memory.addMessage(chatId, 'assistant', 'Okay');
    return { reply: 'Okay', noReply: false, consentState: consent.state };
  }

  if (consent.state === consentGate.CONSENT_STATES.DENIED) {
    if (consentGate.isEnableCommand(message)) {
      consent = consentGate.set(chatId, consentGate.CONSENT_STATES.ALLOWED);
      memory.addMessage(chatId, 'assistant', 'Okay');
      return { reply: 'Okay', noReply: false, consentState: consent.state };
    }
    return { reply: null, noReply: true, reason: 'CONSENT_DENIED', consentState: consent.state };
  }

  if (consent.state === consentGate.CONSENT_STATES.PENDING) {
    const decision = consentGate.classifyDecision(message);
    if (decision === 'AGREE') {
      consent = consentGate.set(chatId, consentGate.CONSENT_STATES.ALLOWED);
      memory.addMessage(chatId, 'assistant', 'Okay');
      return { reply: 'Okay', noReply: false, consentState: consent.state };
    }
    if (decision === 'DISAGREE') {
      consent = consentGate.set(chatId, consentGate.CONSENT_STATES.DENIED);
      memory.addMessage(chatId, 'assistant', 'Okay');
      return { reply: 'Okay', noReply: false, consentState: consent.state };
    }
    const clarification = consentGate.disclosure(message, contactProfile.preferredLanguage);
    memory.addMessage(chatId, 'assistant', clarification);
    return { reply: clarification, noReply: false, consentState: consent.state };
  }

  const firstInteraction = consent.state === consentGate.CONSENT_STATES.UNKNOWN;
  const finishFirstInteraction = reply => {
    if (!firstInteraction) return reply;
    consentGate.set(chatId, consentGate.CONSENT_STATES.PENDING);
    return `${reply || 'Okay'} ${consentGate.disclosure(message, contactProfile.preferredLanguage)}`;
  };

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
    isGroup: false,
  });
  console.log(`[SKAgent] Reply policy: ${policyDecision.reason}, should reply: ${policyDecision.shouldReply}`);
  if (!policyDecision.shouldReply) {
    return { reply: null, noReply: true, reason: policyDecision.reason, socialIntent: socialIntent.intent };
  }
  
  // ══════════════════════════════════════════════════════════════════════════════
  // STEP 6: Fast-path intents (no LLM needed)
  // ══════════════════════════════════════════════════════════════════════════════
  
  const intent = detectIntent(message);
  
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
  if (intent === 'file') {
    const reply = finishFirstInteraction('Checking...');
    memory.addMessage(chatId, 'assistant', reply);
    return { reply, taskAction: null, fileRequest: buildFileRequest(message) };
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
  const relevantDialect = Object.entries(dialectPhrases).slice(0, 12)
    .map(([phrase, data]) => `${phrase} = ${data.meaning}`).join('; ');
  const systemPrompt = SK_RUNTIME_PROMPT;

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
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `CONTACT LANGUAGE: ${contactProfile.preferredLanguage || 'unknown'}\nCONSENT STATE: ${consent.state}\nKNOWN RELEVANT DIALECT: ${relevantDialect || 'none'}\nSHORT CONVERSATION STATE: ${convIntel.slice(0, 1200)}\nRECENT CHAT:\n${chatHistory.slice(0, -1).map(item => `${item.role}: ${item.content}`).join('\n')}\nCURRENT MESSAGE: ${message}` },
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
    if (firstInteraction) {
      const reply = finishFirstInteraction(null);
      memory.addMessage(chatId, 'assistant', reply);
      return { reply, noReply: false, taskAction: null, fileRequest: null };
    }
    return { reply: null, noReply: true, taskAction: null, fileRequest: null };
  }
  
  // ══════════════════════════════════════════════════════════════════════════════
  // STEP 9: Parse special blocks (tasks, files)
  // ══════════════════════════════════════════════════════════════════════════════
  
  let taskAction = null;
  let fileRequest = null;
  
  const taskBlock = parseBlock(rawReply, 'SK_TASK');
  if (taskBlock.found && taskBlock.data) {
    taskAction = taskBlock.data;
    
    // Force routing based on keywords
    const mentionsOwner = textMentionsOwner(message);
    const saysSelfRemind = textSaysSelfRemind(message);
    
    if (mentionsOwner && !saysSelfRemind) {
      taskAction.recipients = 'owner';
    }
    
    if (saysSelfRemind && !mentionsOwner) {
      taskAction.recipients = 'self';
    }
    
    if (!taskAction.recipients) {
      taskAction.recipients = mentionsOwner ? 'owner' : 'self';
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
  return r === 'owner' || r.includes('suraj') || r.includes('boss') || r.includes('zalke');
}

function scheduleTask(chatId, senderName, taskAction) {
  const ownerConfig = getOwnerConfig();
  const timeExpr = taskAction.timeExpression || '';
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
  runtimePrompt: SK_RUNTIME_PROMPT,
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
