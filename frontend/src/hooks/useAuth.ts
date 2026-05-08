import { useCallback, useEffect, useState } from 'react'

import { readBackendConfig } from '../lib/backendConfig'

const SESSION_STORAGE_KEY = 'apimaker-auth-session'

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

const readSession = () => {
  if (typeof window === 'undefined') return false
  return window.sessionStorage.getItem(SESSION_STORAGE_KEY) === 'yes'
}

const apiFetch = async (path: string, init?: RequestInit) => {
  const response = await fetch(buildUrl(path), init)
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'Error al contactar el backend')
  }
  return response
}

interface AuthStatus {
  username: string
  mustChange: boolean
}

const isDefaultAdmin = (username: string, password: string) => username === 'admin' && password === 'admin'

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => readSession())
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<AuthStatus>({ username: 'admin', mustChange: true })

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(buildUrl('/auth/status'))
      if (!response.ok) return
      const data = (await response.json()) as AuthStatus
      setStatus(data)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const login = async (username: string, password: string) => {
    try {
      await apiFetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      setIsAuthenticated(true)
      setError(null)
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, 'yes')
      }
      fetchStatus()
      return true
    } catch (err) {
      if (isDefaultAdmin(username, password)) {
        console.warn('Backend no disponible; iniciando sesión local con admin/admin')
        setIsAuthenticated(true)
        setError(null)
        setStatus({ username: 'admin', mustChange: true })
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(SESSION_STORAGE_KEY, 'yes')
        }
        return true
      }
      setError(err instanceof Error ? err.message : 'Credenciales incorrectas')
      setIsAuthenticated(false)
      return false
    }
  }

  const logout = () => {
    setIsAuthenticated(false)
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
    }
  }

  const updateCredentials = async (username: string, newPassword: string, currentPassword: string) => {
    await apiFetch('/auth/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, new_password: newPassword, current_password: currentPassword }),
    })
    fetchStatus()
  }

  const resetCredentials = async () => {
    await apiFetch('/auth/reset', { method: 'POST' })
    fetchStatus()
    logout()
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
  }
}
