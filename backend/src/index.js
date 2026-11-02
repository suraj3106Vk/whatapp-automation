/**
 * SK Agent - Main Server
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const whatsapp = require('./whatsapp/client');
const memory = require('./memory/conversationMemory');
const fileManager = require('./files/fileManager');
const scheduler = require('./agent/taskScheduler');
const routes = require('./api/routes');
const {
  requireDashboardAuth,
  initializeFirebaseAdmin,
  verifyFirebaseToken,
  issueToken,
  verifyPin,
  verifyToken,
} = require('./api/firebaseAuth');
const { getUploadsPath, verifyPersistentStorage } = require('./config/storage');

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Allowed origins for CORS
// Add FRONTEND_URL env-var on Railway when you use a custom domain.
const ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  // ── Netlify sites ──────────────────────────────────────────────────────────
  'https://whatapp.netlify.app',
  'https://whatappai.netlify.app',
  'https://whatappsa.netlify.app',       // current live site (seen in browser bar)
  // ── Vercel sites ──────────────────────────────────────────────────────────
  'https://whatsapp.vercel.app',
  // ── Custom domain (set FRONTEND_URL on Railway if needed) ─────────────────
  process.env.FRONTEND_URL,
].filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true;                            // same-origin / curl / health-checks
  if (ORIGINS.includes(origin)) return true;
  // Allow any *.netlify.app or *.vercel.app deploy preview automatically
  if (/^https:\/\/[a-z0-9-]+\.netlify\.app$/i.test(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return true;
  return false;
}

const corsOptions = {
  origin: (origin, callback) => callback(null, isAllowedOrigin(origin) ? origin || true : false),
  credentials: true,
};

const app = express();
const server = http.createServer(app);
app.set('trust proxy', 'loopback');

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

io.use((socket, next) => {
  const token = socket.handshake.auth?.token || '';
  if (verifyToken(token)) {
    socket.data.authenticated = true;
    return next();
  }
  return next(new Error('unauthorized'));
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

// ── Time-PIN login ─────────────────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { pin } = req.body || {};
  if (!pin) return res.status(400).json({ success: false, error: 'PIN is required' });
  if (!verifyPin(pin)) {
    return res.status(401).json({ success: false, error: 'Incorrect PIN. Use the current time as HHMM (e.g. 01:22 → 0122).' });
  }
  const token = issueToken();
  return res.json({ success: true, token });
});

app.get('/api/auth/verify', requireDashboardAuth, (req, res) => {
  res.json({ success: true, authenticated: true });
});
app.use('/api', requireDashboardAuth);
app.use('/uploads', requireDashboardAuth, express.static(getUploadsPath()));
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

  initializeFirebaseAdmin();
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
