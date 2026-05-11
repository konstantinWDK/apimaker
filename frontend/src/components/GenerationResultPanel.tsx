import { useEffect, useRef, useState } from 'react'

import type { GenerationResult } from '../types/schemas'
import { readBackendConfig } from '../lib/backendConfig'
import { useToast } from './Toast'

interface Props {
  result: GenerationResult
  projectId: string
}

export function GenerationResultPanel({ result, projectId }: Props) {
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toast = useToast()

  useEffect(() => () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
  }, [])

  const handleCopy = (text: string) => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return
    navigator.clipboard.writeText(text)
    setCopied(true)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setCopied(false), 2000)
    toast('Copiado al portapapeles', 'info')
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const { baseUrl } = readBackendConfig()
      const cleanBase = baseUrl?.replace(/\/$/, '')
      const url = `${cleanBase}/projects/${projectId}/download`
      let token = typeof window !== 'undefined' ? window.sessionStorage.getItem('apimaker-jwt-token') : null

      if (!token) {
        toast('No hay sesión activa. Inicia sesión primero.', 'error')
        setDownloading(false)
        return
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        toast(`Error al descargar: ${res.status}`, 'error')
        setDownloading(false)
        return
      }

      const blob = await res.blob()
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `${projectId}-bundle.zip`
      link.click()
      URL.revokeObjectURL(link.href)
    } catch (err) {
      toast('Error de conexión con el backend', 'error')
    } finally {
      setDownloading(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const { baseUrl } = readBackendConfig()
      const cleanBase = baseUrl?.replace(/\/$/, '')
      const token = typeof window !== 'undefined' ? window.sessionStorage.getItem('apimaker-jwt-token') : null

      const res = await fetch(`${cleanBase}/projects/${projectId}/export`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
      if (!res.ok) throw new Error('Error al exportar')

      const data = await res.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `${projectId}-export.json`
      link.click()
      URL.revokeObjectURL(link.href)
      toast('Proyecto exportado correctamente', 'info')
    } catch (err) {
      toast('Error al exportar el proyecto', 'error')
    } finally {
      setExporting(false)
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const { baseUrl } = readBackendConfig()
      const cleanBase = baseUrl?.replace(/\/$/, '')
      const token = typeof window !== 'undefined' ? window.sessionStorage.getItem('apimaker-jwt-token') : null

      const res = await fetch(`${cleanBase}/projects/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data.datasets ? { ...data.project, datasets: data.datasets, endpoints: data.endpoints || [] } : data),
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(errText)
      }

      toast('Proyecto importado correctamente. Recarga la pagina para verlo.', 'success')
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      toast(`Error al importar: ${err instanceof Error ? err.message : 'Formato invalido'}`, 'error')
    }
  }

  const baseUrl = result.apiUrl.split('/').slice(0, -1).join('/')

  return (
    <div className="deploy-console">
      <div className="deploy-grid">
        {/* Left: Main Actions */}
        <div className="deploy-main">
          <div className="deploy-card download-card">
            <div className="card-header">
              <div className="stack-badge">
                {result.stack === 'fastapi' ? '🐍 Python' : '🟢 Node.js'}
              </div>
              <h3>Código Fuente Completo</h3>
            </div>
            <p className="card-desc">Proyecto estructurado con modelos, rutas y Docker.</p>
            <button
              type="button"
              className="btn primary btn-full btn-large"
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading ? 'Generando ZIP...' : '📥 Descargar Bundle (.zip)'}
            </button>
          </div>

          <div className="deploy-card sandbox-card">
            <p className="label">Sandbox Base URL</p>
            <div className="url-display">
              <code>{baseUrl}/...</code>
              <button className="copy-icon-btn" onClick={() => handleCopy(baseUrl)}>
                {copied ? '✅' : '📋'}
              </button>
            </div>
            <div className="card-footer-actions">
              <a className="btn ghost btn-small" href={result.docsUrl} target="_blank" rel="noreferrer">
                📚 Ver Documentación (Redoc)
              </a>
            </div>
          </div>

          <div className="deploy-card deploy-options-card">
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem' }}>Despliegue 1-click</h3>
            <div className="deploy-options">
              <div className="deploy-option">
                <div className="deploy-option__icon">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                </div>
                <div className="deploy-option__info">
                  <strong>Railway</strong>
                  <p>Conecta tu repo de GitHub y Railway detecta automaticamente el Dockerfile.</p>
                </div>
                <button className="btn ghost btn-sm" onClick={() => handleCopy('railway up')}>railway up</button>
              </div>
              <div className="deploy-option">
                <div className="deploy-option__icon">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>
                </div>
                <div className="deploy-option__info">
                  <strong>Render</strong>
                  <p>Usa el archivo <code>deploy/render.yaml</code> incluido en el bundle para deploy automatizado.</p>
                </div>
                <a className="btn ghost btn-sm" href="https://render.com/docs/deploy-blueprint" target="_blank" rel="noreferrer">Blueprint</a>
              </div>
              <div className="deploy-option">
                <div className="deploy-option__icon">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
                </div>
                <div className="deploy-option__info">
                  <strong>Docker Compose</strong>
                  <p>Usa <code>docker compose up -d</code> para levantar localmente con PostgreSQL.</p>
                </div>
                <button className="btn ghost btn-sm" onClick={() => handleCopy('docker compose up -d')}>Copiar</button>
              </div>
            </div>
          </div>

          <div className="deploy-card export-card">
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>Exportar / Importar Proyecto</h3>
            <p className="card-desc" style={{ fontSize: '0.8rem', marginBottom: '0.75rem' }}>
              Exporta el proyecto completo como JSON para compartirlo o importarlo en otra instancia.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="btn ghost btn-small" onClick={handleExport} disabled={exporting}>
                {exporting ? 'Exportando...' : '⬇ Exportar JSON'}
              </button>
              <button type="button" className="btn ghost btn-small" onClick={() => fileInputRef.current?.click()}>
                ⬆ Importar JSON
              </button>
              <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
            </div>
          </div>
        </div>

        {/* Right: Steps */}
        <div className="deploy-steps-panel">
          <h4 className="steps-title">🚀 Guía de Despliegue</h4>
          <div className="step-item">
            <div className="step-circle">1</div>
            <div className="step-content">
              <strong>Descomprimir</strong>
              <p>Extrae el ZIP en tu carpeta de proyectos.</p>
            </div>
          </div>
          <div className="step-item">
            <div className="step-circle">2</div>
            <div className="step-content">
              <strong>Instalar y Lanzar</strong>
              <div className="code-block">
                <code>./setup.sh</code>
                <button onClick={() => handleCopy('./setup.sh')}>📋</button>
              </div>
              <p className="muted-text-tiny" style={{ marginTop: '4px' }}>Si falla, usa: <code>bash setup.sh</code></p>
            </div>
          </div>
          <div className="step-item">
            <div className="step-circle">3</div>
            <div className="step-content">
              <strong>Docker Compose</strong>
              <div className="code-block">
                <code>docker compose up -d</code>
                <button onClick={() => handleCopy('docker compose up -d')}>📋</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .deploy-console {
          margin-top: 1rem;
        }
        .deploy-grid {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 1.5rem;
        }
        .deploy-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 1.5rem;
          margin-bottom: 1rem;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        }
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }
        .stack-badge {
          background: #f1f5f9;
          padding: 0.25rem 0.75rem;
          border-radius: 999px;
          font-size: 0.75rem;
          font-weight: 700;
          color: #475569;
        }
        .card-desc {
          font-size: 0.9rem;
          color: #64748b;
          margin-bottom: 1.5rem;
        }
        .btn-large {
          padding: 1rem;
          font-size: 1rem;
          font-weight: 700;
        }
        .url-display {
          background: #0f172a;
          padding: 0.75rem 1rem;
          border-radius: 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 0.5rem;
        }
        .url-display code {
          color: #38bdf8;
          font-size: 0.85rem;
        }
        .copy-icon-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 1rem;
        }
        .deploy-steps-panel {
          background: #f8fafc;
          border-radius: 16px;
          padding: 1.5rem;
          border: 1px solid #e2e8f0;
        }
        .steps-title {
          font-size: 1rem;
          margin-bottom: 1.5rem;
          color: #1e293b;
        }
        .step-item {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        .step-circle {
          width: 28px;
          height: 28px;
          background: #3b82f6;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 0.8rem;
          flex-shrink: 0;
        }
        .step-content strong {
          display: block;
          font-size: 0.9rem;
          color: #1e293b;
        }
        .step-content p {
          font-size: 0.8rem;
          color: #64748b;
          margin: 0.25rem 0;
        }
        .code-block {
          background: #1e293b;
          padding: 0.5rem 0.75rem;
          border-radius: 6px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 0.5rem;
        }
        .code-block code {
          color: #cbd5e1;
          font-size: 0.75rem;
          font-family: monospace;
        }
        .code-block button {
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
        }
        .card-footer-actions {
          margin-top: 1rem;
          display: flex;
          gap: 0.5rem;
        }
        .deploy-options-card {
          margin-bottom: 1rem;
        }
        .deploy-options {
          display: flex; flex-direction: column; gap: 0.75rem;
        }
        .deploy-option {
          display: flex; align-items: center; gap: 0.75rem;
          padding: 0.6rem 0.75rem; border: 1px solid #e2e8f0; border-radius: 8px;
          transition: border-color 0.15s;
        }
        .deploy-option:hover { border-color: #cbd5e1; }
        .deploy-option__icon { flex-shrink: 0; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: #f1f5f9; border-radius: 8px; color: #64748b; }
        .deploy-option__info { flex: 1; min-width: 0; }
        .deploy-option__info strong { display: block; font-size: 0.85rem; color: #1e293b; }
        .deploy-option__info p { font-size: 0.75rem; color: #64748b; margin: 0.15rem 0 0; }
        .deploy-option__info code { font-size: 0.7rem; background: #f1f5f9; padding: 0.1rem 0.3rem; border-radius: 3px; }
      `}</style>
    </div>
  )
}
