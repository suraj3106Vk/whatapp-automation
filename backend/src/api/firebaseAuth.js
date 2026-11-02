/**
 * Time-based PIN authentication
 *
 * The dashboard password is always the current time in HHMM format (IST).
 * Example: if the time is 01:22, the password is "0122".
 *
 * A ±2 minute window is accepted so clock drift / slow typing doesn't lock you out.
 * Sessions are issued as simple signed tokens (HMAC-SHA256) that expire in 8 hours.
 */

const crypto = require('crypto');

// Secret used to sign session tokens.  Set DASHBOARD_SECRET in .env for a
// stable value; if not set a random one is generated per process restart.
const SECRET = process.env.DASHBOARD_SECRET || crypto.randomBytes(32).toString('hex');

// Session lifetime: 8 hours
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

// ── PIN generation ────────────────────────────────────────────────────────────

/**
 * Returns the valid PINs for a given Date (±2 minutes window).
 * Each minute produces a 4-digit "HHMM" string in IST (UTC+5:30).
 */
function validPinsForTime(date = new Date()) {
  const pins = new Set();
  for (let offset = -2; offset <= 2; offset++) {
    const t = new Date(date.getTime() + offset * 60_000);
    // Convert to IST
    const ist = new Date(t.getTime() + 5.5 * 60 * 60 * 1000);
    const hh = String(ist.getUTCHours()).padStart(2, '0');
    const mm = String(ist.getUTCMinutes()).padStart(2, '0');
    pins.add(`${hh}${mm}`);
  }
  return pins;
}

function verifyPin(pin) {
  return validPinsForTime().has(String(pin || '').trim());
}

// ── Session tokens ────────────────────────────────────────────────────────────

function issueToken() {
  const payload = `${Date.now()}`;
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}.${sig}`).toString('base64url');
}

function verifyToken(token) {
  if (!token) return false;
  try {
    const raw = Buffer.from(token, 'base64url').toString();
    const [ts, sig] = raw.split('.');
    if (!ts || !sig) return false;
    const expected = crypto.createHmac('sha256', SECRET).update(ts).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
    return Date.now() - Number(ts) < SESSION_TTL_MS;
  } catch {
    return false;
  }
}

// ── Express middleware ────────────────────────────────────────────────────────

function getBearerToken(req) {
  const match = (req.get('authorization') || '').match(/^Bearer ([^\s]+)$/i);
  return match ? match[1] : '';
}

function requireDashboardAuth(req, res, next) {
  const token = getBearerToken(req);
  if (verifyToken(token)) {
    req.dashboardUser = { authenticated: true };
    return next();
  }
  return res.status(401).json({ success: false, error: 'Session expired or invalid. Enter the current time PIN.' });
}

// Socket.IO auth (returns true/false instead of throwing)
function verifySocketToken(token) {
  return verifyToken(token);
}

// ── No-op stubs kept so index.js imports don't break ─────────────────────────
function initializeFirebaseAdmin() {}
async function verifyFirebaseToken(token) {
  if (!verifyToken(token)) {
    const err = new Error('Invalid or expired session token');
    err.status = 401;
    throw err;
  }
  return { authenticated: true };
}

module.exports = {
  verifyPin,
  issueToken,
  verifyToken,
  getBearerToken,
  requireDashboardAuth,
  initializeFirebaseAdmin,
  verifyFirebaseToken,
  verifySocketToken,
  validPinsForTime, // exported for testing
};
