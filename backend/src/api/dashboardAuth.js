const crypto = require('crypto');

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

function getCredentials() {
  const password = process.env.DASHBOARD_PASSWORD || '';
  const sessionSecret = process.env.DASHBOARD_SESSION_SECRET || '';
  if (password.length < 16) {
    throw new Error('DASHBOARD_PASSWORD must be at least 16 characters long');
  }
  if (Buffer.byteLength(sessionSecret, 'utf8') < 32) {
    throw new Error('DASHBOARD_SESSION_SECRET must be at least 32 bytes long');
  }
  return { password, sessionSecret };
}

function hash(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest();
}

function verifyPassword(password) {
  const { password: configuredPassword } = getCredentials();
  if (typeof password !== 'string') return false;
  return crypto.timingSafeEqual(hash(password), hash(configuredPassword));
}

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function getTokenSecret() {
  const { password, sessionSecret } = getCredentials();
  return `${sessionSecret}:${hash(password).toString('hex')}`;
}

function createSessionToken(now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({
    expiresAt: Math.floor(now / 1000) + SESSION_TTL_SECONDS,
  })).toString('base64url');
  return `${payload}.${sign(payload, getTokenSecret())}`;
}

function isValidSessionToken(token, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 2048) return false;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;

  const expectedSignature = Buffer.from(sign(parts[0], getTokenSecret()));
  const actualSignature = Buffer.from(parts[1]);
  if (expectedSignature.length !== actualSignature.length ||
      !crypto.timingSafeEqual(expectedSignature, actualSignature)) return false;

  try {
    const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    return Number.isInteger(payload.expiresAt) && payload.expiresAt > Math.floor(now / 1000);
  } catch (error) {
    if (error instanceof SyntaxError) return false;
    throw error;
  }
}

function tokenFromRequest(req) {
  const authorization = req.get('authorization') || '';
  const match = authorization.match(/^Bearer ([^\s]+)$/i);
  return match ? match[1] : '';
}

function requireDashboardAuth(req, res, next) {
  if (isValidSessionToken(tokenFromRequest(req))) return next();
  return res.status(401).json({ success: false, error: 'Authentication required' });
}

function createLoginRateLimiter({ maxAttempts = 5, windowMs = 15 * 60 * 1000 } = {}) {
  const attempts = new Map();

  return (req, res, next) => {
    const now = Date.now();
    for (const [ip, record] of attempts) {
      if (record.resetAt <= now) attempts.delete(ip);
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const record = attempts.get(ip);
    if (record && record.count >= maxAttempts) {
      res.set('Retry-After', String(Math.ceil((record.resetAt - now) / 1000)));
      return res.status(429).json({ success: false, error: 'Too many login attempts. Try again later.' });
    }

    req.recordDashboardLoginFailure = () => {
      const current = attempts.get(ip);
      if (!current || current.resetAt <= Date.now()) {
        attempts.set(ip, { count: 1, resetAt: Date.now() + windowMs });
      } else {
        current.count += 1;
      }
    };
    req.clearDashboardLoginFailures = () => attempts.delete(ip);
    return next();
  };
}

module.exports = {
  createLoginRateLimiter,
  createSessionToken,
  isValidSessionToken,
  requireDashboardAuth,
  verifyPassword,
  validateAuthConfig: getCredentials,
};
