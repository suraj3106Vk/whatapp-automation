import axios from 'axios'

// Local development API endpoint
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/+$/, '')
const BASE = `${API_URL}/api`

const SOCKET_URL = API_URL

const api = axios.create({
  baseURL: BASE,
  timeout: 15000,
})

const TOKEN_KEY = 'sk-agent-dashboard-session'

export function getDashboardToken() {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function clearDashboardToken() {
  sessionStorage.removeItem(TOKEN_KEY)
}

export async function loginDashboard(password) {
  const { data } = await axios.post(`${BASE}/auth/login`, { password }, { timeout: 15000 })
  sessionStorage.setItem(TOKEN_KEY, data.token)
  return data
}

export const verifyDashboardSession = () => api.get('/auth/verify').then(r => r.data)

api.interceptors.request.use((config) => {
  const token = getDashboardToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      clearDashboardToken()
      window.dispatchEvent(new Event('dashboard:unauthorized'))
    }
    return Promise.reject(error)
  }
)

export { SOCKET_URL }

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
