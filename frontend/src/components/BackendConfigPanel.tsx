import { useState } from 'react'

import { useBackendConfig } from '../lib/backendConfig'

export function BackendConfigPanel() {
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
          URL del backend
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
          X-API-Key (opcional)
        </label>
        <input
          id="backend-token"
          type="password"
          value={form.apiKey}
          onChange={(event) => handleChange('apiKey', event.target.value)}
          placeholder="Introduce tu token"
        />
      </div>
      <p className="muted-text">
        Estas preferencias se guardan en tu navegador. Usa una URL accesible desde donde estés ejecutando el builder.
      </p>
    </div>
  )
}
