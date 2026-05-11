import { useState } from 'react'

import { useBackendConfig } from '../lib/backendConfig'

const steps = [
  'Configura la URL y el token del backend en esta vista',
  'Define dataset y endpoints en las pestañas superiores',
  'Sincroniza en “Payload & Entrega” y revisa la pestaña “API generada”',
  'Comparte la URL de Redoc o descarga el openapi.json',
]

export function HowToPlayground() {
  const { config } = useBackendConfig()
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState<string>('Pulsa para verificar la conexión con tu backend')

  const handleTest = async () => {
    if (!config.baseUrl) {
      setStatus('error')
      setMessage('Configura primero la URL del backend')
      return
    }
    setStatus('loading')
    setMessage('Probando /health...')
    try {
      const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/health`)
      if (!response.ok) throw new Error('Respuesta no válida')
      const data = await response.json()
      setStatus('success')
      setMessage(`Backend listo: ${data.status ?? 'ok'}`)
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'No se pudo conectar con el backend')
    }
  }

  return (
    <div className="howto-panel">
      <div>
        <p className="label">Flujo recomendado</p>
        <ol>
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
      <div className="howto-panel__tester">
        <button type="button" className="btn primary" onClick={handleTest} disabled={status === 'loading'}>
          {status === 'loading' ? 'Comprobando...' : 'Probar backend'}
        </button>
        <p className={status === 'error' ? 'error-text' : 'success-text'}>{message}</p>
        <pre className="howto-panel__snippet">curl -X GET {config.baseUrl || 'http://localhost:8000'}/projects</pre>
      </div>
    </div>
  )
}
