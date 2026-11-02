const assert = require('node:assert/strict');
const test = require('node:test');

const {
  getBearerToken,
  getFirebaseConfig,
  isAuthorizedAdmin,
} = require('../src/api/firebaseAuth');

test('Firebase token verification config requires project ID and an email or UID allowlist', () => {
  const previous = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    adminEmails: process.env.FIREBASE_ADMIN_EMAILS,
    adminUids: process.env.FIREBASE_ADMIN_UIDS,
  };

  try {
    process.env.FIREBASE_PROJECT_ID = 'test-project';
    process.env.FIREBASE_ADMIN_EMAILS = 'Admin@Example.com';
    process.env.FIREBASE_ADMIN_UIDS = 'firebase-admin-uid';
    const config = getFirebaseConfig();
    assert.equal(config.projectId, 'test-project');
    assert.deepEqual(config.adminEmails, ['admin@example.com']);
    assert.deepEqual(config.adminUids, ['firebase-admin-uid']);
  } finally {
    if (previous.projectId === undefined) delete process.env.FIREBASE_PROJECT_ID;
    else process.env.FIREBASE_PROJECT_ID = previous.projectId;
    if (previous.adminEmails === undefined) delete process.env.FIREBASE_ADMIN_EMAILS;
    else process.env.FIREBASE_ADMIN_EMAILS = previous.adminEmails;
    if (previous.adminUids === undefined) delete process.env.FIREBASE_ADMIN_UIDS;
    else process.env.FIREBASE_ADMIN_UIDS = previous.adminUids;
  }
});

test('Firebase admins are authorized by exact UID or verified allowlisted email', () => {
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
  assert.equal(isAuthorizedAdmin({
    uid: 'firebase-admin-uid',
    email: 'admin@example.com',
    email_verified: true,
  }, [], ['firebase-admin-uid']), true);
  assert.equal(isAuthorizedAdmin({
    uid: 'firebase-admin-uid',
    email: 'admin@example.com',
    email_verified: false,
  }, [], ['firebase-admin-uid']), true);
  assert.equal(isAuthorizedAdmin({
    uid: 'firebase-admin-uid',
  }, [], ['firebase-admin-uid']), true);
  assert.equal(isAuthorizedAdmin({
    uid: 'other-uid',
    email: 'admin@example.com',
    email_verified: true,
  }, [], ['firebase-admin-uid']), false);
});

test('bearer token extraction rejects missing or malformed authorization', () => {
  assert.equal(getBearerToken({ get: () => 'Bearer firebase-id-token' }), 'firebase-id-token');
  assert.equal(getBearerToken({ get: () => '' }), '');
  assert.equal(getBearerToken({ get: () => 'Basic abc' }), '');
});
