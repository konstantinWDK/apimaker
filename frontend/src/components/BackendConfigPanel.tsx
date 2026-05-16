import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useBackendConfig } from '../lib/backendConfig'

export function BackendConfigPanel() {
  const { t } = useTranslation()
  const { config, updateConfig } = useBackendConfig()
  const [form, setForm] = useState(config)

  const handleChange = (key: 'baseUrl' | 'apiKey', value: string) => {
    const next = { ...form, [key]: value }
    setForm(next)
    updateConfig(next)
  }

  return (
    <div className="backend-config">
      <div className="form-field">
        <label className="label" htmlFor="backend-base-url">
          {t('backendConfig.urlLabel')}
        </label>
        <input
          id="backend-base-url"
          type="text"
          value={form.baseUrl}
          onChange={(event) => handleChange('baseUrl', event.target.value)}
          placeholder="http://localhost:8000"
        />
      </div>
      <div className="form-field">
        <label className="label" htmlFor="backend-token">
          {t('backendConfig.apiKeyLabel')}
        </label>
        <input
          id="backend-token"
          type="password"
          value={form.apiKey}
          onChange={(event) => handleChange('apiKey', event.target.value)}
          placeholder={t('backendConfig.apiKeyPlaceholder')}
        />
      </div>
      <p className="muted-text">
        {t('backendConfig.hint')}
      </p>
    </div>
  )
}
