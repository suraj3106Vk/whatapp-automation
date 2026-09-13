const contacts = new Map();

function normalizeName(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

function normalizeNumber(jid) {
  const value = String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');
  return value.length >= 7 ? value : null;
}

function upsert(entries = []) {
  for (const entry of entries) {
    const jid = entry?.id || entry?.jid;
    const number = normalizeNumber(jid);
    const name = entry?.name || entry?.notify || entry?.verifiedName || entry?.shortName;
    if (!number || !name) continue;
    contacts.set(normalizeName(name), { name: String(name).trim(), number, jid });
  }
}

function remember(jid, name) {
  const number = normalizeNumber(jid);
  if (!number || !name) return;
  contacts.set(normalizeName(name), { name: String(name).trim(), number, jid });
}

function find(name) {
  const query = normalizeName(name);
  if (!query) return null;
  const exact = contacts.get(query);
  if (exact) return exact;
  const queryTokens = query.split(' ').filter(token => token.length > 1);
  for (const [key, contact] of contacts) {
    if (key.includes(query) || query.includes(key)) return contact;
    const keyTokens = key.split(' ');
    if (queryTokens.length > 1 && queryTokens.every(token => keyTokens.includes(token))) return contact;
  }
  return null;
}

function clear() {
  contacts.clear();
}

module.exports = { upsert, remember, find, clear };
