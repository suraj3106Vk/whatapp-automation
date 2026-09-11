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
const { loadAuthState, getAuthPath, hasExistingWhatsAppAuth, flushCredentialWrites, getAuthMetadata } = require('./authManager');
const storage = require('../config/storage');
const { isLoggedOut, isAuthFailure, getDelay } = require('./reconnectManager');
const { mergeMessages } = require('../agent/messageNormalizer');
const { extractMessageContent, unwrapMessageContent } = require('./messageExtractor');
const { classifyReplyPolicy } = require('../agent/messagePolicy');
const { createInboundGuard, isStaleIncomingMessage, timestampMs } = require('./inboundGuard');
const memory = require('../memory/conversationMemory');

const OWNER_NAME = process.env.OWNER_NAME || 'Suraj Zalke';
const OWNER_SHORT_NAME = process.env.OWNER_SHORT_NAME || 'Suraj';
const AUTH_PATH = getAuthPath();
// ── Pino logger with Signal Protocol noise filter ─────────────────────────────
// Baileys logs Bad MAC / MessageCounterError / decrypt failures from libsignal
// internally. These are harmless (ratchet-key stale/already-used), the affected
// messages arrive with no text and get dropped by WA_EXTRACT.  We suppress them
// here so they don't flood production logs.
const SIGNAL_NOISE_RE = /bad mac|messagecountererror|key used already|never filled|failed to decrypt|decrypt.*session|session.*decrypt/i;

const _pinoBase = pino({ level: process.env.LOG_LEVEL || 'warn' });
const logger = _pinoBase.child(
  {},
  {
    // Intercept every log call; if the msg or any passed object mentions Signal
    // crypto problems, discard it silently.
    redact: [],
    // pino doesn't have a native "filter" hook, so we override the transport
    // methods at the child level via a custom mixin approach.
  }
);

// Wrap the low-level pino write so we can drop Signal noise before it reaches
// stdout/stderr.  This is done once on the shared logger instance that is also
// passed into makeWASocket.
(function patchLoggerForSignalNoise(log) {
  const levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
  for (const lvl of levels) {
    const original = log[lvl].bind(log);
    log[lvl] = function (...args) {
      // args can be (obj, msg, ...interpolation) or (msg, ...interpolation)
      const combined = args.map(a => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a ?? ''))).join(' ');
      if (SIGNAL_NOISE_RE.test(combined)) return; // drop silently
      return original(...args);
    };
  }
}(logger));
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
let explicitLogout = false;
const BOT_STARTED_AT = Date.now();
const inboundGuard = createInboundGuard();
let connectionGeneration = 0;

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
const pendingTextMessages = new Map();
const automatedOutgoing = new Map();
const DEDUP_TTL = 10 * 60 * 1000;

function getState() {
  return {
    state,
    qr,
    qrBase64,
    authPath: AUTH_PATH,
    persistentStorage: !storage.isRailway() || AUTH_PATH === path.resolve('/data/whatsapp-auth'),
    existingSession: hasExistingWhatsAppAuth(),
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
async function emitQr(nextQr) {
  qr = nextQr;
  state = 'qr';
  qrBase64 = await qrcode.toDataURL(nextQr, { margin: 2, width: 420 });
  qrcode.toFile(path.join(__dirname, '../../qr-code.png'), nextQr).catch(() => {});
  qrcodeTerminal.generate(nextQr, { small: true });
  if (io) io.emit('qr', { qr: nextQr, qrBase64 });
}
function textOf(message) {
  if (message.__combinedText) return message.__combinedText;
  return extractMessageContent(message).text;
}
function typeOf(message) {
  return extractMessageContent(message).type;
}
async function downloadIncomingMedia(message, type) {
  const content = unwrapMessageContent(message);
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
  const outgoing = automatedOutgoing.get(chatId) || [];
  outgoing.push(text);
  automatedOutgoing.set(chatId, outgoing.slice(-10));
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
async function processIncomingMessage(message) {
  const id = message.key?.id;
  const chatId = message.key?.remoteJid;
  if (!id || !chatId || chatId === 'status@broadcast' || chatId === 'newsletter') return;
  if (isStaleIncomingMessage(message, BOT_STARTED_AT)) {
    logger.info({ id, chatId }, 'stale WhatsApp message ignored');
    return;
  }
  if (message.key.fromMe) {
    const body = textOf(message);
    const outgoing = automatedOutgoing.get(chatId) || [];
    const automatedIndex = outgoing.indexOf(body);
    if (automatedIndex >= 0) {
      outgoing.splice(automatedIndex, 1);
      if (outgoing.length) automatedOutgoing.set(chatId, outgoing);
      else automatedOutgoing.delete(chatId);
    } else if (body) {
      memory.addMessage(chatId, 'owner', body);
    }
    return;
  }
  const now = Date.now();
  for (const [oldId, at] of processedMessages) if (now - at > DEDUP_TTL) processedMessages.delete(oldId);
  const extracted = extractMessageContent(message);
  const guardResult = inboundGuard.check({ chatId, messageId: id, text: extracted.text, timestamp: timestampMs(message.messageTimestamp) || now });
  if (!guardResult.allowed) {
    logger.info({ id, chatId, reason: guardResult.reason, count: guardResult.count }, 'inbound message ignored');
    return;
  }
  processedMessages.set(id, now);
  const isGroup = chatId.endsWith('@g.us');
  if (!settings.autoReply || (isGroup && !settings.replyToGroups) || settings.blacklistedChats.has(chatId) || (settings.whitelistedOnly && !settings.whitelistedChats.has(chatId))) return;
  return enqueue(chatId, async () => {
    const type = extracted.type;
    const body = extracted.text;
    if (!body && !extracted.hasMedia) {
      logger.warn({ messageId: id, topLevelType: Object.keys(message.message || {})[0] || 'unknown', keys: Object.keys(message.message || {}), extractedTextLength: 0 }, 'WA_EXTRACT produced no text');
      return;
    }
    const policy = classifyReplyPolicy(extracted, memory.getHistory(chatId).slice(-6).map(item => item.content));
    if (policy === 'NO_REPLY') {
      logger.info({ id, chatId, type, textLength: body.length, policy }, 'message policy suppressed reply');
      return;
    }
    const senderName = message.pushName || chatId.split('@')[0];
    knownChats.set(chatId, { id: chatId, name: senderName, isGroup });
    let agentMessage = body;
    if (type === 'image' || type === 'document') {
      try {
        const media = await downloadIncomingMedia(message, type);
        const mimeType = extracted.mimeType;
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
    const fromNumber = chatId.split('@')[0]; // Extract phone number from chatId
    try { result = await skAgent.processMessage(chatId, senderName, agentMessage, fromNumber, { isGroup }); }
    catch (error) { logger.error({ err: error.message }, 'agent processing failed'); result = { reply: 'Sorry, I had an error processing your message. Please try again.' }; }
    let responseText = result.reply || null;
    if (result.taskAction) {
      const task = skAgent.scheduleTask(chatId, senderName, result.taskAction);
      const confirmation = taskConfirmation(task);
      responseText = responseText ? `${responseText}\n${confirmation}` : confirmation;
    }
    if (responseText) { await sendText(chatId, responseText); logMessage({ type: 'outgoing', chatId, senderName: 'SK Agent', message: responseText, timestamp: Date.now() }); }
    if (result.fileRequest) await handleFileRequest(chatId, result.fileRequest, senderName);
    logger.info({ chatId, totalMs: Date.now() - started }, 'message processed');
  });
}

async function handleIncoming(message) {
  const chatId = message.key?.remoteJid;
  const type = typeOf(message);
  const body = textOf(message);
  if (!chatId || type !== 'chat' || !body) return processIncomingMessage(message);

  const pending = pendingTextMessages.get(chatId) || { messages: [], timer: null };
  pending.messages.push(message);
  if (pending.timer) clearTimeout(pending.timer);
  pending.timer = setTimeout(() => {
    pendingTextMessages.delete(chatId);
    const first = pending.messages[0];
    first.__combinedText = mergeMessages(pending.messages.map(textOf));
    processIncomingMessage(first).catch(error => logger.error({ err: error.message }, 'aggregated message handler failed'));
  }, 1500);
  pendingTextMessages.set(chatId, pending);
}
async function sendTask(task) { if (state === 'ready') await sendText(task.chatId, `Reminder: ${task.message || task.description || 'Reminder!'}`); }
async function startSocket() {
  if (starting || state === 'ready' || state === 'connecting' || reconnectTimer) return;
  starting = true;
  state = reconnectAttempt ? 'reconnecting' : 'connecting';
  try {
    const authMetadata = await getAuthMetadata();
    const existingAuth = authMetadata.existing;
    logger.info({ authPath: authMetadata.path, existingAuth, keyFiles: authMetadata.keyFiles }, existingAuth ? 'Restoring linked WhatsApp session' : 'No existing WhatsApp auth; pairing may be required');
    console.log(`[WhatsApp] Auth path: ${authMetadata.path}`);
    console.log(`[WhatsApp] Existing auth: ${existingAuth ? 'YES' : 'NO'}`);
    if (existingAuth) console.log(`[WhatsApp Auth] credentials present: YES; key files: ${authMetadata.keyFiles}`);
    const { state: authState, saveCreds } = await loadAuthState();
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] }));
    const generation = ++connectionGeneration;
    const activeSocket = makeWASocket({ version, auth: { creds: authState.creds, keys: makeCacheableSignalKeyStore(authState.keys, logger) }, browser: Browsers.ubuntu('SK Agent'), logger, printQRInTerminal: false, markOnlineOnConnect: false, syncFullHistory: false, generateHighQualityLinkPreview: false });
    socket = activeSocket;
    activeSocket.ev.on('creds.update', saveCreds);
    activeSocket.ev.on('messages.upsert', ({ messages, type }) => { if (type === 'notify' && generation === connectionGeneration) messages.forEach(item => handleIncoming(item).catch(error => logger.error({ err: error.message, stack: error.stack }, 'message handler failed'))); });
    activeSocket.ev.on('connection.update', async update => {
      if (generation !== connectionGeneration) return;
      const { connection, lastDisconnect, qr: nextQr } = update;
      if (nextQr) emitQr(nextQr).catch(error => logger.error({ err: error.message }, 'QR generation failed'));
      if (connection === 'open') { state = 'ready'; qr = null; qrBase64 = null; reconnectAttempt = 0; ownerChatId = activeSocket.user?.id || null; if (ownerChatId) skAgent.setOwnerConfig({ name: OWNER_NAME, shortName: OWNER_SHORT_NAME, chatId: ownerChatId }); if (io) io.emit('status', getState()); console.log(existingAuth ? '[WhatsApp] Session restored successfully' : '[WhatsApp] Connected'); logger.info({ user: ownerChatId, authPath: AUTH_PATH, existingAuth }, existingAuth ? 'WhatsApp session restored successfully' : 'WhatsApp connected'); }
      if (connection === 'close') {
        const error = lastDisconnect?.error;
        const loggedOut = isLoggedOut(error);
        const authFailure = isAuthFailure(error);
        socket = null;
        state = loggedOut || authFailure ? 'logged_out' : 'disconnected';
        logger.error({ name: error?.name, message: error?.message, statusCode: error?.output?.statusCode || error?.statusCode, stack: error?.stack }, 'WhatsApp connection closed');

        if (authFailure) {
          try {
            await fs.remove(AUTH_PATH);
            console.log('[WhatsApp] Invalid session detected; cleared auth and waiting for QR pairing.');
            logger.warn({ authPath: AUTH_PATH }, 'Invalid WhatsApp session cleared');
          } catch (cleanupError) {
            logger.warn({ err: cleanupError.message, authPath: AUTH_PATH }, 'Failed to clear invalid WhatsApp auth');
          }
        }

        if (!loggedOut && !authFailure && !explicitLogout && !reconnectTimer) {
          const delay = getDelay(reconnectAttempt++);
          state = 'reconnecting';
          reconnectTimer = setTimeout(() => { reconnectTimer = null; startSocket().catch(reconnectError => logger.error({ err: reconnectError.message, stack: reconnectError.stack }, 'WhatsApp reconnect failed')); }, delay);
          logger.warn({ delay, reason: error?.message }, 'WhatsApp reconnect scheduled');
        }
        if (io) io.emit('status', getState());
      }
    });
  } finally { starting = false; }
}
async function init(socketIO) { io = socketIO; await storage.verifyPersistentStorage(); await fs.ensureDir(AUTH_PATH); if (!schedulerBound) { schedulerBound = true; scheduler.on('task_due', task => sendTask(task).catch(error => logger.error({ err: error.message }, 'task send failed'))); } await startSocket(); }
async function getChats() { return [...knownChats.values()].slice(0, 50).map(chat => ({ ...chat, unreadCount: 0, lastMessage: '' })); }
async function close() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  connectionGeneration++;
  if (socket?.ws) socket.ws.close();
  await flushCredentialWrites();
  socket = null;
  state = 'disconnected';
}
async function logout() {
  explicitLogout = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  connectionGeneration++;
  if (socket) await socket.logout();
  await flushCredentialWrites();
  await fs.remove(AUTH_PATH);
  socket = null;
  state = 'pairing_required';
  explicitLogout = false;
}
module.exports = { init, getState, getSettings, updateSettings, getMessageLog, sendMessage: sendText, sendText, sendFile, getChats, close, logout, getOwnerInfo: () => ({ ownerName: OWNER_NAME, ownerShortName: OWNER_SHORT_NAME, ownerChatId }) };
