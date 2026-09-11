/**
 * Simple Brain — Deterministic Pattern-Based Reply Engine
 * NO LLM, NO HALLUCINATIONS. Just pattern matching + templates.
 * 
 * Prioritizes:
 * 1. Relationship detection (Aai = Mother)
 * 2. Message patterns (regex)
 * 3. Conversation state (last assistant message) for "manje" clarifications
 */

const { getOwnerConfig } = require('./personaEngine');

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

// ── Owner name helpers ────────────────────────────────────────────────────────
function ownerShort() { return getOwnerConfig().shortName || 'Suraj'; }
function ownerFull()  { return getOwnerConfig().name || 'Suraj Zalke'; }

// ── Busy status for Suraj (variations for naturalness) ───────────────────────
const BUSY_STATUSES = [
  'work madhe busy ahe',
  'meeting madhe ahe atmadhye',
  'kaam madhe ahe',
  'office madhe busy ahe',
  'work la ahe bhet nahi yet',
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
  const rel = detectRelationship(senderName);
  const OSN = ownerShort();

  // ──────────────────────────────────────────────────────────────────────
  // STEP 1: SHORT-ACK / NO-REPLY messages (fast path)
  // ──────────────────────────────────────────────────────────────────────
  if (/^(br+|ok+|ha+|ho+|hmm+|hm|k|barobar|thik|theek|acha|accha|alright|done|👌|👍|✅)[\s!.]*$/i.test(t)) {
    return { reply: null, noReply: true, usedSimpleBrain: true, source: 'short_ack' };
  }
  if (/^(hmm|hm|uh|uhh|um|umm|ahem)[\s.]*$/i.test(t)) {
    return { reply: null, noReply: true, usedSimpleBrain: true, source: 'filler' };
  }
  if (/^(bye|tata|chalo|ok\s+bye|good\s*night|night)[\s!.]*$/i.test(t)) {
    return { reply: null, noReply: true, usedSimpleBrain: true, source: 'bye' };
  }
  if (/^[\p{Emoji}\s]+$/u.test(t)) {
    // Single emoji → usually no reply
    if (t.length < 6) return { reply: null, noReply: true, usedSimpleBrain: true, source: 'emoji_only' };
    // Playful emojis → small emoji back
    if (/[😂🤣😜😝🙄]/.test(t)) return { reply: '😂', usedSimpleBrain: true, source: 'emoji_playful' };
    if (/[😢😭💔]/.test(t)) return { reply: 'Kay jhala re?', usedSimpleBrain: true, source: 'emoji_sad' };
    return { reply: null, noReply: true, usedSimpleBrain: true, source: 'emoji_other' };
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
    const base = `Mi ${OSN} boltoy`;
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
    return { reply: 'Ho, auto-reply chalu ahe 😂', usedSimpleBrain: true, source: 'ai_disclosure' };
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
  const recentContact = history.filter(h => h.role !== 'assistant').slice(-3).map(h => String(h.content).toLowerCase().trim());
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
