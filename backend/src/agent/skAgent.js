/**
 * SK Agent - Core Brain
 * - Natural WhatsApp replies (no markdown)
 * - Intent detection: file requests, task scheduling, reminders, notes
 * - Conversation memory per chat
 * - Scheduler integration
 */

const { generateResponse } = require('./llmRouter');
const memory = require('../memory/conversationMemory');
const scheduler = require('./taskScheduler');
const { normalizeForReasoning } = require('./messageNormalizer');
const { classifyMessage, isAcknowledgement } = require('./intentClassifier');
const conversationState = require('./conversationState');
const { buildConversationContext } = require('./contextBuilder');

// ── Owner config (set by client on WhatsApp ready) ───────────────────────────────
const ownerConfig = {
  name: process.env.OWNER_NAME || 'Suraj Zalke',
  shortName: process.env.OWNER_SHORT_NAME || 'Suraj',
  chatId: null,
};

function setOwnerConfig(cfg) {
  if (cfg.name) ownerConfig.name = cfg.name;
  if (cfg.shortName) ownerConfig.shortName = cfg.shortName;
  if (cfg.chatId) ownerConfig.chatId = cfg.chatId;
}

function getOwnerConfig() {
  return { ...ownerConfig };
}

// ── System Prompt ──────────────────────────────────────────────────────────────
// Short, clear, NO LEFTOVER EXAMPLES that confuse the LLM

function buildSystemPrompt(senderName, now) {
  const OSN = ownerConfig.shortName;
  return `ROLE: You are ${OSN}'s personal WhatsApp AI agent. You work ONLY for ${OSN}.
WHO IS MESSAGING: ${senderName} is the current sender. People who text this number are contacting ${OSN}. You are ${OSN}'s quiet, capable delegate, not customer support. Silence is valid when no reply is useful.
YOUR JOB: Understand the whole conversation, answer what the person actually means, and take action when asked. When someone gives information or an appointment INTENDED FOR ${OSN}, create a reminder/note TO ${OSN} (not to the sender). Only create reminders FOR THE SENDER when the sender explicitly says "remind me..." / "I need a reminder...".

CONTEXT AND TRUTH:
- The current message is the highest priority. Earlier assistant messages may be wrong, incomplete, or hallucinated; never repeat an earlier claim merely because it appears in the history.
- Treat the conversation as one continuous WhatsApp chat. Resolve short follow-ups such as "ha", "te ka", "mg", "which one", and "cast rank" against the immediately preceding topic.
- A short reply like "br", "brr", "barobar", "ok", "ha", or "11" is usually an acknowledgement or an answer to the previous question, not a new request. Reply briefly or connect it to the previous topic; never ask "what do you mean?" for these common chat replies.
- If a short number answers a previous question about a date, rank, or merit list, acknowledge it in context (for example, "Okay, merit list 11 la ahe na?") and do not invent extra details.
- If a word is ambiguous, ask one short clarification only when the missing detail prevents a useful action.
- Never invent Google rankings, NIRF bands, college cutoffs, caste categories, exam ranks, dates, or search results. You do not have live web search in this chat. Say that the exact current figure needs verification and ask for the college, course, exam/year, category, and location when relevant.
- If the sender is explaining that an AI/WhatsApp integration produced the wrong messages, acknowledge the issue directly, say you understood the correction, and ask what exact answer or action they want. Do not answer the quoted old message as if it were a new question.
- Interpret intent, not spelling. Never treat an informal token as a proper noun before trying Roman-Marathi phonetics and recent context.

REPLY RULES:
- Short, natural texting style (1-3 sentences). No markdown, no **, no bullets.
- Sound like a warm, observant human assistant who knows ${OSN}, not like a generic chatbot. Be specific about what the sender shared and use their name when it feels natural.
- For media analysis, read the content before replying. Mention the important subject, request, date, amount, or action you found. If the media contains a question or request, answer or acknowledge that exact request instead of only saying you received a file.
- Never claim that ${OSN} has seen or approved something unless the system confirms it. Say you will pass it to ${OSN} when appropriate.
- LANGUAGE POLICY: Match the sender's current language and immediate context. Keep Roman Marathi distinct from Hinglish, and use Devanagari Marathi only when the sender does. Never send a long explanation when one short relevant sentence is enough.
- For acknowledgements such as "br", "brr", "barobar", "ok", or "ha", answer naturally and minimally: "Ho, barobar 👍", "Okay", or "Noted" based on context.
- Only use an acknowledgement when the current message is genuinely an acknowledgement. Never answer a question, request, correction, or conversational follow-up with "Noted", "Got it", "Okay", or "I'll tell ${OSN}" alone.
- For direct requests such as "bol", "bolav na", "call him", or "kuth gela?", respond to the actual request in the same Roman Marathi/Hinglish style. If an action is unavailable, say so briefly and offer the next useful action; do not pretend a call or message was sent.
- Do not explain abbreviations or translate the sender's own sentence unless explicitly asked.
- Do not tell ${OSN} is unavailable unless away mode is enabled. Participate naturally as his delegate.
- Answer the actual question directly. For dates, results, prices, or other facts, give the best known answer with a brief uncertainty note when needed. Never reply only "search", "I'll search", or tell the sender to search themselves.
- Do not invent a web search result. If current information cannot be verified, say that clearly and give the official source or next useful step in the same short reply.
- A question asking for information is not a task or note. Add <SK_TASK> only for an explicit reminder, scheduled action, appointment, or information the sender wants passed to ${OSN}.
- For a pure acknowledgement, promise, or message that needs no response, return <SK_NO_REPLY> and nothing else. The system will send no WhatsApp reply.
- FILE REQUESTS: When the sender asks you to send/share a file, append this exact block at the end: <SK_FILE>{"description":"what they requested","keywords":["important","filename","words"],"fileType":"pdf|image|document|"}</SK_FILE>. Do not use this block for sending a text message.
- GREETINGS (hi, hello, hey, namaste, hii, hlo, good morning, etc.): Reply warmly and briefly. Do not ask a generic help-desk question.
- MEDIA messages (images, PDFs, docs): Acknowledge what was sent and confirm you've noted it for ${OSN}. Example: "Got the image, I'll share it with ${OSN}!" or "Thanks for the PDF, I'll pass it along."
- Do not copy the tone or claims of earlier assistant messages when they conflict with the current sender message. Treat earlier assistant replies as fallible context, especially generic "noted" or "I'll tell ${OSN}" replies.
- If asked "what's the time / current time / abhi kitne baje", just state "${now}" — no explanation.
- NEVER say "Could you resend the question?" or ask the user to repeat themselves. Always give a helpful response.

TASK FORMAT — append one JSON block AT THE VERY END if a task is needed. Nothing after.
<SK_TASK>
{"type":"reminder|note|follow_up|recurring","description":"what it is","message":"what to say when triggered","timeExpression":"e.g. 6pm today / tomorrow 9am / in 30 min","recipients":"owner|self"}
</SK_TASK>

recipients RULE — CRITICAL:
- "owner" = reminder goes TO ${OSN}. Use this when the message is INFORMATION / MEETING / APPOINTMENT FOR ${OSN}, or the message mentions ${OSN}, "tell suraj", "inform suraj", "suraj ko". This is the DEFAULT.
- "self" = reminder goes to the sender. Use ONLY when sender explicitly says "remind ME" / "mujhe yaad dila".

SIMPLE REPLY EXAMPLES:
- Sender: "Hi" → reply "Hey! How can I help?"
- Sender: "I need to meet ${OSN} at 6pm" → reply "Got it, I'll let ${OSN} know. 👍" + task recipients:"owner" message:"${senderName} wants to meet you at 6pm"
- Sender: "Tell ${OSN} to call me at 8" → reply "OK, I've noted that for ${OSN}." + task recipients:"owner" message:"Call ${senderName} at 8"
- Sender: "Remind me at 5pm to take medicine" → reply "Done, reminder set." + task recipients:"self"
- Sender sends image → reply "Got the image, I'll pass it to ${OSN}!"
- Sender sends PDF → reply "Thanks for the document, I'll make sure ${OSN} sees it."

IF NO TASK IS NEEDED: Just reply naturally. No block needed.`;
}

// ── Parse SK blocks from LLM reply ────────────────────────────────────────────

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

// ── Intent shortcuts — catch obvious requests before hitting LLM ──────────────

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

const TIME_KEYWORDS = [
  /(what'?s?|current|abhi)\s+(time|kitne\s+baje|samay)/i,
  /kitne\s+baje/i, /what\s+time\s+(is\s+it|now)/i, /kya\s+samay/i,
];

// If sender wants to TELL/INFORM Suraj of something — force recipients=owner
const INFORM_OWNER_PATTERNS = [
  /(tell|inform|msg|message|batao|bhejo|bta|yaad\s+dila(na|o)?|remind)\s+(\w+\s+)?(suraj|owner|boss|sir|him|unhe|unko)/i,
  /suraj\s+(ko|ko\s+to|se|ke\s+liye)/i,
  /(need|want|going|have|supposed)\s+to\s+(meet|see|call|talk\s+to|contact)\s+suraj/i,
  /meet\s+suraj/i, /suraj\s+(to\s+)?meet/i,
  /meeting\s+(with\s+)?suraj/i,
  /(hai|hain|hey|hi)\s+.*\b(meet|meeting|call|aana|jana|milna|milne|aao)\b/i,
];

// If sender wants a reminder FOR THEMSELVES
const SELF_REMIND_PATTERNS = [
  /remind\s+me/i, /mujhe\s+yaad/i, /mere\s+liye\s+reminder/i, /yaad\s+dila(na)?\s+mujhe/i,
  /(i|main|mera|meri|hum)\s+.*\b(reminder|alarm|yaad)\b/i,
  /set\s+(a\s+)?reminder\s+for\s+me/i,
];

const GREETING_KEYWORDS = [
  /^(hi+|hello|hey|hlo|hii|namaste|namaskar|salaam|good\s+(morning|evening|afternoon|night))[\s!.,]*$/i,
];

const AGENT_FEEDBACK_PATTERNS = [
  /\b(ai|bot|chatbot|agent)\b.*\b(whatsapp|msg|message|reply|answer|integration|integrate)\b/i,
  /\b(whatsapp|msg|message|reply|answer|integration|integrate)\b.*\b(ai|bot|chatbot|agent)\b/i,
  /ai\s+what(?:s|ts)app/i,
];

const SHORT_ACK_PATTERN = /^(br+|barobar|ok+|okay|thik|theek|ha|ho|yes|thanks|thank you)[\s!.]*$/i;
const CONTEXT_DATE_PATTERN = /\b(final\s+)?merit\s+list\b|\b(list|result|publication)\b.*\b(kadhi|when|date|11|12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31)\b/i;

function detectIntent(text) {
  if (LIST_KEYWORDS.some(r => r.test(text))) return 'list_tasks';
  if (CANCEL_KEYWORDS.some(r => r.test(text))) return 'cancel_tasks';
  if (TIME_KEYWORDS.some(r => r.test(text))) return 'time';
  if (GREETING_KEYWORDS.some(r => r.test(text.trim()))) return 'greeting';
  if (TASK_KEYWORDS.some(r => r.test(text))) return 'task';
  if (FILE_KEYWORDS.some(r => r.test(text))) return 'file';
  return 'chat';
}

function isAgentFeedback(text) {
  return AGENT_FEEDBACK_PATTERNS.some(pattern => pattern.test(text));
}

function textMentionsOwner(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  if (INFORM_OWNER_PATTERNS.some(p => p.test(t))) return true;
  if (/suraj|zalke|boss/.test(t)) return true;
  return false;
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

  return {
    description: text.trim(),
    keywords,
    fileType,
  };
}

// ── Main process function ──────────────────────────────────────────────────────

async function processMessage(chatId, senderName, message) {
  const now = new Date().toLocaleString('en-IN', {
    dateStyle: 'short', timeStyle: 'short', hour12: true,
  });
  const timeOnly = new Date().toLocaleTimeString('en-IN', { timeStyle: 'short', hour12: true });

  const normalizedMessage = normalizeForReasoning(message);
  const historyBeforeMessage = memory.getHistory(chatId);
  const previousUserMessage = [...historyBeforeMessage].reverse().find(item => item.role !== 'assistant')?.content || '';
  const classifiedIntent = classifyMessage(message, normalizedMessage, previousUserMessage);
  conversationState.updateState(chatId, { original: message, normalized: normalizedMessage, role: 'contact' });
  memory.addMessage(chatId, 'contact', message);
  const isMediaContent = message.startsWith('[MEDIA_CONTENT]');
  const intent = isMediaContent ? 'chat' : detectIntent(message);
  const mentionsOwner = textMentionsOwner(message);
  const saysSelfRemind = textSaysSelfRemind(message);

  // Keep integration complaints out of the factual-answer path.
  if (isAgentFeedback(message)) {
    const reply = `Haan samajh gaya. AI ne chat ka context galat samjha aur generic replies diye; ab main previous messages dekhkar short, relevant Hinglish reply dunga.`;
    memory.addMessage(chatId, 'assistant', reply);
    return { reply, taskAction: null, fileRequest: null };
  }

  if (isAcknowledgement(message)) {
    const normalizedAck = message.trim().toLowerCase();
    if (/^(br+|barobar|brobr|ok+|okay|accha|thik|theek|hmm+|k|👍)/i.test(normalizedAck)) {
      return { reply: null, noReply: true, taskAction: null, fileRequest: null, intent: 'ACKNOWLEDGEMENT' };
    }
    const reply = `Ho, barobar.`;
    memory.addMessage(chatId, 'assistant', reply);
    return { reply, taskAction: null, fileRequest: null, intent: 'ACKNOWLEDGEMENT' };
  }
  if (/^\d{1,2}$/.test(message.trim()) && CONTEXT_DATE_PATTERN.test(previousUserMessage)) {
    const reply = `Okay, final merit list ${message.trim()} la ahe na?`;
    memory.addMessage(chatId, 'assistant', reply);
    return { reply, taskAction: null, fileRequest: null };
  }

  if (classifiedIntent === 'CORRECTION') {
    const reply = `Ha, samajla. Magcha reply chukicha hota; ata context proper gheun reply karto.`;
    memory.addMessage(chatId, 'assistant', reply);
    return { reply, taskAction: null, fileRequest: null, intent: classifiedIntent };
  }

  if (classifiedIntent === 'PROMISE_FUTURE_ACTION' && !TASK_KEYWORDS.some(pattern => pattern.test(normalizedMessage))) {
    const reply = `Brr 👍`;
    memory.addMessage(chatId, 'assistant', reply);
    return { reply, taskAction: null, fileRequest: null, intent: classifiedIntent };
  }

  // ── Time shortcut (no LLM) ────────────────────────────────────────────────
  if (intent === 'time') {
    const reply = `Current time is ${timeOnly} (${now}).`;
    memory.addMessage(chatId, 'assistant', reply);
    return { reply, taskAction: null, fileRequest: null };
  }

  // ── Greeting shortcut (no LLM) ────────────────────────────────────────────
  if (intent === 'greeting') {
    const greetings = [
      `Hi, bolo.`,
      `Hello! Kay help pahije?`,
    ];
    const reply = greetings[Math.floor(Math.random() * greetings.length)];
    memory.addMessage(chatId, 'assistant', reply);
    return { reply, taskAction: null, fileRequest: null };
  }

  // ── List tasks without LLM ─────────────────────────────────────────────────
  if (intent === 'list_tasks') {
    const taskList = scheduler.getTasksForChat(chatId);
    const reply = taskList.length === 0
      ? 'You have no active tasks or reminders.'
      : 'Your active tasks:\n' + scheduler.formatTaskList(taskList);
    memory.addMessage(chatId, 'assistant', reply);
    return { reply, taskAction: null, fileRequest: null };
  }

  // ── Cancel tasks without LLM ────────────────────────────────────────────────
  if (intent === 'cancel_tasks') {
    const count = scheduler.cancelAllForChat(chatId);
    const reply = count > 0
      ? `Done! Cancelled ${count} task${count > 1 ? 's' : ''}.`
      : 'No active tasks to cancel.';
    memory.addMessage(chatId, 'assistant', reply);
    return { reply, taskAction: null, fileRequest: null };
  }

  // File matching does not need an LLM. This keeps requests such as
  // "send me the ration card image" reliable even when a provider is down.
  if (intent === 'file') {
    const reply = `I'll check for that file and send it if I have it.`;
    memory.addMessage(chatId, 'assistant', reply);
    return { reply, taskAction: null, fileRequest: buildFileRequest(message) };
  }

  // ── Build messages for LLM ─────────────────────────────────────────────────
  // The current user message is already in memory. Keep only a short recent
  // window here; the LLM service applies a second character-based limit.
  const history = memory.getHistory(chatId);
  const context = buildConversationContext(history.slice(0, -1), conversationState.getState(chatId), message, normalizedMessage);
  const messages = [
    { role: 'system', content: `${buildSystemPrompt(senderName, now)}\n\n${context}` },
    ...history.slice(-15, -1).map(h => ({
      role: h.role === 'assistant' ? 'assistant' : 'user',
      content: h.role === 'assistant' ? h.content : `[${h.role === 'owner' ? 'OWNER/SURAJ' : 'CONTACT'}]\n${h.content}`,
    })),
    { role: 'user', content: `[CONTACT - CURRENT MESSAGE]\n${message}\n[REASONING NORMALIZED]\n${normalizedMessage}` },
  ];

  // ── Call LLM ───────────────────────────────────────────────────────────────
  let rawReply;
  try {
    rawReply = await generateResponse({ messages, userId: chatId, metadata: { senderName } });
  } catch (err) {
    console.error('[SKAgent] LLM error:', err.message);
    // Do not turn infrastructure failures into a fake customer-support reply.
    let fb = null;
    if (mentionsOwner) {
      fb = `Got it, I'll let ${ownerConfig.shortName} know about this.`;
    } else if (/\b(hi+|hello|hey|namaste|hlo|hii|kaise\s+ho|kya\s+haal|good\s+(morning|evening|afternoon|night))\b/i.test(message)) {
      fb = `Hey! Kay help pahije?`;
    }
    if (fb) memory.addMessage(chatId, 'assistant', fb);
    return { reply: fb, noReply: !fb, taskAction: null, fileRequest: null };
  }

  if (/<SK_NO_REPLY\s*\/?\s*>/i.test(rawReply)) {
    return { reply: null, noReply: true, taskAction: null, fileRequest: null, intent: classifiedIntent };
  }

  // ── Parse special blocks ───────────────────────────────────────────────────
  let taskAction = null;
  let fileRequest = null;

  const taskBlock = parseBlock(rawReply, 'SK_TASK');
  if (taskBlock.found && taskBlock.data) {
    taskAction = taskBlock.data;
  }

  // Informational questions should be answered, not scheduled as notes.
  if (taskAction && intent === 'chat' && !mentionsOwner) {
    taskAction = null;
  }

  const fileBlock = parseBlock(rawReply, 'SK_FILE');
  if (fileBlock.found && fileBlock.data) {
    fileRequest = fileBlock.data;
  }

  const listBlock = parseBlock(rawReply, 'SK_LIST_TASKS');
  if (listBlock.found && listBlock.isSelfClose) {
    const taskList = scheduler.getTasksForChat(chatId);
    const listText = taskList.length === 0
      ? 'No active tasks.'
      : scheduler.formatTaskList(taskList);
    const cleaned = cleanReply(rawReply);
    const reply = cleaned ? `${cleaned}\n\n${listText}` : listText;
    memory.addMessage(chatId, 'assistant', reply);
    return { reply, taskAction: null, fileRequest: null };
  }

  const cancelBlock = parseBlock(rawReply, 'SK_CANCEL_TASK');
  if (cancelBlock.found && cancelBlock.data) {
    const { taskId } = cancelBlock.data;
    if (taskId === 'all') {
      scheduler.cancelAllForChat(chatId);
    } else {
      scheduler.cancelTask(taskId);
    }
  }

  // ── Post-process task: FORCE routing based on keywords ─────────────────────////
  if (taskAction) {
    // Sanitize description/message so LLM doesn't leak old sender names like "sangitahmaske"
    if (mentionsOwner && !saysSelfRemind) {
      taskAction.recipients = 'owner';
      if (taskAction.message) {
        const m = taskAction.message.toLowerCase();
        // Only rewrite if the "to suraj" side isn't clear
        if (/(sangita|rahul|priya|old sender|previous sender)/i.test(taskAction.message)) {
          taskAction.message = `${senderName} sent a message: ${message}`;
        }
      }
      taskAction.description = sanitizeDescription(taskAction.description, senderName, ownerConfig.shortName, message);
      if (!taskAction.message) {
        taskAction.message = `From ${senderName}: ${message}`;
      }
    }

    // If user typed reminders for themselves but LLM set owner, flip back
    if (saysSelfRemind && !mentionsOwner) {
      taskAction.recipients = 'self';
    }

    // Default fallback for task+time keywords but no recipients set:
    if (!taskAction.recipients) {
      taskAction.recipients = mentionsOwner ? 'owner' : 'self';
    }
  }

  let reply = cleanReply(rawReply);

  // Guard: LLM returned only a task block with no text — generate a sensible fallback
  if (!reply) {
    if (taskAction) {
      // Task was created for the owner
      if (isOwnerRecipient(taskAction.recipients)) {
        reply = `Got it, I'll let ${ownerConfig.shortName} know. 👍`;
      } else {
        reply = 'Done! Reminder set. ✅';
      }
    } else {
      reply = null;
    }
  }

  if (reply) memory.addMessage(chatId, 'assistant', reply);

  return { reply, taskAction, fileRequest };
}

function sanitizeDescription(desc, senderName, ownerShort, originalMessage) {
  // If LLM hallucinated an old sender name like "sangitahmaske" instead of current sender, fix it
  let d = (desc || '').trim();
  const weirdSender = /(sangitahmaske|unknown|oldcontact|previoussender)/i;
  if (weirdSender.test(d)) {
    d = d.replace(weirdSender, senderName);
  }
  // If description still looks wrong — build a clean one from original message
  if (!d || /^\s*Task\s*$/i.test(d) || weirdSender.test(d)) {
    const short = originalMessage.length > 80 ? originalMessage.slice(0, 77) + '...' : originalMessage;
    d = `${senderName}: ${short}`;
  }
  return d;
}

// ── Schedule a task parsed from LLM output ────────────────────────────────────

function isOwnerRecipient(recipients) {
  if (!recipients) return false;
  const r = String(recipients).toLowerCase().trim();
  return r === 'owner' || r.includes('suraj') || r.includes('boss') || r.includes('zalke');
}

function scheduleTask(chatId, senderName, taskAction) {
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

module.exports = { processMessage, scheduleTask, setOwnerConfig, getOwnerConfig, isOwnerRecipient, buildSystemPrompt };
