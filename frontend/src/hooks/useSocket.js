import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { getStoredToken, signOutDashboard } from '../api/client'

// Local development socket connection
const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/+$/, '')

export function useSocket() {
  const socketRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const [status, setStatus] = useState({ state: 'disconnected' })
  const [qrData, setQrData] = useState(null)
  const [messages, setMessages] = useState([])

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 20,
      timeout: 20000,
      transports: ['websocket', 'polling'],
      upgrade: true,
      rememberUpgrade: true,
      path: '/socket.io/',
      auth: { token: getStoredToken() },
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
    })

    socket.on('connect_error', (error) => {
      setConnected(false)
      if (error.message === 'unauthorized') {
        signOutDashboard()
        window.dispatchEvent(new Event('dashboard:unauthorized'))
      }
    })

    socket.on('disconnect', () => setConnected(false))

    socket.on('status', (data) => {
      setStatus(data)
      if (data.state === 'ready') setQrData(null)
    })

    socket.on('qr', (data) => {
      setQrData(data)
      setStatus(prev => ({ ...prev, state: 'qr' }))
    })

    socket.on('message_log', (data) => {
      if (Array.isArray(data)) {
        setMessages(data.slice(-100))
      } else {
        setMessages(prev => [...prev, data].slice(-100))
      }
    })

    socket.on('settings_updated', () => {})

    return () => { socket.disconnect() }
  }, [])

  return { socket: socketRef.current, connected, status, qrData, messages }
}
