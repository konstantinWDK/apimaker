import { useCallback, useEffect, useState } from 'react'

import { readBackendConfig } from '../lib/backendConfig'

const TOKEN_STORAGE_KEY = 'apimaker-jwt-token'
const USER_STORAGE_KEY = 'apimaker-jwt-user'

const buildUrl = (path: string) => {
  const config = readBackendConfig()
  const base = config.baseUrl?.trim()
  if (base) {
    return `${base.replace(/\/$/, '')}${path}`
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${path}`
  }
  return path
}

const readToken = (): string | null => {
  if (typeof window === 'undefined') return null
  return window.sessionStorage.getItem(TOKEN_STORAGE_KEY)
}

const readUser = (): { username: string; role: string } | null => {
  if (typeof window === 'undefined') return null
  const raw = window.sessionStorage.getItem(USER_STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const apiFetch = async (path: string, init?: RequestInit) => {
  const token = readToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const response = await fetch(buildUrl(path), {
    ...init,
    headers: { ...headers, ...(init?.headers as Record<string, string> || {}) },
  })
  if (!response.ok) {
    const message = await response.text()
    try {
      const parsed = JSON.parse(message)
      throw new Error(typeof parsed.detail === 'string' ? parsed.detail : message)
    } catch {
      throw new Error(message || 'Error al contactar el backend')
    }
  }
  return response
}

interface AuthStatus {
  username: string
  mustChange: boolean
}

interface JwtUser {
  id: string
  username: string
  email: string | null
  role: string
}

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => !!readToken())
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<AuthStatus>(() => {
    const user = readUser()
    return {
      username: user?.username || 'admin',
      mustChange: user?.username === 'admin' || false,
    }
  })
  const [currentUser, setCurrentUser] = useState<JwtUser | null>(() => {
    const user = readUser()
    if (!user) return null
    return { id: '', ...user, email: null }
  })

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(buildUrl('/auth/status'))
      if (!response.ok) return
      const data = await response.json()
      // New format: { hasUsers, userCount }
      if (!data.hasUsers) {
        setStatus({ username: '', mustChange: false })
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const login = async (username: string, password: string) => {
    try {
      const response = await apiFetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await response.json()
      // Store JWT tokens
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(TOKEN_STORAGE_KEY, data.access_token)
        window.sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user))
      }
      setCurrentUser(data.user)
      setStatus({ username: data.user.username, mustChange: false })
      setIsAuthenticated(true)
      setError(null)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Credenciales incorrectas')
      setIsAuthenticated(false)
      return false
    }
  }

  const logout = () => {
    setIsAuthenticated(false)
    setCurrentUser(null)
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(TOKEN_STORAGE_KEY)
      window.sessionStorage.removeItem(USER_STORAGE_KEY)
    }
  }

  const updateCredentials = async (newPassword: string, currentPassword: string) => {
    await apiFetch('/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    })
  }

  const resetCredentials = async () => {
    try {
      await apiFetch('/auth/reset', { method: 'POST' })
      logout()
    } catch {
      // If reset fails, just logout locally
      logout()
    }
  }

  return {
    isAuthenticated,
    error,
    login,
    logout,
    updateCredentials,
    resetCredentials,
    resetError: () => setError(null),
    authStatus: status,
    currentUser,
    getToken: () => readToken(),
  }
}
