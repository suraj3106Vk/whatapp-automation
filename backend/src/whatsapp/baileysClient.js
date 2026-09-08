const fs = require('fs-extra');
const path = require('path');
const mime = require('mime-types');
const qrcode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const pino = require('pino');
const {
  default: makeWASocket,
  Browsers,
  DisconnectReason,
  downloadContentFromMessage,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} = require('@whiskeysockets/baileys');

const skAgent = require('../agent/skAgent');
const { analyzeMedia } = require('../agent/llmService');
const fileManager = require('../files/fileManager');
const scheduler = require('../agent/taskScheduler');
const { loadAuthState, getAuthPath } = require('./authManager');
const { isLoggedOut, getDelay } = require('./reconnectManager');

const OWNER_NAME = process.env.OWNER_NAME || 'Suraj Zalke';
const OWNER_SHORT_NAME = process.env.OWNER_SHORT_NAME || 'Suraj';
const AUTH_PATH = getAuthPath();
const logger = pino({ level: process.env.LOG_LEVEL || 'warn' });
let io;
let socket;
let starting = false;
let reconnectTimer;
let reconnectAttempt = 0;
let state = 'disconnected';
let qr = null;
let qrBase64 = null;
let ownerChatId = null;
let messageLog = [];
let schedulerBound = false;

const settings = {
  autoReply: true,
  replyToGroups: process.env.ENABLE_GROUPS === 'true',
  blacklistedChats: new Set(),
  whitelistedOnly: false,
  whitelistedChats: new Set(),
};
const processedMessages = new Map();
const queues = new Map();
const knownChats = new Map();
const DEDUP_TTL = 10 * 60 * 1000;

function getState() {
  return {
    state,
    qr,
    qrBase64,
    owner: ownerChatId ? { name: OWNER_NAME, shortName: OWNER_SHORT_NAME, chatId: ownerChatId } : null,
  };
}
function getMessageLog() { return messageLog.slice(-100); }
function logMessage(entry) {
  messageLog.push({ ...entry, id: `${Date.now()}_${Math.random()}` });
  if (messageLog.length > 300) messageLog.shift();
  if (io) io.emit('message_log', entry);
}
function getSettings() {
  return { ...settings, blacklistedChats: [...settings.blacklistedChats], whitelistedChats: [...settings.whitelistedChats] };
}
function updateSettings(next) {
  if (typeof next.autoReply === 'boolean') settings.autoReply = next.autoReply;
  if (typeof next.replyToGroups === 'boolean') settings.replyToGroups = next.replyToGroups;
  if (typeof next.whitelistedOnly === 'boolean') settings.whitelistedOnly = next.whitelistedOnly;
  if (Array.isArray(next.blacklistedChats)) settings.blacklistedChats = new Set(next.blacklistedChats);
  if (Array.isArray(next.whitelistedChats)) settings.whitelistedChats = new Set(next.whitelistedChats);
  if (io) io.emit('settings_updated', getSettings());
}
function normalizeJid(id) { return id.includes('@') ? id : `${id.replace(/\D/g, '')}@s.whatsapp.net`; }
function messageContent(message) {
  let content = message.message || {};
  while (content.ephemeralMessage?.message || content.viewOnceMessage?.message || content.viewOnceMessageV2?.message) {
    content = content.ephemeralMessage?.message || content.viewOnceMessage?.message || content.viewOnceMessageV2?.message;
  }
  return content;
}
async function emitQr(nextQr) {
  qr = nextQr;
  state = 'qr';
  qrBase64 = await qrcode.toDataURL(nextQr, { margin: 2, width: 420 });
  qrcode.toFile(path.join(__dirname, '../../qr-code.png'), nextQr).catch(() => {});
  qrcodeTerminal.generate(nextQr, { small: true });
  if (io) io.emit('qr', { qr: nextQr, qrBase64 });
}
function textOf(message) {
  const content = messageContent(message);
  return (content.conversation || content.extendedTextMessage?.text || content.imageMessage?.caption || content.videoMessage?.caption || content.documentMessage?.caption || '').trim();
}
function typeOf(message) {
  const content = messageContent(message);
  if (content.imageMessage) return 'image';
  if (content.videoMessage) return 'video';
  if (content.audioMessage) return content.audioMessage.ptt ? 'ptt' : 'audio';
  if (content.documentMessage) return 'document';
  if (content.stickerMessage) return 'sticker';
  if (content.locationMessage) return 'location';
  if (content.contactMessage || content.contactsArrayMessage) return 'vcard';
  return 'chat';
}
async function downloadIncomingMedia(message, type) {
  const content = messageContent(message);
  const mediaMessage = content[`${type}Message`];
  if (!mediaMessage || !['image', 'document'].includes(type)) return null;
  const stream = await downloadContentFromMessage(mediaMessage, type);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}
function enqueue(chatId, work) {
  const previous = queues.get(chatId) || Promise.resolve();
  const current = previous.catch(() => {}).then(work);
  queues.set(chatId, current.finally(() => { if (queues.get(chatId) === current) queues.delete(chatId); }));
  return current;
}
async function sendText(chatId, text) {
  if (!socket || state !== 'ready') throw new Error('WhatsApp is not connected');
  return socket.sendMessage(normalizeJid(chatId), { text });
}
async function sendFile(chatId, filePath, caption = '') {
  if (!socket || state !== 'ready') throw new Error('WhatsApp is not connected');
  const buffer = await fs.readFile(filePath);
  const mimetype = mime.lookup(filePath) || 'application/octet-stream';
  const name = path.basename(filePath);
  const jid = normalizeJid(chatId);
  if (mimetype.startsWith('image/')) return socket.sendMessage(jid, { image: buffer, mimetype, caption, fileName: name });
  if (mimetype.startsWith('video/')) return socket.sendMessage(jid, { video: buffer, mimetype, caption, fileName: name });
  if (mimetype.startsWith('audio/')) return socket.sendMessage(jid, { audio: buffer, mimetype, ptt: false });
  return socket.sendMessage(jid, { document: buffer, mimetype, fileName: name, caption });
}
async function handleFileRequest(chatId, request, senderName) {
  const matched = await fileManager.findMatchingFile(request);
  if (!matched) {
    const files = await fileManager.listFiles();
    const available = files.length ? `\n\nAvailable files:\n${files.map(file => `- ${file.name}`).join('\n')}` : '';
    await sendText(chatId, `I don't have that file uploaded yet.${available}`);
    return;
  }
  await sendFile(chatId, matched.path, `Here you go! ${matched.name}`);
  logMessage({ type: 'outgoing_file', chatId, senderName: 'SK Agent', message: `[File: ${matched.name}]`, fileName: matched.name, timestamp: Date.now() });
}
function taskConfirmation(task) {
  const when = task.triggerAt ? new Date(task.triggerAt).toLocaleString('en-IN') : 'noted';
  return task.isForOwner ? `Got it! I'll tell ${OWNER_SHORT_NAME} — "${task.description}" — ${when}.` : `Got it! "${task.description}" set for ${when}.`;
}
async function handleIncoming(message) {
  const id = message.key?.id;
  const chatId = message.key?.remoteJid;
  if (!id || !chatId || message.key.fromMe || chatId === 'status@broadcast') return;
  const now = Date.now();
  for (const [oldId, at] of processedMessages) if (now - at > DEDUP_TTL) processedMessages.delete(oldId);
  if (processedMessages.has(id)) return;
  processedMessages.set(id, now);
  const isGroup = chatId.endsWith('@g.us');
  if (!settings.autoReply || (isGroup && !settings.replyToGroups) || settings.blacklistedChats.has(chatId) || (settings.whitelistedOnly && !settings.whitelistedChats.has(chatId))) return;
  return enqueue(chatId, async () => {
    const type = typeOf(message);
    const body = textOf(message);
    const senderName = message.pushName || chatId.split('@')[0];
    knownChats.set(chatId, { id: chatId, name: senderName, isGroup });
    let agentMessage = body || `[${type} message received]`;
    if (type === 'image' || type === 'document') {
      try {
        const media = await downloadIncomingMedia(message, type);
        const mimeType = message.message?.[`${type}Message`]?.mimetype;
        const analysis = await analyzeMedia(media, mimeType, body);
        if (analysis) {
          agentMessage = `[MEDIA_CONTENT]\n${body ? `Caption from ${senderName}: ${body}\n` : ''}Media analysis (${type}):\n${analysis}`;
        }
      } catch (error) {
        logger.warn({ err: error.message, type }, 'incoming media analysis failed');
      }
    }
    logMessage({ type: 'incoming', chatId, senderName, isGroup, message: body || `[${type}]`, hasMedia: type !== 'chat', timestamp: now });
    const started = Date.now();
    let result;
    try { result = await skAgent.processMessage(chatId, senderName, agentMessage); }
    catch (error) { logger.error({ err: error.message }, 'agent processing failed'); result = { reply: 'Sorry, I had an error processing your message. Please try again.' }; }
    if (result.reply) { await sendText(chatId, result.reply); logMessage({ type: 'outgoing', chatId, senderName: 'SK Agent', message: result.reply, timestamp: Date.now() }); }
    if (result.taskAction) { const task = skAgent.scheduleTask(chatId, senderName, result.taskAction); await sendText(chatId, taskConfirmation(task)); }
    if (result.fileRequest) await handleFileRequest(chatId, result.fileRequest, senderName);
    logger.info({ chatId, totalMs: Date.now() - started }, 'message processed');
  });
}
async function sendTask(task) { if (state === 'ready') await sendText(task.chatId, `Reminder: ${task.message || task.description || 'Reminder!'}`); }
async function startSocket() {
  if (starting || state === 'ready' || state === 'connecting') return;
  starting = true;
  state = reconnectAttempt ? 'reconnecting' : 'connecting';
  try {
    const { state: authState, saveCreds } = await loadAuthState();
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] }));
    socket = makeWASocket({ version, auth: { creds: authState.creds, keys: makeCacheableSignalKeyStore(authState.keys, logger) }, browser: Browsers.ubuntu('SK Agent'), logger, printQRInTerminal: false, markOnlineOnConnect: false, syncFullHistory: false, generateHighQualityLinkPreview: false });
    socket.ev.on('creds.update', saveCreds);
    socket.ev.on('messages.upsert', ({ messages, type }) => { if (type === 'notify') messages.forEach(item => handleIncoming(item).catch(error => logger.error({ err: error.message }, 'message handler failed'))); });
    socket.ev.on('connection.update', update => {
      const { connection, lastDisconnect, qr: nextQr } = update;
      if (nextQr) emitQr(nextQr).catch(error => logger.error({ err: error.message }, 'QR generation failed'));
      if (connection === 'open') { state = 'ready'; qr = null; qrBase64 = null; reconnectAttempt = 0; ownerChatId = socket.user?.id || null; if (ownerChatId) skAgent.setOwnerConfig({ name: OWNER_NAME, shortName: OWNER_SHORT_NAME, chatId: ownerChatId }); if (io) io.emit('status', getState()); logger.info({ user: ownerChatId }, 'WhatsApp connected'); }
      if (connection === 'close') { const error = lastDisconnect?.error; socket = null; state = isLoggedOut(error) ? 'logged_out' : 'disconnected'; if (!isLoggedOut(error)) { const delay = getDelay(reconnectAttempt++); state = 'reconnecting'; reconnectTimer = setTimeout(() => { reconnectTimer = null; startSocket().catch(() => {}); }, delay); logger.warn({ delay, reason: error?.message }, 'WhatsApp reconnect scheduled'); } if (io) io.emit('status', getState()); }
    });
  } finally { starting = false; }
}
async function init(socketIO) { io = socketIO; await fs.ensureDir(AUTH_PATH); if (!schedulerBound) { schedulerBound = true; scheduler.on('task_due', task => sendTask(task).catch(error => logger.error({ err: error.message }, 'task send failed'))); } await startSocket(); }
async function getChats() { return [...knownChats.values()].slice(0, 50).map(chat => ({ ...chat, unreadCount: 0, lastMessage: '' })); }
async function close() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  if (socket?.ws) socket.ws.close();
  socket = null;
  state = 'disconnected';
}
async function logout() { if (reconnectTimer) clearTimeout(reconnectTimer); reconnectTimer = null; if (socket) await socket.logout(); socket = null; state = 'logged_out'; }
module.exports = { init, getState, getSettings, updateSettings, getMessageLog, sendMessage: sendText, sendText, sendFile, getChats, close, logout, getOwnerInfo: () => ({ ownerName: OWNER_NAME, ownerShortName: OWNER_SHORT_NAME, ownerChatId }) };
