/**
 * SK Agent - Main Server
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const whatsapp = require('./whatsapp/client');
const memory = require('./memory/conversationMemory');
const fileManager = require('./files/fileManager');
const scheduler = require('./agent/taskScheduler');
const routes = require('./api/routes');
const { getUploadsPath, verifyPersistentStorage } = require('./config/storage');

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Allowed origins for CORS
const ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'https://whatapp.netlify.app',         // Netlify production
  'http://whatapp.netlify.app',
  'https://whatappai.netlify.app',       // Current Netlify production
  'http://whatappai.netlify.app',
  process.env.FRONTEND_URL,              // custom domain if set
].filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  return ORIGINS.includes(origin) || /^https:\/\/[a-z0-9-]+\.netlify\.app$/i.test(origin);
}

const corsOptions = {
  origin: (origin, callback) => callback(null, isAllowedOrigin(origin) ? origin || true : false),
  credentials: true,
};

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => callback(null, isAllowedOrigin(origin) ? origin || true : false),
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,        // How long to wait for pong response
  pingInterval: 25000,       // How often to send ping
  connectTimeout: 45000,     // Initial connection timeout
  transports: ['websocket', 'polling'],  // Try websocket first, fallback to polling
  allowEIO3: true,           // Support older clients
});

io.on('connection', (socket) => {
  console.log('[Socket.IO] Dashboard connected:', socket.id);
  const state = whatsapp.getState();
  socket.emit('status', { state: state.state, qr: state.qr });
  if (state.qr && state.qrBase64) socket.emit('qr', { qr: state.qr, qrBase64: state.qrBase64 });
  socket.emit('message_log', whatsapp.getMessageLog());
  socket.on('disconnect', () => console.log('[Socket.IO] Dashboard disconnected:', socket.id));
  socket.on('ping', () => socket.emit('pong'));
});

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(getUploadsPath()));
app.use('/api', routes);
app.get('/health', (req, res) => {
  const whatsappState = whatsapp.getState();
  res.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    whatsapp: whatsappState.state,
    scheduler: 'running',
    llm: {
      groq: Boolean(process.env.GROQ_API_KEY || process.env.GROQ_API_KEYS),
      gemini: Boolean(process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEYS),
    },
  });
});

async function start() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║       SK Agent - WhatsApp Bot          ║');
  console.log('╚════════════════════════════════════════╝\n');

  await verifyPersistentStorage();
  await memory.init();
  console.log('[Server] Memory initialized');

  await fileManager.init();
  console.log('[Server] File manager initialized');

  // Load and start task scheduler
  await scheduler.load();
  scheduler.start();
  console.log('[Server] Task scheduler started');

  await new Promise(resolve => server.listen(PORT, HOST, resolve));
  console.log(`[Server] API → http://${HOST}:${PORT}`);
  console.log(`[Server] Dashboard → http://localhost:5173`);

  console.log('\n[WhatsApp] Starting client...');
  await whatsapp.init(io);
}

async function shutdown(signal) {
  console.log(`[Server] ${signal} received — shutting down`);
  scheduler.stop();
  try { await whatsapp.close(); } catch (err) { console.warn('[Server] WhatsApp shutdown:', err.message); }
  await new Promise(resolve => server.close(resolve));
  process.exit(0);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

start().catch(err => {
  console.error('[Server] Fatal error:', err);
  process.exit(1);
});

// ── Global error handlers (prevent crashes) ────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught Exception:', err);
  console.error('Stack:', err.stack);
  // Don't exit - try to recover
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  // Don't exit - try to recover
});

