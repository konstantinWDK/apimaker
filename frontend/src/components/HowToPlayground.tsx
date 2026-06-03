import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useBackendConfig } from '../lib/backendConfig'

export function HowToPlayground() {
  const { t } = useTranslation()
  const { config } = useBackendConfig()
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState<string>(t('howTo.initialMessage'))

  const steps = [
    t('howTo.step1'),
    t('howTo.step2'),
    t('howTo.step3'),
    t('howTo.step4'),
  ]

  const handleTest = async () => {
    if (!config.baseUrl) {
      setStatus('error')
      setMessage(t('howTo.configureFirst'))
      return
    }
    setStatus('loading')
    setMessage(t('howTo.testing'))
    try {
      const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/health`)
      if (!response.ok) throw new Error(t('howTo.invalidResponse'))
      const data = await response.json()
      setStatus('success')
      setMessage(`${t('howTo.backendReady')} ${data.status ?? 'ok'}`)
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : t('howTo.connectionFailed'))
    }
  }

  return (
    <div className="howto-panel">
      <div>
        <p className="label">{t('howTo.recommendedFlow')}</p>
        <ol>
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
      <div className="howto-panel__tester">
        <button type="button" className="btn primary" onClick={handleTest} disabled={status === 'loading'}>
          {status === 'loading' ? t('howTo.checking') : t('howTo.testBackend')}
        </button>
        <p className={status === 'error' ? 'error-text' : 'success-text'}>{message}</p>
        <pre className="howto-panel__snippet">curl -X GET {config.baseUrl || 'http://localhost:8000'}/projects</pre>
      </div>
    </div>
  )
}
