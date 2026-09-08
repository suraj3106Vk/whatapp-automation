# SK Agent — Deploy to Railway

Railway is better than Render for WhatsApp bots:
- ✅ $5 free trial credit (500 hours)
- ✅ Better network (no WebSocket blocks)
- ✅ More RAM on free tier (8GB shared)
- ✅ Faster cold starts

---

## 📋 Step-by-Step Deployment

### Step 1: Create GitHub Repo

1. Go to https://github.com/new
2. Repository name: `whatapp-automation`
3. **Private** (has API keys!)
4. Don't initialize with README
5. Click "Create repository"

Then push your code:
```powershell
git push -u origin main
```

---

### Step 2: Deploy to Railway

1. Go to https://railway.app
2. Click "Start a New Project"
3. Choose "Deploy from GitHub repo"
4. Select `suraj3106Vk/whatapp-automation`
5. Railway auto-detects the Dockerfile ✅

---

### Step 3: Set Environment Variables

In Railway dashboard → your project → Variables tab, add:

**Required:**
```
GROQ_API_KEY=gsk_your_groq_key_here
GEMINI_API_KEY=your_gemini_key_here
OWNER_SHORT_NAME=Suraj
PORT=3001
```

**Optional (fallback keys):**
```
GEMINI_API_KEY2=another_key
GEMINI_API_KEY3=third_key
```

**⚠️ Important:** Railway auto-sets `PORT` but our app uses `3001` - add it anyway.

---

### Step 4: Get Public URL & Scan QR

After deploy completes (~3-5 min):

1. Railway gives you a public URL: `https://your-app.up.railway.app`
2. Open: `https://your-app.up.railway.app/api/qr-page`
3. Scan the QR code with WhatsApp
4. Done! Bot is live 🎉

**Check logs:** Railway dashboard → Deployments → View Logs

---

## 🔧 Configuration Files

Railway uses these files:

- **`Dockerfile`** - Builds the container (Chromium + Node.js)
- **`railway.json`** - Railway-specific config (optional, auto-detected)
- **`.dockerignore`** - Excludes files from build (faster deploys)

---

## 💰 Pricing & Credits

**Trial Plan ($5 free credit):**
- ~500 hours of runtime
- Shared 8GB RAM, vCPU
- Should last 20-30 days with 24/7 uptime

**After trial:**
- Pay-as-you-go: ~$5-10/month for small bot
- Or wait for GitHub Student Pack → DigitalOcean credit

---

## ⚙️ Railway vs Render

| Feature | Railway | Render Free |
|---------|---------|-------------|
| RAM | 8GB shared | 512MB |
| Network | ✅ No restrictions | ❌ Blocks WhatsApp |
| Cold start | ~10s | ~30-60s |
| Cost | $5 trial → paid | Free (but broken) |
| WhatsApp works? | ✅ Yes | ❌ No |

**Verdict:** Railway is worth $5-10/month for a working bot.

---

## 🛠️ Troubleshooting

### QR code shows but scan fails
- Check Railway logs for errors
- Make sure `PORT=3001` is set in Variables
- Try: `https://your-app.up.railway.app/health` (should return `{"status":"ok"}`)

### Build fails
- Check Dockerfile syntax
- Railway needs Debian Bookworm base (not Bullseye)
- Our Dockerfile already configured ✅

### Bot crashes after QR scan
- Not enough RAM for WhatsApp session
- Check Railway dashboard → Metrics → Memory usage
- If >90%, session is too heavy for shared tier

### Session logs out randomly
- Railway restarts app every ~24h on free tier
- Session should persist (saved in `/data/whatsapp-auth` on the volume)
- If lost, add a Railway volume at `/data`

---

## 📊 Monitor Your Bot

**Railway Dashboard:**
- Metrics → CPU, RAM, Network usage
- Logs → Real-time app logs
- Deployments → Build history

**Health checks:**
- `https://your-app.up.railway.app/health` - Server status
- `https://your-app.up.railway.app/api/status` - WhatsApp connection
- `https://your-app.up.railway.app/api/qr-page` - QR page (if disconnected)

---

## 🚀 Deploy Frontend (Optional)

If you want the dashboard online too:

**Option 1: Netlify (recommended, free)**
1. Go to https://app.netlify.com
2. Drag `frontend` folder to deploy
3. Set environment variable: `VITE_API_URL=https://your-app.up.railway.app`
4. Dashboard will be at: `https://your-site.netlify.app`

**Option 2: Vercel (also free)**
1. Go to https://vercel.com
2. Import from GitHub → select your repo
3. Root directory: `frontend`
4. Add env var: `VITE_API_URL=https://your-app.up.railway.app`

**Option 3: Keep local**
- Just run `npm run dev` in frontend folder
- Visit `http://localhost:5173`
- Update `VITE_API_URL` to your Railway URL in `.env`

---

## 🔐 Security Notes

**Never commit `.env` file!** (already in `.gitignore`)

**Your API keys are safe because:**
- GitHub repo is **Private**
- Railway Variables are encrypted
- `.env` is not pushed to GitHub

**If you accidentally commit `.env`:**
```powershell
# Remove from Git history
git rm --cached backend/.env
git commit -m "Remove .env from tracking"
git push origin main

# Then regenerate all API keys (Groq, Gemini)
```

---

## 💡 Tips

**Save money:**
- Railway charges by usage time
- Bot sleeps when no messages (RAM usage drops)
- Average cost: $5-7/month for 24/7 uptime

**Backup session:**
- Download `.wwebjs_auth` folder from Railway
- Keep local copy (in case Railway resets)
- To restore: upload to Railway volume

**Multiple bots:**
- Deploy same code multiple times
- Each gets own Railway service
- Use different WhatsApp numbers for each

---

## 🆘 Need Help?

**Railway Support:**
- Help center: https://docs.railway.app
- Discord: https://discord.gg/railway
- Twitter: @railway

**Common issues:**
1. "Build failed" → Check Dockerfile syntax
2. "App crashed" → Check logs for errors
3. "Out of memory" → Bot needs more RAM (upgrade tier)
4. "Can't connect" → Check Railway public URL is correct

---

**Ready to deploy?** Follow Step 1-4 above! 🚀

After deployment, your bot will be online 24/7 until your $5 credit runs out (~3-4 weeks).
