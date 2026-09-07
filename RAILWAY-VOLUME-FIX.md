# Fix Railway Session Loss - Add Persistent Volume

Railway is deleting your WhatsApp session on every restart. You need to add a **persistent volume** to save the `.wwebjs_auth` folder.

## 📦 Add Volume in Railway Dashboard

1. **Go to Railway Dashboard** → Your Project → Your Service
2. **Click "Settings" tab**
3. **Scroll to "Volumes" section**
4. **Click "New Volume"**
5. **Configure:**
   ```
   Mount Path: /app/.wwebjs_auth
   ```
6. **Click "Add"**

That's it! Railway will now persist your WhatsApp session across restarts.

## ✅ After Adding Volume:

1. **Redeploy your service** (or it will auto-redeploy)
2. **Scan QR code once**
3. **Session will persist** - no more QR scanning on restart!

## 🔍 Verify It Works:

After scanning QR:
1. Go to Railway → **Deployments**
2. Click **"Restart"** on your service
3. Wait for it to come back online
4. Check logs - should see: `[WhatsApp] ✅ Ready` (NO QR code)
5. ✅ Session persisted!

---

## 📝 Alternative: Add via Railway CLI

```bash
railway volume add -m /app/.wwebjs_auth
railway up
```

---

## ⚠️ Important Notes:

- **First time after adding volume**: You'll need to scan QR once more
- **After that**: No more QR scanning needed!
- **Volume is persistent**: Even if you redeploy or restart
- **Free tier**: Railway free tier includes persistent volumes

---

**Add the volume now and you'll never need to scan QR again!** 🎉
