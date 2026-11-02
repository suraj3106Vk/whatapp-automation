import axios from 'axios'

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/+$/, '')
const BASE = `${API_URL}/api`
const SOCKET_URL = API_URL

const TOKEN_KEY = 'sk_dashboard_token'

// ── Token helpers ─────────────────────────────────────────────────────────────
export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

function storeToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

// ── Axios instance ────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: BASE,
  timeout: 15000,
})

api.interceptors.request.use(config => {
  const token = getStoredToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      clearToken()
      window.dispatchEvent(new Event('dashboard:unauthorized'))
    }
    return Promise.reject(error)
  }
)

export { SOCKET_URL }

// ── Auth ──────────────────────────────────────────────────────────────────────

/**
 * Login with time-based PIN.
 * PIN = current time in HHMM format (e.g. 01:22 → "0122").
 */
export async function loginWithPin(pin) {
  const res = await axios.post(`${BASE}/auth/login`, { pin }, { timeout: 10000 })
  storeToken(res.data.token)
  return res.data
}

export async function verifyDashboardSession() {
  return api.get('/auth/verify').then(r => r.data)
}

export function signOutDashboard() {
  clearToken()
  return Promise.resolve()
}

// Kept as no-op for compatibility
export async function getDashboardToken() {
  return getStoredToken()
}

// ── Status & QR ───────────────────────────────────────────────────────────────
export const getStatus = () => api.get('/status').then(r => r.data)

// ── Settings ──────────────────────────────────────────────────────────────────
export const getSettings = () => api.get('/settings').then(r => r.data)
export const updateSettings = (settings) => api.post('/settings', settings).then(r => r.data)

// ── Messages ──────────────────────────────────────────────────────────────────
export const getMessages = () => api.get('/messages').then(r => r.data)
export const sendMessage = (chatId, message) =>
  api.post('/send', { chatId, message }).then(r => r.data)

// ── Chats ─────────────────────────────────────────────────────────────────────
export const getChats = () => api.get('/chats').then(r => r.data)

// ── Files ─────────────────────────────────────────────────────────────────────
export const getFiles = () => api.get('/files').then(r => r.data)
export const downloadFile = (filename) =>
  api.get(`/files/download/${encodeURIComponent(filename)}`, { responseType: 'blob' }).then(r => r.data)

export const uploadFile = (file) => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/files/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}

export const deleteFile = (filename) =>
  api.delete(`/files/${encodeURIComponent(filename)}`).then(r => r.data)

export const sendFile = (chatId, filename, caption) =>
  api.post('/send-file', { chatId, filename, caption }).then(r => r.data)

// ── Memory ────────────────────────────────────────────────────────────────────
export const getMemoryStats = () => api.get('/memory').then(r => r.data)
export const clearChatMemory = (chatId) =>
  api.delete(`/memory/${encodeURIComponent(chatId)}`).then(r => r.data)

// ── Logout ────────────────────────────────────────────────────────────────────
export const logout = () => api.post('/logout').then(r => r.data)

export default api
