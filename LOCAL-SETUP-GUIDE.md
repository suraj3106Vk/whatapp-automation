# 🏠 SK Agent - Local Setup Guide

Run your WhatsApp bot entirely on your PC - no cloud servers needed!

---

## 🚀 Quick Start (One Command)

**Double-click or run:**
```powershell
START-LOCAL.ps1
```

This will:
1. ✅ Start backend on `http://localhost:3001`
2. ✅ Start dashboard on `http://localhost:5173`
3. ✅ Open dashboard in your browser automatically

---

## 📱 First Time Setup

### 1. Run the Startup Script
```powershell
.\START-LOCAL.ps1
```

### 2. Scan QR Code
- QR code appears in **backend terminal** (as ASCII art)
- QR code also shown in **browser dashboard**
- Open WhatsApp on phone → Menu → Linked Devices → Link Device
- Scan the QR code

### 3. Done!
- Bot is now connected and ready
- Receives and replies to messages automatically
- Dashboard shows live message feed

---

## 📊 Dashboard Features

Access at: **http://localhost:5173**

- ✅ Live message feed
- ✅ Connection status
- ✅ Message statistics
- ✅ Settings (enable/disable auto-reply, groups, etc.)
- ✅ File manager
- ✅ Task scheduler

---

## ⚙️ Manual Startup (Alternative)

If you prefer to start components manually:

### Terminal 1 - Backend:
```powershell
cd backend
npm start
```

### Terminal 2 - Frontend:
```powershell
cd frontend
npm run dev
```

---

## 🔧 Configuration

### Backend Settings:
Edit `backend/.env`:
```env
PORT=3001
OWNER_NAME=Your Name
OWNER_SHORT_NAME=Your Nick

# AI API Keys
GROQ_API_KEY=your_groq_key
GEMINI_API_KEY=your_gemini_key
```

### Bot Behavior:
- Access dashboard → Settings
- Toggle auto-reply on/off
- Enable/disable group replies
- Manage blacklist/whitelist

---

## 📝 How It Works

```
┌─────────────────────────────────┐
│  Your PC (localhost)            │
│                                 │
│  ┌─────────────────────────┐   │
│  │  Frontend Dashboard     │   │
│  │  localhost:5173         │   │
│  └──────────┬──────────────┘   │
│             │                   │
│  ┌──────────▼──────────────┐   │
│  │  Backend Server         │   │
│  │  localhost:3001         │   │
│  └──────────┬──────────────┘   │
│             │                   │
│  ┌──────────▼──────────────┐   │
│  │  WhatsApp Web.js        │   │
│  │  (.wwebjs_auth session) │   │
│  └─────────────────────────┘   │
│             │                   │
└─────────────┼───────────────────┘
              │
              │ Internet
              ▼
       WhatsApp Servers
              │
              ▼
       Your Phone Number

```

---

## 🛠️ Troubleshooting

### QR Code Not Showing?
- Check backend terminal for errors
- Make sure Chrome is installed
- Delete `.wwebjs_auth` folder and restart

### Dashboard Won't Connect?
- Backend must be running first
- Check `frontend/.env` has `VITE_API_URL=http://localhost:3001`
- Restart frontend: `Ctrl+C` then `npm run dev`

### Bot Not Replying?
- Check dashboard → Settings → Auto Reply is ON
- Check backend terminal for `[MSG IN]` logs
- Verify WhatsApp is connected (green status in dashboard)

### Session Lost After Restart?
- Normal! Scan QR again
- Session saves in `.wwebjs_auth` folder
- Don't delete this folder while bot is running

---

## ⏱️ Keeping Bot Running 24/7

### Option 1: Keep PC On
- Leave both terminal windows open
- Bot runs as long as PC is on

### Option 2: Auto-Start on Boot
Use `setup-autostart.ps1` to make bot start automatically when PC boots.

### Option 3: Use Cloud (Railway/Railway)
Follow the cloud deployment guides if you want 24/7 uptime without leaving PC on.

---

## 📦 What's Running Locally?

### Backend (`localhost:3001`):
- WhatsApp Web.js client
- Message handler & AI chat
- File manager
- Task scheduler
- REST API

### Frontend (`localhost:5173`):
- React dashboard
- Real-time updates (WebSocket)
- Settings panel
- Message viewer

---

## 🔒 Security Notes

### Local Setup is Secure:
- ✅ Everything runs on your PC
- ✅ No data sent to external servers (except AI APIs)
- ✅ WhatsApp session stored locally
- ✅ No port forwarding needed
- ✅ Only accessible from your PC

### Not Accessible From:
- ❌ Other devices on your network (unless you configure it)
- ❌ Internet (no public URL)
- ❌ Outside your PC

---

## 💡 Tips & Best Practices

1. **Keep Terminal Windows Open**
   - Don't close them while bot is running
   - Minimize them to system tray if needed

2. **Monitor Backend Logs**
   - Backend terminal shows all activity
   - Check for errors if bot stops working

3. **Regular Backups**
   - `.wwebjs_auth` folder = your WhatsApp session
   - Back it up if you want to preserve session

4. **Update Dependencies**
   ```powershell
   cd backend
   npm update
   
   cd ../frontend
   npm update
   ```

---

## 🎯 Next Steps

- ✅ Customize bot responses in `backend/src/agent/skAgent.js`
- ✅ Add custom commands
- ✅ Configure AI models in `.env`
- ✅ Set up file sharing
- ✅ Create scheduled tasks

---

## 🆘 Need Help?

Check the logs:
- **Backend logs**: Terminal 1 (backend window)
- **Frontend logs**: Browser console (F12)
- **Message logs**: Dashboard → Message feed

Common log locations:
- Backend: Terminal output
- WhatsApp session: `.wwebjs_auth/`
- Uploaded files: `backend/uploads/`
- Task database: `backend/data/tasks.json`

---

**Your bot is now running 100% locally on your PC!** 🎉

No Railway, no Netlify, no cloud servers - complete control!
