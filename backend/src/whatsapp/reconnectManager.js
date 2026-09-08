const { DisconnectReason } = require('@whiskeysockets/baileys');

const BACKOFF_MS = [1000, 2000, 5000, 10000, 20000, 30000];

function isLoggedOut(error) {
  return error?.output?.statusCode === DisconnectReason.loggedOut ||
    error?.statusCode === DisconnectReason.loggedOut;
}

function getDelay(attempt) {
  return BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
}

module.exports = { isLoggedOut, getDelay };
