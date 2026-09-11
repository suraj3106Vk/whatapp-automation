# Fix WhatsApp Connection on Railway

## Current Issue

Your Railway logs show:
```
WhatsApp connection closed
Error statuscode: 408
Reason: QR refs attempts ended
```

This means the WhatsApp session either:
1. QR code wasn't scanned in time
2. Session data was lost
3. WhatsApp logged out

## Quick Fix Steps

### Step 1: Get QR Code from Railway

Open this URL in your browser:
```
https://whatapp-automation-production.up.railway.app/api/qr-page
```

This will show a QR code page.

### Step 2: Scan QR Code

1. Open WhatsApp on your phone
2. Go to: Settings → Linked Devices
3. Click: Link a Device
4. Scan the QR code from the page

### Step 3: Wait for Connection

The Railway logs should show:
```
[WhatsApp] Connected! ✅
[WhatsApp] Authenticated as: Your Name
```

---

## Alternative: Restart Railway Service

If QR code page doesn't load or shows old QR:

1. Go to Railway Dashboard
2. Click on your project
3. Click on the service (backend)
4. Click **⋯** (three dots) → **Restart**
5. Wait 30 seconds
6. Open QR page again: `https://whatapp-automation-production.up.railway.app/api/qr-page`
7. Scan the new QR code

---

## Troubleshooting

### QR Page Shows Blank

Railway might be crashing. Check:
1. Railway Dashboard → Logs
2. Look for errors
3. Common issue: Out of memory

**Solution:**
```powershell
# Restart the service from CLI
railway restart
```

### QR Code Scanned But Disconnects

Session data not persisting. Check Railway volume:

1. Railway Dashboard → Your Project
2. Click **Settings** → **Volumes**
3. Make sure volume is mounted at `/data`
4. If not, add volume:
   - Click **Add Volume**
   - Mount path: `/data`
   - Save and redeploy

### Connection Closes After Few Hours

Railway free tier restarts services. Session should persist if volume is set up correctly.

**Check if volume exists:**
```powershell
# In Railway settings, you should see:
# Volume mounted at: /data
```

---

## Check Current Status

**API Endpoint:**
```
https://whatapp-automation-production.up.railway.app/api/status
```

Response will show:
```json
{
  "connected": true,
  "qr": null,
  "state": "authenticated",
  "user": {
    "name": "Your Name",
    "number": "1234567890"
  }
}
```

---

## Summary

1. ✅ Backend CORS fixed (already deployed)
2. ⏳ Update Vercel environment variable (you need to do this)
3. ⏳ Scan QR code to reconnect WhatsApp: `https://whatapp-automation-production.up.railway.app/api/qr-page`

Once both are done, your dashboard on Vercel will connect to Railway backend and show live WhatsApp status!
