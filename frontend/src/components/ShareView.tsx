import { useEffect, useState } from 'react'

import { PayloadPreview } from './PayloadPreview'
import { PreviewPanel } from './PreviewPanel'
import { GenerationResultPanel } from './GenerationResultPanel'
import { SectionCard } from './SectionCard'
import { getShareSnapshot, type ShareSnapshot } from '../lib/shareStorage'

type ShareStatus = 'loading' | 'ready' | 'missing'

const formatDate = (value?: string) => {
  if (!value) return 'sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'sin fecha'
  return date.toLocaleString()
}

export function ShareView() {
  const [status, setStatus] = useState<ShareStatus>('loading')
  const [snapshot, setSnapshot] = useState<ShareSnapshot | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const segments = window.location.pathname.split('/').filter(Boolean)
    const shareId = segments[1] ?? ''
    if (!shareId) {
      setStatus('missing')
      return
    }
    const found = getShareSnapshot(shareId)
    if (!found) {
      setStatus('missing')
      return
    }
    if (segments[2] && segments[2] !== found.slug) {
      window.history.replaceState(null, '', `/share/${found.id}/${found.slug}`)
    }
    setSnapshot(found)
    setStatus('ready')
  }, [])

  const handleBackToBuilder = () => {
    if (typeof window === 'undefined') return
    window.location.href = '/'
  }

  if (status === 'loading') {
    return (
      <div className="share-shell share-shell--centered">
        <div className="share-empty-card">
          <p className="muted-text">Cargando enlace compartido...</p>
        </div>
      </div>
    )
  }

  if (status === 'missing' || !snapshot) {
    return (
      <div className="share-shell share-shell--centered">
        <div className="share-empty-card">
          <h1>Enlace no disponible</h1>
          <p>Este enlace compartido ya expiró o nunca fue generado en este navegador.</p>
          <button type="button" className="btn primary" onClick={handleBackToBuilder}>
            Volver al builder
          </button>
        </div>
      </div>
    )
  }

  const { project, result, createdAt } = snapshot
  const datasetFields = project.dataset?.fields.length ?? 0
  const datasetRows = project.dataset?.sampleRows?.length ?? 0

  return (
    <div className="share-shell">
      <header className="share-hero">
        <div>
          <p className="share-hero__eyebrow">API compartida</p>
          <h1 className="share-hero__title">{project.name}</h1>
          {project.description ? <p className="share-hero__copy">{project.description}</p> : null}
          <div className="share-hero__meta">
            <span>{project.targetStack}</span>
            <span>{project.endpoints.length} endpoints</span>
            <span>Última generación {formatDate(createdAt)}</span>
          </div>
        </div>
        <div className="share-hero__actions">
          <button type="button" className="btn ghost" onClick={handleBackToBuilder}>
            Abrir builder
          </button>
          {result.shareUrl ? (
            <a className="btn primary" href={result.shareUrl} target="_blank" rel="noreferrer">
              Abrir enlace público
            </a>
          ) : null}
        </div>
      </header>

      <div className="share-summary">
        <div>
          <p className="label">Campos</p>
          <p className="share-summary__value">{datasetFields}</p>
        </div>
        <div>
          <p className="label">Muestras</p>
          <p className="share-summary__value">{datasetRows}</p>
        </div>
        <div>
          <p className="label">Endpoints</p>
          <p className="share-summary__value">{project.endpoints.length}</p>
        </div>
      </div>

      <div className="share-grid">
        <SectionCard title="Dataset" subtitle="Vista previa del dataset adjunto" accent="sky" fullWidth>
          <PreviewPanel project={project} />
        </SectionCard>

        <SectionCard title="Payload estimado" subtitle="JSON base que entrega la API">
          <PayloadPreview project={project} />
        </SectionCard>

        <SectionCard title="API generada" subtitle="Endpoints y sandbox" fullWidth>
          <GenerationResultPanel result={result} />
        </SectionCard>
      </div>
    </div>
  )
}
