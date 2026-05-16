import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useProjectBuilder } from '../hooks/useProjectBuilder'
import { readBackendConfig } from '../lib/backendConfig'
import { TestRunnerPanel } from './TestRunnerPanel'

interface TestResult {
  name: string
  status: 'passed' | 'failed' | 'pending' | 'running'
  message?: string
}

export function TestsPage() {
  const { t } = useTranslation()
  const { project, mockRunning, checkMockStatus } = useProjectBuilder()
  const [results, setResults] = useState<TestResult[]>([
    { name: t('tests.test1Name'), status: 'pending' },
    { name: t('tests.test2Name'), status: 'pending' },
    { name: t('tests.test3Name'), status: 'pending' },
    { name: t('tests.test4Name'), status: 'pending' },
  ])
  const [isRunning, setIsRunning] = useState(false)

  const runTests = async () => {
    setIsRunning(true)
    const newResults: TestResult[] = [...results]
    const config = readBackendConfig()
    const baseUrl = config.baseUrl?.replace(/\/$/, '')

    // 1. Backend Connection
    newResults[0] = { name: t('tests.test1Name'), status: 'running' }
    setResults([...newResults])
    try {
      const res = await fetch(`${baseUrl}/health`)
      newResults[0] = { 
        name: t('tests.test1Name'), 
        status: res.ok ? 'passed' : 'failed',
        message: res.ok ? t('tests.test1Pass') : t('tests.test1Fail')
      }
    } catch (e) {
      newResults[0] = { name: t('tests.test1Name'), status: 'failed', message: t('tests.test1Error') }
    }
    setResults([...newResults])

    // 2. Mock Server Status
    newResults[1] = { name: t('tests.test2Name'), status: 'running' }
    setResults([...newResults])
    await checkMockStatus()
    newResults[1] = { 
      name: t('tests.test2Name'), 
      status: mockRunning ? 'passed' : 'failed',
      message: mockRunning ? t('tests.test2Pass') : t('tests.test2Fail')
    }
    setResults([...newResults])

    // 3. Datasets Integrity
    newResults[2] = { name: t('tests.test3Name'), status: 'running' }
    setResults([...newResults])
    const hasDatasets = project.datasets.length > 0
    const hasFields = project.datasets.every(ds => ds.fields.length > 0)
    newResults[2] = { 
      name: t('tests.test3Name'), 
      status: (hasDatasets && hasFields) ? 'passed' : 'failed',
      message: hasDatasets 
        ? (hasFields ? t('tests.test3Pass') : t('tests.test3FailNoFields')) 
        : t('tests.test3NoDatasets')
    }
    setResults([...newResults])

    // 4. Smoke Test (End-to-End lite)
    if (mockRunning && project.datasets.length > 0) {
      newResults[3] = { name: t('tests.test4Name'), status: 'running' }
      setResults([...newResults])
      try {
        const token = typeof window !== 'undefined' ? window.sessionStorage.getItem('doapi-jwt-token') : null
        const headers: Record<string, string> = {}
        if (token) headers['Authorization'] = `Bearer ${token}`
        const projectId = project.remoteId || project.slug || project.id
        const firstEp = project.endpoints[0]
        if (firstEp) {
          const testRes = await fetch(`${baseUrl}/api/mock/${projectId}${firstEp.path}`, { headers })
          const body = testRes.ok ? '' : await testRes.text().catch(() => '')
          newResults[3] = { 
            name: t('tests.test4Name'), 
            status: testRes.ok ? 'passed' : 'failed',
            message: testRes.ok
              ? t('tests.test4Pass').replace('{method}', firstEp.method).replace('{path}', firstEp.path).replace('{status}', String(testRes.status))
              : t('tests.test4Fail').replace('{status}', String(testRes.status)).replace('{method}', firstEp.method).replace('{path}', firstEp.path).replace('{body}', body ? ': ' + body.slice(0, 200) : '')
          }
        } else {
          newResults[3] = {
            name: t('tests.test4Name'),
            status: 'failed',
            message: t('tests.test4NoEndpoints')
          }
        }
      } catch (e) {
        newResults[3] = { name: t('tests.test4Name'), status: 'failed', message: t('tests.test4NetworkError') }
      }
    } else {
      newResults[3] = { 
        name: t('tests.test4Name'), 
        status: 'failed', 
        message: t('tests.test4Requirement') 
      }
    }
    setResults([...newResults])
    setIsRunning(false)
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('tests.pageTitle')}</h1>
          <p className="page-subtitle">{t('tests.pageSubtitle')}</p>
        </div>
        <button 
          className={`btn primary ${isRunning ? 'loading' : ''}`} 
          onClick={runTests}
          disabled={isRunning}
        >
          {isRunning ? t('tests.running') : t('tests.runDiagnostic')}
        </button>
      </div>

      <div className="tests-grid">
        {results.map((test, i) => (
          <div key={i} className={`test-card ${test.status}`}>
            <div className="test-header">
              <span className={`test-badge ${test.status}`}>
                {test.status === 'passed' && t('tests.passed')}
                {test.status === 'failed' && t('tests.failed')}
                {test.status === 'running' && t('tests.runningBadge')}
                {test.status === 'pending' && t('tests.pending')}
              </span>
              <h3 className="test-name">{test.name}</h3>
            </div>
            {test.message && <p className="test-message">{test.message}</p>}
          </div>
        ))}
      </div>

      <div className="info-card" style={{ marginTop: '2rem' }}>
        <h3>{t('tests.backendTests')}</h3>
        <TestRunnerPanel />
      </div>

      <div className="info-card" style={{ marginTop: '2rem' }}>
        <h3>{t('tests.aboutTitle')}</h3>
        <p>
          {t('tests.aboutDesc')}
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
