const fs = require('fs-extra');
const path = require('path');
const { useMultiFileAuthState } = require('@whiskeysockets/baileys');

const authPath = path.resolve(process.env.WHATSAPP_AUTH_PATH || path.join(__dirname, '../../data/whatsapp-auth'));

async function loadAuthState() {
  await fs.ensureDir(authPath);
  return useMultiFileAuthState(authPath);
}

function getAuthPath() {
  return authPath;
}

module.exports = { loadAuthState, getAuthPath };
