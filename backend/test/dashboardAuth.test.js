const assert = require('node:assert/strict');
const test = require('node:test');

process.env.DASHBOARD_PASSWORD = 'test-dashboard-password-123';
process.env.DASHBOARD_SESSION_SECRET = 'test-session-secret-with-more-than-32-bytes';

const {
  createSessionToken,
  isValidSessionToken,
  requireDashboardAuth,
  validateAuthConfig,
  verifyPassword,
} = require('../src/api/dashboardAuth');

test('dashboard auth requires configured long secrets', () => {
  assert.doesNotThrow(() => validateAuthConfig());
  const previous = process.env.DASHBOARD_PASSWORD;
  process.env.DASHBOARD_PASSWORD = 'short';
  assert.throws(() => validateAuthConfig(), /at least 16 characters/);
  process.env.DASHBOARD_PASSWORD = previous;
});

test('dashboard password comparison accepts only the configured password', () => {
  assert.equal(verifyPassword('test-dashboard-password-123'), true);
  assert.equal(verifyPassword('wrong-password'), false);
  assert.equal(verifyPassword(undefined), false);
});

test('signed sessions are valid until expiration and reject tampering', () => {
  const now = 1_800_000_000_000;
  const token = createSessionToken(now);
  assert.equal(isValidSessionToken(token, now), true);
  assert.equal(isValidSessionToken(token, now + 7 * 24 * 60 * 60 * 1000), false);
  assert.equal(isValidSessionToken(`${token}x`, now), false);
  assert.equal(isValidSessionToken('not-a-token', now), false);
});

test('dashboard API middleware rejects missing tokens and accepts valid sessions', () => {
  const response = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  let continued = false;
  const next = () => { continued = true; };

  requireDashboardAuth({ get: () => '' }, response, next);
  assert.equal(response.statusCode, 401);
  assert.equal(continued, false);

  requireDashboardAuth({ get: () => `Bearer ${createSessionToken()}` }, response, next);
  assert.equal(continued, true);
});
