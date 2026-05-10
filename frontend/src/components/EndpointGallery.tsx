import type { GeneratedEndpoint } from '../types/schemas'

interface Props {
  endpoints: GeneratedEndpoint[]
  baseUrl: string
  authMethod?: string
  apiKey?: string
}

const methodColors: Record<string, string> = {
  GET: '#0ea5e9',
  POST: '#10b981',
  PUT: '#f97316',
  PATCH: '#a855f7',
  DELETE: '#ef4444',
}

export function EndpointGallery({ endpoints, baseUrl, authMethod, apiKey }: Props) {
  if (!endpoints.length) return <p className="muted-text">Añade endpoints para ver el resumen aquí.</p>

  return (
    <div className="endpoint-gallery">
      {endpoints.map((endpoint) => {
        const fullUrl = `${baseUrl.split('/api/mock/')[0]}/api/mock/${baseUrl.split('/api/mock/')[1]?.split('/')[0]}${endpoint.path}`
        
        const authHeader = authMethod === 'apikey' && apiKey 
          ? ` -H "X-API-Key: ${apiKey}"` 
          : authMethod === 'jwt' 
          ? ` -H "Authorization: Bearer <TU_TOKEN>"` 
          : ''
          
        const curl = `curl -X ${endpoint.method} "${fullUrl}"${authHeader}`
        
        return (
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
            
            <details className="endpoint-card__curl">
              <summary>Ver ejemplo curl</summary>
              <pre className="preview-json" style={{ fontSize: '0.7rem', marginTop: '0.4rem', padding: '0.5rem' }}>
                {curl}
              </pre>
              <p className="muted-text" style={{ fontSize: '0.65rem', marginTop: '0.2rem' }}>
                {endpoint.method === 'GET' ? 'Obtiene datos del servidor.' : 
                 endpoint.method === 'POST' ? 'Crea un nuevo registro enviando un JSON en el body.' :
                 endpoint.method === 'PUT' ? 'Actualiza un registro existente enviando el objeto completo.' :
                 'Interacción directa con la API.'}
              </p>
            </details>
          </article>
        )
      })}

      <style>{`
        .endpoint-card__curl {
          margin-top: 0.5rem;
          border-top: 1px dashed #e2e8f0;
          padding-top: 0.5rem;
        }
        .endpoint-card__curl summary {
          font-size: 0.72rem;
          color: #64748b;
          cursor: pointer;
          font-weight: 500;
        }
        .endpoint-card__curl summary:hover {
          color: #3b82f6;
        }
      `}</style>
    </div>
  )
}
