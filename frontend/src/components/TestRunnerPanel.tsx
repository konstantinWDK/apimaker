import { useState } from 'react'
import { readBackendConfig } from '../lib/backendConfig'

interface TestResult {
  success: boolean
  output: string
  passed: number
  failed: number
  total: number
}

const TEST_FILES = [
  { id: 'health', name: 'Health Check', file: 'tests/test_health.py', desc: 'Verifica que el backend responde correctamente' },
  { id: 'auth', name: 'Autenticación', file: 'tests/test_auth.py', desc: 'Registro, login, refresh token y validación de credenciales' },
  { id: 'generator', name: 'Generador de código', file: 'tests/test_generator.py', desc: 'Renderizado de templates FastAPI, Express y NestJS con datos de prueba' },
]

export function TestRunnerPanel() {
  const [results, setResults] = useState<Record<string, TestResult | 'running' | null>>({})
  const [running, setRunning] = useState<string | null>(null)

  const runTest = async (testId: string) => {
    setRunning(testId)
    setResults(prev => ({ ...prev, [testId]: 'running' }))
    try {
      const token = typeof window !== 'undefined' ? window.sessionStorage.getItem('apimaker-jwt-token') : null
      const baseUrl = readBackendConfig().baseUrl?.replace(/\/$/, '') || 'http://localhost:8000'
      const res = await fetch(`${baseUrl}/admin/run-tests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
      const data = await res.json()
      setResults(prev => ({ ...prev, [testId]: data }))
    } catch (e) {
      setResults(prev => ({
        ...prev,
        [testId]: { success: false, output: String(e), passed: 0, failed: 0, total: 0 },
      }))
    } finally {
      setRunning(null)
    }
  }

  const runAll = async () => {
    for (const t of TEST_FILES) {
      await runTest(t.id)
    }
  }

  const allDone = TEST_FILES.every(t => results[t.id] && results[t.id] !== 'running')
  const totalPassed = TEST_FILES.reduce((acc, t) => {
    const r = results[t.id]
    return acc + (r && r !== 'running' ? (r as TestResult).passed : 0)
  }, 0)
  const totalFailed = TEST_FILES.reduce((acc, t) => {
    const r = results[t.id]
    return acc + (r && r !== 'running' ? (r as TestResult).failed : 0)
  }, 0)

  return (
    <div className="test-runner">
      <div className="test-runner__header">
        <p className="test-runner__desc">
          Ejecuta los tests del backend para verificar que los componentes principales funcionan correctamente.
          Cada archivo de prueba cubre un area especifica del sistema.
        </p>
      </div>

      {allDone && (
        <div className={`test-runner__global ${totalFailed === 0 ? 'pass' : 'fail'}`}>
          <span className="test-runner__global-icon">{totalFailed === 0 ? '✓' : '✗'}</span>
          <span>{totalFailed === 0 ? 'Todos los tests pasaron' : `${totalFailed} test(s) fallaron`}</span>
          <span className="test-runner__global-counts">{totalPassed} passed / {totalFailed} failed</span>
        </div>
      )}

      <button type="button" className="btn primary" onClick={runAll} disabled={running !== null}>
        {running !== null ? 'Ejecutando...' : 'Ejecutar todos'}
      </button>

      <div className="test-runner__list">
        {TEST_FILES.map((t) => {
          const res = results[t.id]
          const isRunning = res === 'running'
          const done = res && res !== 'running'

          return (
            <div key={t.id} className={`test-item ${done ? (res as TestResult).success ? 'pass' : 'fail' : ''} ${isRunning ? 'running' : ''}`}>
              <div className="test-item__head">
                <div className="test-item__info">
                  <span className="test-item__name">{t.name}</span>
                  <span className="test-item__file">{t.file}</span>
                </div>
                <div className="test-item__status">
                  {isRunning && <span className="test-item__spinner" />}
                  {done && (
                    <span className={`test-item__badge ${(res as TestResult).success ? 'pass' : 'fail'}`}>
                      {(res as TestResult).success ? 'PASÓ' : 'FALLÓ'}
                    </span>
                  )}
                  {done && (
                    <span className="test-item__counts">
                      {(res as TestResult).passed}/{(res as TestResult).total}
                    </span>
                  )}
                  {!done && !isRunning && (
                    <button type="button" className="btn ghost btn-sm" onClick={() => runTest(t.id)}>
                      Ejecutar
                    </button>
                  )}
                </div>
              </div>
              <p className="test-item__desc">{t.desc}</p>
              {done && (res as TestResult).output && (
                <details className="test-item__details">
                  <summary>Ver salida</summary>
                  <pre className="test-item__output">{(res as TestResult).output}</pre>
                </details>
              )}
            </div>
          )
        })}
      </div>

      <style>{`
        .test-runner { padding: 0.5rem 0; }
        .test-runner__desc { color: #64748b; font-size: 0.85rem; margin: 0 0 1rem; }
        .test-runner__global {
          display: flex; align-items: center; gap: 0.75rem;
          padding: 0.75rem 1rem; border-radius: 8px; margin-bottom: 1rem;
          font-weight: 600; font-size: 0.9rem;
        }
        .test-runner__global.pass { background: #f0fdf4; border: 1px solid #bbf7d0; color: #16a34a; }
        .test-runner__global.fail { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; }
        .test-runner__global-icon { font-size: 1.2rem; }
        .test-runner__global-counts { margin-left: auto; font-weight: 400; color: #64748b; }
        .test-runner__list { margin-top: 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
        .test-item {
          border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem;
          transition: border-color 0.15s;
        }
        .test-item.pass { border-color: #bbf7d0; background: #fafdfb; }
        .test-item.fail { border-color: #fecaca; background: #fefafb; }
        .test-item.running { border-color: #bfdbfe; background: #f8faff; }
        .test-item__head { display: flex; justify-content: space-between; align-items: center; }
        .test-item__info { display: flex; flex-direction: column; gap: 0.15rem; }
        .test-item__name { font-weight: 600; font-size: 0.9rem; color: #1e293b; }
        .test-item__file { font-size: 0.75rem; color: #94a3b8; font-family: monospace; }
        .test-item__status { display: flex; align-items: center; gap: 0.5rem; }
        .test-item__badge {
          font-size: 0.7rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 4px;
        }
        .test-item__badge.pass { background: #bbf7d0; color: #166534; }
        .test-item__badge.fail { background: #fecaca; color: #991b1b; }
        .test-item__counts { font-size: 0.8rem; color: #64748b; font-weight: 600; }
        .test-item__desc { font-size: 0.8rem; color: #64748b; margin: 0.4rem 0 0; }
        .test-item__details { margin-top: 0.5rem; }
        .test-item__details summary { font-size: 0.8rem; color: #3b82f6; cursor: pointer; }
        .test-item__output {
          margin-top: 0.5rem; background: #1e293b; color: #e2e8f0;
          padding: 0.75rem; border-radius: 6px; font-size: 0.75rem;
          max-height: 300px; overflow: auto; white-space: pre-wrap; word-break: break-all;
        }
        .test-item__spinner {
          width: 16px; height: 16px; border: 2px solid #bfdbfe;
          border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.6s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
