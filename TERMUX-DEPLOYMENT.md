# Run the backend in Termux on Android

This runs the WhatsApp backend on your phone instead of Railway. The phone must
stay powered on and connected to the internet for the bot to remain available.
Android may still stop Termux because of battery or manufacturer background
limits, so this is not as reliable as an always-on server.

## Install and start

1. Install Termux from F-Droid (avoid outdated Play Store builds), open it, then
   install Node.js and Git:

   ```sh
   pkg update
   pkg install nodejs-lts git openssl curl
   node --version
   ```

   The backend requires Node.js 20 or newer.

2. Clone the repository and install backend dependencies:

   ```sh
   cd "$HOME"
   git clone https://github.com/suraj3106Vk/whatapp-automation.git
   cd "$HOME/whatapp-automation/backend"
   npm install
   cp .env.example .env
   nano .env
   ```

3. In `backend/.env`, set your AI provider key(s), owner details, and two
   dashboard login secrets. Generate each secret separately:

   ```sh
   openssl rand -hex 32
   openssl rand -hex 32
   ```

   Put one generated value in `DASHBOARD_PASSWORD` and the other in
   `DASHBOARD_SESSION_SECRET`. Keep `.env` private; never commit or share it.
   Also set `HOST=127.0.0.1` so only the local tunnel can connect to the backend.
   The dashboard login token expires after seven days. It does not contain the
   WhatsApp session, and signing in again does not require pairing WhatsApp.

4. Create a persistent data directory outside the Git checkout and start the
   backend:

   ```sh
   mkdir -p "$HOME/sk-agent-data"
   cd "$HOME/whatapp-automation/backend"
   DATA_PATH="$HOME/sk-agent-data" npm start
   ```

   Confirm it responds locally in another Termux session:

   ```sh
   curl http://127.0.0.1:3001/health
   ```

   Keep using the same `DATA_PATH` value every time you start the backend. The
   WhatsApp auth files are stored under
   `$HOME/sk-agent-data/whatsapp-auth`; memory, scheduler data, and uploads are
   stored under the same persistent data directory.

## Pair WhatsApp once

When the backend first starts, it prints a QR code in the Termux terminal. Scan
it using WhatsApp → **Linked devices** → **Link a device**. The account must
remain linked on the phone that owns the WhatsApp account.

Baileys saves the login credentials under `DATA_PATH`. Stopping and restarting
the backend reuses those files; do not delete the data directory and do not use
the dashboard's **Logout** action if you want to keep the pairing. You may need
to link again if you explicitly log out, unlink the device in WhatsApp, or lose
the auth files. Railway's old session cannot be reused unless you can securely
export its auth files; if those files are unavailable, scan a new QR once on
Termux.

## Connect the hosted dashboard from anywhere

The backend API is protected by the dashboard password, but it must still be
served over HTTPS when accessed remotely. Do not expose port 3001 directly to
the public internet. Set up a persistent HTTPS tunnel to
`http://127.0.0.1:3001` using a provider such as Cloudflare Tunnel, and use its
stable HTTPS hostname as the Netlify site's `VITE_API_URL`. Trigger a Netlify
redeploy after changing that variable. If you use a custom frontend domain,
also set `FRONTEND_URL` in `backend/.env` to that exact origin and restart the
backend.

The temporary `trycloudflare.com` Quick Tunnel hostname changes when the tunnel
restarts, so it is not suitable for a dashboard that needs a stable URL. Keep
the phone, Termux backend, and tunnel running. In Android battery settings,
allow Termux to run without battery optimization. A Termux wake lock can reduce
sleep-related interruptions, but Android may still stop background work.

After the tunnel and dashboard are configured, open the dashboard on another
device, enter the `DASHBOARD_PASSWORD`, then use the QR shown by the dashboard
to pair the WhatsApp account on the phone.

## Session safety

Treat `$HOME/sk-agent-data/whatsapp-auth` as a password: anyone with those files
may be able to use the linked WhatsApp session. Back them up only to private,
encrypted storage. Never put them in Git, a public tunnel, or a support chat.
Uninstalling or clearing Termux app data also removes the session files.
