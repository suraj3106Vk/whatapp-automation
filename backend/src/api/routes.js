/**
 * SK Agent - Express API Routes
 * Dashboard ↔ Backend communication
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const router = express.Router();

const whatsapp = require('../whatsapp/client');
const fileManager = require('../files/fileManager');
const memory = require('../memory/conversationMemory');
const scheduler = require('../agent/taskScheduler');

// ── File Upload Setup ──────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await fs.ensureDir(fileManager.UPLOADS_DIR);
    cb(null, fileManager.UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// ── Debug logs endpoint ───────────────────────────────────────────────────────
const _startupLogs = [];
const _origConsoleError = console.error.bind(console);
const _origConsoleWarn  = console.warn.bind(console);
console.error = (...a) => { _origConsoleError(...a); _startupLogs.push({ level:'error', msg: a.join(' '), t: Date.now() }); if (_startupLogs.length > 50) _startupLogs.shift(); };
console.warn  = (...a) => { _origConsoleWarn(...a);  _startupLogs.push({ level:'warn',  msg: a.join(' '), t: Date.now() }); if (_startupLogs.length > 50) _startupLogs.shift(); };

router.get('/debug-logs', (req, res) => {
  const state = whatsapp.getState();
  res.json({ state, logs: _startupLogs.slice(-20) });
});

router.get('/status', (req, res) => {
  const state = whatsapp.getState();
  res.json({ success: true, ...state });
});

// ── Test endpoint - check if client can send messages ──
router.get('/test-send', async (req, res) => {
  const { to } = req.query;
  if (!to) {
    return res.status(400).json({ success: false, error: 'Provide ?to=phone_number' });
  }
  try {
    const chatId = to.includes('@') ? to : `${to}@c.us`;
    await whatsapp.sendMessage(chatId, '🤖 Test message from SK Agent - I am alive!');
    res.json({ success: true, message: 'Test message sent', to: chatId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Direct QR image (PNG) ──
router.get('/qr.png', async (req, res) => {
  const qrPath = path.join(__dirname, '../../qr-code.png');
  if (fs.existsSync(qrPath)) {
    res.sendFile(qrPath);
  } else {
    res.status(404).send('QR code not generated yet');
  }
});

// ── QR page — open in browser to scan ──
router.get('/qr-page', async (req, res) => {
  const state = whatsapp.getState();
  if (state.state === 'ready') {
    return res.send(`<!DOCTYPE html><html><body style="background:#111;color:#0f0;font-family:sans-serif;text-align:center;padding:60px">
      <h2>✅ WhatsApp is Connected!</h2>
      <p>SK Agent is online and listening for messages.</p>
    </body></html>`);
  }
  if (state.state !== 'qr' || !state.qr) {
    return res.send(`<!DOCTYPE html><html>
    <head><meta http-equiv="refresh" content="3"></head>
    <body style="background:#111;color:#fff;font-family:sans-serif;text-align:center;padding:60px">
      <h2>⏳ Waiting for QR code...</h2>
      <p>State: <b style="color:#f90">${state.state}</b></p>
      <p style="color:#aaa;font-size:13px">This page auto-refreshes every 3 seconds.</p>
      <p style="color:#aaa;font-size:13px">If state stays "disconnected" for more than 60s,<br>
      check backend logs for Chrome/Puppeteer errors.</p>
      <hr style="border-color:#333;margin:30px auto;width:300px">
      <p style="font-size:12px;color:#555">
        Debug: <a href="/health" style="color:#25D366">/health</a> &nbsp;|&nbsp; 
        <a href="/api/status" style="color:#25D366">/api/status</a> &nbsp;|&nbsp;
        <a href="/api/debug-logs" style="color:#f90">/api/debug-logs ← check this for errors</a>
      </p>
    </body></html>`);
  }
  // Convert raw QR string → base64 PNG
  let qrBase64 = '';
  try {
    const qrcode = require('qrcode');
    qrBase64 = await qrcode.toDataURL(state.qr);
  } catch { qrBase64 = ''; }

  res.send(`<!DOCTYPE html><html>
  <head>
    <title>SK Agent — Scan QR Code</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { 
        background: linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%);
        color: #fff; 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        text-align: center; 
        padding: 20px; 
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .container {
        max-width: 600px;
        width: 100%;
      }
      .header {
        margin-bottom: 2rem;
      }
      h1 { 
        color: #25D366; 
        font-size: 2.5rem; 
        margin-bottom: 0.5rem;
        font-weight: 700;
      }
      .subtitle {
        color: #aaa; 
        font-size: 1.1rem;
      }
      .qr-container {
        background: rgba(255, 255, 255, 0.05);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 24px;
        padding: 2rem;
        margin: 2rem 0;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      }
      .qr-wrap { 
        display: inline-block; 
        background: white; 
        padding: 20px; 
        border-radius: 20px; 
        margin: 0 auto;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
      }
      img { 
        display: block; 
        width: 320px; 
        height: 320px;
        max-width: 100%;
        height: auto;
      }
      .instructions {
        background: rgba(37, 211, 102, 0.1);
        border: 1px solid rgba(37, 211, 102, 0.3);
        border-radius: 16px;
        padding: 1.5rem;
        margin: 1.5rem 0;
        text-align: left;
      }
      .instructions h3 {
        color: #25D366;
        margin-bottom: 1rem;
        font-size: 1.2rem;
      }
      .instructions ol {
        padding-left: 1.5rem;
        line-height: 2;
        color: #ddd;
      }
      .instructions li {
        margin-bottom: 0.5rem;
      }
      .instructions strong {
        color: #25D366;
      }
      .tip { 
        background: rgba(255, 193, 7, 0.1);
        border: 1px solid rgba(255, 193, 7, 0.3);
        border-radius: 12px; 
        padding: 1rem; 
        margin: 1rem 0;
        font-size: 0.9rem; 
        color: #ffc107;
      }
      .refresh-bar { 
        width: 100%; 
        max-width: 400px; 
        height: 4px; 
        background: rgba(255, 255, 255, 0.1);
        border-radius: 2px; 
        margin: 1rem auto;
        overflow: hidden;
      }
      .refresh-fill { 
        height: 4px; 
        background: #25D366; 
        width: 100%; 
        transition: width 0.2s linear;
      }
      #refresh-text {
        font-size: 0.85rem;
        color: #666;
        margin-top: 0.5rem;
      }
      .download-btn {
        display: inline-block;
        margin-top: 1rem;
        padding: 0.75rem 1.5rem;
        background: rgba(37, 211, 102, 0.2);
        border: 1px solid #25D366;
        border-radius: 10px;
        color: #25D366;
        text-decoration: none;
        font-weight: 600;
        transition: all 0.2s;
        cursor: pointer;
      }
      .download-btn:hover {
        background: #25D366;
        color: white;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(37, 211, 102, 0.3);
      }
      @media (max-width: 600px) {
        h1 { font-size: 2rem; }
        .qr-wrap { padding: 12px; }
        img { width: 280px; height: 280px; }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>🔐 WhatsApp Login</h1>
        <p class="subtitle">SK Agent — Scan QR Code</p>
      </div>

      <div class="qr-container">
        <div class="qr-wrap">
          ${qrBase64 ? `<img src="${qrBase64}" alt="WhatsApp QR Code" id="qr-image"/>` : '<p style="color:red;padding:20px">QR generation failed — refreshing...</p>'}
        </div>
        ${qrBase64 ? '<a href="#" class="download-btn" id="download-btn">📥 Download QR Code</a>' : ''}
      </div>

      <div class="instructions">
        <h3>📱 How to scan:</h3>
        <ol>
          <li>Open <strong>WhatsApp</strong> on your phone</li>
          <li>Tap <strong>Menu (⋮)</strong> or <strong>Settings</strong></li>
          <li>Tap <strong>Linked Devices</strong></li>
          <li>Tap <strong>Link a Device</strong></li>
          <li>Point your camera at the QR code above</li>
        </ol>
      </div>

      <div class="tip">
        ⚠️ <strong>Important:</strong> QR code expires in ~60 seconds. 
        This page will auto-refresh with a new code if it expires.
      </div>

      <div class="refresh-bar">
        <div id="refresh-fill" class="refresh-fill"></div>
      </div>
      <p id="refresh-text">Checking for updates...</p>
    </div>

    <script>
      const pageQr = ${JSON.stringify(state.qr)};
      let seconds = 8;
      
      // Download QR code
      const downloadBtn = document.getElementById('download-btn');
      if (downloadBtn) {
        downloadBtn.addEventListener('click', (e) => {
          e.preventDefault();
          const img = document.getElementById('qr-image');
          const link = document.createElement('a');
          link.href = img.src;
          link.download = 'whatsapp-qr-code.png';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        });
      }

      // Check for new QR or connection
      async function refreshQr() {
        try {
          const response = await fetch('/api/status', { cache: 'no-store' });
          const state = await response.json();
          if (state.state === 'ready') {
            document.body.innerHTML = \`
              <div style="text-align:center;margin-top:100px">
                <h1 style="color:#25D366;font-size:3rem;margin-bottom:1rem">✅</h1>
                <h2 style="color:#25D366">WhatsApp Connected!</h2>
                <p style="color:#aaa;margin-top:1rem">SK Agent is online and listening for messages.</p>
                <p style="color:#666;margin-top:2rem;font-size:0.9rem">You can close this page now.</p>
              </div>
            \`;
            return;
          }
          if (state.state === 'qr' && state.qr && state.qr !== pageQr) {
            window.location.reload();
          }
        } catch (err) {
          console.error('Status check failed:', err);
        }
      }

      // Progress bar countdown
      setInterval(() => {
        seconds = seconds <= 1 ? 8 : seconds - 1;
        document.getElementById('refresh-fill').style.width = (seconds / 8 * 100) + '%';
        document.getElementById('refresh-text').textContent = 'Checking for updates in ' + seconds + 's';
      }, 1000);

      // Check status every 2 seconds
      setInterval(refreshQr, 2000);
      
      // Initial check
      refreshQr();
    </script>
  </body></html>`);
});

// ── Settings ──────────────────────────────────────────────────────────────────

router.get('/settings', (req, res) => {
  res.json({ success: true, settings: whatsapp.getSettings() });
});

router.post('/settings', express.json(), (req, res) => {
  whatsapp.updateSettings(req.body);
  res.json({ success: true, settings: whatsapp.getSettings() });
});

// ── Message Log ───────────────────────────────────────────────────────────────

router.get('/messages', (req, res) => {
  res.json({ success: true, messages: whatsapp.getMessageLog() });
});

// ── Chats ─────────────────────────────────────────────────────────────────────

router.get('/chats', async (req, res) => {
  try {
    const chats = await whatsapp.getChats();
    res.json({ success: true, chats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Send Manual Message ───────────────────────────────────────────────────────

router.post('/send', express.json(), async (req, res) => {
  const { chatId, message } = req.body;
  if (!chatId || !message) {
    return res.status(400).json({ success: false, error: 'chatId and message required' });
  }
  try {
    await whatsapp.sendMessage(chatId, message);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Send File ─────────────────────────────────────────────────────────────────

router.post('/send-file', express.json(), async (req, res) => {
  const { chatId, filename, caption } = req.body;
  if (!chatId || !filename) {
    return res.status(400).json({ success: false, error: 'chatId and filename required' });
  }
  try {
    const filePath = path.join(fileManager.UPLOADS_DIR, filename);
    await whatsapp.sendFile(chatId, filePath, caption || '');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── File Management ───────────────────────────────────────────────────────────

router.get('/files', async (req, res) => {
  try {
    const files = await fileManager.listFiles();
    res.json({ success: true, files });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/files/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No file uploaded' });
  }
  res.json({
    success: true,
    file: {
      name: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
    },
  });
});

router.delete('/files/:filename', async (req, res) => {
  try {
    await fileManager.deleteFile(req.params.filename);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Memory / Conversations ────────────────────────────────────────────────────

router.get('/memory', (req, res) => {
  res.json({ success: true, stats: memory.getStats() });
});

router.delete('/memory/:chatId', (req, res) => {
  memory.clearHistory(req.params.chatId);
  res.json({ success: true });
});

// ── Logout ────────────────────────────────────────────────────────────────────

router.post('/logout', async (req, res) => {
  try {
    await whatsapp.logout();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Tasks / Scheduler ─────────────────────────────────────────────────────────

router.get('/tasks', (req, res) => {
  const all = scheduler.getAllPending();
  res.json({ success: true, tasks: all });
});

router.delete('/tasks/:id', (req, res) => {
  const ok = scheduler.cancelTask(req.params.id);
  res.json({ success: ok });
});

router.delete('/tasks/chat/:chatId', (req, res) => {
  const count = scheduler.cancelAllForChat(decodeURIComponent(req.params.chatId));
  res.json({ success: true, cancelled: count });
});

module.exports = router;
