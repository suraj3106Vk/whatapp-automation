# SK Agent — Local Setup Guide

## ✅ What's Configured

Your SK Agent WhatsApp bot is now **100% local** with:

- ✅ No cloud dependencies (Render/Netlify references removed)
- ✅ Auto-start on Windows boot
- ✅ Backend: `http://localhost:3001`
- ✅ Frontend: `http://localhost:5173`
- ✅ Session persistence (scan QR once, works forever)

---

## 🚀 How to Start

### Option 1: Auto-Start (Recommended)
Bot starts automatically when you log into Windows.

**To test now without restarting:**
```powershell
.\start.ps1
```

### Option 2: Manual Start
Open two terminals:

**Terminal 1 (Backend):**
```powershell
cd backend
npm start
```

**Terminal 2 (Frontend):**
```powershell
cd frontend
npm run dev
```

---

## 📱 First Time Setup

1. Run `.\start.ps1`
2. Backend terminal will show a QR code (ASCII art)
3. Open your phone: **WhatsApp → ⋮ Menu → Linked Devices → Link a Device**
4. Scan the QR code
5. Done! Session saves automatically

**Alternative:** Visit `http://localhost:3001/api/qr-page` for a prettier QR code

---

## 🔧 Configuration

### Environment Variables
Copy `backend\.env.example` to `backend\.env` and fill in:

```env
# Required
GROQ_API_KEY=gsk_your_groq_key_here
GEMINI_API_KEY=your_gemini_key_here

# Optional (fallback)
GEMINI_API_KEY2=another_gemini_key
GEMINI_API_KEY3=third_gemini_key
```

### Bot Settings
- **Owner Name:** Set `OWNER_SHORT_NAME=YourName` in `.env`
- **Reply to Groups:** Enabled by default (see Dashboard → Settings)
- **Task Scheduler:** Enabled by default (checks every 30s)

---

## 🛠️ Troubleshooting

### Bot won't start
**Check if Chrome is installed:**
```powershell
Test-Path "C:\Program Files\Google\Chrome\Application\chrome.exe"
```
If `False`, install Chrome from https://google.com/chrome

### QR code shows "LOGOUT" error
Session was logged out. Delete session and rescan:
```powershell
cd backend
Remove-Item .wwebjs_auth -Recurse -Force
npm start
```

### Dashboard won't load
Make sure both backend AND frontend are running:
- Backend: `http://localhost:3001/health` should return `{"status":"ok"}`
- Frontend: `http://localhost:5173` should show dashboard

### Bot not replying to groups
Check Dashboard → Settings → "Reply to Groups" is **ON**

---

## 📂 Project Structure

```
whatapp automation/
├── backend/
│   ├── src/
│   │   ├── index.js          # Main server
│   │   ├── whatsapp/         # WhatsApp client
│   │   ├── agent/            # SK Agent AI logic
│   │   ├── api/              # REST API routes
│   │   └── memory/           # Conversation history
│   ├── .env                  # Your API keys (DO NOT SHARE)
│   └── package.json
├── frontend/
│   ├── src/                  # React dashboard
│   └── package.json
├── start.ps1                 # Start script (runs both)
└── setup-autostart.ps1       # Auto-start configurator
```

---

## 🎯 Features

✅ **Message Handling**
- Text messages (individual + groups)
- Images (Gemini Vision analysis)
- PDFs (text extraction + summary)
- Voice messages (acknowledged)
- Stickers (acknowledged)

✅ **AI Replies**
- Groq API (primary, fast)
- Gemini API (fallback, has vision)
- Greeting shortcut (no API call for "hi"/"hello")
- Conversation memory (remembers context)

✅ **Task Scheduling**
- Set reminders via chat
- Check Dashboard → Tasks tab
- Auto-executes at scheduled time

✅ **Dashboard**
- Real-time message log
- WhatsApp connection status
- Settings panel
- Task manager

---

## 💡 Tips

**Keep PC awake:**
Windows Settings → System → Power → Sleep: **Never**

**Disable auto-start:**
Delete shortcut from: `C:\Users\suraj\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup`

**Check logs:**
Backend terminal shows all activity in real-time

**QR code expired?**
Just wait 30-60 seconds, a new one appears automatically

---

## 🆘 Need Help?

**Check these first:**
1. Backend terminal (shows errors)
2. `http://localhost:3001/health` (backend health)
3. `http://localhost:3001/api/debug-logs` (startup logs)
4. Dashboard → message log (shows bot activity)

**Common fixes:**
- Restart both backend + frontend
- Delete `.wwebjs_auth` folder and rescan QR
- Check `.env` has valid API keys
- Make sure Chrome is installed

---

**Your bot is production-ready! 🎉**

Keep your PC on and connected to the internet. The bot will handle all WhatsApp messages automatically.
