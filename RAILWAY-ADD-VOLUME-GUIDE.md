# 📦 Railway Volume Setup - Never Scan QR Again!

## The Problem

Every time you deploy new code, Railway creates a fresh container. Without a volume, your WhatsApp auth files are LOST, so you have to scan QR code again. Annoying! 😤

## The Solution

Add a **persistent volume** so auth files survive across deployments.

---

## Step-by-Step Guide

### Step 1: Go to Railway Dashboard

Open: https://railway.app/dashboard

### Step 2: Select Your Project

Click on: **whatapp-automation** (or your project name)

### Step 3: Open Settings

Click the **Settings** tab (top navigation)

### Step 4: Find Volumes Section

Scroll down to find **"Volumes"** section

### Step 5: Check Current Status

**Scenario A: No Volume Exists**
```
Volumes
─────────────────────
[ Add Volume ]

No volumes configured
```

**→ Go to Step 6**

**Scenario B: Volume Already Exists**
```
Volumes
─────────────────────
✓ Volume: data-volume
  Mount Path: /data
  Size: 1 GB
```

**→ Skip to Step 8** (already configured!)

### Step 6: Add New Volume

Click the **[ Add Volume ]** button

**Fill in the form:**
```
Mount Path: /data
Size: 1 (GB)
```

Click **Add** or **Save**

### Step 7: Redeploy

After adding volume:
1. Railway will show "Volume added"
2. Service will **automatically redeploy**
3. Wait ~3-5 minutes for deployment

**OR manually trigger:**
- Go to **Deployments** tab
- Click **⋯** (three dots) on latest deployment
- Click **Redeploy**

### Step 8: Scan QR Code (Last Time!)

1. After deployment completes, check Railway **Logs**

2. Look for:
   ```
   [Storage] Railway detected: YES
   [Storage] Persistent root: /data
   [WhatsApp] Waiting for QR code scan...
   ```

3. Open QR page:
   ```
   https://whatapp-automation-production.up.railway.app/api/qr-page
   ```

4. **Scan with WhatsApp** (Settings → Linked Devices → Link Device)

5. Wait for logs to show:
   ```
   [WhatsApp] Connected! ✅
   [WhatsApp] Authenticated as: Suraj Zalke
   ```

### Step 9: Test Persistence

Now test if it persists:

1. **Make a small code change** (or just redeploy)
   
2. **Push to GitHub** (triggers Railway redeploy)
   ```bash
   git commit --allow-empty -m "Test session persistence"
   git push origin main
   ```

3. **Wait for deployment** (~3 minutes)

4. **Check Railway logs** for:
   ```
   [WhatsApp] Existing session detected ✓
   [WhatsApp] Session restored successfully ✓
   [WhatsApp] Connected! ✅
   ```

5. **Send a WhatsApp message** → AI should reply without QR scan! 🎉

---

## Verification Checklist

After setup, verify everything works:

### ✅ Railway Dashboard
- [ ] Volume exists in Settings → Volumes
- [ ] Mount path is `/data`
- [ ] Size is at least 1 GB

### ✅ Deployment Logs
- [ ] `[Storage] Railway detected: YES`
- [ ] `[Storage] Persistent root: /data`
- [ ] `[Storage] Writable: YES`
- [ ] `[WhatsApp] Auth path: /data/whatsapp-auth`

### ✅ First Connection (After Volume Added)
- [ ] Scanned QR code successfully
- [ ] Logs show `[WhatsApp] Connected! ✅`
- [ ] Can send/receive messages

### ✅ After Redeploy
- [ ] Logs show `[WhatsApp] Existing session detected`
- [ ] Logs show `[WhatsApp] Session restored successfully`
- [ ] NO QR code required ✅
- [ ] Messages work immediately

---

## What the Volume Does

```
WITHOUT Volume:
Deploy 1: Scan QR → Works
Deploy 2: Scan QR again → Works  ❌ (annoying!)
Deploy 3: Scan QR again → Works  ❌ (every time!)

WITH Volume:
Deploy 1: Scan QR → Works
Deploy 2: Auto-restored → Works  ✅ (no QR needed!)
Deploy 3: Auto-restored → Works  ✅ (never again!)
```

---

## Troubleshooting

### Issue: Volume added but still asking for QR

**Check 1: Volume mount path**
- Railway Settings → Volumes
- Ensure mount path is exactly: `/data`
- Not `/data/` or `/Data` or anything else

**Check 2: Deployment logs**
```bash
# Look for this in Railway logs:
[Storage] Persistent root: /data
```

If you see `/app/data` or something else → volume not mounted correctly.

**Fix:** Delete volume, add again with exact path `/data`

### Issue: "Volume full" error

Volume size too small. Increase size:
1. Railway Settings → Volumes
2. Click on existing volume
3. Increase size to 2 GB or more
4. Save

### Issue: Auth files not persisting

**Check if files are being written:**

In Railway logs, look for:
```
[WhatsApp] Saving credentials to /data/whatsapp-auth
```

If path is different, volume is not configured properly.

**Fix:** Set environment variable in Railway:
```
WHATSAPP_AUTH_PATH=/data/whatsapp-auth
DATA_PATH=/data
```

---

## Railway Volume Pricing

**Good news:** Volumes are **FREE** on Railway up to certain limits!

- ✅ 1 GB volume: FREE
- ✅ Included in trial credit
- ✅ No extra charges for small volumes

WhatsApp auth files are tiny (~100KB), so 1 GB is MORE than enough!

---

## Alternative: Environment Variables (Advanced)

If Railway volume has issues, you can force the path:

**Railway Dashboard → Variables → Add:**

```
WHATSAPP_AUTH_PATH=/data/whatsapp-auth
DATA_PATH=/data
```

This ensures the app uses the correct persistent directory.

---

## Summary

1. ✅ **Add volume** at mount path `/data` (1 GB)
2. ✅ **Redeploy** service
3. ✅ **Scan QR** once
4. ✅ **Never scan again!** 🎉

**Time to complete:** 5 minutes
**QR scans needed after setup:** 0 (forever!)

---

## Visual Reference

```
Railway Dashboard Structure:

whatapp-automation (Project)
├── Deployments (tab)
├── Variables (tab)
├── Metrics (tab)
└── Settings (tab)  ← Go here!
    ├── General
    ├── Domains
    ├── Environment
    ├── Volumes  ← Add volume here!
    │   └── [ Add Volume ]
    │       Mount Path: /data
    │       Size: 1 GB
    └── Danger Zone
```

---

**Once volume is added, your WhatsApp session will survive ALL future deploys!** 🚀

No more QR scanning! No more interruptions! Just deploy and go! 🎉
