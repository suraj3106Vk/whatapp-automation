#!/data/data/com.termux/files/usr/bin/sh
set -eu

MIN_NODE_MAJOR=20
NODE_MAJOR=$(node -p "Number(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt "$MIN_NODE_MAJOR" ]; then
  printf 'Node.js 20 or newer is required; found %s.\n' "$(node --version)" >&2
  exit 1
fi

cd "$HOME/whatapp-automation/backend"

if [ ! -f .env ]; then
  printf '%s\n' 'Create or paste newly rotated provider keys. Input is hidden.'
  printf '%s' 'Fresh Groq API key(s), comma-separated (leave blank if unused): '
  stty -echo
  IFS= read -r GROQ_KEYS || true
  stty echo
  printf '\n'

  printf '%s' 'Fresh Gemini API key(s), comma-separated (leave blank if unused): '
  stty -echo
  IFS= read -r GEMINI_KEYS || true
  stty echo
  printf '\n'

  if [ -z "$GROQ_KEYS" ] && [ -z "$GEMINI_KEYS" ]; then
    printf '%s\n' 'Enter at least one provider API key to continue.' >&2
    exit 1
  fi

  printf '%s' 'Firebase admin email (create and verify this user in Firebase Console): '
  IFS= read -r FIREBASE_ADMIN_EMAIL
  if [ -z "$FIREBASE_ADMIN_EMAIL" ]; then
    printf '%s\n' 'A Firebase admin email is required.' >&2
    exit 1
  fi

  umask 077
  {
    printf 'PORT=3001\n'
    printf 'HOST=127.0.0.1\n'
    printf 'NODE_ENV=production\n'
    printf 'OWNER_NAME=Suraj Zalke\n'
    printf 'OWNER_SHORT_NAME=Suraj\n'
    printf 'DATA_PATH=%s/sk-agent-data\n' "$HOME"
    printf 'GROQ_API_KEYS=%s\n' "$GROQ_KEYS"
    printf 'GEMINI_API_KEYS=%s\n' "$GEMINI_KEYS"
    printf 'FIREBASE_PROJECT_ID=whtapp-automation\n'
    printf 'FIREBASE_ADMIN_EMAILS=%s\n' "$FIREBASE_ADMIN_EMAIL"
  } > .env
  chmod 600 .env

  unset GROQ_KEYS GEMINI_KEYS FIREBASE_ADMIN_EMAIL
else
  printf '%s\n' 'Using the existing backend/.env; secrets will not be displayed.'
fi

set_env_value() {
  key=$1
  value=$2
  updated_env=$(mktemp)
  awk -v key="$key" 'index($0, key "=") != 1' .env > "$updated_env"
  printf '%s=%s\n' "$key" "$value" >> "$updated_env"
  cat "$updated_env" > .env
  rm "$updated_env"
  chmod 600 .env
}

sed -i '/^DASHBOARD_PASSWORD=/d; /^DASHBOARD_SESSION_SECRET=/d; /^GOOGLE_APPLICATION_CREDENTIALS=/d' .env
chmod 600 .env

FIREBASE_PROJECT_ID=$(sed -n 's/^FIREBASE_PROJECT_ID=//p' .env | tail -n 1)
if [ -z "$FIREBASE_PROJECT_ID" ]; then
  FIREBASE_PROJECT_ID=whtapp-automation
  set_env_value FIREBASE_PROJECT_ID "$FIREBASE_PROJECT_ID"
fi

FIREBASE_ADMIN_EMAILS=$(sed -n 's/^FIREBASE_ADMIN_EMAILS=//p' .env | tail -n 1)
if [ -z "$FIREBASE_ADMIN_EMAILS" ]; then
  printf '%s' 'Firebase admin email (create and verify this user in Firebase Console): '
  IFS= read -r FIREBASE_ADMIN_EMAILS
  if [ -z "$FIREBASE_ADMIN_EMAILS" ]; then
    printf '%s\n' 'A Firebase admin email is required.' >&2
    exit 1
  fi
  set_env_value FIREBASE_ADMIN_EMAILS "$FIREBASE_ADMIN_EMAILS"
fi

git config --global url."https://github.com/".insteadOf "ssh://git@github.com/"
npm install --allow-git=all

mkdir -p "$HOME/sk-agent-data"
printf 'Persistent WhatsApp session/data directory: %s/sk-agent-data\n' "$HOME"
printf '%s\n' 'Starting backend. Keep Termux open; press Ctrl+C to stop.'
exec npm start
