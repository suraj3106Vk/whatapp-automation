# 🚀 Complete Deployment Guide - Railway + Netlify

## ✅ What I Fixed

### Railway Backend Issues Fixed:
1. ✅ **"Can't open display" error** - Added `DISPLAY` and `DBUS_SESSION_BUS_ADDRESS` env vars
2. ✅ **"Profile in use" error** - Added Chrome lock file cleanup on startup
3. ✅ **Chrome arguments** - Added `--user-data-dir=/tmp/chrome-user-data` to prevent profile conflicts

### What These Changes Do:
- **Lock file cleanup**: Removes stale Chrome profile locks from previous crashed runs
- **Display configuration**: Sets up virtual display for headless Chrome in Docker
- **Separate user data**: Uses `/tmp` for Chrome profile instead of persistent volume (avoids conflicts)

---

## 🚂 Railway Backend Deployment

### Your Railway URL:
```
https://sk-agent-backend-production.up.railway.app
```

### Current Status:
The fixes have been committed. After you push to GitHub, Railway will:
1. Auto-detect the new commit
2. Rebuild the Docker image
3. Deploy with fixed Chrome configuration

### After Deployment Succeeds:

**Test these endpoints:**

```bash
# Health check
https://sk-agent-backend-production.up.railway.app/health

# Status check (should show QR state)
https://sk-agent-backend-production.up.railway.app/api/status

# QR code page (MAIN PAGE TO SCAN)
https://sk-agent-backend-production.up.railway.app/qr-page
```

---

## 🌐 Netlify Frontend Deployment

### Step 1: Connect GitHub to Netlify

1. **Go to Netlify:** https://app.netlify.com/
2. **Click "Add new site" → "Import an existing project"**
3. **Connect to GitHub** and authorize Netlify
4. **Select your repository:** `suraj3106Vk/whatapp-automation`

### Step 2: Configure Build Settings

**When Netlify asks for build settings, enter:**

| Setting | Value |
|---------|-------|
| **Base directory** | `frontend` |
| **Build command** | `npm run build` |
| **Publish directory** | `frontend/dist` |
| **Branch to deploy** | `main` |

### Step 3: Set Environment Variables

**CRITICAL:** Before deploying, add this environment variable:

1. In Netlify: **Site settings → Environment variables**
2. Click **"Add a variable"**
3. **Key:** `VITE_API_URL`
4. **Value:** `https://sk-agent-backend-production.up.railway.app`
5. **Scope:** `All` (or select specific contexts)
6. Click **"Create variable"**

### Step 4: Deploy

1. Click **"Deploy site"**
2. Wait for build to complete (~2-3 minutes)
3. Netlify will assign you a URL like: `https://random-name-12345.netlify.app`

### Step 5: (Optional) Custom Domain

If you want a better URL:
1. Go to **Site settings → Domain management**
2. Click **"Options → Edit site name"**
3. Change to something like: `sk-agent-dashboard`
4. Your new URL: `https://sk-agent-dashboard.netlify.app`

---

## 🎯 Complete Testing Checklist

### Railway Backend Tests:

```bash
# 1. Health check (should return {"status":"ok"})
curl https://sk-agent-backend-production.up.railway.app/health

# 2. API status (should return WhatsApp state)
curl https://sk-agent-backend-production.up.railway.app/api/status

# 3. QR page (open in browser)
# Should show large QR code or "WhatsApp Connected"
```

Open in browser:
```
https://sk-agent-backend-production.up.railway.app/qr-page
```

### Netlify Frontend Tests:

1. **Open your Netlify URL** (e.g., `https://sk-agent-dashboard.netlify.app`)
2. **Check connection status** at top of page:
   - ✅ "Connected to SK Agent backend" = Good!
   - ❌ "Backend disconnected" = Check `VITE_API_URL` variable
3. **Should see QR code** if WhatsApp not connected
4. **Should see "SK Agent is Live"** if WhatsApp is connected

---

## 📱 How to Connect WhatsApp

### Method 1: Via Netlify Dashboard (Easiest!)

1. Open your Netlify frontend URL
2. Large QR code will display automatically
3. Open WhatsApp on phone → Menu → Linked Devices → Link a Device
4. Scan the QR code
5. Dashboard will update to "SK Agent is Live" when connected

### Method 2: Via Railway QR Page

1. Open: `https://sk-agent-backend-production.up.railway.app/qr-page`
2. Beautiful QR page with download option
3. Scan with WhatsApp
4. Page will show "WhatsApp Connected!" when successful

---

## 🔧 Troubleshooting

### Railway: "Can't open display" still appears?

Check Railway logs for:
```
ENV DISPLAY=:99
ENV DBUS_SESSION_BUS_ADDRESS=/dev/null
```

If missing, the code hasn't deployed yet. Wait for Railway to rebuild.

### Railway: "Profile in use" still appears?

The fix includes lock file cleanup. If it persists:
1. Go to Railway Dashboard → Your Service
2. Click **Settings → Restart**
3. This will clear all temp files

### Netlify: "Backend disconnected"

Check:
1. **Environment variable is set:**
   - Go to: Site settings → Environment variables
   - Verify `VITE_API_URL` exists
   - Value should be: `https://sk-agent-backend-production.up.railway.app`
   - **No trailing slash!**

2. **Redeploy after adding variable:**
   - Go to: Deploys → Trigger deploy → Deploy site

3. **Check browser console:**
   - Open DevTools (F12)
   - Console tab
   - Look for connection errors

### QR Code Not Appearing

1. **Check Railway logs:**
   ```
   [WhatsApp] Scan QR code to login:
   ```
   Should appear ~30 seconds after startup

2. **Check `/api/status` endpoint:**
   ```bash
   curl https://sk-agent-backend-production.up.railway.app/api/status
   ```
   Should return `"state":"qr"` or `"state":"ready"`

3. **Check Railway deployment status:**
   - Must show "Success" (green)
   - If "Running" but failing, check logs

---

## 📊 Expected Timeline

| Step | Time | Status Check |
|------|------|--------------|
| Push to GitHub | Instant | ✅ `git push` succeeds |
| Railway detects commit | ~10 seconds | Railway shows "Building" |
| Railway builds Docker | 3-5 minutes | Railway shows "Deploying" |
| Railway deployment live | +30 seconds | Railway shows "Success" ✅ |
| Chrome initializes | +30-60 seconds | Check logs for QR code |
| QR code appears | ~90 sec total | `/qr-page` shows QR |
| Netlify build | 2-3 minutes | Netlify shows "Published" ✅ |
| Frontend connects | Instant | Dashboard shows "Connected" |

**Total time from push to fully working: ~8-10 minutes**

---

## ✅ Success Criteria

You'll know everything is working when:

### Railway Backend:
- ✅ Deployment shows "Success" in Railway dashboard
- ✅ Logs show: `[Server] ✓ SK Agent backend running on port 3001`
- ✅ Logs show: `[WhatsApp] Scan QR code to login:` with QR in terminal
- ✅ `/health` returns `{"status":"ok"}`
- ✅ `/qr-page` shows scannable QR code

### Netlify Frontend:
- ✅ Deployment shows "Published" in Netlify dashboard
- ✅ Site opens without errors
- ✅ Shows "Connected to SK Agent backend" at top
- ✅ QR code displays (if WhatsApp not connected)
- ✅ Or shows "SK Agent is Live 🟢" (if WhatsApp connected)

### WhatsApp Connection:
- ✅ Scan QR code with phone
- ✅ Railway logs show: `[WhatsApp] ✅ Ready — [Your Name]`
- ✅ Frontend shows: "SK Agent is Live 🟢"
- ✅ Test message: Send a message to the bot, should get AI response

---

## 🎉 Final URLs

After successful deployment:

**Backend API:**
```
https://sk-agent-backend-production.up.railway.app
```

**QR Code Page (for scanning):**
```
https://sk-agent-backend-production.up.railway.app/qr-page
```

**Frontend Dashboard:**
```
https://your-site-name.netlify.app
```
(You'll get this after Netlify deployment)

---

## 📝 Environment Variables Summary

### Railway (Backend):
These are set automatically in Dockerfile:
- `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true`
- `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`
- `DISPLAY=:99`
- `DBUS_SESSION_BUS_ADDRESS=/dev/null`

Optional (set in Railway dashboard if needed):
- `OWNER_NAME` = Your full name
- `OWNER_SHORT_NAME` = Your first name
- `GEMINI_API_KEY` = For media analysis (images/PDFs)

### Netlify (Frontend):
**REQUIRED:**
- `VITE_API_URL` = `https://sk-agent-backend-production.up.railway.app`

---

## 🚨 Important Notes

1. **Don't add trailing slashes** to `VITE_API_URL` - it breaks API calls
2. **Wait for Railway to fully deploy** before testing (check logs)
3. **Add a Volume in Railway** for session persistence:
   - Mount path: `/data`
   - This persists WhatsApp login across deployments
4. **Netlify autodeploys** on every GitHub push to `main` branch
5. **Railway autodeploys** on every GitHub push to `main` branch

---

**You're all set! Push the changes to GitHub and both services will deploy automatically! 🚀**
