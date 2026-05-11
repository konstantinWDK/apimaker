import { useState, useEffect, useCallback } from 'react'
import { readBackendConfig } from '../lib/backendConfig'

interface Webhook {
  id: string
  url: string
  events: string[]
  is_active: boolean
  created_at: string
}

interface Props {
  projectId: string
}

const EVENT_OPTIONS = [
  { value: 'create', label: 'Crear', desc: 'Cuando se crea un registro' },
  { value: 'update', label: 'Actualizar', desc: 'Cuando se modifica un registro' },
  { value: 'delete', label: 'Eliminar', desc: 'Cuando se elimina un registro' },
]

export function WebhookPanel({ projectId }: Props) {
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [loading, setLoading] = useState(true)
  const [url, setUrl] = useState('')
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['create'])
  const [editingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)

  const getHeaders = useCallback(() => {
    const token = typeof window !== 'undefined' ? window.sessionStorage.getItem('apimaker-jwt-token') : null
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  }, [])

  const baseUrl = readBackendConfig().baseUrl?.replace(/\/$/, '') || 'http://localhost:8000'

  const fetchWebhooks = useCallback(async () => {
    try {
      const res = await fetch(`${baseUrl}/projects/${projectId}/webhooks`, { headers: getHeaders() })
      if (res.ok) setWebhooks(await res.json())
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [baseUrl, projectId, getHeaders])

  useEffect(() => { fetchWebhooks() }, [fetchWebhooks])

  const toggleEvent = (event: string) => {
    setSelectedEvents(prev =>
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
    )
  }

  const handleSubmit = async () => {
    if (!url.trim()) { setError('La URL es obligatoria'); return }
    if (selectedEvents.length === 0) { setError('Selecciona al menos un evento'); return }
    setError(null)

    try {
      const res = await fetch(`${baseUrl}/projects/${projectId}/webhooks`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ url: url.trim(), events: selectedEvents }),
      })
      if (!res.ok) { setError('Error al crear webhook'); return }
      setUrl(''); setSelectedEvents(['create'])
      await fetchWebhooks()
    } catch { setError('Error de conexion') }
  }

  const handleUpdate = async (id: string) => {
    try {
      const wh = webhooks.find(w => w.id === id)
      if (!wh) return
      const res = await fetch(`${baseUrl}/projects/${projectId}/webhooks/${id}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ is_active: !wh.is_active }),
      })
      if (res.ok) await fetchWebhooks()
    } catch { /* ignore */ }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`${baseUrl}/projects/${projectId}/webhooks/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      })
      if (res.ok) await fetchWebhooks()
    } catch { /* ignore */ }
  }

  const handleTest = async (wh: Webhook) => {
    setTestingId(wh.id)
    try {
      await fetch(wh.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'test', project_id: projectId, data: {}, timestamp: new Date().toISOString() }),
      })
    } catch { /* ignore */ }
    finally { setTestingId(null) }
  }

  if (loading) return <p className="muted-text">Cargando webhooks...</p>

  return (
    <div className="webhook-panel">
      <p className="webhook-panel__desc">
        Los webhooks notifican a URLs externas cuando los datos cambian en el mock server.
      </p>

      {/* New webhook form */}
      <div className="webhook-form">
        <p className="webhook-form__title">{editingId ? 'Editar webhook' : 'Nuevo webhook'}</p>
        <div className="webhook-form__field">
          <label>URL del webhook</label>
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://ejemplo.com/webhook" />
        </div>
        <div className="webhook-form__field">
          <label>Eventos</label>
          <div className="webhook-form__events">
            {EVENT_OPTIONS.map(opt => (
              <label key={opt.value} className={`webhook-event ${selectedEvents.includes(opt.value) ? 'active' : ''}`}>
                <input
                  type="checkbox"
                  checked={selectedEvents.includes(opt.value)}
                  onChange={() => toggleEvent(opt.value)}
                />
                <span className="webhook-event__label">{opt.label}</span>
                <span className="webhook-event__desc">{opt.desc}</span>
              </label>
            ))}
          </div>
        </div>
        {error && <p className="error-text" style={{ margin: '0.5rem 0' }}>{error}</p>}
        <button type="button" className="btn primary btn-sm" onClick={handleSubmit}>
          {editingId ? 'Guardar cambios' : 'Anadir webhook'}
        </button>
      </div>

      {/* Webhook list */}
      <div className="webhook-list">
        {webhooks.length === 0 ? (
          <p className="muted-text" style={{ textAlign: 'center', padding: '1.5rem' }}>
            No hay webhooks configurados.
          </p>
        ) : webhooks.map(wh => (
          <div key={wh.id} className={`webhook-item ${wh.is_active ? '' : 'inactive'}`}>
            <div className="webhook-item__head">
              <div className="webhook-item__info">
                <span className="webhook-item__url">{wh.url}</span>
                <div className="webhook-item__events">
                  {wh.events.map(ev => (
                    <span key={ev} className="webhook-event-badge">{ev}</span>
                  ))}
                </div>
              </div>
              <div className="webhook-item__actions">
                <span className={`webhook-item__status ${wh.is_active ? 'active' : 'paused'}`}>
                  {wh.is_active ? 'Activo' : 'Pausado'}
                </span>
                <button type="button" className="btn ghost btn-sm" onClick={() => handleTest(wh)} disabled={testingId === wh.id}>
                  {testingId === wh.id ? '...' : 'Probar'}
                </button>
                <button type="button" className="btn ghost btn-sm" onClick={() => handleUpdate(wh.id)}>
                  {wh.is_active ? 'Pausar' : 'Activar'}
                </button>
                <button type="button" className="btn ghost btn-sm btn-danger" onClick={() => handleDelete(wh.id)}>
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .webhook-panel { padding: 0.5rem 0; }
        .webhook-panel__desc { color: #64748b; font-size: 0.85rem; margin: 0 0 1.25rem; }
        .webhook-form {
          border: 1px solid #e2e8f0; border-radius: 10px; padding: 1.25rem; background: #fafbfc; margin-bottom: 1.25rem;
        }
        .webhook-form__title { font-weight: 600; font-size: 0.9rem; margin: 0 0 0.75rem; color: #1e293b; }
        .webhook-form__field { margin-bottom: 0.75rem; }
        .webhook-form__field label { display: block; font-size: 0.75rem; font-weight: 600; color: #475569; margin-bottom: 0.3rem; text-transform: uppercase; letter-spacing: 0.03em; }
        .webhook-form__field input { width: 100%; padding: 0.45rem 0.6rem; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 0.85rem; box-sizing: border-box; }
        .webhook-form__field input:focus { border-color: #3b82f6; outline: none; box-shadow: 0 0 0 2px #bfdbfe; }
        .webhook-form__events { display: flex; gap: 0.5rem; flex-wrap: wrap; }
        .webhook-event {
          display: flex; align-items: center; gap: 0.4rem; padding: 0.4rem 0.7rem;
          border: 1px solid #e2e8f0; border-radius: 6px; cursor: pointer; transition: all 0.12s;
          background: #fff; font-size: 0.8rem;
        }
        .webhook-event:hover { border-color: #93c5fd; }
        .webhook-event.active { background: #eff6ff; border-color: #3b82f6; }
        .webhook-event input { display: none; }
        .webhook-event__label { font-weight: 600; color: #1e293b; }
        .webhook-event__desc { color: #94a3b8; font-size: 0.72rem; }
        .webhook-list { display: flex; flex-direction: column; gap: 0.5rem; }
        .webhook-item {
          border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem;
          background: #fff; transition: border-color 0.15s;
        }
        .webhook-item.inactive { opacity: 0.6; }
        .webhook-item__head { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
        .webhook-item__info { flex: 1; min-width: 0; }
        .webhook-item__url { font-size: 0.85rem; font-weight: 500; color: #1e293b; word-break: break-all; display: block; margin-bottom: 0.25rem; }
        .webhook-item__events { display: flex; gap: 0.3rem; }
        .webhook-event-badge {
          font-size: 0.65rem; padding: 0.15rem 0.4rem; border-radius: 4px;
          background: #e0e7ff; color: #4338ca; font-weight: 600; text-transform: uppercase;
        }
        .webhook-item__actions { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
        .webhook-item__status { font-size: 0.7rem; font-weight: 600; padding: 0.15rem 0.45rem; border-radius: 4px; }
        .webhook-item__status.active { background: #bbf7d0; color: #166534; }
        .webhook-item__status.paused { background: #fef3c7; color: #92400e; }
        .btn-danger { color: #dc2626; }
        .btn-danger:hover { background: #fef2f2; }
      `}</style>
    </div>
  )
}
