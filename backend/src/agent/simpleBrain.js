/**
 * Simple Brain — Deterministic Pattern-Based Reply Engine
 * NO LLM, NO HALLUCINATIONS. Just pattern matching + templates.
 *
 * IMPORTANT — two modes, controlled by SIMPLE_BRAIN_MODE env var:
 *
 *  'minimal' (default) — only handles messages that genuinely need NO
 *  content-bearing reply at all: short acks ("ok", "hmm"), filler, goodbyes,
 *  and emoji-only messages. Everything with actual meaning (greetings,
 *  "who are you", "how are you", introductions, "where is X") is left for
 *  the LLM, which now has a proper personality prompt and real conversation
 *  context — so it can reply in a way that's actually specific to what was
 *  said, instead of always returning the same fixed line from a small array.
 *  This is the recommended mode: it's what makes replies feel like a real
 *  person instead of a scripted bot.
 *
 *  'full' — restores the original behaviour: canned Marathi/Hindi templated
 *  replies (bucketed by guessed relationship — mother/father/brother/etc.)
 *  fire before the LLM ever runs, for greetings, identity questions, "how
 *  are you", introductions, and "where is X". Useful only if you
 *  specifically want fixed scripted replies for these cases and don't mind
 *  every stranger getting the same handful of lines.
 */

const { getOwnerConfig } = require('./personaEngine');
const contactDirectory = require('../whatsapp/contactDirectory');

const SIMPLE_BRAIN_MODE = (process.env.SIMPLE_BRAIN_MODE || 'full').toLowerCase();
const FULL_MODE = SIMPLE_BRAIN_MODE === 'full';

// ── Relationship detection ────────────────────────────────────────────────────
function detectRelationship(contactName) {
  const n = String(contactName || '').toLowerCase();
  if (/\baai|mom|mother|mummy|आई|mata\b/.test(n))        return 'MOTHER';
  if (/\bbaba|dad|father|papa|बाबा|pita\b/.test(n))      return 'FATHER';
  if (/\bbhai|bro|brother|भाऊ\b/.test(n))               return 'BROTHER';
  if (/\bbahin|sister|tai|didi|बहीण|ताई|दीदी\b/.test(n)) return 'SISTER';
  if (/\bkaka|mama|aajoba|ajji|uncle|aunty|mavshi|atya\b/.test(n)) return 'ELDER';
  if (/\bfriend|dost|mitra|yaar\b/i.test(n))             return 'FRIEND';
  return 'UNKNOWN';
}

function relationshipFromMessage(message, fallback) {
  const text = String(message || '').toLowerCase();
  if (/(?:me|mi|main|i\s+am|tuzi|your)\s+[^.?!]{0,30}\b(sister|tai|bahin|didi|ताई|बहीण|दीदी)\b|\b(tai|sister|bahin|didi)\s+manun\s+bol/.test(text)) return 'SISTER';
  if (/(?:me|mi|main|i\s+am|tuza|your)\s+[^.?!]{0,30}\b(aai|mother|mom|mummy|आई|mata)\b/.test(text)) return 'MOTHER';
  if (/(?:me|mi|main|i\s+am|tuza|your)\s+[^.?!]{0,30}\b(baba|dad|father|papa|बाबा|pita)\b/.test(text)) return 'FATHER';
  if (/(?:me|mi|main|i\s+am|tuza|your)\s+[^.?!]{0,30}\b(brother|bhau|bro|भाऊ)\b/.test(text)) return 'BROTHER';
  if (/(?:me|mi|main|i\s+am|tuza|your)\s+[^.?!]{0,30}\b(kaka|mama|aajoba|ajji|uncle|aunty|mavshi|atya)\b/.test(text)) return 'ELDER';
  return fallback;
}

function relationshipFromHistory(history, fallback) {
  for (const entry of [...history].reverse()) {
    if (entry.role === 'contact') {
      const relationship = relationshipFromMessage(entry.content, null);
      if (relationship) return relationship;
    }
  }
  return fallback;
}

// ── Owner name helpers ────────────────────────────────────────────────────────
function ownerShort() { return getOwnerConfig().shortName || 'Suraj'; }
function ownerFull()  { return getOwnerConfig().name || 'Suraj Zalke'; }

// ── Busy status for Suraj (variations for naturalness) ───────────────────────
const BUSY_STATUSES = [
  'college madhe busy ahe',
  'college madhe ahe atmadhye',
  'college cha kaam chaluy',
  'college madhe kaam ahe',
  'college la ahe, bhet nahi yet',
];
function randomBusyStatus() {
  return BUSY_STATUSES[Math.floor(Math.random() * BUSY_STATUSES.length)];
}

// ── Helper: pick from array randomly ─────────────────────────────────────────
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ── The main reply function ───────────────────────────────────────────────────
/**
 * Try to produce a deterministic reply.
 * Returns { reply: string|null, noReply: bool, usedSimpleBrain: true, source: string }
 * If nothing matches → { reply: null, usedSimpleBrain: false } so caller falls back to LLM.
 */
function tryReply({
  chatId,
  senderName,
  message,
  history,      // full chat history: [{role, content, timestamp}]
  socialIntent,
}) {
  const text = String(message || '').trim();
  const t = text.toLowerCase();
  const displayRelationship = detectRelationship(senderName);
  const OSN = ownerShort();

  if (/^(start|\/start|sk\s+start|ai\s+(on|start)|continue)$/i.test(t)) {
    return { reply: 'Okay, bol na.', usedSimpleBrain: true, source: 'start_chat' };
  }

  if (/^(?:ok\s+)?(?:oyeii?\s+)?sk[\s!.]*$/i.test(t) || /^sk[\s!.]*$/i.test(t)) {
    return { reply: 'Ho, bol na.', usedSimpleBrain: true, source: 'sk_greeting' };
  }

  // ──────────────────────────────────────────────────────────────────────
  // STEP 1: SHORT-ACK / NO-REPLY messages (fast path)
  // ──────────────────────────────────────────────────────────────────────
  if (/^(br+|ok+|ha+|ho+|hmm+|hm|k|barobar|thik|theek|acha|accha|alright|done|👌|👍|✅)[\s!.]*$/i.test(t)) {
    return { reply: pick(['Okay', 'Ho', 'Barobar']), usedSimpleBrain: true, source: 'short_ack' };
  }
  if (/^(hmm|hm|uh|uhh|um|umm|ahem)[\s.]*$/i.test(t)) {
    return { reply: 'Ho, bol na.', usedSimpleBrain: true, source: 'filler' };
  }
  if (/^(bye|tata|chalo|ok\s+bye|good\s*night|night)[\s!.]*$/i.test(t)) {
    return { reply: pick(['Bye', 'Byee', 'Chal, bye']), usedSimpleBrain: true, source: 'bye' };
  }
  if (/^[\p{Emoji}\s]+$/u.test(t) && /[^\d\s]/u.test(t)) {
    // Single emoji → usually no reply
    if (t.length < 6) return { reply: '🙂', usedSimpleBrain: true, source: 'emoji_only' };
    // Playful emojis → small emoji back
    if (/[😂🤣😜😝🙄]/.test(t)) return { reply: '😂', usedSimpleBrain: true, source: 'emoji_playful' };
    if (/[😢😭💔]/.test(t)) return { reply: 'Kay jhala re?', usedSimpleBrain: true, source: 'emoji_sad' };
    return { reply: '🙂', usedSimpleBrain: true, source: 'emoji_other' };
  }

  const previousContactQuestion = [...history].reverse().find(entry => entry.role === 'owner' && /[?]|\b(what|when|where|how|kadhi|konte|kasa|kay)\b/i.test(entry.content));
  const rel = relationshipFromMessage(message, relationshipFromHistory(history, displayRelationship));
  if (/^\d{1,4}[\s!.]*$/.test(t) && previousContactQuestion) {
    return { reply: text.trim(), usedSimpleBrain: true, source: 'answer_previous_question' };
  }

  if (/\b(chukich|chukicha|wrong|galat)\b/i.test(t)) {
    return { reply: 'Ho, chukicha hota.', usedSimpleBrain: true, source: 'correction' };
  }

  if (/(?:suraj|to|tyacha|tyachi)\s+(?:kay|kai|kaya)\s+kart|what\s+is\s+suraj\s+doing/i.test(t)) {
    return { reply: `${OSN} college cha kaam karat ahe.`, usedSimpleBrain: true, source: 'owner_activity' };
  }

  if (/(?:meeting|metting|meet)\s+(?:ka|kashala|why)|ka\s+(?:meeting|metting|meet)|meeting\s+(?:ahe|aahe|chalu)/i.test(t)) {
    return { reply: `${OSN} college cha kaam ahe mhanun meeting madhe ahe.`, usedSimpleBrain: true, source: 'meeting_context' };
  }

  const numberMatch = t.match(/\bmala\s+ek\s+kam\s+ahe\s+mala\s+([a-z][a-z0-9 .'-]*?)\s+(?:cha|chi|che|chya)\s+(?:no|number|mobile|phone|contact)\b/i) ||
    t.match(/\bmala\s+(?:(?:ek\s+kam\s+kar|ek\s+kam\s+|please)\s+)?([a-z][a-z0-9 .'-]*?)\s+(?:cha|chi|che|chya)\s+(?:no|number|mobile|phone|contact)\b/i) ||
    t.match(/\b([a-z][a-z0-9 .'-]*?)\s+(?:cha|chi|che|chya)\s+(?:no|number|mobile|phone|contact)\s+(?:pathav|bhej|send|de|pahije)\b/i);
  if (numberMatch || /(?:no|number|mobile|phone|contact)\s+(?:pathav|bhej|send|de|pahije)/i.test(t)) {
    const requestedName = numberMatch
      ? numberMatch[1].trim().replace(/^(?:(?:ok|are|oyeii?|brr|mala|please|ek\s+kam\s+kar)\s+)+/i, '').trim()
      : rel;
    const contact = contactDirectory.find(requestedName) || contactDirectory.find(rel);
    if (contact) {
      return { reply: `${contact.name} cha number ${contact.number}`, usedSimpleBrain: true, source: 'contact_number' };
    }
    return { reply: `Mazyakade ${requestedName || 'tyancha'} contact number saved nahi ahe.`, usedSimpleBrain: true, source: 'contact_number_missing' };
  }

  // Everything below this point is scripted/templated persona behaviour
  // (greetings, identity, "how are you", introductions, "where is X"...).
  // Only run it in 'full' mode — otherwise fall through to the LLM, which
  // will handle these more naturally using the real conversation context.
  if (!FULL_MODE) {
    return { reply: null, usedSimpleBrain: false, source: 'nomatch_minimal_mode' };
  }

  // ──────────────────────────────────────────────────────────────────────
  // STEP 2: "Manje" — they are confused by OUR LAST MESSAGE
  //           Rephrase or repeat our last reply concisely.
  // ──────────────────────────────────────────────────────────────────────
  if (/^\s*manje\s*[?.!]*\s*$/i.test(t) || /\bmanje\s*[?.!]*\s*$/i.test(t)) {
    const lastBotMsg = [...history].reverse().find(h => h.role === 'assistant');
    if (lastBotMsg) {
      const content = String(lastBotMsg.content);
      // Just rephrase slightly — clean up any emoji at end for clarity
      const simplified = content.replace(/[?!.]*\s*[😅😂😊👍✨💯💖❤️🤣😜]*\s*$/,'').trim();
      // If already very short, repeat it; otherwise shorten
      const reply = simplified.length < 20
        ? content
        : `${simplified.split(/[,;]/)[0].trim()} mhanje.`;
      return { reply, usedSimpleBrain: true, source: 'manje_clarify' };
    }
    // No prior context, default to asking softly
    return { reply: 'Kay unclear vatat ahe?', usedSimpleBrain: true, source: 'manje_generic' };
  }

  // ──────────────────────────────────────────────────────────────────────
  // STEP 3: Identity question "Tu kon", "Kon tu", "Who r u", etc.
  // ──────────────────────────────────────────────────────────────────────
  if (/\b(tu\s+kon|kon\s+tu|kaun\s+hai\s+tu|kaun\s+tu|who\s+(r|are)\s+you|kon\s+ah(at|es|e)s?)\b/i.test(t)) {
    const base = `Mi ${OSN} cha AI assistant boltoy`;
    if (rel === 'MOTHER')  return { reply: `${base} aai.`, usedSimpleBrain: true, source: 'identity_mother' };
    if (rel === 'FATHER')  return { reply: `${base} baba.`, usedSimpleBrain: true, source: 'identity_father' };
    if (rel === 'BROTHER') return { reply: `${base} re bhau.`, usedSimpleBrain: true, source: 'identity_brother' };
    if (rel === 'SISTER')  return { reply: `${base} re bahin.`, usedSimpleBrain: true, source: 'identity_sister' };
    if (rel === 'ELDER')   return { reply: `${base}.`, usedSimpleBrain: true, source: 'identity_elder' };
    return { reply: `${base} re.`, usedSimpleBrain: true, source: 'identity' };
  }

  // ──────────────────────────────────────────────────────────────────────
  // STEP 4: AI question "AI ahes ka", "Tu AI ahes ka" etc.
  // ──────────────────────────────────────────────────────────────────────
  if (/\b(ai|bot|chatbot|robot|auto.?reply)\b.*\?|\?.*\b(ai|bot|chatbot|robot)\b/i.test(t) ||
      /\b(tu\s+ai\s+(ahes|aahes|ah(e|at))|ai\s+ka)\b/i.test(t)) {
    return { reply: `Ho, mi ${OSN} cha AI assistant ahe 😂`, usedSimpleBrain: true, source: 'ai_disclosure' };
  }

  // ──────────────────────────────────────────────────────────────────────
  // STEP 5: "[Name] me ahe" / "Mi [Name]" → self introduction
  // ──────────────────────────────────────────────────────────────────────
  const introMatch = t.match(/(?:mi\s+|me\s+|main\s+)([a-z][a-z0-9_]{2,})\s+(?:ahe|aahe|ah(e|es)?|hu|hoon|hain)\b/i) ||
                     t.match(/\b([a-z][a-z0-9_]{2,})\s+(?:me\s+ahe|maa?i\s+aahe?)\b/i);
  if (introMatch) {
    const name = introMatch[1].charAt(0).toUpperCase() + introMatch[1].slice(1).toLowerCase();
    if (rel === 'MOTHER') return { reply: `Ho, ${name}. Kaay kaam?`, usedSimpleBrain: true, source: 'intro_mother' };
    if (rel === 'ELDER')  return { reply: `Ho, ${name} kaka/aai.`, usedSimpleBrain: true, source: 'intro_elder' };
    return { reply: `Ho, ${name}. Bol na.`, usedSimpleBrain: true, source: 'intro' };
  }
  // Also match "[Name] ahe" / "[Name] aahe" with "mi" omitted (common in chat)
  const shortIntro = t.match(/^([a-z][a-z0-9_]{2,})\s+(?:me\s+)?(ahe|aahe|ah(e|es)?)\s*[!.]*$/i);
  if (shortIntro && !/(kuthe|kase|kasa|kay|kadhi|ka|kyu|kyon|why|how|what|when|where)\b/i.test(t)) {
    const name = shortIntro[1].charAt(0).toUpperCase() + shortIntro[1].slice(1).toLowerCase();
    return { reply: `Ho, ${name}. Kaay kaam?`, usedSimpleBrain: true, source: 'intro_short' };
  }

  // ──────────────────────────────────────────────────────────────────────
  // STEP 6: "Suraj kuthe ahe" / "Where is Suraj" → ALWAYS BUSY for elders
  // ──────────────────────────────────────────────────────────────────────
  if (/(kuthe\s+(ahe|aahe|ahat|aahet)|where\s+is\s+(suraj|he|him))\b/i.test(t) ||
      /\bsuraj\s+(kuthe|kade|kahape|kahan|where)\b/i.test(t)) {
    const busy = randomBusyStatus();
    if (rel === 'MOTHER')  return { reply: `Aai, ${OSN} thoda ${busy}. Thodya velanni boltoy.`, usedSimpleBrain: true, source: 'whereis_mother' };
    if (rel === 'FATHER')  return { reply: `Baba, ${OSN} thoda ${busy}. Thoda vel.`, usedSimpleBrain: true, source: 'whereis_father' };
    if (rel === 'ELDER')   return { reply: `${OSN} thoda ${busy}. Thodya velanni bolnar.`, usedSimpleBrain: true, source: 'whereis_elder' };
    if (rel === 'BROTHER') return { reply: `Busy ahe re, thoda vel.`, usedSimpleBrain: true, source: 'whereis_bro' };
    if (rel === 'SISTER')  return { reply: `Kaam madhe ahe, thoda.`, usedSimpleBrain: true, source: 'whereis_sis' };
    // Unknown caller
    return { reply: `${OSN} thoda ${busy}. Bol na tu kaay kaam?`, usedSimpleBrain: true, source: 'whereis_generic' };
  }

  // ──────────────────────────────────────────────────────────────────────
  // STEP 7: GREETINGS ("Hi", "Hello", "Namaskar", "Oyeii", etc.)
  // ──────────────────────────────────────────────────────────────────────
  // Repeated same-ping detection (Oyeii × N) — look at recent 3 contact messages
  const recentContact = history.filter(h => h.role !== 'assistant').slice(0, -1).slice(-3).map(h => String(h.content).toLowerCase().trim());
  const lastMsgs = [...recentContact, t];
  const uniqueMsgs = [...new Set(lastMsgs.filter(m => m.length > 0))];
  const isRepeatedPing = uniqueMsgs.length === 1 && lastMsgs.length >= 2;

  if (isRepeatedPing) {
    const msg = uniqueMsgs[0];
    if (rel === 'MOTHER') {
      return { reply: 'Ho aai, bol na kahi?', usedSimpleBrain: true, source: 'repeat_mother' };
    }
    if (rel === 'FATHER') {
      return { reply: 'Ho baba, bol na?', usedSimpleBrain: true, source: 'repeat_father' };
    }
    if (rel === 'ELDER') {
      return { reply: 'Ho, bol na kaay?', usedSimpleBrain: true, source: 'repeat_elder' };
    }
    return { reply: 'Ha bol na?', usedSimpleBrain: true, source: 'repeat_generic' };
  }

  // Greeting pattern
  if (/^(hi+|hello|hlo|hii|hey|namaste|namaskar|salaam|good\s+(morning|evening|afternoon|night))[\s!.,]*$/i.test(t) ||
      /^(oye|oyee|oyye|oyeii)[\s!]*$/i.test(t)) {
    if (rel === 'MOTHER')  return { reply: pick(['Ho aai, kaish ahes?','Namaskar aai.','Ho aai.']), usedSimpleBrain: true, source: 'greet_mother' };
    if (rel === 'FATHER')  return { reply: pick(['Namaskar baba.','Ho baba, kasa ahes?','Ho baba.']), usedSimpleBrain: true, source: 'greet_father' };
    if (rel === 'ELDER')   return { reply: 'Namaskar. Kaay kaam?', usedSimpleBrain: true, source: 'greet_elder' };
    if (rel === 'BROTHER') return { reply: pick(['Ha bhau.','Kai bhau.','Ho bro.']), usedSimpleBrain: true, source: 'greet_bro' };
    if (rel === 'SISTER')  return { reply: pick(['Ho bahin.','Ho tai.','Hey.']), usedSimpleBrain: true, source: 'greet_sis' };
    if (rel === 'FRIEND')  return { reply: pick(['Hey','Ha bol','Kai re','Ho']), usedSimpleBrain: true, source: 'greet_friend' };
    return { reply: pick(['Ho, kaay kaam?','Hi. Bol na.','Hey.']), usedSimpleBrain: true, source: 'greet_generic' };
  }

  // ──────────────────────────────────────────────────────────────────────
  // STEP 8: Casual "kaish ahes", "kai kartoys" type small-talk
  // ──────────────────────────────────────────────────────────────────────
  if (/\b(kaish?\s+ahes|tusi\s+kaise\s+ho|kaise\s+ho|how\s+are\s+you|kesa\s+hai)\b/i.test(t)) {
    if (rel === 'MOTHER')  return { reply: 'Mi barobar aai, tu kashi ahes?', usedSimpleBrain: true, source: 'hru_mother' };
    if (rel === 'FATHER')  return { reply: 'Mi thik baba, tu kasa ahes?', usedSimpleBrain: true, source: 'hru_father' };
    if (rel === 'BROTHER') return { reply: 'Barobar re, tu kasa?', usedSimpleBrain: true, source: 'hru_bro' };
    if (rel === 'SISTER')  return { reply: 'Mast, tu kashi?', usedSimpleBrain: true, source: 'hru_sis' };
    return { reply: 'Mi thik, tu?', usedSimpleBrain: true, source: 'hru_generic' };
  }
  if (/\b(kai\s+kart(oys|oyt|ahe)?|kya\s+kar\s+raha\s+hai|what'?s?\s+up|wassup|sup)\b/i.test(t)) {
    if (rel === 'MOTHER')  return { reply: 'Kahi khas aai, kaam chal.', usedSimpleBrain: true, source: 'wud_mother' };
    if (rel === 'FATHER')  return { reply: 'Kahi khas baba, kaam chal.', usedSimpleBrain: true, source: 'wud_father' };
    if (rel === 'BROTHER') return { reply: 'Bas re, tu kay kartoys?', usedSimpleBrain: true, source: 'wud_bro' };
    return { reply: 'Kahi khas, tu?', usedSimpleBrain: true, source: 'wud_generic' };
  }

  // ──────────────────────────────────────────────────────────────────────
  // STEP 9: YES/NO simple factual with common word shortcuts
  // ──────────────────────────────────────────────────────────────────────
  if (/\b(college|clg|office|work|kaam)\s+(chalu|start|ahe|aahe|hai)\s*[?؟]?\s*$/i.test(t)) {
    return { reply: 'Ho, chalu.', usedSimpleBrain: true, source: 'fact_yn_generic' };
  }

  // ──────────────────────────────────────────────────────────────────────
  // STEP 10: Very short (< 12 chars) casual "Ho?", "Na?", "Mg?"
  // ──────────────────────────────────────────────────────────────────────
  if (t.length < 12) {
    if (/^(mg|mag|maga)\s*[?.!]*\s*$/i.test(t)) return { reply: 'Kaay?', usedSimpleBrain: true, source: 'mg_short' };
    if (/^(kai|kay|kya)\s*[?.!]*\s*$/i.test(t)) {
      const lastBotMsg = [...history].reverse().find(h => h.role === 'assistant');
      if (lastBotMsg) return { reply: 'Kay vichartoy re? Bol clear.', usedSimpleBrain: true, source: 'kay_short_context' };
      return { reply: 'Kaay?', usedSimpleBrain: true, source: 'kay_short' };
    }
    if (/^(na|nahi|no)\s*[?.!]*\s*$/i.test(t)) {
      const lastBotMsg = [...history].reverse().find(h => h.role === 'assistant');
      if (lastBotMsg) return { reply: 'Ho mg chalel kaay?', usedSimpleBrain: true, source: 'na_short' };
      return { reply: null, noReply: true, usedSimpleBrain: true, source: 'na_nocontext' };
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // NO MATCH → caller should fall back to LLM for complex / unseen input
  // ──────────────────────────────────────────────────────────────────────
  return { reply: null, usedSimpleBrain: false, source: 'nomatch' };
}

module.exports = {
  tryReply,
  detectRelationship,
};
