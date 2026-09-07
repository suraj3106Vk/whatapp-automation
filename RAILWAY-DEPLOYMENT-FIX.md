# 🚂 Railway Deployment Fix Guide

## ❌ Current Issue
Your Railway URL shows: **"This site can't be reached"** with DNS error `ERR_NAME_NOT_RESOLVED`

This means either:
1. The Railway app hasn't been deployed yet
2. The deployment failed
3. The service is not running
4. The domain/URL is incorrect

---

## ✅ Step-by-Step Fix

### Step 1: Check Railway Dashboard

1. **Go to Railway Dashboard:** https://railway.app/dashboard
2. **Find your WhatsApp Automation project**
3. **Check the deployment status:**
   - ✅ Green = Running (but might have issues)
   - 🟡 Yellow = Building/Deploying
   - ❌ Red = Failed
   - ⚪ Gray = Not deployed

### Step 2: Check the Logs

In Railway Dashboard:
1. Click on your service/deployment
2. Go to **"Deployments"** tab
3. Click on the latest deployment
4. Check **"Build Logs"** and **"Deploy Logs"**

**Common errors to look for:**
- Chrome/Chromium installation failures
- Port binding issues
- Memory/resource limits
- Missing environment variables

### Step 3: Verify Environment Variables

Make sure these are set in Railway:

**Required:**
- `PORT` → `3001` (or Railway will set this automatically)
- `NODE_ENV` → `production`

**Optional but recommended:**
- `OWNER_NAME` → Your full name (e.g., "Suraj Zalke")
- `OWNER_SHORT_NAME` → Your short name (e.g., "Suraj")
- `GEMINI_API_KEY` → Your Google Gemini API key (for media analysis)

**Auto-set by system:**
- `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD` → `true` (in Dockerfile)
- `PUPPETEER_EXECUTABLE_PATH` → `/usr/bin/chromium` (in Dockerfile)

### Step 4: Check Railway Settings

1. **Settings** → **Networking**
   - Make sure **"Public Networking"** is enabled
   - Check the **public domain** URL
   - Copy the correct URL (should be like: `https://something.up.railway.app`)

2. **Settings** → **Deploy**
   - Source: **GitHub repository**
   - Branch: **main**
   - Root directory: `/` (or leave empty)
   - Build command: (leave empty, Dockerfile handles it)
   - Start command: (leave empty, Dockerfile CMD handles it)

### Step 5: Add Volume for Persistent Storage

WhatsApp session needs persistent storage:

1. Go to **"Variables"** or **"Storage"** tab in Railway
2. Add a **Volume** (if not already added):
   - Mount path: `/app/.wwebjs_auth`
   - This will persist your WhatsApp session across deployments

### Step 6: Redeploy

After making any changes:
1. Go to **"Deployments"** tab
2. Click **"Redeploy"** or **"Deploy Latest Commit"**
3. Wait for build to complete (can take 5-10 minutes)
4. Check logs for errors

---

## 🔍 Troubleshooting Common Errors

### Error: "Port already in use"
**Solution:** Railway automatically sets the PORT variable. Your app should listen on `process.env.PORT || 3001`

Check `backend/src/index.js`:
```javascript
const PORT = process.env.PORT || 3001;
```

### Error: "Chrome/Chromium not found"
**Solution:** The Dockerfile already installs Chromium. If failing:
1. Check Railway build logs
2. Ensure Dockerfile is being used (not default Node buildpack)
3. Verify Railway is set to use Dockerfile

### Error: "Cannot create directory .wwebjs_auth"
**Solution:** Add a persistent volume:
1. Railway Dashboard → Your Service → Variables
2. Add Volume: `/app/.wwebjs_auth`

### Error: "EADDRINUSE: Address already in use"
**Solution:** Only run ONE instance of the service
1. Check Railway settings → Scaling
2. Set replicas to 1
3. Restart service

### Error: QR code doesn't appear
**Solution:** 
1. Wait 60-90 seconds after deployment
2. Check `/qr-page` endpoint specifically
3. Check Railway logs for WhatsApp client initialization
4. Look for: `[WhatsApp] Scan QR code to login:` in logs

---

## 📋 Deployment Checklist

Use this checklist to ensure proper setup:

- [ ] GitHub repository is connected to Railway
- [ ] Dockerfile exists in root directory
- [ ] Railway is configured to use Dockerfile (not Node.js buildpack)
- [ ] Public networking is enabled in Railway
- [ ] Volume is mounted at `/app/.wwebjs_auth` (for session persistence)
- [ ] Environment variables are set (if any custom ones needed)
- [ ] Latest code is pushed to GitHub (Railway auto-deploys on push)
- [ ] Deployment shows "Success" in Railway dashboard
- [ ] Logs show `[Server] ✓ SK Agent backend running on port 3001`
- [ ] Public URL opens successfully (not "site can't be reached")
- [ ] `/health` endpoint returns OK
- [ ] `/qr-page` shows QR code or connection status

---

## 🎯 Quick Test Commands

Once deployed, test these URLs:

```
# Health check
https://your-app.railway.app/health

# API status
https://your-app.railway.app/api/status

# QR code page
https://your-app.railway.app/qr-page

# Debug logs
https://your-app.railway.app/api/debug-logs
```

---

## 🔧 Manual Deployment from Local

If Railway deployment keeps failing, you can deploy manually using Railway CLI:

### Install Railway CLI
```bash
npm install -g @railway/cli
```

### Login to Railway
```bash
railway login
```

### Link to your project
```bash
railway link
```

### Deploy
```bash
railway up
```

---

## 💡 Alternative: Deploy to Render

If Railway continues to have issues, try Render (it's similar):

1. Go to https://render.com
2. Create New → Web Service
3. Connect your GitHub repo
4. Settings:
   - **Docker** (auto-detected from Dockerfile)
   - **Branch:** main
   - **Instance Type:** Free tier is fine for testing
5. Add Volume:
   - Mount path: `/app/.wwebjs_auth`
   - Size: 1GB
6. Click **"Create Web Service"**

Render will build and deploy automatically!

---

## 📞 Get the Correct Railway URL

1. Open Railway Dashboard
2. Click your service
3. Look for **"Domains"** section or **Settings → Networking**
4. Copy the **Railway-provided domain** (like: `something.up.railway.app`)
5. Try opening: `https://that-url.up.railway.app/qr-page`

---

## 🚨 If Nothing Works

1. **Check Railway Status Page:** https://railway.statuspage.io/
2. **Railway Discord:** https://discord.gg/railway (very helpful community!)
3. **Delete and recreate the Railway service** (sometimes needed)
4. **Try a different hosting platform** (Render, Fly.io, or DigitalOcean App Platform)

---

## ✅ Success Indicators

You'll know it's working when:

1. ✅ Railway deployment shows **"Success"** (green checkmark)
2. ✅ Logs show: `[Server] ✓ SK Agent backend running on port 3001`
3. ✅ Public URL opens (doesn't show "can't be reached")
4. ✅ `/health` returns: `{"status":"ok"}`
5. ✅ `/qr-page` shows a QR code or "WhatsApp Connected" message
6. ✅ You can scan the QR code and connect WhatsApp

---

**After following these steps, your Railway deployment should work! 🎉**

If you still have issues, share the **Railway build/deploy logs** for specific troubleshooting.
