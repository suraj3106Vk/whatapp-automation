# Update Vercel Environment Variable - Quick Guide

## Your Railway Backend URL
```
https://whatapp-automation-production.up.railway.app
```

## Method 1: Vercel Dashboard (EASIEST - Do This!)

1. **Go to:** https://vercel.com/dashboard
2. **Click:** Your `whatsapp` project
3. **Go to:** Settings → Environment Variables
4. **Find or Add:** `VITE_API_URL`
5. **Set Value:**
   ```
   https://whatapp-automation-production.up.railway.app
   ```
6. **Check:** Production environment
7. **Click:** Save
8. **Go to:** Deployments tab
9. **Click:** Latest deployment → ⋯ (three dots) → Redeploy
10. **Uncheck:** Use existing Build Cache
11. **Click:** Redeploy

## Method 2: Using Vercel CLI

```powershell
# Login to Vercel
npx vercel login

# Go to frontend
cd frontend

# Deploy with new environment variable
npx vercel --prod
```

When prompted, confirm settings and it will use the `.env.production` file.

## Verify It's Working

After redeployment (takes ~2 minutes):

1. **Open your Vercel site:** https://whatsapp.vercel.app
2. **Open browser console:** Press F12
3. **Check for errors:** Should see no CORS or connection errors
4. **Dashboard should show:** "Waiting for WhatsApp Client" or QR code

## Test Backend Connection

Open these URLs in your browser to verify Railway backend is working:

**Health Check:**
```
https://whatapp-automation-production.up.railway.app/health
```
Should show: `{"status":"ok","uptime":123,"whatsapp":"..."}`

**API Status:**
```
https://whatapp-automation-production.up.railway.app/api/status
```
Should show WhatsApp connection status.

## What I Already Did ✅

- [x] Updated backend CORS to allow Vercel domains
- [x] Pushed changes to GitHub
- [x] Railway is now deploying the update (~3 min)
- [x] Updated frontend `.env.production` file

## What You Need to Do ⏳

- [ ] Update `VITE_API_URL` in Vercel dashboard
- [ ] Redeploy frontend on Vercel
- [ ] Wait 2-3 minutes
- [ ] Test the connection

---

**After you update Vercel, your frontend should connect to Railway backend successfully!**
