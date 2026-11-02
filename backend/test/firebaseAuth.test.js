const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  getBearerToken,
  getFirebaseConfig,
  isAuthorizedAdmin,
} = require('../src/api/firebaseAuth');

test('Firebase admin config requires a matching service account and admin email', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sk-firebase-'));
  const credentialsPath = path.join(directory, 'service-account.json');
  fs.writeFileSync(credentialsPath, JSON.stringify({
    project_id: 'test-project',
    client_email: 'admin@test-project.iam.gserviceaccount.com',
    private_key: 'test-private-key',
  }));
  const previous = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    adminEmails: process.env.FIREBASE_ADMIN_EMAILS,
    credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  };

  try {
    process.env.FIREBASE_PROJECT_ID = 'test-project';
    process.env.FIREBASE_ADMIN_EMAILS = 'Admin@Example.com';
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
    const config = getFirebaseConfig();
    assert.equal(config.projectId, 'test-project');
    assert.deepEqual(config.adminEmails, ['admin@example.com']);
    assert.equal(config.serviceAccount.project_id, 'test-project');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
    if (previous.projectId === undefined) delete process.env.FIREBASE_PROJECT_ID;
    else process.env.FIREBASE_PROJECT_ID = previous.projectId;
    if (previous.adminEmails === undefined) delete process.env.FIREBASE_ADMIN_EMAILS;
    else process.env.FIREBASE_ADMIN_EMAILS = previous.adminEmails;
    if (previous.credentials === undefined) delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    else process.env.GOOGLE_APPLICATION_CREDENTIALS = previous.credentials;
  }
});

test('only verified, allowlisted Firebase emails are dashboard admins', () => {
  const adminEmails = ['admin@example.com'];
  assert.equal(isAuthorizedAdmin({
    email: 'Admin@Example.com',
    email_verified: true,
  }, adminEmails), true);
  assert.equal(isAuthorizedAdmin({
    email: 'admin@example.com',
    email_verified: false,
  }, adminEmails), false);
  assert.equal(isAuthorizedAdmin({
    email: 'other@example.com',
    email_verified: true,
  }, adminEmails), false);
});

test('bearer token extraction rejects missing or malformed authorization', () => {
  assert.equal(getBearerToken({ get: () => 'Bearer firebase-id-token' }), 'firebase-id-token');
  assert.equal(getBearerToken({ get: () => '' }), '');
  assert.equal(getBearerToken({ get: () => 'Basic abc' }), '');
});
