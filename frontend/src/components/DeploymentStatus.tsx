import { useState, useCallback } from 'react'
import type { ProjectDraft } from '../types/schemas'
import { useProjectBuilder } from '../hooks/useProjectBuilder'
import { apiFetch } from '../lib/api'

export function DeploymentStatus({ project }: { project: ProjectDraft }) {
  const { updateProject } = useProjectBuilder()
  const dep = project.deployment
  const [checking, setChecking] = useState(false)
  const [healthResult, setHealthResult] = useState<{ ok: boolean; time: string } | null>(null)
  const [log, setLog] = useState<string[]>([])

  const addLog = useCallback((msg: string) => setLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]), [])

  const checkHealth = useCallback(async () => {
    if (!dep) return
    setChecking(true)
    setHealthResult(null)
    const url = `http://${dep.host}:${dep.apiPort}/health`
    const start = Date.now()
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
      const elapsed = ((Date.now() - start) / 1000).toFixed(1)
      if (res.ok) {
        setHealthResult({ ok: true, time: elapsed })
        addLog(`✅ Health check OK (${elapsed}s) - ${url}`)
        updateProject({ deployment: { ...dep, lastCheckAt: new Date().toISOString(), status: 'running' } })
      } else {
        setHealthResult({ ok: false, time: elapsed })
        addLog(`⚠️ Health check falló (${res.status}) - ${url}`)
        updateProject({ deployment: { ...dep, lastCheckAt: new Date().toISOString(), status: 'stopped' } })
      }
    } catch {
      setHealthResult({ ok: false, time: ((Date.now() - start) / 1000).toFixed(1) })
      addLog(`❌ No se pudo conectar - ${url}`)
      updateProject({ deployment: { ...dep, lastCheckAt: new Date().toISOString(), status: 'unknown' } })
    }
    setChecking(false)
  }, [dep, updateProject, addLog])

  const handleRedeploy = async () => {
    if (!dep) return
    addLog('🔄 Redeploy...')
    try {
      const res = await apiFetch('/api/deploy/local', {
        method: 'POST',
        body: JSON.stringify({ project_id: project.slug || project.id, port: parseInt(dep.apiPort, 10) || 8080 }),
      })
      const data = await res.json()
      data.logs?.forEach((l: string) => addLog(l))
      if (data.status === 'running') addLog('✅ Redeploy exitoso')
    } catch (e: any) {
      addLog(`❌ ${e.message || e}`)
    }
  }

  const deleteDeployment = async () => {
    if (!dep) return
    if (!window.confirm('¿Eliminar el deployment? Se detendrá el contenedor y se borrarán los archivos.')) return
    addLog('🗑️ Eliminando deployment...')
    try {
      const res = await apiFetch('/api/deploy/local/delete', {
        method: 'POST',
        body: JSON.stringify({ slug: project.slug || project.id }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      data.logs?.forEach((l: string) => addLog(l))
      if (data.status === 'deleted') {
        updateProject({ deployment: undefined })
        addLog('✅ Deployment eliminado')
      }
    } catch (e: any) {
      addLog(`❌ ${e.message || e}`)
    }
  }

  const clearDeployment = () => {
    updateProject({ deployment: undefined })
    setHealthResult(null)
    setLog([])
  }

  if (!dep) {
    return (
      <div className="info-card" style={{ textAlign: 'center', padding: '2rem' }}>
        <p className="muted-text" style={{ marginBottom: '0.75rem' }}>
          Este proyecto no tiene un despliegue registrado.
        </p>
        <a href="/deploy" className="btn" style={{ textDecoration: 'none', display: 'inline-block' }}>
          🚀 Ir a Despliegue
        </a>
      </div>
    )
  }

  return (
    <div>
      {/* Status summary */}
      <div className="info-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '0.75rem', margin: 0 }}>
        <div className="info-card">
          <h3 className="info-card__title" style={{ marginBottom: '0.5rem' }}>Estado</h3>
          <div style={{ fontSize: '0.85rem', lineHeight: 1.8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{
                width: 10, height: 10, borderRadius: '50%', display: 'inline-block',
                background: dep.status === 'running' ? '#22c55e' : dep.status === 'stopped' ? '#ef4444' : '#94a3b8',
              }} />
              <strong>{dep.status === 'running' ? 'Corriendo' : dep.status === 'stopped' ? 'Detenido' : 'Desconocido'}</strong>
            </div>
            <div><strong>URL:</strong> <code className="docs-code--inline">http://{dep.host}:{dep.apiPort}</code></div>
            <div><strong>Desplegado:</strong> {new Date(dep.deployedAt).toLocaleString()}</div>
            {dep.lastCheckAt && <div><strong>Último check:</strong> {new Date(dep.lastCheckAt).toLocaleString()}</div>}
          </div>
        </div>

        <div className="info-card">
          <h3 className="info-card__title" style={{ marginBottom: '0.5rem' }}>Conexión</h3>
          <div style={{ fontSize: '0.85rem', lineHeight: 1.8 }}>
            <div><strong>Servidor:</strong> {dep.host}:{dep.port}</div>
            <div><strong>Usuario:</strong> {dep.user}</div>
            <div><strong>Auth:</strong> {dep.authType === 'key' ? 'Clave SSH' : 'Contraseña'}</div>
            <div style={{ marginTop: '0.3rem' }}>
              <code className="docs-code--inline" style={{ fontSize: '0.75rem' }}>ssh {dep.user}@{dep.host} -p {dep.port}</code>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.5rem', margin: '0.75rem 0' }}>
        <button type="button" className="btn" onClick={checkHealth} disabled={checking}>
          {checking ? 'Verificando...' : '🔍 Verificar estado'}
        </button>
        <button type="button" className="btn" onClick={handleRedeploy}>
          🔄 Redeploy
        </button>
        <button type="button" className="btn ghost" style={{ color: '#dc2626' }} onClick={deleteDeployment}>
          🗑️ Eliminar
        </button>
        <button type="button" className="btn ghost" onClick={clearDeployment} style={{ marginLeft: 'auto' }}>
          Olvidar registro
        </button>
      </div>

      {/* Health check result */}
      {healthResult && (
        <div className="info-card" style={{ marginBottom: '0.75rem' }}>
          <h3 className="info-card__title" style={{ marginBottom: '0.3rem' }}>Health Check</h3>
          <p style={{ fontSize: '0.85rem', margin: 0, color: healthResult.ok ? '#166534' : '#991b1b' }}>
            {healthResult.ok
              ? `✅ API responde correctamente (${healthResult.time}s)`
              : `❌ API no responde o devolvió error (${healthResult.time}s)`}
          </p>
        </div>
      )}

      {/* Logs */}
      {log.length > 0 && (
        <div className="info-card">
          <h3 className="info-card__title" style={{ marginBottom: '0.5rem' }}>Actividad</h3>
          <pre className="docs-code" style={{ fontSize: '0.75rem', maxHeight: '200px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
            {log.join('\n')}
          </pre>
        </div>
      )}
    </div>
  )
}
