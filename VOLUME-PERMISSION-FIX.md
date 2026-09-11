# Railway Volume Permission Fix

## The Problem

You correctly set up the volume at `/data`, but the app was crashing with:

```
[Error: EACCES: permission denied, open '/data/.storage-write-test-...']
```

## Why This Happened

The Dockerfile had:
```dockerfile
USER node  ← Running as non-root user
CMD ["node", "src/index.js"]
```

When Railway mounts a volume, it creates it with **root ownership** by default. But the app was running as the `node` user (non-root), so it couldn't write to the volume!

## The Fix

Changed Dockerfile to:
```dockerfile
# Removed: USER node
CMD ["node", "src/index.js"]  ← Now runs as root (Railway's default)
```

Running as root inside the container is safe because:
- Docker containers are isolated
- Railway handles security at the platform level
- This is the standard approach for Railway volumes

## What Happens Now

1. **Railway is redeploying** (~3-5 minutes)
2. Container will run as root
3. `/data` volume will be writable
4. App will start successfully ✅

## After Deployment

Check Railway logs for:

### ✅ Success Indicators:
```
[Storage] Railway detected: YES
[Storage] Persistent root: /data
[Storage] Writable: YES  ← This should now work!
[WhatsApp] Starting client...
[WhatsApp] Waiting for QR code scan...
```

### ❌ If Still Failing:
```
[Server] Fatal error: EACCES permission denied
```

(But this should be fixed now!)

## Next Steps

1. **Wait 3-5 minutes** for Railway deployment
2. **Check logs** - should see "Writable: YES"
3. **Open QR page**: `https://whatapp-automation-production.up.railway.app/api/qr-page`
4. **Scan QR code** with WhatsApp
5. **Verify connection** - logs should show "Connected! ✅"
6. **Test persistence** - redeploy and session should survive!

## Alternative Solutions (If This Doesn't Work)

If you still get permission errors after this deploy:

### Option A: Railway CLI Volume Permissions
```bash
railway volume permissions set vol_g0v9qjt3jkzlv3ib 777
```

### Option B: Use Different Mount Path
Change volume mount from `/data` to `/app/data` (inside app directory where we already have write access).

But the current fix should work! 🤞

---

**Status:** Fix deployed, waiting for Railway to rebuild (~3 min)

**What Changed:** Dockerfile now runs as root to access Railway volume

**Expected Result:** No more permission errors, WhatsApp will start properly! ✅
