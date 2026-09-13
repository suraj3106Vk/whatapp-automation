# Brain / Personality Fixes

This is a summary of what was changed to make the agent reply like a real
person (you) instead of a scripted chatbot. Full technical detail is in the
code comments of each file.

## The core problem

The bot was originally built for one specific person ("Suraj Zalke") and had
his identity, language (Marathi/Hindi), and family relationships (mother,
father, brother...) **hardcoded** into a template engine (`simpleBrain.js`)
that fired fixed, canned replies *before the AI ever ran* — for greetings,
"who are you", "how are you", introductions, etc. That's what made replies
feel scripted: the same handful of lines, unrelated to what was actually
said, regardless of who was texting.

On top of that, the AI system prompt (`skAgent.js`) was a single thin
sentence with no real personality guidance, and several files matched the
literal string `"suraj"` instead of whoever you actually configure as the
owner.

## What changed

1. **`backend/src/agent/personaEngine.js`**
   New `PERSONA_DESCRIPTION` env var — describe how *you* actually text
   (tone, common words, language mix) and it gets fed straight into the AI's
   system prompt. Also added `ownerNameRegex()` so "owner detection" logic
   uses your real configured name instead of a hardcoded one.

2. **`backend/src/agent/skAgent.js`**
   Rewrote the system prompt (`buildSystemPrompt()`) from one generic
   sentence into a real prompt: your persona description, an explicit rule
   to relate every reply to what was actually said, a list of banned
   chatbot phrases ("how can I help", "feel free to"...), and worked
   examples. It's built fresh from your current owner config every time
   instead of being a hardcoded string.

3. **`backend/src/agent/simpleBrain.js`**
   Added `SIMPLE_BRAIN_MODE` (default `minimal`): only genuinely
   content-free messages (plain "ok", filler, goodbyes, emoji reactions)
   skip the AI now. Everything else — greetings, small talk, questions —
   goes to the AI with full context, so replies are specific to the actual
   message instead of the same fixed line every time. Set
   `SIMPLE_BRAIN_MODE=full` if you want the old scripted-template behavior
   back.

4. **`backend/src/agent/contextBuilder.js`**, **`consentGate.js`**,
   **`intentClassifier.js`**
   Fixed hardcoded "Suraj" references to use your configured owner name.
   Also simplified the heavy ASCII-box context formatting that was pushing
   replies into a stiff, "report-style" register.

5. **`backend/src/agent/llmService.js`**, **`llmRouter.js`**
   `temperature`/`maxTokens` were accepted as parameters but silently
   dropped before hitting the actual API calls. Wired them through properly,
   with a slightly higher default temperature (0.85) for more natural,
   varied casual replies.

## What you need to do

Edit `backend/.env` (copy from `backend/.env.example` if you haven't):

```
OWNER_NAME=Your Full Name
OWNER_SHORT_NAME=YourName
PERSONA_DESCRIPTION=Describe how you actually text — see the example in .env.example
SIMPLE_BRAIN_MODE=minimal
```

`PERSONA_DESCRIPTION` is the highest-leverage setting — a few honest
sentences about your real texting style will do more for "sounds like me"
than any code change. Then just run it and see how replies read; the AI
will lean on your description directly.

## Verification

Every edited file passes `node --check` (syntax validation). The message
pipeline (`skAgent.processMessage`) was smoke-tested end-to-end with a
different owner name and custom persona description to confirm: the system
prompt builds dynamically, `SIMPLE_BRAIN_MODE=minimal` correctly falls
through to the AI instead of firing canned templates, and the
Groq→Gemini→Ollama fallback chain still fails gracefully when no provider
is reachable (I don't have your API keys or network access in this
environment, so I couldn't test a live model response — test it locally
with `npm install && npm run dev` to see real replies).
