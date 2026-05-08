import { useEffect, useRef, useState } from 'react'

import type { GenerationResult } from '../types/schemas'

interface Props {
  result: GenerationResult
}

export function GenerationResultPanel({ result }: Props) {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
  }, [])

  const handleCopyShare = async () => {
    if (!result.shareUrl || typeof navigator === 'undefined' || !navigator.clipboard) return
    try {
      await navigator.clipboard.writeText(result.shareUrl)
      setCopied(true)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
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
      <p className="muted-text">{result.retentionNotice}</p>

      {result.shareUrl ? (
        <div className="result-panel__share">
          <p className="label">Enlace compartible</p>
          <div className="share-input">
            <input type="text" value={result.shareUrl} readOnly />
            <button type="button" className="btn ghost btn-small" onClick={handleCopyShare}>
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
