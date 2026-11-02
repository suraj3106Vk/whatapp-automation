import React from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import {
  MessageSquare, Settings, FolderOpen, Activity, Bot, Wifi, WifiOff, LogOut, LockKeyhole
} from 'lucide-react'
import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth'
import { useSocket } from './hooks/useSocket'
import {
  signOutDashboard,
  verifyDashboardSession,
} from './api/client'
import { firebaseAuth, isFirebaseConfigured } from './config/firebase'
import Dashboard from './pages/Dashboard'
import MessagesPage from './pages/MessagesPage'
import FilesPage from './pages/FilesPage'
import SettingsPage from './pages/SettingsPage'

function LoginScreen() {
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (!firebaseAuth) throw new Error('Firebase is not configured in the Netlify/Vercel environment.')
      await signInWithEmailAndPassword(firebaseAuth, email.trim(), password)
      await verifyDashboardSession()
    } catch (loginError) {
      if (loginError.response?.status === 403) {
        setError('This Firebase account is not allowlisted as a dashboard admin.')
      } else if (loginError.response) {
        setError(loginError.response.data?.error || 'The backend rejected this sign-in.')
      } else if (loginError.code === 'auth/invalid-credential' ||
                 loginError.code === 'auth/user-not-found' ||
                 loginError.code === 'auth/wrong-password') {
        setError('Email or password is incorrect.')
      } else if (loginError.code?.startsWith('auth/')) {
        setError(loginError.message)
      } else if (!loginError.response) {
        setError('Cannot reach the backend. Check that VITE_API_URL is set correctly in the Netlify environment variables and redeploy.')
      } else {
        setError(loginError.message || 'The backend rejected the sign-in.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl p-7 space-y-5">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto rounded-xl bg-whatsapp-green flex items-center justify-center">
            <LockKeyhole size={23} className="text-white" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-white">SK Agent Sign In</h1>
          <p className="mt-1 text-sm text-gray-400">Sign in with your Firebase admin account.</p>
        </div>
        <div>
          <label htmlFor="dashboard-email" className="block text-sm text-gray-300 mb-2">Email</label>
          <input
            id="dashboard-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={event => setEmail(event.target.value)}
            required
            className="mb-4 w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:border-whatsapp-green"
          />
          <label htmlFor="dashboard-password" className="block text-sm text-gray-300 mb-2">Password</label>
          <input
            id="dashboard-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:border-whatsapp-green"
          />
        </div>
        {!isFirebaseConfigured && (
          <p role="alert" className="text-sm text-red-400">
            Firebase client settings are missing. Configure the VITE_FIREBASE_* build variables and redeploy.
          </p>
        )}
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        <button type="submit" disabled={busy || !email || !password || !isFirebaseConfigured} className="btn-primary w-full disabled:opacity-50">
          {busy ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

export default function App() {
  const [authenticated, setAuthenticated] = React.useState(false)
  const [checkingSession, setCheckingSession] = React.useState(true)

  React.useEffect(() => {
    let active = true
    const expireSession = () => {
      signOutDashboard()
      setAuthenticated(false)
      setCheckingSession(false)
    }
    window.addEventListener('dashboard:unauthorized', expireSession)

    if (!firebaseAuth) {
      setCheckingSession(false)
    } else {
      const unsubscribe = onAuthStateChanged(firebaseAuth, async user => {
        if (!user) {
          setAuthenticated(false)
          setCheckingSession(false)
          return
        }
        try {
          await verifyDashboardSession()
          if (active) setAuthenticated(true)
        } catch {
          await signOutDashboard()
          if (active) setAuthenticated(false)
        } finally {
          if (active) setCheckingSession(false)
        }
      })
      return () => {
        active = false
        unsubscribe()
        window.removeEventListener('dashboard:unauthorized', expireSession)
      }
    }

    return () => {
      active = false
      window.removeEventListener('dashboard:unauthorized', expireSession)
    }
  }, [])

  if (checkingSession) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Checking dashboard session...</div>
  }
  if (!authenticated) return <LoginScreen />
  return <DashboardApp onSignOut={signOutDashboard} />
}

function DashboardApp({ onSignOut }) {
  const { connected, status } = useSocket()

  const stateColor = {
    ready: 'bg-green-500',
    qr: 'bg-yellow-500',
    connecting: 'bg-blue-500',
    disconnected: 'bg-red-500',
    error: 'bg-red-600',
  }[status.state] || 'bg-gray-500'

  const stateLabel = {
    ready: 'Online',
    qr: 'Scan QR',
    connecting: 'Connecting',
    disconnected: 'Offline',
    error: 'Error',
  }[status.state] || 'Unknown'

  const navItems = [
    { to: '/', label: 'Dashboard', icon: Activity, exact: true },
    { to: '/messages', label: 'Messages', icon: MessageSquare },
    { to: '/files', label: 'Files', icon: FolderOpen },
    { to: '/settings', label: 'Settings', icon: Settings },
  ]

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
        {/* Logo */}
        <div className="p-5 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-whatsapp-green rounded-xl flex items-center justify-center">
              <Bot size={22} className="text-white" />
            </div>
            <div>
              <h1 className="font-bold text-white text-base leading-tight">SK Agent</h1>
              <p className="text-gray-500 text-xs">WhatsApp Automation</p>
            </div>
          </div>
        </div>

        {/* Status Banner */}
        <div className="mx-4 mt-4 bg-gray-800 rounded-xl px-3 py-2 flex items-center gap-2">
          <span className={`status-dot ${stateColor} ${status.state === 'ready' ? 'animate-pulse-green' : ''}`} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white">{stateLabel}</p>
            {status.name && <p className="text-xs text-gray-400 truncate">{status.name}</p>}
          </div>
          {connected ? <Wifi size={14} className="text-green-400 shrink-0" /> : <WifiOff size={14} className="text-red-400 shrink-0" />}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? 'bg-whatsapp-green text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800">
          <p className="text-xs text-gray-600 text-center">SK Agent v1.0 · Local</p>
          <button onClick={onSignOut} className="mt-3 w-full flex items-center justify-center gap-2 text-xs text-gray-400 hover:text-white">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-gray-950">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/files" element={<FilesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  )
}
