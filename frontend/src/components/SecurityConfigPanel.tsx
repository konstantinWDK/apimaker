import { useTranslation } from 'react-i18next'
import type { ProjectDraft } from '../types/schemas'

interface Props {
  project: ProjectDraft
  onChange: (payload: Partial<ProjectDraft>) => void
}

export function SecurityConfigPanel({ project, onChange }: Props) {
  const { t } = useTranslation()

  const handleChange = (name: string, value: any) => {
    onChange({ [name]: value })
  }

  return (
    <div className="security-config">
      <div className="form-grid">
        <label className="form-field">
          <span className="label">{t('securityConfig.authMethod')}</span>
          <select
            className="field"
            value={project.authMethod || 'none'}
            onChange={(e) => handleChange('authMethod', e.target.value)}
          >
            <option value="none">{t('securityConfig.authNone')}</option>
            <option value="apikey">{t('securityConfig.authApiKey')}</option>
            <option value="jwt">{t('securityConfig.authJwt')}</option>
          </select>
        </label>

        {project.authMethod === 'apikey' && (
          <label className="form-field">
            <span className="label">{t('securityConfig.apiKey')}</span>
            <input
              className="field"
              value={project.apiKey || ''}
              onChange={(e) => handleChange('apiKey', e.target.value)}
              placeholder={t('securityConfig.apiKeyPlaceholder')}
            />
            <p className="muted-text" style={{ fontSize: '0.75rem', marginTop: '0.3rem' }}>
              {t('securityConfig.apiKeyHint')} <code>X-API-Key</code>.
            </p>
          </label>
        )}

        {project.authMethod === 'jwt' && (
          <label className="form-field">
            <span className="label">{t('securityConfig.jwtSecret')}</span>
            <input
              className="field"
              value={project.jwtSecret || ''}
              onChange={(e) => handleChange('jwtSecret', e.target.value)}
              placeholder={t('securityConfig.jwtSecretPlaceholder')}
            />
            <p className="muted-text" style={{ fontSize: '0.75rem', marginTop: '0.3rem' }}>
              {t('securityConfig.jwtHint')} <code>Authorization: Bearer &lt;token&gt;</code>.
            </p>
          </label>
        )}

        <label className="form-field">
          <span className="label">{t('securityConfig.rateLimit')}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="number"
              className="field"
              style={{ width: '100px' }}
              value={project.rateLimit || ''}
              onChange={(e) => handleChange('rateLimit', e.target.value ? parseInt(e.target.value, 10) : undefined)}
              placeholder="0"
            />
            <span className="muted-text">{t('securityConfig.rateLimitUnit')}</span>
          </div>
          <p className="muted-text" style={{ fontSize: '0.75rem', marginTop: '0.3rem' }}>
            {t('securityConfig.rateLimitHint')}
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
