import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

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
  datasets: Array<{
    id: string
    name: string
    source_type: string
    fields: Array<{ name: string; type: string; required: boolean; description: string | null }>
  }>
  endpoints: Array<{ id: string; name: string; method: string; path: string; summary: string | null }>
  share_id: string
  share_slug: string
  share_views: number
}

const toProjectDraft = (data: any): ProjectDraft => {
  return {
    id: data.project.id,
    remoteId: (data.project as any).slug || data.project.id,
    slug: (data.project as any).slug,
    name: data.project.name,
    description: data.project.description ?? undefined,
    authMethod: 'none',
    targetStack: data.project.target_stack as 'fastapi' | 'express' | 'nest',
    datasets: (data.datasets || []).map((ds: any) => ({
      id: ds.id,
      name: ds.name,
      sourceType: ds.source_type as 'upload' | 'manual' | 'database',
      fields: (ds.fields || []).map((f: any) => ({
        id: f.name,
        name: f.name,
        type: f.type as 'string' | 'integer' | 'float' | 'boolean' | 'datetime',
        required: f.required,
      })),
      sampleRows: [],
    })),
    endpoints: data.endpoints.map((ep: any) => ({
      id: ep.id,
      name: ep.name,
      method: ep.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
      path: ep.path,
      summary: ep.summary ?? undefined,
    })),
  }
}

export function ShareView() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<ShareStatus>('loading')
  const [shareData, setShareData] = useState<ShareData | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [passwordRequired, setPasswordRequired] = useState(false)
  const [sharePassword, setSharePassword] = useState('')
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const segments = window.location.pathname.split('/').filter(Boolean)
    const shareId = segments[1] ?? ''
    const slug = segments[2] ?? ''
    if (!shareId || !slug) {
      setStatus('missing')
      return
    }
    fetchSnapshot(shareId, slug)
  }, [])

  const fetchSnapshot = async (shareId: string, slug: string, password?: string) => {
    try {
      const data = await getShareSnapshot(shareId, slug, password)
      setShareData(data)
      setStatus('ready')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('share.unknownError')
      if (message.toLowerCase().includes('password')) {
        setPasswordRequired(true)
        setStatus('error')
        setErrorMsg(t('share.passwordProtected'))
      } else {
        setErrorMsg(message)
        setStatus('error')
      }
    }
  }

  const handleUnlock = () => {
    if (typeof window === 'undefined') return
    const segments = window.location.pathname.split('/').filter(Boolean)
    const shareId = segments[1] ?? ''
    const slug = segments[2] ?? ''
    if (!sharePassword) {
      setPasswordError(t('share.enterPassword'))
      return
    }
    setPasswordError('')
    fetchSnapshot(shareId, slug, sharePassword)
  }

  const handleBackToBuilder = () => {
    if (typeof window === 'undefined') return
    window.location.href = '/'
  }

  if (status === 'loading') {
    return (
      <div className="share-shell share-shell--centered">
        <div className="share-empty-card">
          <p className="muted-text">{t('share.loading')}</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="share-shell share-shell--centered">
        <div className="share-empty-card">
          <h1>{t('share.notAvailable')}</h1>
          {passwordRequired ? (
            <>
              <p>{errorMsg}</p>
              <div className="share-password-form">
                <input
                  type="password"
                  placeholder={t('share.linkPassword')}
                  value={sharePassword}
                  onChange={e => setSharePassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleUnlock()}
                />
                {passwordError && <p className="error-text">{passwordError}</p>}
                <button type="button" className="btn primary" onClick={handleUnlock}>
                  {t('share.unlock')}
                </button>
              </div>
            </>
          ) : (
            <p>{errorMsg || t('share.expiredOrPassword')}</p>
          )}
          <button type="button" className="btn ghost" onClick={handleBackToBuilder}>
            {t('share.backToBuilder')}
          </button>
        </div>
      </div>
    )
  }

  if (status === 'missing' || !shareData) {
    return (
      <div className="share-shell share-shell--centered">
        <div className="share-empty-card">
          <h1>{t('share.notFound')}</h1>
          <p>{t('share.noLongerExists')}</p>
          <button type="button" className="btn primary" onClick={handleBackToBuilder}>
            {t('share.backToBuilder')}
          </button>
        </div>
      </div>
    )
  }

  const project = toProjectDraft(shareData)
  const datasetFields = shareData.datasets?.reduce((acc, ds) => acc + (ds.fields?.length ?? 0), 0) ?? 0
  const { baseUrl } = readBackendConfig()
  const result = {
    apiUrl: `${baseUrl}/api/mock/${project.slug || project.id}`,
    docsUrl: `${baseUrl}/projects/${project.slug || project.id}/docs`,
    message: t('share.mockReady'),
    retentionNotice: t('share.mockRetention'),
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
          <p className="share-hero__eyebrow">{t('share.sharedApi')}</p>
          <h1 className="share-hero__title">{project.name}</h1>
          {project.description ? <p className="share-hero__copy">{project.description}</p> : null}
          <div className="share-hero__meta">
            <span>{project.targetStack}</span>
            <span>{project.endpoints.length} {t('share.endpoints')}</span>
            <span>{shareData.share_views} {t('share.views')}</span>
          </div>
        </div>
        <div className="share-hero__actions">
          <button type="button" className="btn ghost" onClick={handleBackToBuilder}>
            {t('share.openBuilder')}
          </button>
          <a className="btn primary" href={result.shareUrl} target="_blank" rel="noreferrer">
            {t('share.openPublicLink')}
          </a>
        </div>
      </header>

      <div className="share-summary">
        <div>
          <p className="label">{t('share.fields')}</p>
          <p className="share-summary__value">{datasetFields}</p>
        </div>
        <div>
          <p className="label">{t('share.views')}</p>
          <p className="share-summary__value">{shareData.share_views}</p>
        </div>
        <div>
          <p className="label">{t('share.endpoints')}</p>
          <p className="share-summary__value">{project.endpoints.length}</p>
        </div>
      </div>

      <div className="share-grid">
        <SectionCard title={t('share.datasetTitle')} subtitle={t('share.datasetSubtitle')} accent="sky" fullWidth>
          <PreviewPanel project={project} />
        </SectionCard>

        <SectionCard title={t('share.payloadTitle')} subtitle={t('share.payloadSubtitle')}>
          <PayloadPreview project={project} />
        </SectionCard>

        <SectionCard title={t('share.apiGeneratedTitle')} subtitle={t('share.apiGeneratedSubtitle')} fullWidth>
          <GenerationResultPanel result={result} projectId={shareData.project.id} />
        </SectionCard>
      </div>
    </div>
  )
}
