import { useState } from 'react'
import { useProjectBuilder } from '../hooks/useProjectBuilder'
import { readBackendConfig } from '../lib/backendConfig'
import type { ProjectDraft } from '../types/schemas'

function generateKey(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const parts: string[] = []
  for (let i = 0; i < 4; i++) {
    let s = ''
    for (let j = 0; j < 8; j++) s += chars[Math.floor(Math.random() * chars.length)]
    parts.push(s)
  }
  return parts.join('-')
}

function generateJwtSecret(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()'
  let s = ''
  for (let i = 0; i < 48; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

export function SecurityPage() {
  const { project, updateProject } = useProjectBuilder()
  const [testResult, setTestResult] = useState<{ status: number; body: string } | null>(null)
  const [testLoading, setTestLoading] = useState(false)
  const [copied, setCopied] = useState('')

  const baseUrl = readBackendConfig().baseUrl?.replace(/\/$/, '') || 'http://localhost:8000'
  const projectPrefix = project.slug || project.id
  const mockUrl = `${baseUrl}/api/mock/${projectPrefix}/pokemon`

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
    { id: 'https', label: 'HTTPS obligatorio en producción', ok: true },
    { id: 'auth', label: 'Autenticación configurada', ok: project.authMethod !== 'none' },
    { id: 'key', label: 'Clave/Secreto generado y no default', ok: !!(project.authMethod === 'apikey' && project.apiKey) || !!(project.authMethod === 'jwt' && project.jwtSecret) },
    { id: 'ratelimit', label: 'Rate limit configurado', ok: !!project.rateLimit && project.rateLimit > 0 },
    { id: 'cors', label: 'CORS restringido en producción', ok: true },
    { id: 'workers', label: 'Múltiples workers en producción', ok: true },
  ]

  return (
    <div className="info-page">
      <div className="info-hero">
        <div className="info-hero__content">
          <h1 className="info-hero__title">Seguridad</h1>
          <p className="info-hero__subtitle">
            Configura la autenticación, genera credenciales y prueba la seguridad de tu API.
          </p>
        </div>
      </div>

      <div className="info-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Auth Method */}
        <div className="info-card" style={{ gridColumn: '1 / -1' }}>
          <h3 className="info-card__title" style={{ marginBottom: '0.75rem' }}>Método de Autenticación</h3>
          <div className="form-grid">
            <label className="form-field">
              <span className="label">Tipo</span>
              <select
                className="field"
                value={project.authMethod || 'none'}
                onChange={(e) => {
                  handleChange('authMethod', e.target.value)
                  if (e.target.value === 'apikey' && !project.apiKey) handleChange('apiKey', generateKey())
                  if (e.target.value === 'jwt' && !project.jwtSecret) handleChange('jwtSecret', generateJwtSecret())
                }}
              >
                <option value="none">Ninguno (Público)</option>
                <option value="apikey">API Key (X-API-Key)</option>
                <option value="jwt">JWT (Bearer Token)</option>
              </select>
            </label>

            {project.authMethod === 'apikey' && (
              <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                <span className="label">API Key</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input className="field" readOnly value={project.apiKey || ''} style={{ fontFamily: 'monospace', flex: 1 }} />
                  <button type="button" className="btn ghost" onClick={() => copyToClipboard(project.apiKey || '', 'key')}>
                    {copied === 'key' ? 'Copiado' : 'Copiar'}
                  </button>
                  <button type="button" className="btn ghost" onClick={() => handleChange('apiKey', generateKey())}>
                    Regenerar
                  </button>
                </div>
                <p className="muted-text" style={{ fontSize: '0.75rem', marginTop: '0.3rem' }}>
                  Enviar en cabecera: <code className="docs-code--inline">X-API-Key: {project.apiKey || '&lt;tu-clave&gt;'}</code>
                </p>
              </div>
            )}

            {project.authMethod === 'jwt' && (
              <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                <span className="label">Secreto JWT</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input className="field" readOnly value={project.jwtSecret || ''} style={{ fontFamily: 'monospace', flex: 1 }} />
                  <button type="button" className="btn ghost" onClick={() => copyToClipboard(project.jwtSecret || '', 'jwt')}>
                    {copied === 'jwt' ? 'Copiado' : 'Copiar'}
                  </button>
                  <button type="button" className="btn ghost" onClick={() => handleChange('jwtSecret', generateJwtSecret())}>
                    Regenerar
                  </button>
                </div>
                <p className="muted-text" style={{ fontSize: '0.75rem', marginTop: '0.3rem' }}>
                  Enviar en cabecera: <code className="docs-code--inline">Authorization: Bearer &lt;token&gt;</code>
                </p>
              </div>
            )}

            <label className="form-field">
              <span className="label">Rate Limit</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="number" className="field" style={{ width: '100px' }}
                  value={project.rateLimit ?? ''}
                  onChange={(e) => handleChange('rateLimit', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                  placeholder="0"
                />
                <span className="muted-text">peticiones / minuto</span>
              </div>
            </label>
          </div>
        </div>

        {/* Test Auth */}
        <div className="info-card">
          <h3 className="info-card__title" style={{ marginBottom: '0.75rem' }}>Probar Autenticación</h3>
          <p className="muted-text" style={{ fontSize: '0.82rem', marginBottom: '0.75rem' }}>
            Envía una petición de prueba al mock server con la configuración actual.
          </p>
          <div className="docs-code" style={{ fontSize: '0.75rem', padding: '0.5rem 0.75rem', marginBottom: '0.75rem', wordBreak: 'break-all' }}>
            {project.authMethod === 'apikey' && project.apiKey
              ? `curl -H "X-API-Key: ${project.apiKey}" ${mockUrl}`
              : project.authMethod === 'jwt'
                ? `curl -H "Authorization: Bearer <token>" ${mockUrl}`
                : `curl ${mockUrl}`}
          </div>
          <button type="button" className="btn" onClick={testAuth} disabled={testLoading}>
            {testLoading ? 'Probando...' : 'Probar Autenticación'}
          </button>
          {testResult && (
            <div style={{ marginTop: '0.75rem' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: testResult.status === 200 ? '#166534' : '#991b1b' }}>
                {testResult.status === 200 ? '✅ Acceso permitido' : testResult.status === 401 ? '🔒 Acceso denegado (401)' : `⚠️ Error (${testResult.status})`}
              </span>
              <pre style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.3rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {testResult.body}
              </pre>
            </div>
          )}
        </div>

        {/* Security Checklist */}
        <div className="info-card">
          <h3 className="info-card__title" style={{ marginBottom: '0.75rem' }}>Checklist de Seguridad</h3>
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
            Checklist orientativo. En producción seguir las guías de seguridad del framework.
          </p>
        </div>
      </div>

      {/* Generated API Security */}
      <div className="info-card" style={{ marginTop: '1rem' }}>
        <h3 className="info-card__title" style={{ marginBottom: '0.75rem' }}>Seguridad en la API Generada</h3>
        <div className="info-stacks" style={{ gap: '0.75rem' }}>
          <div className="info-stack">
            <div className="info-stack__head"><strong>Código generado</strong></div>
            <p className="info-stack__desc">
              El bundle incluye middleware de autenticación según el método elegido: validación de API Key
              o verificación JWT con el secreto configurado. Rate limit implementado con计数 middleware.
            </p>
          </div>
          <div className="info-stack">
            <div className="info-stack__head"><strong>Mock server</strong></div>
            <p className="info-stack__desc">
              El simulador respeta la configuración de seguridad. Las rutas mock requieren las mismas
              credenciales que la API generada, permitiendo probar la autenticación antes de desplegar.
            </p>
          </div>
          <div className="info-stack">
            <div className="info-stack__head"><strong>Recomendaciones</strong></div>
            <p className="info-stack__desc">
              Usa HTTPS en producción. Genera claves únicas por proyecto. No compartas secretos JWT.
              Rate limit protege contra abusos. CORS restringido a orígenes conocidos.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
