import type { GeneratedEndpoint } from '../types/schemas'

interface Props {
  endpoints: GeneratedEndpoint[]
}

const methodColors: Record<string, string> = {
  GET: '#0ea5e9',
  POST: '#10b981',
  PUT: '#f97316',
  PATCH: '#a855f7',
  DELETE: '#ef4444',
}

export function EndpointGallery({ endpoints }: Props) {
  if (!endpoints.length) return <p className="muted-text">Añade endpoints para ver el resumen aquí.</p>

  return (
    <div className="endpoint-gallery">
      {endpoints.map((endpoint) => (
        <article key={`${endpoint.method}-${endpoint.path}`} className="endpoint-card">
          <div className="endpoint-card__header">
            <span
              className="endpoint-card__method"
              style={{ backgroundColor: `${methodColors[endpoint.method] ?? '#0f172a'}1a`, color: methodColors[endpoint.method] ?? '#0f172a' }}
            >
              {endpoint.method}
            </span>
            <span className="endpoint-card__path">{endpoint.path}</span>
          </div>
          <p className="endpoint-card__description">{endpoint.description}</p>
        </article>
      ))}
    </div>
  )
}
