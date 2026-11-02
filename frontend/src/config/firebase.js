import { getApps, initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDGowMCwWeusueo-77jmn5u2wHJRWG5N8U',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'whtapp-automation.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'whtapp-automation',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'whtapp-automation.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '144595856372',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:144595856372:web:712de53793c1b533c8a7a1',
}

export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean)
const app = isFirebaseConfigured
  ? (getApps()[0] || initializeApp(firebaseConfig))
  : null

export const firebaseAuth = app ? getAuth(app) : null
