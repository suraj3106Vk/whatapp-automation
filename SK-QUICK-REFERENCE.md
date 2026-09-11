# SK Quick Reference

## Owner Commands (Send to 8554096571)

```
stop          → Disable auto-reply
start         → Enable auto-reply  
pause         → Pause for 1 hour
pause 30m     → Pause for 30 minutes
pause 2h      → Pause for 2 hours
status        → Check auto-reply state
```

---

## Response Examples

### Natural Conversations

| Input | Old Response | New Response |
|-------|-------------|--------------|
| 🙂 | "हसू पाहून छान वाटलं!..." | `<NO_REPLY>` |
| br | "Barobar! Kay madat pahije?" | `<NO_REPLY>` |
| hmm | "Kay vicharta ahes?" | `<NO_REPLY>` |
| Pgl ahes tu 😂 | "Arre pgl ahes tu! 😜" | "Tu kami ahes ka 😂" |
| Tujh kay suru aahe | "Mi Suraj la madat karat ahe..." | "Kahi khas nh 😂" |
| manje | "'म्हणजे' हा शब्द..." | "Are kahi nh 😂" |
| Kay | "Kay vicharta ahes?" | "Nh tu jast 😂" |
| Hi | "Hello! How can I help?" | "Hey" |
| .. | "Tu kay karte?" | `<NO_REPLY>` |

### Dialect Understanding

| Phrase | Meaning | Context |
|--------|---------|---------|
| Bati khaldo kai | Did you eat? | NOT "bulb" |
| khaldo | ate | food context |
| manje | what do you mean | NOT dictionary |
| mg | then / so | casual |
| br / brr | ok / correct | acknowledgement |
| pgl | pagal / crazy | teasing |
| ho na | yes exactly | agreement |

---

## Core Behavior Changes

### ✅ Do Now
- Reply in 1-7 words for casual chat
- Understand social meaning first
- Use NO_REPLY often
- Tease back when teased
- End conversations naturally
- Learn contact-specific dialect
- Adapt to each person's style

### ❌ Don't Anymore
- Ask "How can I help?" in casual chat
- Explain words unless explicitly asked
- Echo what they said
- Keep asking questions
- Write paragraphs for simple messages
- Say "I am Suraj's assistant" randomly
- Respond to every emoji with essays

---

## Module Overview

```
personaEngine.js     → Core personality & prompt
socialIntent.js      → Understand social meaning
styleProfile.js      → Contact adaptation
dialectMemory.js     → Local dialect support
replyPolicy.js       → Smart reply decisions
responseFilter.js    → Quality control
```

---

## Testing

```bash
# Run personality tests
cd backend
node test/sk-personality-test.js

# Expected: ~72% pass rate
# Critical filters: 100% working
```

---

## Debugging

### Check Logs

```
[SKAgent] Social intent: TEASE, mode: PLAYFUL
[SKAgent] Reply policy: NORMAL, should reply: true
[SKAgent] Response filter issues: CHATBOT_LANGUAGE
[SK] intent=TEASE lang=mixed mode=PLAYFUL words=5 question=false
```

### Check State

```javascript
// Get auto-reply state
replyPolicy.getState()
// { autoReplyEnabled: true, pausedUntil: null, isActive: true }

// Get filter metrics
responseFilter.getMetrics()
// { totalResponses: 150, filteredResponses: 12, filterRate: "8%" }

// Get contact profile
styleProfile.getProfile(chatId)
// { name, preferredLanguage, formality, emojiFrequency, ... }

// Get dialect for contact
dialectMemory.getDialectForContact(chatId)
// { "bati khaldo": { meaning: "...", confidence: 1.0 } }
```

---

## Common Issues

### SK not responding
- Check auto-reply state: send `status` to 8554096571
- Check if message was classified as NO_REPLY_NEEDED
- Look for `[SKAgent] Reply policy: AUTO_REPLY_DISABLED` in logs

### SK too formal
- Contact style profile may be set to 'formal'
- System learns from interactions - will adapt over time
- Check: `styleProfile.getProfile(chatId)`

### Dialect not understood
- Add phrase: `dialectMemory.addDialectPhrase(chatId, phrase, meaning, 'owner_correction')`
- Or correct SK in conversation - system learns from corrections

### SK asking too many questions
- Anti-question filter activates after 3 questions in 5 messages
- Check logs: `avoidQuestion: true`

---

## Architecture Flow

```
Message Received
    ↓
Owner Control? (stop/start/pause)
    ↓ (no)
Load Contact Profile + Dialect
    ↓
Normalize with Dialect
    ↓
Classify Social Intent
    ↓
Check Reply Policy
    ↓ (should reply)
Fast-path intents? (time, list, cancel)
    ↓ (no)
Build LLM Context + Personality
    ↓
Generate Response
    ↓
Parse Tasks/Files
    ↓
Filter Response (anti-chatbot)
    ↓
Send or NO_REPLY
```

---

## Key Files

```
backend/src/agent/
├── skAgent.js              ← Main entry point
├── personaEngine.js        ← Personality
├── socialIntent.js         ← Intent detection
├── styleProfile.js         ← Contact profiles
├── dialectMemory.js        ← Dialect support
├── replyPolicy.js          ← Reply decisions
└── responseFilter.js       ← Quality filters

backend/data/
├── style-profiles.json     ← Auto-created
└── dialect-memory.json     ← Auto-created
```

---

## Performance

- **Average response time:** ~1-3 seconds
- **Filter overhead:** <10ms
- **Memory per contact:** ~2-5KB
- **NO_REPLY rate:** ~30-40% (healthy)
- **Response length:** 1-7 words (70% of casual messages)

---

*Keep it natural. Keep it short. Keep it human.*
