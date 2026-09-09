const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { DisconnectReason } = require('@whiskeysockets/baileys');

function loadStorage(env) {
  const keys = ['RAILWAY_ENVIRONMENT', 'RAILWAY_PROJECT_ID', 'RAILWAY_SERVICE_ID', 'DATA_PATH', 'WHATSAPP_AUTH_PATH'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  keys.forEach(key => delete process.env[key]);
  Object.assign(process.env, env);
  const modulePath = require.resolve('../src/config/storage');
  delete require.cache[modulePath];
  const storage = require(modulePath);
  keys.forEach(key => {
    if (previous[key] === undefined) delete process.env[key];
    else process.env[key] = previous[key];
  });
  return storage;
}

test('Railway defaults auth to /data/whatsapp-auth', () => {
  const storage = loadStorage({ RAILWAY_ENVIRONMENT: 'production' });
  assert.equal(storage.getDataPath(), path.resolve('/data'));
  assert.equal(storage.getWhatsAppAuthPath(), path.resolve('/data/whatsapp-auth'));
});

test('auth detection survives a fresh auth manager load', async () => {
  const authPath = fs.mkdtempSync(path.join(os.tmpdir(), 'sk-auth-'));
  fs.writeFileSync(path.join(authPath, 'creds.json'), '{}');
  const previous = process.env.WHATSAPP_AUTH_PATH;
  process.env.WHATSAPP_AUTH_PATH = authPath;
  const modulePath = require.resolve('../src/whatsapp/authManager');
  delete require.cache[modulePath];
  const authManager = require(modulePath);
  assert.equal(authManager.getAuthPath(), path.resolve(authPath));
  assert.equal(authManager.hasExistingWhatsAppAuth(), true);
  fs.rmSync(authPath, { recursive: true, force: true });
  if (previous === undefined) delete process.env.WHATSAPP_AUTH_PATH;
  else process.env.WHATSAPP_AUTH_PATH = previous;
});

test('401 auth failures are detected as invalid sessions', () => {
  const { isAuthFailure } = require('../src/whatsapp/reconnectManager');

  assert.equal(isAuthFailure({ output: { statusCode: 401 }, message: 'Connection Failure' }), true);
  assert.equal(isAuthFailure({ output: { statusCode: DisconnectReason.loggedOut } }), true);
  assert.equal(isAuthFailure({ output: { statusCode: 500 }, message: 'Connection Failure' }), false);
});