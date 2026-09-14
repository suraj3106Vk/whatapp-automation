# Session / Group / Brain fixes (this round)

Note: several fixes from the previous round (group blocking, minimal
SimpleBrain mode) had been reverted/regressed in the code you uploaded this
time — likely from other edits made on top of it. I re-applied them and made
them harder to accidentally regress again. Details below.

## 1. Group replies — now a hard rule, not a toggle

Previously `replyToGroups` defaulted to `true` (`ENABLE_GROUPS !== 'false'`),
and the actual block check in `replyPolicy.js` tested a field
(`contactProfile.replyToGroups`) that was never set anywhere — so it never
actually blocked anything. **The bot really was replying in groups.**

Fixed by making it an unconditional rule, checked in two independent places
so there's no path around it:
- `backend/src/whatsapp/baileysClient.js` — group messages are skipped
  before they even reach the agent.
- `backend/src/agent/skAgent.js` — `processMessage()` refuses groups as the
  very first thing it does, before any other processing, and even a crash
  later in the pipeline can no longer fall back to an error-message reply
  landing in a group.

## 2. WhatsApp session / "logs out" issue

From your Railway logs, the pattern was repeated QR-code regeneration
(connection opens → closes → reconnects → new QR) rather than an
established session suddenly logging out. That points to the websocket
dying during/soon after the handshake — common on proxied hosts like
Railway when the connection sits idle or a handshake runs slow.

Changes in `baileysClient.js`:
- Added `keepAliveIntervalMs`, `connectTimeoutMs`, `defaultQueryTimeoutMs`,
  `retryRequestDelayMs` to the Baileys socket config — these are the
  standard resilience settings for cloud/proxied hosts and give slow
  handshakes room instead of timing out mid-pairing.
- Baileys always closes the connection once with `restartRequired` (515)
  immediately after a **successful** QR scan — that's expected, not an
  error. Previously this got the same backoff delay as a real failure,
  which could look like it "hung" right after scanning. Now it reconnects
  almost immediately in that specific case.
- The dashboard/logs now show the actual disconnect reason by name
  (`lastDisconnectReason` in the state object) instead of just a spinner —
  so if it does happen again you'll be able to see whether it's an expected
  restart, a real logout, or something else, rather than guessing.

This can't fully rule out a genuinely flaky network path on Railway's end,
but these are the standard fixes for this exact symptom. If it still happens
after this, check the Railway logs for the new `[WhatsApp] Connection
closed: <reason>` line — that'll tell us exactly what to fix next.

## 3. Brain reply / agentic flow

- `SIMPLE_BRAIN_MODE` had been reset to `full` in the code (canned template
  replies firing again instead of the AI). Set back to `minimal`. **Check
  your actual Railway environment variables too** — if `SIMPLE_BRAIN_MODE`
  is set there explicitly, it'll override the code default either way.
- The system prompt had been edited to say "never return a no-reply marker
  for ordinary conversation" — i.e. always reply to literally everything,
  including a bare "ok" or a thumbs-up emoji. Real people don't do that;
  it read as more chatbot-like, not less. Restored natural handling: plain
  acknowledgments/goodbyes/reactions can go unanswered, anything with actual
  content still always gets a real, context-specific reply.
- The old consent-gate system (`consentGate.js`, the "do you want to
  continue chatting with me?" flow from before) is no longer wired into the
  pipeline at all in your current code — it's been replaced by a simpler
  exact-match `stop`/`start` command in `replyPolicy.js`, which doesn't have
  the "misreads a random 'no' as declining forever" bug. That part is
  already fine as-is.

## 4. Task/reminder pipeline — the "oyeii" bug

From your transcript, two separate real bugs, both fixed:

**Garbled reminder text.** `buildLocalTaskAction()` (the fast-path regex
parser that handles reminders before the AI ever runs) couldn't handle
"...la oyeii msg karsil" — the reminder content sits *between* the time and
the verb in that word order, which none of the existing patterns matched.
It fell through to a generic cleanup pass that left most of the original
sentence in as the reminder text instead of just "oyeii". Also, **the AI
itself had zero instructions about how to create reminders** — no
`<SK_TASK>` format documentation in the system prompt at all — so if the
regex fast-path missed, there was no fallback; reminders just silently
didn't work right.

Fixed by:
- Adding a third pattern that matches this exact word order.
- Adding a sanity check: if what gets extracted still looks like it has
  scheduling scaffolding left in it (stray digits, "remind", etc), the
  fast-path backs off instead of returning a garbled result.
- Teaching the AI the `<SK_TASK>` JSON format directly in the system prompt,
  with the exact "oyeii" example, so ambiguous phrasing the regex can't
  confidently handle still produces a clean reminder via the AI instead of
  silently failing.

**Duplicate confirmation.** The code was sending the reply *and* a second,
separate mechanical "reminder set" line, concatenated together — that's why
you saw two different-worded "okay"s back to back. Fixed: the reply itself
(from either path) already confirms the task in natural language, so the
mechanical line is now only used as a fallback if there's no reply text at
all, never appended on top of one.

Also added an explicit instruction against a different bug visible in your
transcript: at one point the bot sent what looks like a raw image
analysis/caption (the Ganesh Chaturthi card description) verbatim as its
reply, completely disconnected from the conversation. The prompt now
explicitly says media analysis is background context to react to
naturally, never something to copy/forward as the reply itself.
