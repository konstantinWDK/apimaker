import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { ProjectDraft } from '../types/schemas'
import { syncProjectWithBackend } from '../lib/api'
import { useBackendConfig } from '../lib/backendConfig'
import { SecurityOptions } from './SecurityOptions'

interface Props {
  project: ProjectDraft
  onSynced: (remoteId: string) => void
}

export function BackendSyncCard({ project, onSynced }: Props) {
  const { t } = useTranslation()
  const { config } = useBackendConfig()
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const docsBaseUrl = config.baseUrl?.replace(/\/$/, '')
  const docsUrl = project.remoteId && docsBaseUrl ? `${docsBaseUrl}/projects/${project.remoteId}/docs` : null
  const openapiUrl = project.remoteId && docsBaseUrl ? `${docsBaseUrl}/projects/${project.remoteId}/openapi.json` : null
  const sandboxUrl = project.remoteId && docsBaseUrl ? `${docsBaseUrl}/api/${project.remoteId}${project.endpoints[0]?.path ?? '/records'}` : ''

  const handleSync = async () => {
    setStatus('loading')
    setMessage(null)
    try {
      const result = await syncProjectWithBackend(project)
      onSynced(result.remoteId)
      setStatus('success')
      setMessage(t('backendSync.synced'))
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : t('backendSync.syncFailed'))
    }
  }

  const isConfigured = Boolean(config.baseUrl)

  return (
    <div className="backend-sync">
      <p className="muted-text">
        {t('backendSync.description')}
      </p>
      <div className="backend-sync__actions">
        <button type="button" className="btn primary" onClick={handleSync} disabled={!isConfigured || status === 'loading'}>
          {status === 'loading' ? t('backendSync.syncing') : t('backendSync.syncButton')}
        </button>
        {!isConfigured ? <p className="muted-text">{t('backendSync.notConfigured')}</p> : null}
      </div>
      {message ? <p className={status === 'error' ? 'error-text' : 'success-text'}>{message}</p> : null}
      {docsUrl ? (
        <div className="backend-sync__links">
          <a className="link" href={docsUrl} target="_blank" rel="noreferrer">
            {t('backendSync.viewDocs')}
          </a>
          <a className="link" href={openapiUrl ?? undefined} target="_blank" rel="noreferrer">
            {t('backendSync.downloadOpenapi')}
          </a>
        </div>
      ) : null}
      <SecurityOptions docsUrl={docsUrl ?? ''} sandboxUrl={sandboxUrl} />
    </div>
  )
}
