import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'

// Local development socket connection
const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/+$/, '')

export function useSocket() {
  const socketRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const [status, setStatus] = useState({ state: 'disconnected' })
  const [qrData, setQrData] = useState(null)
  const [messages, setMessages] = useState([])

  useEffect(() => {
    console.log('[Socket] Connecting to:', SOCKET_URL)
    
    const socket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionDelay: 1000,      // Faster reconnection (was 2000)
      reconnectionAttempts: 20,     // More attempts (was 10)
      timeout: 20000,               // Connection timeout
      transports: ['websocket', 'polling'],  // Try both
      upgrade: true,                // Allow transport upgrades
      rememberUpgrade: true,        // Remember successful upgrade
      path: '/socket.io/',          // Explicit path
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      console.log('[Socket] ✅ Connected to SK Agent backend')
    })

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message)
      setConnected(false)
    })

    socket.on('disconnect', (reason) => {
      setConnected(false)
      console.log('[Socket] Disconnected:', reason)
    })

    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`[Socket] Reconnection attempt ${attemptNumber}...`)
    })

    socket.on('reconnect', (attemptNumber) => {
      console.log(`[Socket] ✅ Reconnected after ${attemptNumber} attempts`)
      setConnected(true)
    })

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

    return () => { 
      console.log('[Socket] Disconnecting...')
      socket.disconnect() 
    }
  }, [])

  return { socket: socketRef.current, connected, status, qrData, messages }
}
