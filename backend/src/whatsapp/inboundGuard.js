const crypto = require('crypto');

const DEFAULT_WINDOW_MS = 60 * 1000;
const DEFAULT_MAX_PER_MINUTE = 20;

function timestampMs(value) {
  if (value == null) return null;
  if (typeof value === 'object' && typeof value.toNumber === 'function') return value.toNumber() * 1000;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return numeric < 1e12 ? numeric * 1000 : numeric;
}

function isStaleIncomingMessage(message, startedAt = Date.now(), toleranceMs = 45 * 1000) {
  const timestamp = timestampMs(message?.messageTimestamp);
  return timestamp != null && timestamp < startedAt - toleranceMs;
}

function createInboundGuard(options = {}) {
  const windowMs = options.windowMs || DEFAULT_WINDOW_MS;
  const maxPerMinute = Number(options.maxPerMinute || process.env.AUTOMATION_MAX_MESSAGES_PER_MINUTE || DEFAULT_MAX_PER_MINUTE);
  const ids = new Map();
  const semantic = new Map();
  const counts = new Map();
  const clean = now => {
    for (const [key, at] of ids) if (now - at > windowMs * 10) ids.delete(key);
    for (const [key, at] of semantic) if (now - at > 15000) semantic.delete(key);
    for (const [key, entry] of counts) if (now - entry.startedAt > windowMs) counts.delete(key);
  };
  return {
    check({ chatId, messageId, text = '', timestamp = Date.now() }) {
      const now = Date.now(); clean(now);
      if (!chatId || !messageId) return { allowed: false, reason: 'invalid' };
      if (ids.has(`${chatId}:${messageId}`)) return { allowed: false, reason: 'duplicate' };
      const normalized = String(text).trim().toLowerCase().replace(/\s+/g, ' ');
      if (normalized) {
        const rounded = Math.floor((timestampMs(timestamp) || now) / 5000);
        const hash = crypto.createHash('sha1').update(`${chatId}:${normalized}:${rounded}`).digest('hex');
        if (semantic.has(hash)) return { allowed: false, reason: 'semantic_duplicate' };
        semantic.set(hash, now);
      }
      const current = counts.get(chatId) || { startedAt: now, count: 0 };
      if (now - current.startedAt >= windowMs) { current.startedAt = now; current.count = 0; }
      current.count++;
      counts.set(chatId, current);
      ids.set(`${chatId}:${messageId}`, now);
      if (current.count > maxPerMinute) return { allowed: false, reason: 'rate_limit', count: current.count, retryAfterMs: windowMs - (now - current.startedAt) };
      return { allowed: true, count: current.count };
    },
    clear() { ids.clear(); semantic.clear(); counts.clear(); },
  };
}

module.exports = { createInboundGuard, isStaleIncomingMessage, timestampMs };
