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

  DASHBOARD_PASSWORD=$(openssl rand -hex 16)
  DASHBOARD_SESSION_SECRET=$(openssl rand -hex 32)
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
    printf 'DASHBOARD_PASSWORD=%s\n' "$DASHBOARD_PASSWORD"
    printf 'DASHBOARD_SESSION_SECRET=%s\n' "$DASHBOARD_SESSION_SECRET"
  } > .env
  chmod 600 .env

  printf '\n%s\n' 'Save these dashboard credentials somewhere private. They are only shown during this setup:'
  printf 'Dashboard password: %s\n' "$DASHBOARD_PASSWORD"
  printf 'Dashboard session secret: %s\n\n' "$DASHBOARD_SESSION_SECRET"
  unset GROQ_KEYS GEMINI_KEYS DASHBOARD_PASSWORD DASHBOARD_SESSION_SECRET
else
  printf '%s\n' 'Using the existing backend/.env; secrets will not be displayed.'
fi

CURRENT_PASSWORD=$(sed -n 's/^DASHBOARD_PASSWORD=//p' .env | tail -n 1)
CURRENT_SESSION_SECRET=$(sed -n 's/^DASHBOARD_SESSION_SECRET=//p' .env | tail -n 1)
if [ "${#CURRENT_PASSWORD}" -lt 16 ] || [ "${#CURRENT_SESSION_SECRET}" -lt 32 ]; then
  DASHBOARD_PASSWORD=$(openssl rand -hex 16)
  DASHBOARD_SESSION_SECRET=$(openssl rand -hex 32)
  UPDATED_ENV=$(mktemp)
  awk '
    !/^[[:space:]]*DASHBOARD_PASSWORD=/ &&
    !/^[[:space:]]*DASHBOARD_SESSION_SECRET=/
  ' .env > "$UPDATED_ENV"
  {
    printf '\nDASHBOARD_PASSWORD=%s\n' "$DASHBOARD_PASSWORD"
    printf 'DASHBOARD_SESSION_SECRET=%s\n' "$DASHBOARD_SESSION_SECRET"
  } >> "$UPDATED_ENV"
  cat "$UPDATED_ENV" > .env
  rm "$UPDATED_ENV"
  chmod 600 .env
  printf '\n%s\n' 'Generated dashboard credentials; save them somewhere private:'
  printf 'Dashboard password: %s\n' "$DASHBOARD_PASSWORD"
  printf 'Dashboard session secret: %s\n\n' "$DASHBOARD_SESSION_SECRET"
  unset CURRENT_PASSWORD CURRENT_SESSION_SECRET DASHBOARD_PASSWORD DASHBOARD_SESSION_SECRET
else
  unset CURRENT_PASSWORD CURRENT_SESSION_SECRET
fi

if [ ! -d node_modules ]; then
  npm install
fi

mkdir -p "$HOME/sk-agent-data"
printf 'Persistent WhatsApp session/data directory: %s/sk-agent-data\n' "$HOME"
printf '%s\n' 'Starting backend. Keep Termux open; press Ctrl+C to stop.'
exec npm start
