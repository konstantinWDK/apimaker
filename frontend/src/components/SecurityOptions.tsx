interface Props {
  docsUrl: string
  sandboxUrl: string
}

const securityTips = [
  'Protege el backend detrás de un reverse proxy con HTTPS (Nginx, Caddy o Cloudflare).',
  'Define variables de entorno como APIMAKER_BUILDER_TOKEN y compártelas sólo con tu equipo.',
  'Añade autenticación básica o JWT a las rutas /api/<projectId> si expones datos sensibles.',
  'Limita las IPs que pueden acceder al builder; tus consumidores sólo necesitan las rutas /api y /projects/{id}/docs.',
]

export function SecurityOptions({ docsUrl, sandboxUrl }: Props) {
  return (
    <div className="security-panel">
      <h4>Opciones de seguridad recomendadas</h4>
      <ul>
        {securityTips.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
      {docsUrl ? (
        <p>
          URL actual de docs: <code>{docsUrl}</code>
        </p>
      ) : null}
      {sandboxUrl ? (
        <p>
          Sandbox público sugerido: <code>{sandboxUrl}</code>
        </p>
      ) : null}
    </div>
  )
}
