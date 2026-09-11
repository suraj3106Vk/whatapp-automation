# Fix Vercel Frontend ↔️ Railway Backend Connection

## Problem
Your frontend is deployed on Vercel but can't connect to your Railway backend because:
1. Wrong backend URL in Vercel environment variables
2. CORS not configured for Vercel domain in backend

## ✅ I've Already Fixed

### 1. Backend CORS Configuration (✅ Done)
Updated `backend/src/index.js` to allow Vercel domains:
- Added `https://whatsapp.vercel.app`
- Added wildcard for all `*.vercel.app` domains

### 2. Frontend Environment Configuration
Updated `frontend/.env.production` structure

---

## 🔧 Steps to Fix (You Need to Do This)

### Step 1: Find Your Railway Backend URL

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click on your WhatsApp project
3. Go to **Settings** → **Domains**
4. Copy the public URL (looks like: `https://your-project.up.railway.app`)

**Or test if this URL works:**
- Try: `https://whatapp-automation-production.up.railway.app/health`
- If it returns `{"status":"ok"}`, that's your URL!

---

### Step 2: Update Vercel Environment Variable

#### Option A: Via Vercel Dashboard (Easiest)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click on your **whatsapp** project
3. Go to **Settings** → **Environment Variables**
4. Find `VITE_API_URL` or add it if missing
5. Set the value to your Railway URL:
   ```
   https://whatapp-automation-production.up.railway.app
   ```
   (or whatever URL you found in Step 1)
6. **Important:** Apply to **Production** environment
7. Click **Save**

#### Option B: Via Vercel CLI

```powershell
# Set production environment variable
vercel env add VITE_API_URL production

# When prompted, paste your Railway URL:
# https://whatapp-automation-production.up.railway.app
```

---

### Step 3: Redeploy Frontend

After updating the environment variable, you MUST redeploy:

#### Option A: Via Dashboard
1. Go to Vercel Dashboard → Your Project
2. Click **Deployments** tab
3. Find the latest deployment
4. Click **⋯** (three dots) → **Redeploy**
5. Make sure **Use existing Build Cache** is **UNCHECKED**
6. Click **Redeploy**

#### Option B: Via Git Push
```powershell
# Make any small change and push
cd frontend
echo "# Updated" >> README.md
git add .
git commit -m "Update backend URL"
git push
```

#### Option C: Via CLI
```powershell
cd frontend
vercel --prod
```

---

### Step 4: Verify Connection

1. Wait ~2 minutes for deployment
2. Open your Vercel site: `https://whatsapp.vercel.app`
3. Check browser console (F12) - errors should be gone
4. Dashboard should connect and show "Waiting for WhatsApp Client"

---

## 🔍 How to Check if Backend URL is Correct

### Test 1: Health Check
Open in browser:
```
https://YOUR-RAILWAY-URL/health
```

Should return:
```json
{
  "status": "ok",
  "uptime": 12345,
  "whatsapp": "authenticated",
  "scheduler": "running",
  "llm": {
    "groq": true,
    "gemini": true
  }
}
```

### Test 2: API Status
Open in browser:
```
https://YOUR-RAILWAY-URL/api/status
```

Should return WhatsApp connection status.

### Test 3: CORS Test
Open browser console on your Vercel site (F12) and run:
```javascript
fetch('https://YOUR-RAILWAY-URL/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

Should print the health status without CORS errors.

---

## 🛠️ Troubleshooting

### Still seeing connection errors?

**1. Check Railway is running:**
- Go to Railway Dashboard
- Make sure deployment status is "Active" (green)
- Check logs for errors

**2. Push backend changes to Railway:**
The CORS fix needs to be deployed to Railway:
```powershell
cd backend
git add .
git commit -m "Add Vercel CORS support"
git push origin main
```

Railway will auto-deploy. Wait ~3 minutes.

**3. Verify environment variable in Vercel:**
```powershell
# List all environment variables
vercel env ls
```

Make sure `VITE_API_URL` is set for **Production**.

**4. Clear Vercel build cache:**
- Vercel Dashboard → Settings → General
- Scroll to "Build & Development Settings"
- Click "Clear Build Cache"
- Redeploy

---

## 📊 Final Checklist

- [ ] Found Railway backend URL
- [ ] Updated `VITE_API_URL` in Vercel environment variables
- [ ] Redeployed frontend (cache cleared)
- [ ] Backend CORS updated (already done ✅)
- [ ] Pushed backend changes to Railway
- [ ] Tested `/health` endpoint - works
- [ ] Opened Vercel site - no console errors
- [ ] Dashboard shows "Waiting for WhatsApp Client" ✅

---

## 🎯 Quick Fix Summary

**What you need to do right now:**

1. **Find your Railway URL** (Railway Dashboard → Settings → Domains)
2. **Update Vercel env var:** `VITE_API_URL` = your Railway URL
3. **Redeploy on Vercel** (Dashboard → Deployments → Redeploy)
4. **Push backend to Railway** (if not already done)
5. **Test:** Open your Vercel site, should connect!

---

## 💡 Alternative: Run Backend Locally

If Railway is having issues, you can test with local backend:

```powershell
# Terminal 1: Start backend
cd backend
npm start
```

Then in Vercel, set:
```
VITE_API_URL=http://localhost:3001
```

But this only works when testing locally, not for production!

---

**Need your Railway URL?** Tell me and I'll help you verify it's correct!
