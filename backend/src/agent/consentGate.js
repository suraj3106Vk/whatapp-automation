const fs = require('fs');
const path = require('path');
const { getDataPath } = require('../config/storage');

const CONSENT_STATES = Object.freeze({
  UNKNOWN: 'UNKNOWN',
  PENDING: 'PENDING',
  ALLOWED: 'ALLOWED',
  DENIED: 'DENIED',
});

const consentPath = path.join(getDataPath(), 'ai-consent.json');
let consentByContact = loadConsent();

const AGREE = /^(yes|y|yeah|yep|ok|okay|okk|ha+|ho+|hona|hmm\s+yes|sure|continue|chalel|b+r+r|barobar|thik(?:\s+ahe)?|theek|kar|kr|bol|chalega|yes\s+please)[\s!.?]*$/i;
const DISAGREE = /^(no|n|nope|nah|nahi|nh|nko|nako|don'?t|stop|band\s+kar|reply\s+nako|ai\s+nako|chat\s+nako|nahi\s+pahije|leave\s+it|rahude|rhaude)[\s!.?]*$/i;
const ENABLE = /\b(?:ai\s+(?:on|start)|bot\s+start|assistant\s+sobat\s+bolaych|ai\s+reply\s+karu\s+de|continue\s+ai)\b/i;
const REVOKE = /\b(?:ai\s+nako|reply\s+nako|bot\s+band\s+kar|stop\s+reply(?:ing)?|don'?t\s+reply|nako\s+bolu|assistant\s+off)\b/i;

function loadConsent() {
  try {
    return JSON.parse(fs.readFileSync(consentPath, 'utf8')) || {};
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn('[Consent] Could not read consent store:', error.message);
    return {};
  }
}

function persist() {
  fs.mkdirSync(path.dirname(consentPath), { recursive: true });
  const temporaryPath = `${consentPath}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(consentByContact, null, 2)}\n`, 'utf8');
  fs.renameSync(temporaryPath, consentPath);
}

function get(chatId) {
  return consentByContact[chatId] || { state: CONSENT_STATES.UNKNOWN, askedAt: null, updatedAt: null };
}

function set(chatId, state) {
  const now = new Date().toISOString();
  consentByContact[chatId] = {
    state,
    askedAt: state === CONSENT_STATES.PENDING ? now : (consentByContact[chatId]?.askedAt || null),
    updatedAt: now,
  };
  persist();
  return consentByContact[chatId];
}

function classifyDecision(text) {
  const normalized = String(text || '').trim();
  if (AGREE.test(normalized)) return 'AGREE';
  if (DISAGREE.test(normalized)) return 'DISAGREE';
  return 'UNCLEAR';
}

function languageFor(text, preferredLanguage = '') {
  if (/\b(?:nahi|nko|nako|hai|hoon|karna|chalega|aap|main)\b/i.test(text)) return 'hindi';
  if (/\b(?:ahe|aahe|kay|kaay|kuthe|chalel|brr|bolaych|mazya|mi|ha|ho)\b/i.test(text)) return 'marathi';
  return preferredLanguage || 'english';
}

function disclosure(text, preferredLanguage) {
  const language = languageFor(text, preferredLanguage);
  if (language === 'hindi') return 'Main Mr. Suraj ka AI assistant hoon. Mere saath chat continue karna hai?';
  if (language === 'marathi') return 'Mi Mr. Suraj cha AI assistant ahe. Mazyashi chat continue karaychi ka?';
  return "I'm Mr. Suraj's AI assistant. Want to continue chatting with me?";
}

function reset() {
  consentByContact = {};
  persist();
}

module.exports = {
  CONSENT_STATES,
  classifyDecision,
  disclosure,
  get,
  set,
  isEnableCommand: text => ENABLE.test(String(text || '')),
  isRevokeCommand: text => REVOKE.test(String(text || '')),
  reset,
  path: consentPath,
};