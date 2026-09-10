const DEFAULT_LOCAL_BACKEND = 'http://localhost:3001'
const ACTIVE_BACKEND_URL = 'https://sk-agent-backend-production.up.railway.app'
const LEGACY_BACKEND_URLS = new Set([
  'https://whatapp-automation-production.up.railway.app',
  'https://whatapp-automation-production.up.railway.app/',
  'http://whatapp-automation-production.up.railway.app',
  'http://whatapp-automation-production.up.railway.app/',
])

export function normalizeBackendUrl(input) {
  const candidate = (input || '').trim()

  if (!candidate) return DEFAULT_LOCAL_BACKEND

  if (LEGACY_BACKEND_URLS.has(candidate)) {
    return ACTIVE_BACKEND_URL
  }

  return candidate.replace(/\/$/, '')
}

export { DEFAULT_LOCAL_BACKEND, ACTIVE_BACKEND_URL }
