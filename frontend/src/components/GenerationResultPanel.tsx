import { useEffect, useRef, useState } from 'react'

import type { GenerationResult } from '../types/schemas'
import { readBackendConfig } from '../lib/backendConfig'

interface Props {
  result: GenerationResult
  projectId: string
}

export function GenerationResultPanel({ result, projectId }: Props) {
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(result.shareUrl || null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
  }, [])

  const handleCopyShare = async () => {
    const url = shareUrl || result.shareUrl
    if (!url || typeof navigator === 'undefined' || !navigator.clipboard) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const [shareError, setShareError] = useState<string | null>(null)

  const handleCreateShare = async () => {
    setSharing(true)
    setShareError(null)
    try {
      const { baseUrl } = readBackendConfig()
      const cleanBase = baseUrl?.replace(/\/$/, '')
      if (!cleanBase) {
        setShareError('Configura la URL del backend primero')
        return
      }
      let token = typeof window !== 'undefined' ? window.sessionStorage.getItem('apimaker-jwt-token') : null
      if (!token) {
        const loginRes = await fetch(`${cleanBase}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'admin', password: 'admin' }),
        })
        if (!loginRes.ok) {
          setShareError(`No se pudo autenticar: ${loginRes.statusText}`)
          return
        }
        const loginData = await loginRes.json()
        if (loginData.access_token && typeof window !== 'undefined') {
          window.sessionStorage.setItem('apimaker-jwt-token', loginData.access_token)
          token = loginData.access_token
        }
      }
      const res = await fetch(`${cleanBase}/share/projects/${projectId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ expires_days: 30 }),
      })
      const data = await res.json()
      if (!res.ok) {
        setShareError(data.detail || 'Error al crear el enlace')
        return
      }
      if (data.url) {
        setShareUrl(`${cleanBase}${data.url}`)
      } else {
        setShareError('No se recibió URL del enlace')
      }
    } catch (err: unknown) {
      setShareError(err instanceof Error ? err.message : 'Error de conexión')
    } finally {
      setSharing(false)
    }
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const { baseUrl } = readBackendConfig()
      const cleanBase = baseUrl?.replace(/\/$/, '')
      const url = `${cleanBase}/projects/${projectId}/download`
      let token = typeof window !== 'undefined' ? window.sessionStorage.getItem('apimaker-jwt-token') : null

      console.log('[Download] Token exists:', !!token, 'Base:', cleanBase)

      // Auto-login: try stored credentials first, then admin/admin
      const storedCreds = typeof window !== 'undefined' ? window.sessionStorage.getItem('apimaker-creds') : null
      const creds = storedCreds ? JSON.parse(storedCreds) : null
      const loginBody = creds || { username: 'admin', password: 'admin' }
      const loginRes = await fetch(`${cleanBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginBody),
      })

      if (loginRes.ok) {
        const loginData = await loginRes.json()
        if (loginData.access_token && typeof window !== 'undefined') {
          window.sessionStorage.setItem('apimaker-jwt-token', loginData.access_token)
          token = loginData.access_token
          console.log('[Download] Auto-login OK, token set')
        }
      } else {
        console.log('[Download] Auto-login failed, status:', loginRes.status)
      }

      if (!token) {
        // Try one more time with manual password entry
        const manualPw = prompt('Introduce tu contraseña de administrador:')
        if (!manualPw) { setDownloading(false); return }
        const storedUser = typeof window !== 'undefined' ? window.sessionStorage.getItem('apimaker-jwt-user') : null
        const username = storedUser ? JSON.parse(storedUser).username : 'admin'
        const retryLogin = await fetch(`${cleanBase}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password: manualPw }),
        })
        if (!retryLogin.ok) {
          alert('Contraseña incorrecta. La contraseña por defecto es: admin')
          setDownloading(false)
          return
        }
        const loginData = await retryLogin.json()
        if (loginData.access_token && typeof window !== 'undefined') {
          window.sessionStorage.setItem('apimaker-jwt-token', loginData.access_token)
          token = loginData.access_token
        }
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        const errText = await res.text()
        console.error('[Download] Download failed:', res.status, errText)
        alert(`Error al descargar: ${res.status} - ${errText}`)
        setDownloading(false)
        return
      }

      const blob = await res.blob()
      triggerDownload(blob, `${projectId}-bundle.zip`)
    } catch (err) {
      console.error('[Download] Exception:', err)
      alert('Error de conexión. Asegúrate de que el backend está activo.')
    } finally {
      setDownloading(false)
    }
  }

  const triggerDownload = (blob: Blob, filename: string) => {
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <div className="result-panel">
      <div className="result-panel__highlight">
        <div>
          <p className="label">Sandbox URL</p>
          <p className="result-panel__link">{result.apiUrl}</p>
        </div>
        <div>
          <p className="label">Documentación</p>
          <a className="link" href={result.docsUrl} target="_blank" rel="noreferrer">
            Abrir Redoc
          </a>
        </div>
      </div>

      {/* Download button */}
      <div className="result-panel__download">
        <button
          type="button"
          className="btn primary btn-full"
          onClick={handleDownload}
          disabled={downloading}
        >
          {downloading ? 'Descargando...' : 'Descargar bundle (.zip)'}
        </button>
        <p className="muted-text" style={{ fontSize: '0.8rem', marginTop: '0.4rem', textAlign: 'center' }}>
          Código FastAPI listo para desplegar con Docker o VPS
        </p>
      </div>

      <p className="muted-text">{result.retentionNotice}</p>

      {/* Share section */}
      <div className="result-panel__share">
        <p className="label">Enlace compartible</p>
        {shareError && <p className="error-text" style={{ fontSize: '0.82rem' }}>{shareError}</p>}
        {!shareUrl ? (
          <button
            type="button"
            className="btn ghost btn-small btn-full"
            onClick={handleCreateShare}
            disabled={sharing}
          >
            {sharing ? 'Creando enlace...' : 'Crear enlace para compartir'}
          </button>
        ) : (
          <div className="share-input">
            <input type="text" value={shareUrl} readOnly />
            <button type="button" className="btn ghost btn-small" onClick={handleCopyShare}>
              {copied ? '✓' : 'Copiar'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
