# Run the backend in Termux on Android

This runs the WhatsApp backend on your phone instead of Railway. The phone must
stay powered on and connected to the internet for the bot to remain available.
Android may still stop Termux because of battery or manufacturer background
limits, so this is not as reliable as an always-on server.

## Install and start

Paste this into Termux to install prerequisites, get the latest project, and run
the setup:

```sh
pkg update -y && pkg install -y nodejs-lts git openssl curl && if [ -d "$HOME/whatapp-automation/.git" ]; then cd "$HOME/whatapp-automation" && git pull --ff-only origin main; else git clone https://github.com/suraj3106Vk/whatapp-automation.git "$HOME/whatapp-automation"; fi && cd "$HOME/whatapp-automation" && sh termux-start.sh
```

1. Install Termux from F-Droid (avoid outdated Play Store builds), open it, and
   verify Node.js is version 20 or newer:

   ```sh
   node --version
   ```

   The backend requires Node.js 20 or newer.

2. On first run, the script securely prompts for provider keys (input is
   hidden), generates a strong dashboard password and session secret, stores
   them in a private `backend/.env`, and starts the backend. If `.env` already
   exists but those dashboard credentials are missing or too short, the script
   generates replacements while preserving the existing provider keys. Save
   displayed credentials somewhere private. Keep `.env` private; never commit
   or share it.

   On later runs, paste the same command again. It updates the checkout,
   reuses the existing `.env` and persistent data directory, and starts the
   backend without displaying credentials again.

3. Confirm the local health endpoint in another Termux session:

   ```sh
   curl http://127.0.0.1:3001/health
   ```

   The WhatsApp auth files are stored under
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
