import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { GenerationResult } from '../types/schemas'
import { readBackendConfig } from '../lib/backendConfig'
import { useToast } from './Toast'

interface Props {
  result: GenerationResult
  projectId: string
}

export function GenerationResultPanel({ result, projectId }: Props) {
  const { t } = useTranslation()
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
    toast(t('generation.copiedToClipboard'), 'info')
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const { baseUrl } = readBackendConfig()
      const cleanBase = baseUrl?.replace(/\/$/, '')
      const url = `${cleanBase}/projects/${projectId}/download`
      let token = typeof window !== 'undefined' ? window.sessionStorage.getItem('doapi-jwt-token') : null

      if (!token) {
        toast(t('generation.noSession'), 'error')
        setDownloading(false)
        return
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        toast(t('generation.downloadError').replace('{status}', String(res.status)), 'error')
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
      toast(t('generation.connectionError'), 'error')
    } finally {
      setDownloading(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const { baseUrl } = readBackendConfig()
      const cleanBase = baseUrl?.replace(/\/$/, '')
      const token = typeof window !== 'undefined' ? window.sessionStorage.getItem('doapi-jwt-token') : null

      const res = await fetch(`${cleanBase}/projects/${projectId}/export`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
      if (!res.ok) throw new Error(t('generation.exportError'))

      const data = await res.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `${projectId}-export.json`
      link.click()
      URL.revokeObjectURL(link.href)
      toast(t('generation.exportSuccess'), 'info')
    } catch (err) {
      toast(t('generation.exportFail'), 'error')
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
      const token = typeof window !== 'undefined' ? window.sessionStorage.getItem('doapi-jwt-token') : null

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

      toast(t('generation.importSuccess'), 'success')
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      toast(t('generation.importError').replace('{msg}', err instanceof Error ? err.message : t('generation.invalidFormat')), 'error')
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
                {result.stack === 'fastapi' ? ' Python' : ' Node.js'}
              </div>
              <h3>{t('generation.sourceCode')}</h3>
            </div>
            <p className="card-desc">{t('generation.sourceCodeDesc')}</p>
            <button
              type="button"
              className="btn primary btn-full btn-large"
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading ? t('generation.generatingZip') : t('generation.downloadBundle')}
            </button>
          </div>

          <div className="deploy-card sandbox-card">
            <p className="label">{t('generation.sandboxUrl')}</p>
            <div className="url-display">
              <code>{baseUrl}/...</code>
              <button className="copy-icon-btn" onClick={() => handleCopy(baseUrl)}>
                {copied ? '' : ''}
              </button>
            </div>
            <div className="card-footer-actions">
              <a className="btn ghost btn-small" href={result.docsUrl} target="_blank" rel="noreferrer">
                {t('generation.viewDocs')}
              </a>
            </div>
          </div>

          <div className="deploy-card deploy-options-card">
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem' }}>{t('generation.oneClickDeploy')}</h3>
            <div className="deploy-options">
              <div className="deploy-option">
                <div className="deploy-option__icon">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                </div>
                <div className="deploy-option__info">
                  <strong>Railway</strong>
                  <p>{t('generation.railwayDesc')}</p>
                </div>
                <button className="btn ghost btn-sm" onClick={() => handleCopy('railway up')}>railway up</button>
              </div>
              <div className="deploy-option">
                <div className="deploy-option__icon">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>
                </div>
                <div className="deploy-option__info">
                  <strong>Render</strong>
                  <p>{t('generation.renderDesc')}</p>
                </div>
                <a className="btn ghost btn-sm" href="https://render.com/docs/deploy-blueprint" target="_blank" rel="noreferrer">{t('generation.blueprint')}</a>
              </div>
              <div className="deploy-option">
                <div className="deploy-option__icon">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
                </div>
                <div className="deploy-option__info">
                  <strong>Docker Compose</strong>
                  <p>{t('generation.composeDesc')}</p>
                </div>
                <button className="btn ghost btn-sm" onClick={() => handleCopy('docker compose up -d')}>{t('generation.copy')}</button>
              </div>
            </div>
          </div>

          <div className="deploy-card export-card">
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>{t('generation.exportImport')}</h3>
            <p className="card-desc" style={{ fontSize: '0.8rem', marginBottom: '0.75rem' }}>
              {t('generation.exportImportDesc')}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="btn ghost btn-small" onClick={handleExport} disabled={exporting}>
                {exporting ? t('generation.exporting') : t('generation.exportJson')}
              </button>
              <button type="button" className="btn ghost btn-small" onClick={() => fileInputRef.current?.click()}>
                {t('generation.importJson')}
              </button>
              <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
            </div>
          </div>
        </div>

        {/* Right: Steps */}
        <div className="deploy-steps-panel">
          <h4 className="steps-title">{t('generation.deployGuide')}</h4>
          <div className="step-item">
            <div className="step-circle">1</div>
            <div className="step-content">
              <strong>{t('generation.step1Title')}</strong>
              <p>{t('generation.step1Desc')}</p>
            </div>
          </div>
          <div className="step-item">
            <div className="step-circle">2</div>
            <div className="step-content">
              <strong>{t('generation.step2Title')}</strong>
              <div className="code-block">
                <code>./setup.sh</code>
                <button onClick={() => handleCopy('./setup.sh')}></button>
              </div>
              <p className="muted-text-tiny" style={{ marginTop: '4px' }}>{t('generation.step2Hint')} <code>bash setup.sh</code></p>
            </div>
          </div>
          <div className="step-item">
            <div className="step-circle">3</div>
            <div className="step-content">
              <strong>{t('generation.step3Title')}</strong>
              <div className="code-block">
                <code>docker compose up -d</code>
                <button onClick={() => handleCopy('docker compose up -d')}></button>
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
