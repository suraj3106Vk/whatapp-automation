# SK WhatsApp Agent

A lightweight WhatsApp automation service using Baileys, Groq/Gemini, persistent conversation memory, scheduling, and file sharing. The WhatsApp connection uses a native WebSocket and does not require Chromium, Puppeteer, a second phone, or a laptop running continuously.

## Local development

1. Copy `.env.example` to `backend/.env` and add provider keys.
2. From `backend/`, run `npm install`.
3. Start with `npm start`.
4. Scan the QR shown in the terminal on the first run.
5. Baileys credentials are stored in `data/whatsapp-auth/` by default.

For local testing, keep Ollama optional. Groq is tried first, Gemini second, and Ollama is used only when both cloud providers fail.

## Docker

```powershell
Copy-Item .env.example .env
docker compose up -d --build
```

The Compose file mounts `./data` to `/data`, preserving WhatsApp auth and future database state across restarts. Uploads are mounted from `backend/uploads`.

## Deployment

Use a single persistent service with one replica. Mount a persistent volume at `/data` and set:

```text
WHATSAPP_AUTH_PATH=/data/whatsapp-auth
DATABASE_PATH=/data/database.sqlite
```

Required provider configuration is `GROQ_API_KEYS` and/or `GEMINI_API_KEYS` as comma-separated values. Legacy single-key variables remain supported. Set `PORT` from the platform and keep `ENABLE_GROUPS=false` unless group handling is intentionally enabled.

For this deployment, Railway is the backend and Netlify is the frontend:

```text
Railway API: https://whatapp-automation-production.up.railway.app
Netlify app: https://whatappai.netlify.app
```

The Netlify build already sets `VITE_API_URL` to the Railway API. Local development keeps using `http://localhost:3001` when that variable is not set.

Railway can use the root `Dockerfile`. Render can use `render.yaml`, but its free tier may sleep and therefore cannot guarantee a permanent WhatsApp WebSocket connection. No self-ping is used.

## API

- `GET /health` returns uptime, WhatsApp state, scheduler state, and configured provider availability.
- `GET /api/status` returns dashboard-safe WhatsApp state.
- `GET /api/qr-page` shows pairing status while a QR is required.
- `GET /api/files` lists files available to the agent.

Upload files through the dashboard or place them in `backend/uploads`. A request such as `send me the ration card image` matches the uploaded filename and sends it through WhatsApp.

## Architecture changes

- Replaced `whatsapp-web.js` and Puppeteer with stable Baileys 6.x.
- Added multi-file auth persistence, QR output, reconnect backoff, bounded deduplication, and per-chat queues.
- Removed artificial typing delays and browser launch dependencies.
- Added non-destructive graceful shutdown; explicit logout is separate.
- Added short provider timeouts and temporary key health cooldowns.
- Preserved memory, scheduler, file handling, API routes, and dashboard transport methods.

## Backup

Back up `data/whatsapp-auth/`, `data/memory/`, `data/tasks.json`, and `backend/uploads/`. Never commit `.env` or auth files. Rotate any API key that has been exposed or shared outside the secret manager.

## Known limitations

The scheduler still uses its existing persisted JSON store rather than SQLite. Incoming images, PDFs, and text documents are downloaded and analyzed when a configured provider supports them, so replies can reference their contents. Video, audio, and stickers are acknowledged without transcription or vision analysis; voice transcription and optional TTS remain extension points.
