const stateByChat = new Map();

function getState(chatId) {
  if (!stateByChat.has(chatId)) {
    stateByChat.set(chatId, {
      activeTopic: '',
      course: '',
      region: '',
      includedRegions: [],
      excludedRegions: [],
      category: '',
      percentile: '',
      pendingQuestions: [],
      pendingFiles: [],
      pendingLists: [],
      lastOwnerQuestion: '',
      lastContactAnswer: '',
      contactLanguage: 'hinglish',
    });
  }
  return stateByChat.get(chatId);
}

function updateState(chatId, { original, normalized, role = 'contact' } = {}) {
  const state = getState(chatId);
  const text = String(normalized || original || '').trim();
  if (!text) return state;

  if (/bsc\s+nursing|nursing/i.test(text)) state.course = 'BSc Nursing';
  if (/maharashtra/i.test(text)) state.region = 'Maharashtra';

  const excluded = text.match(/(?:no|nko|nahi|don't)\s+(?:include|take|gheu|ghya)?\s*(?:college)?s?\s*(?:from\s+)?([a-z]+)|([a-z]+)che\s+kontech\s+nko/i);
  const excludedRegion = (excluded?.[1] || excluded?.[2] || '')
    .replace(/yache$/i, '')
    .replace(/che$/i, '')
    .replace(/^akolya$/i, 'Akola');
  if (excludedRegion && excludedRegion.length > 3) {
    state.excludedRegions = [...new Set([...state.excludedRegions, excludedRegion])];
  }

  if (/college|clg|list|merit|seat\s+matrix|rank/i.test(text)) {
    state.activeTopic = state.course
      ? `${state.course} college preference and admission list`
      : 'college preference and admission list';
  }
  if (/list|college|clg/i.test(text) && /send|pathav|pathv|deto|deto|ahe|javal/i.test(text)) {
    state.pendingLists = ['college list'];
  }
  if (/kadhi|when|date|merit|seat|rank|konta|konte|kay|kasa|kase|kuthe/i.test(text)) {
    state.pendingQuestions = [text.slice(0, 160)];
  }
  if (role === 'owner') state.lastOwnerQuestion = String(original || text).slice(0, 240);
  if (role === 'contact') state.lastContactAnswer = String(original || text).slice(0, 240);
  return state;
}

function resetState(chatId) { stateByChat.delete(chatId); }
function clearAll() { stateByChat.clear(); }

module.exports = { getState, updateState, resetState, clearAll };
