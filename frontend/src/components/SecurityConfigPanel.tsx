import type { ProjectDraft } from '../types/schemas'

interface Props {
  project: ProjectDraft
  onChange: (payload: Partial<ProjectDraft>) => void
}

export function SecurityConfigPanel({ project, onChange }: Props) {
  const handleChange = (name: string, value: any) => {
    onChange({ [name]: value })
  }

  return (
    <div className="security-config">
      <div className="form-grid">
        <label className="form-field">
          <span className="label">Método de Autenticación</span>
          <select
            className="field"
            value={project.authMethod || 'none'}
            onChange={(e) => handleChange('authMethod', e.target.value)}
          >
            <option value="none">Ninguno (Público)</option>
            <option value="apikey">API Key (X-API-Key header)</option>
            <option value="jwt">JWT (Bearer Token)</option>
          </select>
        </label>

        {project.authMethod === 'apikey' && (
          <label className="form-field">
            <span className="label">Clave de API</span>
            <input
              className="field"
              value={project.apiKey || ''}
              onChange={(e) => handleChange('apiKey', e.target.value)}
              placeholder="ej: secreto-123"
            />
            <p className="muted-text" style={{ fontSize: '0.75rem', marginTop: '0.3rem' }}>
              Los clientes deben enviar esta clave en la cabecera <code>X-API-Key</code>.
            </p>
          </label>
        )}

        {project.authMethod === 'jwt' && (
          <label className="form-field">
            <span className="label">Secreto JWT</span>
            <input
              className="field"
              value={project.jwtSecret || ''}
              onChange={(e) => handleChange('jwtSecret', e.target.value)}
              placeholder="ej: clave-secreta-para-firmar-tokens"
            />
            <p className="muted-text" style={{ fontSize: '0.75rem', marginTop: '0.3rem' }}>
              Secreto utilizado para firmar y verificar los tokens JWT. Se requiere cabecera <code>Authorization: Bearer &lt;token&gt;</code>.
            </p>
          </label>
        )}

        <label className="form-field">
          <span className="label">Límite de Peticiones (Rate Limit)</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="number"
              className="field"
              style={{ width: '100px' }}
              value={project.rateLimit || ''}
              onChange={(e) => handleChange('rateLimit', e.target.value ? parseInt(e.target.value, 10) : undefined)}
              placeholder="0"
            />
            <span className="muted-text">peticiones / minuto</span>
          </div>
          <p className="muted-text" style={{ fontSize: '0.75rem', marginTop: '0.3rem' }}>
            Deja vacío o pon 0 para desactivar el límite.
          </p>
        </label>
      </div>

      <style>{`
        .security-config {
          padding: 0.5rem 0;
        }
      `}</style>
    </div>
  )
}
