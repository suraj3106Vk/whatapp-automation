# 🚀 Deploy Frontend to Netlify

Your frontend is ready to deploy! Follow these steps to publish it on Netlify.

> **If the backend runs in Termux:** Ignore any older Railway URL in this guide.
> Set `VITE_API_URL` to the public HTTPS URL of your live tunnel to the Termux
> backend, then trigger a new Netlify deployment. See
> [TERMUX-DEPLOYMENT.md](./TERMUX-DEPLOYMENT.md) for backend and tunnel setup.

---

## 📋 Quick Deploy (5 Minutes)

### Step 1: Go to Netlify Dashboard

1. Open: [https://app.netlify.com/](https://app.netlify.com/)
2. **Login** with your GitHub account (or create account if needed)

### Step 2: Import Project

1. Click **"Add new site"** button (top right)
2. Select **"Import an existing project"**
3. Choose **"Deploy with GitHub"**
4. Authorize Netlify to access your GitHub (if first time)
5. Select repository: **`suraj3106Vk/whatapp-automation`**

### Step 3: Configure Build Settings

**Important:** Fill in these exact settings:

```
Base directory:     frontend
Build command:      npm run build
Publish directory:  frontend/dist
```

### Step 4: Add Environment Variable

Before deploying, click **"Add environment variables"**:

```
Key:   VITE_API_URL
Value: https://YOUR-LIVE-TERMUX-HTTPS-TUNNEL
```

### Step 5: Deploy!

1. Click **"Deploy site"**
2. Wait 2-3 minutes for build to complete
3. Netlify will give you a URL like: `https://random-name-123456.netlify.app`

---

## ✅ After Deployment

### Access Your Dashboard

Open the Netlify URL in your browser. You'll see:

- ✅ **Railway QR Code** (if WhatsApp not connected)
- ✅ **Live Dashboard** with messages, stats, and controls
- ✅ **Works from anywhere** - phone, laptop, anywhere!

### Scan QR Code

1. Open your Netlify dashboard
2. You'll see a large QR code
3. Open WhatsApp on phone → Menu → Linked Devices → Link Device
4. Scan the QR code
5. **Done!** WhatsApp connected to Railway 24/7

### Custom Domain (Optional)

Want a custom domain like `bot.yourdomain.com`?

1. In Netlify: **Site Settings** → **Domain management**
2. Click **"Add custom domain"**
3. Follow the DNS setup instructions

---

## 🔧 Troubleshooting

### Dashboard Shows "Backend is unreachable" or "Backend Disconnected"?

1. Confirm the Termux backend and its HTTPS tunnel are running.
2. Verify Netlify's environment variable:
   - Go to **Site Settings** → **Environment variables**
   - Set `VITE_API_URL` to the tunnel's public HTTPS URL (not the expired Railway URL)
3. **Redeploy:** Deploys → Trigger deploy → Deploy site

### QR Code Not Showing?

- Make sure the Termux backend is running and paired
- Open the tunnel URL followed by `/health`; it should return JSON
- Ensure `VITE_API_URL` has no trailing slash, then redeploy Netlify

### Need to Reconnect WhatsApp?

1. Restart the backend in Termux
2. Wait for QR code to appear on Netlify dashboard
3. Scan new QR code

---

## 🎯 Next Steps

Once deployed, you can:

- ✅ Access dashboard from anywhere
- ✅ Scan QR code to connect WhatsApp
- ✅ Close your PC - bot keeps running on Railway
- ✅ Share dashboard URL with team (they can monitor, not control)

---

## 📱 Your Setup After Deployment

```
┌─────────────────────────────────────────┐
│  Frontend: Netlify (Public Dashboard)  │
│  Backend: Termux → persistent HTTPS tunnel │
└─────────────────┬───────────────────────┘
                  │
                  │ HTTPS Connection
                  │
┌─────────────────▼───────────────────────┐
│  Backend: Railway (WhatsApp Bot)       │
│  Running 24/7 in the cloud            │
│  URL: whatapp-automation.railway.app   │
└─────────────────┬───────────────────────┘
                  │
                  │ WhatsApp Web API
                  │
┌─────────────────▼───────────────────────┐
│  Your WhatsApp Account                  │
│  Receives & sends messages             │
└─────────────────────────────────────────┘
```

---

## 💡 Tips

- **Bookmark your Netlify URL** for easy access
- **Railway runs 24/7** - no need to keep PC on
- **Free tier limits:**
  - Netlify: 100GB bandwidth/month (plenty!)
  - Railway: $5 free credits/month (~10-15 days runtime)

---

**Ready to deploy? Go to [Netlify](https://app.netlify.com/) now!** 🚀
