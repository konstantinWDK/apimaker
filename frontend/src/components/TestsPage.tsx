import { useState } from 'react'
import { useProjectBuilder } from '../hooks/useProjectBuilder'
import { readBackendConfig } from '../lib/backendConfig'
import { TestRunnerPanel } from './TestRunnerPanel'

interface TestResult {
  name: string
  status: 'passed' | 'failed' | 'pending' | 'running'
  message?: string
}

export function TestsPage() {
  const { project, mockRunning, checkMockStatus } = useProjectBuilder()
  const [results, setResults] = useState<TestResult[]>([
    { name: 'Conexión con Backend', status: 'pending' },
    { name: 'Estado del Mock Server', status: 'pending' },
    { name: 'Integridad de Datasets', status: 'pending' },
    { name: 'Respuesta de Endpoints (Smoke Test)', status: 'pending' },
  ])
  const [isRunning, setIsRunning] = useState(false)

  const runTests = async () => {
    setIsRunning(true)
    const newResults: TestResult[] = [...results]
    const config = readBackendConfig()
    const baseUrl = config.baseUrl?.replace(/\/$/, '')

    // 1. Backend Connection
    newResults[0] = { name: 'Conexión con Backend', status: 'running' }
    setResults([...newResults])
    try {
      const res = await fetch(`${baseUrl}/health`)
      newResults[0] = { 
        name: 'Conexión con Backend', 
        status: res.ok ? 'passed' : 'failed',
        message: res.ok ? 'Conexión establecida correctamente' : 'El backend devolvió un error'
      }
    } catch (e) {
      newResults[0] = { name: 'Conexión con Backend', status: 'failed', message: 'No se pudo contactar con el servidor' }
    }
    setResults([...newResults])

    // 2. Mock Server Status
    newResults[1] = { name: 'Estado del Mock Server', status: 'running' }
    setResults([...newResults])
    await checkMockStatus()
    newResults[1] = { 
      name: 'Estado del Mock Server', 
      status: mockRunning ? 'passed' : 'failed',
      message: mockRunning ? 'El servidor de mocks está activo' : 'El servidor de mocks está apagado o no responde'
    }
    setResults([...newResults])

    // 3. Datasets Integrity
    newResults[2] = { name: 'Integridad de Datasets', status: 'running' }
    setResults([...newResults])
    const hasDatasets = project.datasets.length > 0
    const hasFields = project.datasets.every(ds => ds.fields.length > 0)
    newResults[2] = { 
      name: 'Integridad de Datasets', 
      status: (hasDatasets && hasFields) ? 'passed' : 'failed',
      message: hasDatasets 
        ? (hasFields ? 'Todos los datasets tienen campos definidos' : 'Hay datasets sin campos') 
        : 'No hay datasets definidos en el proyecto'
    }
    setResults([...newResults])

    // 4. Smoke Test (End-to-End lite)
    if (mockRunning && project.datasets.length > 0) {
      newResults[3] = { name: 'Respuesta de Endpoints (Smoke Test)', status: 'running' }
      setResults([...newResults])
      try {
        // Check if mock endpoints respond
        const testRes = await fetch(`${baseUrl}/projects/${project.remoteId || project.id}/mock/status`)
        newResults[3] = { 
          name: 'Respuesta de Endpoints (Smoke Test)', 
          status: testRes.ok ? 'passed' : 'failed',
          message: testRes.ok ? 'El endpoint de estado responde correctamente' : 'El mock server devolvió un error 500'
        }
      } catch {
        newResults[3] = { name: 'Respuesta de Endpoints (Smoke Test)', status: 'failed', message: 'Error de red al contactar el mock' }
      }
    } else {
      newResults[3] = { 
        name: 'Respuesta de Endpoints (Smoke Test)', 
        status: 'failed', 
        message: 'Requiere que el Live Mode esté activo y existan datasets' 
      }
    }
    setResults([...newResults])
    setIsRunning(false)
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Centro de Pruebas (Health Check)</h1>
          <p className="page-subtitle">Verifica el estado de salud de tu proyecto y los servicios asociados.</p>
        </div>
        <button 
          className={`btn primary ${isRunning ? 'loading' : ''}`} 
          onClick={runTests}
          disabled={isRunning}
        >
          {isRunning ? 'Ejecutando...' : 'Ejecutar Diagnóstico'}
        </button>
      </div>

      <div className="tests-grid">
        {results.map((test, i) => (
          <div key={i} className={`test-card ${test.status}`}>
            <div className="test-header">
              <span className={`test-badge ${test.status}`}>
                {test.status === 'passed' && 'PASSED'}
                {test.status === 'failed' && 'FAILED'}
                {test.status === 'running' && 'RUNNING'}
                {test.status === 'pending' && 'PENDING'}
              </span>
              <h3 className="test-name">{test.name}</h3>
            </div>
            {test.message && <p className="test-message">{test.message}</p>}
          </div>
        ))}
      </div>

      <div className="info-card" style={{ marginTop: '2rem' }}>
        <h3>Tests del Sistema (Backend)</h3>
        <TestRunnerPanel />
      </div>

      <div className="info-card" style={{ marginTop: '2rem' }}>
        <h3>Acerca de los Tests</h3>
        <p>
          Esta pantalla realiza pruebas funcionales sobre el estado actual de tu entorno. 
          Los <strong>Unit Tests</strong> del código fuente (Vitest) se ejecutan de forma independiente 
          desde la terminal para asegurar la integridad del core de la aplicación.
        </p>
        <div className="code-block">
          <code>cd frontend && npm run test</code>
        </div>
      </div>

      <style>{`
        .tests-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
          margin-top: 2rem;
        }
        .test-card {
          background: white;
          padding: 1.5rem;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          transition: all 0.2s ease;
        }
        .test-card.passed { border-left: 4px solid #10b981; }
        .test-card.failed { border-left: 4px solid #ef4444; }
        .test-card.running { border-left: 4px solid #3b82f6; animation: pulse 1.5s infinite; }
        
        .test-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 0.5rem;
        }
        .test-badge {
          font-size: 0.7rem;
          font-weight: 700;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          text-transform: uppercase;
        }
        .test-badge.passed { background: #d1fae5; color: #065f46; }
        .test-badge.failed { background: #fee2e2; color: #991b1b; }
        .test-badge.pending { background: #f1f5f9; color: #475569; }
        .test-badge.running { background: #dbeafe; color: #1e40af; }
        
        .test-name { margin: 0; font-size: 1rem; color: #1e293b; }
        .test-message { font-size: 0.85rem; color: #64748b; margin: 0.5rem 0 0; }
        
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.6; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
