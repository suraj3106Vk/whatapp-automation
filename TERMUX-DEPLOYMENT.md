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

2. Before starting, in Firebase Console enable **Authentication → Sign-in
   method → Email/Password**, create the admin user, and verify its email. In
   **Project settings → Service accounts**, generate a private service-account
   JSON key. Transfer it securely to Termux as
   `$HOME/firebase-service-account.json`, then run:

   ```sh
   termux-setup-storage
   cp "$HOME/storage/downloads/YOUR-SERVICE-ACCOUNT-FILENAME.json" "$HOME/firebase-service-account.json"
   chmod 600 "$HOME/firebase-service-account.json"
   ```

   Never commit, upload, or share this service-account file. The Firebase web
   API key in the frontend configuration is a public client identifier, not an
   admin credential; restrict it to the Firebase APIs used by this app.

3. On first run, the script securely prompts for provider keys (input is
   hidden) and the admin's Firebase email, then stores configuration in a
   private `backend/.env`. It requires the Firebase service-account file to
   exist before the backend can start. If `.env` already exists, the script
   adds missing Firebase settings without removing provider keys. Restarting
   the script runs `npm install` to pick up updated dependencies.

   On later runs, paste the same command again. It updates the checkout,
   reuses the existing `.env` and persistent data directory, and starts the
   backend without displaying credentials again.

4. Confirm the local health endpoint in another Termux session:

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

The backend API is protected by Firebase authentication and the configured
admin email allowlist, but it must still be
served over HTTPS when accessed remotely. Do not expose port 3001 directly to
the public internet. Set up a persistent HTTPS tunnel to
`http://127.0.0.1:3001` using a provider such as Cloudflare Tunnel, and use its
stable HTTPS hostname as the Netlify/Vercel `VITE_API_URL`. If using Vercel,
also set `VITE_API_URL` in the project environment variables. Trigger a
redeploy after changing that variable. In Firebase Console → Authentication →
Settings → Authorized domains, add the Netlify/Vercel frontend hostnames. If
you use a custom frontend domain,
also set `FRONTEND_URL` in `backend/.env` to that exact origin and restart the
backend.

The temporary `trycloudflare.com` Quick Tunnel hostname changes when the tunnel
restarts, so it is not suitable for a dashboard that needs a stable URL. Keep
the phone, Termux backend, and tunnel running. In Android battery settings,
allow Termux to run without battery optimization. A Termux wake lock can reduce
sleep-related interruptions, but Android may still stop background work.

After the tunnel and dashboard are configured, open the dashboard on another
device and sign in with the verified Firebase admin email and password. Create
the admin user in Firebase Console; this app does not expose public sign-up.
Then use the QR shown by the dashboard to pair WhatsApp once.

## Session safety

Treat `$HOME/sk-agent-data/whatsapp-auth` as a password: anyone with those files
may be able to use the linked WhatsApp session. Back them up only to private,
encrypted storage. Never put them in Git, a public tunnel, or a support chat.
Uninstalling or clearing Termux app data also removes the session files.
