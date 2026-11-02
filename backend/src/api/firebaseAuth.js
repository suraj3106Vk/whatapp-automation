const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

let firebaseConfig;

function getFirebaseConfig() {
  if (firebaseConfig) return firebaseConfig;
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const adminEmails = (process.env.FIREBASE_ADMIN_EMAILS || '')
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);
  const adminUids = (process.env.FIREBASE_ADMIN_UIDS || '')
    .split(',')
    .map(uid => uid.trim())
    .filter(Boolean);
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS)
    : '';

  if (!projectId) throw new Error('FIREBASE_PROJECT_ID is required');
  if (!adminEmails.length && !adminUids.length) {
    throw new Error('Set at least one Firebase admin email or UID');
  }
  if (!credentialsPath || !fs.existsSync(credentialsPath)) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS must point to the Firebase service-account JSON file');
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Firebase service-account file is not valid JSON');
    }
    throw error;
  }
  if (serviceAccount.project_id !== projectId) {
    throw new Error('Firebase service-account project_id must match FIREBASE_PROJECT_ID');
  }

  firebaseConfig = { projectId, adminEmails, adminUids, serviceAccount };
  return firebaseConfig;
}

function initializeFirebaseAdmin() {
  const { projectId, serviceAccount } = getFirebaseConfig();
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId,
    });
  }
  return admin.app();
}

function isAuthorizedAdmin(decodedToken, adminEmails, adminUids = []) {
  const email = decodedToken?.email?.trim().toLowerCase();
  return decodedToken?.email_verified === true &&
    Boolean(email) &&
    (adminEmails.includes(email) || adminUids.includes(decodedToken?.uid));
}

function getBearerToken(req) {
  const match = (req.get('authorization') || '').match(/^Bearer ([^\s]+)$/i);
  return match ? match[1] : '';
}

async function verifyFirebaseToken(token) {
  const { adminEmails, adminUids } = getFirebaseConfig();
  if (!admin.apps.length) initializeFirebaseAdmin();
  const decodedToken = await admin.auth().verifyIdToken(token, true);
  if (!isAuthorizedAdmin(decodedToken, adminEmails, adminUids)) {
    const error = new Error('Firebase user is not an authorized dashboard admin');
    error.status = 403;
    throw error;
  }
  return decodedToken;
}

async function requireDashboardAuth(req, res, next) {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ success: false, error: 'Sign in with the authorized Firebase admin account' });
  }

  try {
    req.firebaseUser = await verifyFirebaseToken(token);
    return next();
  } catch (error) {
    if (error.status === 403) {
      return res.status(403).json({ success: false, error: 'This Firebase account is not an authorized dashboard admin' });
    }
    if (error.code?.startsWith('auth/')) {
      return res.status(401).json({ success: false, error: 'Firebase sign-in has expired; sign in again' });
    }
    console.error('[Auth] Firebase token verification failed:', error.message);
    return res.status(503).json({ success: false, error: 'Firebase authentication is temporarily unavailable' });
  }
}

module.exports = {
  getBearerToken,
  getFirebaseConfig,
  initializeFirebaseAdmin,
  isAuthorizedAdmin,
  requireDashboardAuth,
  verifyFirebaseToken,
};
