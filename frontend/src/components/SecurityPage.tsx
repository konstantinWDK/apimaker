import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useProjectBuilder } from '../hooks/useProjectBuilder'
import { readBackendConfig } from '../lib/backendConfig'
import type { ProjectDraft } from '../types/schemas'

function generateKey(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => chars[byte % chars.length]).join('')
}

function generateJwtSecret(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()'
  const array = new Uint8Array(48)
  crypto.getRandomValues(array)
  return Array.from(array, byte => chars[byte % chars.length]).join('')
}

export function SecurityPage() {
  const { t } = useTranslation()
  const { project, updateProject } = useProjectBuilder()
  const [testResult, setTestResult] = useState<{ status: number; body: string } | null>(null)
  const [testLoading, setTestLoading] = useState(false)
  const [copied, setCopied] = useState('')

  const baseUrl = readBackendConfig().baseUrl?.replace(/\/$/, '') || 'http://localhost:8000'
  const projectPrefix = project.remoteId || project.slug || project.id
  const firstEndpoint = project.endpoints[0]
  const endpointPath = firstEndpoint?.path || '/'
  const mockUrl = `${baseUrl}/api/mock/${projectPrefix}${endpointPath}`

  const handleChange = (field: string, value: unknown) => {
    updateProject({ [field]: value } as Partial<ProjectDraft>)
  }

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      setTimeout(() => setCopied(''), 2000)
    } catch { /* ignore */ }
  }

  const testAuth = async () => {
    setTestLoading(true)
    setTestResult(null)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (project.authMethod === 'apikey' && project.apiKey) {
        headers['X-API-Key'] = project.apiKey
      } else if (project.authMethod === 'jwt') {
        headers['Authorization'] = 'Bearer test-token'
      }
      const res = await fetch(mockUrl, { headers })
      const body = await res.text()
      setTestResult({ status: res.status, body: body.slice(0, 300) })
    } catch (e) {
      setTestResult({ status: 0, body: String(e) })
    }
    setTestLoading(false)
  }

  const checklist = [
    { id: 'https', label: t('security.checklistHttps'), ok: true },
    { id: 'auth', label: t('security.checklistAuth'), ok: project.authMethod !== 'none' },
    { id: 'key', label: t('security.checklistKey'), ok: !!(project.authMethod === 'apikey' && project.apiKey) || !!(project.authMethod === 'jwt' && project.jwtSecret) },
    { id: 'ratelimit', label: t('security.checklistRateLimit'), ok: !!project.rateLimit && project.rateLimit > 0 },
    { id: 'cors', label: t('security.checklistCors'), ok: true },
    { id: 'workers', label: t('security.checklistWorkers'), ok: true },
  ]

  return (
    <div className="info-page">
      <div className="info-hero">
        <div className="info-hero__content">
          <h1 className="info-hero__title">{t('security.title')}</h1>
          <p className="info-hero__subtitle">
            {t('security.subtitle')}
          </p>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.25rem' }}>
            {t('security.project')}: <strong style={{ color: '#e2e8f0' }}>{project.name || t('security.unnamed')}</strong>
            {projectPrefix && <span style={{ marginLeft: '0.5rem' }}>— ID: <code style={{ color: '#94a3b8' }}>{projectPrefix}</code></span>}
          </p>
        </div>
      </div>

      <div className="info-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Auth Method */}
        <div className="info-card" style={{ gridColumn: '1 / -1' }}>
          <h3 className="info-card__title" style={{ marginBottom: '0.75rem' }}>{t('security.authMethodTitle')}</h3>
          <p className="muted-text" style={{ fontSize: '0.82rem', marginBottom: '1rem' }}>
            {t('security.authMethodDesc')} <strong>{project.name}</strong>.
          </p>
          <div className="form-grid">
            <label className="form-field">
              <span className="label">{t('security.type')}</span>
              <select
                className="field"
                value={project.authMethod || 'none'}
                onChange={(e) => {
                  handleChange('authMethod', e.target.value)
                  if (e.target.value === 'apikey' && !project.apiKey) handleChange('apiKey', generateKey())
                  if (e.target.value === 'jwt' && !project.jwtSecret) handleChange('jwtSecret', generateJwtSecret())
                }}
              >
                <option value="none">{t('security.authNone')}</option>
                <option value="apikey">{t('security.authApiKey')}</option>
                <option value="jwt">{t('security.authJwt')}</option>
              </select>
            </label>

            {project.authMethod === 'apikey' && (
              <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                <span className="label">{t('security.apiKey')}</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input className="field" readOnly value={project.apiKey || ''} style={{ fontFamily: 'monospace', flex: 1 }} />
                  <button type="button" className="btn ghost" onClick={() => copyToClipboard(project.apiKey || '', 'key')}>
                    {copied === 'key' ? t('security.copied') : t('security.copy')}
                  </button>
                  <button type="button" className="btn ghost" onClick={() => handleChange('apiKey', generateKey())}>
                    {t('security.regenerate')}
                  </button>
                </div>
                <p className="muted-text" style={{ fontSize: '0.75rem', marginTop: '0.3rem' }}>
                  {t('security.sendInHeader')}: <code className="docs-code--inline">X-API-Key: {project.apiKey || t('security.yourKey')}</code>
                </p>
              </div>
            )}

            {project.authMethod === 'jwt' && (
              <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                <span className="label">{t('security.jwtSecret')}</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input className="field" readOnly value={project.jwtSecret || ''} style={{ fontFamily: 'monospace', flex: 1 }} />
                  <button type="button" className="btn ghost" onClick={() => copyToClipboard(project.jwtSecret || '', 'jwt')}>
                    {copied === 'jwt' ? t('security.copied') : t('security.copy')}
                  </button>
                  <button type="button" className="btn ghost" onClick={() => handleChange('jwtSecret', generateJwtSecret())}>
                    {t('security.regenerate')}
                  </button>
                </div>
                <p className="muted-text" style={{ fontSize: '0.75rem', marginTop: '0.3rem' }}>
                  {t('security.sendInHeader')}: <code className="docs-code--inline">Authorization: Bearer &lt;token&gt;</code>
                </p>
              </div>
            )}

            <label className="form-field">
              <span className="label">{t('security.rateLimit')}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="number" className="field" style={{ width: '100px' }}
                  value={project.rateLimit ?? ''}
                  onChange={(e) => handleChange('rateLimit', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                  placeholder="0"
                />
                <span className="muted-text">{t('security.rateLimitUnit')}</span>
              </div>
            </label>
          </div>
        </div>

        {/* Test Auth */}
        <div className="info-card">
          <h3 className="info-card__title" style={{ marginBottom: '0.75rem' }}>{t('security.testAuthTitle')}</h3>
          <p className="muted-text" style={{ fontSize: '0.82rem', marginBottom: '0.75rem' }}>
            {t('security.testAuthDesc')}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <div className="form-field" style={{ margin: 0 }}>
              <span className="label">{t('security.project')}</span>
              <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{project.name || '—'}</span>
            </div>
            <div className="form-field" style={{ margin: 0 }}>
              <span className="label">{t('security.testEndpoint')}</span>
              <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', wordBreak: 'break-all' }}>{mockUrl}</span>
            </div>
            <div className="form-field" style={{ margin: 0 }}>
              <span className="label">{t('security.authMethod')}</span>
              <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                {project.authMethod === 'apikey' ? t('security.authApiKeyLabel') :
                 project.authMethod === 'jwt' ? t('security.authJwtLabel') :
                 project.authMethod === 'basic' ? 'Basic Auth' : t('security.authNoneLabel')}
              </span>
            </div>
          </div>

          <div className="docs-code" style={{ fontSize: '0.75rem', padding: '0.5rem 0.75rem', marginBottom: '0.75rem', wordBreak: 'break-all' }}>
            {project.authMethod === 'apikey' && project.apiKey
              ? `curl -H "X-API-Key: ${project.apiKey}" ${mockUrl}`
              : project.authMethod === 'jwt'
                ? `curl -H "Authorization: Bearer <token>" ${mockUrl}`
                : `curl ${mockUrl}`}
          </div>
          <button type="button" className="btn" onClick={testAuth} disabled={testLoading}>
            {testLoading ? t('security.testing') : t('security.testAuth')}
          </button>
          {testResult && (
            <div style={{ marginTop: '0.75rem' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: testResult.status === 200 ? '#166534' : '#991b1b' }}>
                {testResult.status === 200 ? ` ${t('security.accessGranted')}` : testResult.status === 401 ? ` ${t('security.accessDenied')}` : ` ${t('security.error')} (${testResult.status})`}
              </span>
              <pre style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.3rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {testResult.body}
              </pre>
            </div>
          )}
        </div>

        {/* Security Checklist */}
        <div className="info-card">
          <h3 className="info-card__title" style={{ marginBottom: '0.75rem' }}>{t('security.checklistTitle')}</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {checklist.map(item => (
              <li key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.4rem 0', fontSize: '0.82rem',
                color: item.ok ? '#166534' : '#92400e',
              }}>
                <span style={{ fontWeight: 700 }}>{item.ok ? '✓' : '○'}</span>
                {item.label}
              </li>
            ))}
          </ul>
          <p className="muted-text" style={{ fontSize: '0.75rem', marginTop: '0.75rem' }}>
            {t('security.checklistHint')}
          </p>
        </div>
      </div>

      {/* Generated API Security */}
      <div className="info-card" style={{ marginTop: '1rem' }}>
        <h3 className="info-card__title" style={{ marginBottom: '0.75rem' }}>{t('security.generatedApiTitle')}</h3>
        <div className="info-stacks" style={{ gap: '0.75rem' }}>
          <div className="info-stack">
            <div className="info-stack__head"><strong>{t('security.generatedCode')}</strong></div>
            <p className="info-stack__desc">
              {t('security.generatedCodeDesc')}
            </p>
          </div>
          <div className="info-stack">
            <div className="info-stack__head"><strong>{t('security.mockServer')}</strong></div>
            <p className="info-stack__desc">
              {t('security.mockServerDesc')}
            </p>
          </div>
          <div className="info-stack">
            <div className="info-stack__head"><strong>{t('security.recommendations')}</strong></div>
            <p className="info-stack__desc">
              {t('security.recommendationsDesc')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
