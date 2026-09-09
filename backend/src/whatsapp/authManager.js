const fs = require('fs-extra');
const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
const storage = require('../config/storage');

const pendingSaves = new Set();

function getAuthPath() {
  return storage.getWhatsAppAuthPath();
}

function hasExistingWhatsAppAuth() {
  const authPath = getAuthPath();
  return fs.existsSync(authPath) && fs.existsSync(`${authPath}/creds.json`);
}

async function loadAuthState() {
  const authPath = getAuthPath();
  await fs.ensureDir(authPath);
  const authState = await useMultiFileAuthState(authPath);
  const originalSaveCreds = authState.saveCreds;
  const saveCreds = () => {
    let operation;
    operation = Promise.resolve()
      .then(() => originalSaveCreds())
      .finally(() => pendingSaves.delete(operation));
    pendingSaves.add(operation);
    return operation;
  };
  return { ...authState, saveCreds };
}

async function flushCredentialWrites(timeoutMs = 5000) {
  const pending = [...pendingSaves];
  if (!pending.length) return;
  await Promise.race([
    Promise.allSettled(pending),
    new Promise(resolve => setTimeout(resolve, timeoutMs)),
  ]);
}

async function getAuthMetadata() {
  const authPath = getAuthPath();
  let keyFiles = 0;
  try {
    keyFiles = (await fs.readdir(authPath)).filter(file => file !== 'creds.json').length;
  } catch {}
  return { path: authPath, existing: hasExistingWhatsAppAuth(), keyFiles };
}

module.exports = { loadAuthState, getAuthPath, hasExistingWhatsAppAuth, flushCredentialWrites, getAuthMetadata };
