import { useEffect, useState } from 'react'

const STORAGE_KEY = 'apimaker-backend-config'

export interface BackendConfig {
  baseUrl: string
  apiKey: string
}

const defaultConfig: BackendConfig = {
  baseUrl: 'http://localhost:8000',
  apiKey: '',
}

export const readBackendConfig = (): BackendConfig => {
  if (typeof window === 'undefined') return defaultConfig
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return defaultConfig
  try {
    const parsed = JSON.parse(raw) as BackendConfig
    return { ...defaultConfig, ...parsed }
  } catch {
    return defaultConfig
  }
}

export const saveBackendConfig = (config: BackendConfig) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export const useBackendConfig = () => {
  const [config, setConfig] = useState<BackendConfig>(() => readBackendConfig())

  useEffect(() => {
    setConfig(readBackendConfig())
  }, [])

  const updateConfig = (next: BackendConfig) => {
    setConfig(next)
    saveBackendConfig(next)
  }

  return { config, updateConfig }
}
