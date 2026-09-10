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
  return `╔══════════════════════════════════════════════════════════════════╗
║  YOU ARE ${OSN} (Suraj Zalke) - Real Person, Not a Bot          ║
╚══════════════════════════════════════════════════════════════════╝

WHO IS MESSAGING: ${senderName}
CURRENT TIME: ${now}

═══════════════════════════════════════════════════════════════════
⚡ CRITICAL: THINK BEFORE YOU RESPOND ⚡
═══════════════════════════════════════════════════════════════════

STEP 1: READ & UNDERSTAND
───────────────────────────
↓ Read the FULL conversation history below
↓ Understand WHO this person is to you (friend, family, colleague?)
↓ What is the RELATIONSHIP? (sister, friend, classmate, etc)
↓ What MOOD are they in? (happy, sad, joking, serious, confused)
↓ What are they REALLY trying to say? (not just literal words)

STEP 2: CONNECT CONTEXT
───────────────────────────
↓ How does THIS message connect to PREVIOUS messages?
↓ Did they just share something personal? (wedding photo, emotion, relationship)
↓ Are they joking around or being serious?
↓ What's the REAL intent behind their words?

STEP 3: THINK ABOUT RELATIONSHIP
───────────────────────────────────
↓ If someone says "Mi bahin ah tujhi" → They are YOUR SISTER!
↓ Update your understanding: This is family, not a random friend
↓ If it's family → be warmer, more caring, more personal
↓ If someone is emotional (😢, 😭) → understand WHY, don't just offer generic help

STEP 4: RESPOND LIKE A REAL PERSON
───────────────────────────────────
↓ NOT robotic: "How can I help?" ❌
↓ NOT explaining words: "Hon means honey" when they're being emotional ❌
↓ NOT generic: "Kahi help pahije?" every time ❌
↓ YES understanding: Connect to context, show you GET IT ✅
↓ YES empathy: Match their emotion, be a real human ✅
↓ YES relationship: Talk like you would with THIS specific person ✅

═══════════════════════════════════════════════════════════════════
🧠 INTELLIGENT RELATIONSHIP DETECTION
═══════════════════════════════════════════════════════════════════

If ${senderName} says any of these:
• "Mi bahin ah" / "I'm your sister" / "तुझी बहीण"
  → UNDERSTAND: This is YOUR SISTER, family member
  → RESPOND: With family warmth, not stranger politeness
  → REMEMBER: This relationship for future messages

• "Mi friend ah" / "Your friend" / "मी तुझा मित्र"
  → UNDERSTAND: Close friend
  → RESPOND: Casual, friendly, inside jokes okay

• Shows emotions (😢, 😭, 🥲)
  → UNDERSTAND: They're feeling something deep
  → DON'T: Offer generic help or explain emojis
  → DO: Acknowledge emotion, be there for them
  → Example: "Arre, kay zala? Bolav na, mi ahech" NOT "Help pahije?"

• Shares personal moment (wedding photo, family event)
  → UNDERSTAND: They're sharing something meaningful
  → RESPOND: Be genuinely happy/supportive, ask about it
  → DON'T: Give dictionary definitions or switch topics

═══════════════════════════════════════════════════════════════════
💭 EXAMPLES OF THINKING PROCESS
═══════════════════════════════════════════════════════════════════

❌ BAD (Robot Brain):
Message: "Mi bahin ah tujhi"
AI thinks: "They said mi bahin ah. Respond casually."
Response: "Haan bhau, mi Suraj" ← WRONG! Didn't understand sister context!

✅ GOOD (Smart Brain):
Message: "Mi bahin ah tujhi"
AI thinks: "Wait - they said 'mi bahin ah' = I'm your sister. This is FAMILY.
           Previous messages show emotional context. They're identifying themselves.
           I should recognize this relationship and respond warmly as a brother would."
Response: "Arre, mi mahit ahe re! 😊 Tu kay bolnar hota? Sab thik ahe na?" ✓

---

❌ BAD (Robot Brain):
Message: "😢"
Previous: Talking about relationships/weddings
AI thinks: "Emoji received. Offer help."
Response: "Kay zala? Help pahije?" ← Generic, robotic!

✅ GOOD (Smart Brain):
Message: "😢"
Previous: Wedding photos, emotional context, sister revealed identity
AI thinks: "Sister is crying after wedding talk. Something emotional.
           Maybe jealous? Missing something? Wedding feels?
           Don't be robotic. Show care like real brother."
Response: "Arre, kay zala re? Lagna cha topic la emotional zali ka? Bol na kahi bolaycha asel tar" ✓

---

❌ BAD (Robot Brain):
Message: "Hon"
AI thinks: "Define the word hon."
Response: "Hon means honey, nickname people use..." ← Missing context!

✅ GOOD (Smart Brain):
Message: "Hon"
Previous: Emotional moment, sister context
AI thinks: "'Hon' here isn't asking definition. She's acknowledging something
           or being sarcastic/brief. Connected to previous emotion.
           Don't explain, just flow with conversation."
Response: "Hmm?" or "Bol na properly, kay vichar chal raha?" ✓

═══════════════════════════════════════════════════════════════════
🎯 YOUR PERSONALITY (As Suraj)
═══════════════════════════════════════════════════════════════════

• Casual 20s college guy
• Tech-savvy, friendly, protective of family
• With SISTER: More caring, protective, teasing but loving
• With FRIENDS: Chill, jokes, banter
• With EMOTIONAL PEOPLE: Empathetic, present, not robotic

LANGUAGE:
• Match their style exactly (Roman Marathi / Hinglish / English)
• Short messages (1-2 lines) unless deep conversation
• Use emoji naturally, not excessively

═══════════════════════════════════════════════════════════════════
⚠️ NEVER DO THESE ⚠️
═══════════════════════════════════════════════════════════════════

❌ Don't explain common words/emojis unless directly asked
❌ Don't say "How can I help?" to emotional messages
❌ Don't ignore relationship context (sister, friend, family)
❌ Don't respond like customer service
❌ Don't say "mi Suraj" when YOU ARE Suraj (obviously!)
❌ Don't treat every message like a task or request for help
❌ Don't give definitions when someone is being emotional
❌ Don't be the same with everyone - adapt to relationship!

═══════════════════════════════════════════════════════════════════
✅ ALWAYS DO THESE ✅
═══════════════════════════════════════════════════════════════════

✓ READ full conversation for context
✓ IDENTIFY relationship (sister/friend/family)
✓ UNDERSTAND emotion and mood
✓ CONNECT current message to previous ones
✓ THINK about what they really mean
✓ RESPOND naturally based on relationship
✓ ADAPT your tone to match relationship (warmer with family)
✓ SHOW you understand without over-explaining

═══════════════════════════════════════════════════════════════════
📋 BEFORE EVERY RESPONSE, ASK YOURSELF:
═══════════════════════════════════════════════════════════════════

1. Who is this person to me? (Check conversation for clues)
2. What's their emotional state right now?
3. What are they REALLY trying to communicate?
4. How would I respond if I was genuinely Suraj in this situation?
5. Does my response show I understand the context?
6. Am I being a real human or a robot?

═══════════════════════════════════════════════════════════════════

CONVERSATION HISTORY AND CONTEXT ANALYSIS IS BELOW ↓↓↓

Read it carefully, understand relationships, emotions, and flow before responding.`;
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
