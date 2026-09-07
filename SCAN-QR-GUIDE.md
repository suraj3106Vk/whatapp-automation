# 📱 How to Scan WhatsApp QR Code on Railway

Your WhatsApp QR code is displaying in Railway logs, but it's hard to scan from there. Here are **3 easy solutions**:

---

## ✅ Solution 1: Use the QR Page (Recommended)

Your backend already has a dedicated QR page!

### Steps:
1. **Open your Railway backend URL** in your browser
2. **Add `/qr-page`** to the URL
3. Example: `https://your-app-name.up.railway.app/qr-page`
4. You'll see a large, scannable QR code
5. Scan it with your phone's WhatsApp app

### Instructions on the page:
1. Open WhatsApp on your phone
2. Tap Menu (⋮) or Settings
3. Tap "Linked Devices"
4. Tap "Link a Device"  
5. Point your camera at the QR code

---

## ✅ Solution 2: Use the Frontend Dashboard (Best UX)

If you've deployed the frontend to Netlify:

### Steps:
1. **Configure the frontend to connect to Railway:**
   - Go to Netlify Dashboard > Your Site > Site Settings > Environment Variables
   - Add: `VITE_API_URL` = `https://your-railway-app.up.railway.app`
   - Redeploy the site

2. **Open your Netlify URL** in browser
3. The dashboard will show a large QR code automatically
4. Scan it with WhatsApp

---

## ✅ Solution 3: Download QR Code from Railway

If the QR is too small in Railway logs:

### Steps:
1. The backend saves QR as a PNG file: `backend/qr-code.png`
2. In Railway dashboard, you can use the "Command" tab to run:
   ```bash
   cat backend/qr-code.png | base64
   ```
3. Copy the base64 output, paste into a [base64 to image decoder](https://base64.guru/converter/decode/image)
4. Download and scan

---

## 🔧 Quick Setup for Netlify Frontend

If your frontend isn't connected yet:

### In Netlify Dashboard:
1. **Site Settings** > **Environment Variables** > **Add a variable**
2. Key: `VITE_API_URL`
3. Value: `https://your-railway-backend.up.railway.app` (your Railway URL)
4. Click **Save**
5. **Trigger a redeploy** (Deploys > Trigger deploy > Deploy site)

### Test the connection:
1. Open your Netlify frontend URL
2. Check if it shows "Connected to SK Agent backend"
3. The QR code should appear automatically if WhatsApp is not connected

---

## 🎯 Quick Command for Railway

Find your Railway backend URL:
```bash
# In Railway dashboard, it's shown at the top
# Usually: https://yourapp-production-xxxx.up.railway.app
```

Then open in browser:
```
https://yourapp-production-xxxx.up.railway.app/qr-page
```

---

## ⚠️ Troubleshooting

### QR page shows "Waiting for QR code"?
- Check Railway logs for errors
- WhatsApp client might still be initializing (wait 30-60 seconds)
- Look for Chrome/Puppeteer errors in logs

### Frontend shows "Backend disconnected"?
- Make sure `VITE_API_URL` environment variable is set in Netlify
- Check if Railway backend is running
- Verify the URL is correct (no trailing slash)

### QR code expires before scanning?
- The page auto-refreshes with a new QR every 60 seconds
- You have up to 5 minutes total to scan
- Just refresh the page if needed

---

## 📝 Notes

- The QR page URL is **safe to bookmark** - you can use it anytime to reconnect
- Once connected, you won't need to scan again unless you logout
- The session persists in Railway's persistent volume
- Frontend dashboard provides the best experience with real-time updates

---

**Current Setup:**
- ✅ Backend: Railway (with `/qr-page` endpoint)
- ✅ Frontend: Netlify (needs `VITE_API_URL` configured)
- ✅ WhatsApp Auth: Persistent storage in Railway volume

**Next Step:** Open `https://your-railway-url.up.railway.app/qr-page` and scan! 🎉
