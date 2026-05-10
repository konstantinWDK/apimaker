import { useEffect, useState } from 'react'

import { PayloadPreview } from './PayloadPreview'
import { PreviewPanel } from './PreviewPanel'
import { GenerationResultPanel } from './GenerationResultPanel'
import { SectionCard } from './SectionCard'
import { getShareSnapshot } from '../lib/api'
import type { ProjectDraft } from '../types/schemas'
import { readBackendConfig } from '../lib/backendConfig'

type ShareStatus = 'loading' | 'ready' | 'missing' | 'error'

interface ShareData {
  project: {
    id: string
    name: string
    description: string | null
    target_stack: string
    status: string
  }
  dataset: {
    id: string
    name: string
    source_type: string
    fields: Array<{ name: string; type: string; required: boolean; description: string | null }>
  } | null
  endpoints: Array<{ id: string; name: string; method: string; path: string; summary: string | null }>
  share_id: string
  share_slug: string
  share_views: number
}

const toProjectDraft = (data: ShareData): ProjectDraft => {
  const datasetFields = data.dataset?.fields ?? []
  return {
    id: data.project.id,
    remoteId: data.project.slug || data.project.id,
    slug: data.project.slug,
    name: data.project.name,
    description: data.project.description ?? undefined,
    targetStack: data.project.target_stack as 'fastapi' | 'express' | 'nest',
    dataset: data.dataset
      ? {
          id: data.dataset.id,
          name: data.dataset.name,
          sourceType: data.dataset.source_type as 'upload' | 'manual',
          fields: datasetFields.map((f) => ({
            id: f.name,
            name: f.name,
            type: f.type as 'string' | 'integer' | 'float' | 'boolean' | 'datetime',
            required: f.required,
          })),
          sampleRows: [],
        }
      : undefined,
    endpoints: data.endpoints.map((ep) => ({
      id: ep.id,
      name: ep.name,
      method: ep.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
      path: ep.path,
      summary: ep.summary ?? undefined,
    })),
  }
}

export function ShareView() {
  const [status, setStatus] = useState<ShareStatus>('loading')
  const [shareData, setShareData] = useState<ShareData | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const segments = window.location.pathname.split('/').filter(Boolean)
    const shareId = segments[1] ?? ''
    const slug = segments[2] ?? ''
    if (!shareId || !slug) {
      setStatus('missing')
      return
    }
    getShareSnapshot(shareId, slug)
      .then((data: ShareData) => {
        setShareData(data)
        setStatus('ready')
      })
      .catch((err: Error) => {
        setErrorMsg(err.message)
        setStatus('error')
      })
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

  if (status === 'error') {
    return (
      <div className="share-shell share-shell--centered">
        <div className="share-empty-card">
          <h1>Enlace no disponible</h1>
          <p>{errorMsg || 'Este enlace expiró o requiere contraseña.'}</p>
          <button type="button" className="btn primary" onClick={handleBackToBuilder}>
            Volver al builder
          </button>
        </div>
      </div>
    )
  }

  if (status === 'missing' || !shareData) {
    return (
      <div className="share-shell share-shell--centered">
        <div className="share-empty-card">
          <h1>Enlace no encontrado</h1>
          <p>Este enlace compartido ya no existe.</p>
          <button type="button" className="btn primary" onClick={handleBackToBuilder}>
            Volver al builder
          </button>
        </div>
      </div>
    )
  }

  const project = toProjectDraft(shareData)
  const datasetFields = shareData.dataset?.fields.length ?? 0
  const { baseUrl } = readBackendConfig()
  const result = {
    apiUrl: `${baseUrl}/api/mock/${project.slug || project.id}`,
    docsUrl: `${baseUrl}/projects/${project.slug || project.id}/docs`,
    message: 'API mock generada y lista para probar',
    retentionNotice: 'Los datos del mock se reinician al detener el servidor',
    endpoints: shareData.endpoints.map((ep) => ({
      id: ep.id,
      method: ep.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
      path: ep.path,
      name: ep.name,
      description: ep.summary ?? '',
    })),
    shareUrl: `${baseUrl}/share/${shareData.share_id}/${shareData.share_slug}`,
    projectName: shareData.project.name,
  }

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
            <span>{shareData.share_views} vistas</span>
          </div>
        </div>
        <div className="share-hero__actions">
          <button type="button" className="btn ghost" onClick={handleBackToBuilder}>
            Abrir builder
          </button>
          <a className="btn primary" href={result.shareUrl} target="_blank" rel="noreferrer">
            Abrir enlace público
          </a>
        </div>
      </header>

      <div className="share-summary">
        <div>
          <p className="label">Campos</p>
          <p className="share-summary__value">{datasetFields}</p>
        </div>
        <div>
          <p className="label">Vistas</p>
          <p className="share-summary__value">{shareData.share_views}</p>
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
          <GenerationResultPanel result={result} projectId={shareData.project.id} />
        </SectionCard>
      </div>
    </div>
  )
}
