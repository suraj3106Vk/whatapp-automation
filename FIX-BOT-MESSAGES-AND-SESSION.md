# Fix: Stop Replying to Bots & Persist WhatsApp Session

## Problem 1: AI Replying to Business Bots ❌

Your AI was wasting time replying to:
- **JioHome** - "I didn't understand that!"
- **Nagpur Metro** - Automated ticket messages
- **Other bots** - Banks, delivery, OTP messages

## Solution: Enhanced Bot Detection ✅

### What I Added:

1. **Known Bot Name Detection**
   - JioHome, JioCare, Swiggy, Zomato, Uber, Amazon, etc.
   - 30+ common business bot names

2. **Automated Bot Pattern Detection**
   ```
   - "Type any number from 1-2"
   - "I didn't understand that"
   - "Thank you for your response"
   - "Welcome to [service]"
   - "This should take less than X minutes"
   - "Skip the queue / Book eTicket"
   ```

3. **System Message Detection**
   - OTP messages
   - Bank alerts
   - Delivery notifications

4. **Promotional Message Detection**
   - "Apply now", "Limited time", "Click here"
   - Marketing/advertising content

### How It Works Now:

```
Bot Message Arrives:
├─ Check sender name → "JioHome"? → IGNORE ✅
├─ Check message pattern → "Type any number"? → IGNORE ✅
├─ Check system patterns → "OTP"? → IGNORE ✅
├─ Check promotional → Marketing? → IGNORE ✅
└─ Real human message → REPLY ✓
```

### Examples:

**Before:**
```
JioHome: "Type 1-2 to make selection"
AI: "Ok bhai!" ❌ (wasting time)
```

**After:**
```
JioHome: "Type 1-2 to make selection"
AI: [NO REPLY] ✅ (ignored bot)
```

---

**Before:**
```
Nagpur Metro: "Click to book eTicket"
AI: "Thanks bhau! Already set ahe" ❌
```

**After:**
```
Nagpur Metro: "Click to book eTicket"
AI: [NO REPLY] ✅ (ignored bot)
```

---

## Problem 2: Session Logs Out After Code Deploy ❌

Every time you push new code to Railway, WhatsApp session gets disconnected and you have to scan QR again.

## Why This Happens:

Railway can lose session data in two scenarios:

### Scenario A: Volume Not Configured (Most Common)
- Railway doesn't have persistent volume attached
- Every deploy = fresh container = lost auth files
- Need to add volume for `/data` directory

### Scenario B: Auth Path Wrong
- Auth files stored in wrong location (not on volume)
- Container restart = files gone

## Solution: Ensure Persistent Volume ✅

### Check 1: Verify Volume in Railway

1. Go to: https://railway.app/dashboard
2. Click your **whatapp-automation** project
3. Click **Settings** tab
4. Scroll to **Volumes** section

**Expected to see:**
```
Volume: ✓ Mounted
Mount Path: /data
Size: 1GB (or more)
```

**If NOT there:**
1. Click **Add Volume**
2. Mount Path: `/data`
3. Size: `1` GB (enough for WhatsApp auth)
4. Click **Add**
5. **Redeploy** the service

### Check 2: Verify Auth Path in Logs

After deployment, check Railway logs for:

```
[Storage] Railway detected: YES
[Storage] Persistent root: /data
[Storage] Writable: YES
[WhatsApp] Auth path: /data/whatsapp-auth
```

If you see `/data/whatsapp-auth` → ✅ Correct!

### Check 3: Verify Auth Files Exist

In Railway logs, look for:

```
[WhatsApp] Existing session detected
[WhatsApp] Session restored successfully
```

This means auth files persisted! ✅

---

## How to Fix Session Persistence

### Option 1: Add Volume via Railway Dashboard (Recommended)

1. **Railway Dashboard** → Your Project
2. **Settings** → **Volumes**
3. **Add Volume**
   - Mount Path: `/data`
   - Size: 1 GB
4. **Save**
5. **Redeploy** (Railway will auto-redeploy)

**Note:** After adding volume, you'll need to scan QR **ONE MORE TIME**. After that, it will persist forever!

### Option 2: Via Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Add volume
railway volume create
# Mount path: /data
# Size: 1GB

# Deploy
railway up
```

### Option 3: Environment Variable (If Volume Exists)

If volume exists but auth still logs out, set explicit path:

Railway Dashboard → Variables → Add:
```
WHATSAPP_AUTH_PATH=/data/whatsapp-auth
DATA_PATH=/data
```

---

## How to Test

### Test 1: Bot Message Ignoring

Send yourself messages from these bots and check if AI replies:

```
JioHome → Should NOT reply ✅
Nagpur Metro → Should NOT reply ✅
Swiggy → Should NOT reply ✅
Bank OTP → Should NOT reply ✅
```

Real friend messages → Should reply ✅

### Test 2: Session Persistence

```
1. Scan QR code and connect
2. Wait for "WhatsApp Connected" in logs
3. Send test message → AI replies ✅
4. Push new code to Railway (trigger redeploy)
5. Wait for redeploy to finish (~3 min)
6. Check logs for "Session restored successfully"
7. Send message again → AI should reply without scanning QR! ✅
```

**If it asks for QR again after step 6:**
- Volume is NOT configured properly
- Follow "Option 1" above

---

## Updated Files

**File: `backend/src/agent/messagePolicy.js`**

Added:
- `KNOWN_BOT_NAMES` array (30+ business bots)
- `BOT_PATTERNS` array (automated message patterns)
- Enhanced `classifyReplyPolicy()` function
- `isKnownBot()` helper function

---

## Logs to Check

### Good Logs (Working):

```
[Storage] Railway detected: YES
[Storage] Persistent root: /data
[Storage] Writable: YES
[WhatsApp] Auth path: /data/whatsapp-auth
[WhatsApp] Existing session detected
[WhatsApp] Session restored successfully
[WhatsApp] Connected! ✅
[Policy] Ignoring bot: JioHome
[Policy] Bot pattern detected in message
```

### Bad Logs (Need Fix):

```
[Storage] Persistent root: /app/data  ❌ (should be /data)
[WhatsApp] Auth path: /app/data/whatsapp-auth  ❌ (not on volume)
[WhatsApp] No existing session, generating QR...  ❌ (every time)
```

---

## Quick Checklist

Before deploying:
- [ ] Railway volume configured at `/data`
- [ ] Volume size: at least 1GB
- [ ] Code deployed with bot detection
- [ ] Scanned QR code once

After deploying:
- [ ] Check logs for "Session restored successfully"
- [ ] Test bot messages (should be ignored)
- [ ] Test real friend messages (should reply)
- [ ] Redeploy and verify session persists

---

## Summary

**Bot Detection:** ✅ Fixed - AI will ignore 30+ known bots and automated patterns

**Session Persistence:** ⚠️ **YOU NEED TO:** Add Railway volume at `/data` (see Option 1 above)

**After adding volume:** Session will persist across all future deploys! 🎉

---

## Need Help?

If session still logs out after adding volume:

1. Check Railway logs for exact auth path
2. Verify volume is mounted at `/data`
3. Check if `railway.json` has volume config:
   ```json
   {
     "deploy": {
       "volumes": [{ "mount": "/data" }]
     }
   }
   ```

Already configured! ✅

So just need to add volume in Railway dashboard and you're done!
