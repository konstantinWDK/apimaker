import { useState, useEffect } from 'react'

const SECTIONS = [
  { id: 'cli', label: 'CLI - Apimaker', sub: [
    { id: 'cli-install', label: 'Instalación' },
    { id: 'cli-deploy', label: 'apimaker deploy' },
    { id: 'cli-serve', label: 'apimaker serve' },
    { id: 'cli-init', label: 'apimaker init' },
    { id: 'cli-ssh', label: 'Deploy remoto (SSH)' },
  ]},
  { id: 'arquitectura', label: 'Arquitectura' },
  { id: 'instalacion', label: 'Instalación' },
  { id: 'stacks', label: 'Stacks' },
  { id: 'flujo', label: 'Flujo de Trabajo' },
  { id: 'funcionalidades', label: 'Funcionalidades' },
  { id: 'recursos', label: 'Recursos y APIs' },
]

export function DocsPage() {
  const [activeSection, setActiveSection] = useState('cli')

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        }
      },
      { rootMargin: '-80px 0px -50% 0px', threshold: 0 }
    )
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
      if (s.sub) for (const sub of s.sub) {
        const el2 = document.getElementById(sub.id)
        if (el2) observer.observe(el2)
      }
    }
    return () => observer.disconnect()
  }, [])

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setActiveSection(id)
  }

  return (
    <div className="docs-layout">
      <div className="docs-content">
        {/* ========== CLI ========== */}
        <div className="docs-block">
          <div className="docs-header" id="cli">
            <h1 className="docs-header__title">CLI — Apimaker</h1>
            <p className="docs-header__desc">
              La interfaz de línea de comandos permite desplegar, servir y exportar
              proyectos de API Maker desde cualquier entorno, sin depender de la interfaz gráfica.
            </p>
          </div>

          <div className="docs-section" id="cli-install">
            <h2 className="docs-section__title">Instalación</h2>
            <p className="docs-section__text">
              El CLI viene incluido en el paquete <code className="docs-code--inline">apimaker-backend</code>.
              Se instala automáticamente con <code className="docs-code--inline">pip install apimaker-backend</code>
              o al ejecutar el instalador del proyecto.
            </p>
            <div className="docs-code">pip install apimaker-backend</div>
            <p className="docs-section__text">Verificar instalación:</p>
            <div className="docs-code">apimaker --help</div>
          </div>

          <div className="docs-section" id="cli-deploy">
            <h2 className="docs-section__title">apimaker deploy</h2>
            <p className="docs-section__text">
              Despliega un proyecto exportado como una API independiente. Lee el archivo JSON,
              crea la base de datos, importa los datos y levanta un servidor con los endpoints limpios.
            </p>
            <div className="docs-code">apimaker deploy &lt;archivo.json&gt; [opciones]</div>
            <table className="docs-table">
              <thead><tr><th>Opción</th><th>Default</th><th>Descripción</th></tr></thead>
              <tbody>
                <tr><td><code className="docs-code--inline">--port</code></td><td>8080</td><td>Puerto del servidor</td></tr>
                <tr><td><code className="docs-code--inline">--host</code></td><td>0.0.0.0</td><td>Host de escucha</td></tr>
                <tr><td><code className="docs-code--inline">--db</code></td><td>SQLite</td><td>URL de base de datos (SQLite o PostgreSQL)</td></tr>
                <tr><td><code className="docs-code--inline">--ssh</code></td><td>-</td><td>Destino SSH para deploy remoto</td></tr>
              </tbody>
            </table>
            <p className="docs-subsection__text">Ejemplo — desplegar localmente:</p>
            <div className="docs-code"><span className="comment"># Exportar proyecto desde el builder</span>
apimaker init pokedex-demo

<span className="comment"># Desplegar como API independiente</span>
apimaker deploy pokedex-demo.json --port 8080</div>
            <p className="docs-section__text">El servidor levanta con URLs limpias:</p>
            <div className="docs-code">GET    /api/pokemon          <span className="comment"># Listar todos</span>
GET    /api/pokemon/25       <span className="comment"># Detalle por ID</span>
POST   /api/pokemon          <span className="comment"># Crear</span>
PUT    /api/pokemon/25       <span className="comment"># Actualizar</span>
DELETE /api/pokemon/25       <span className="comment"># Eliminar</span></div>
          </div>

          <div className="docs-section" id="cli-serve">
            <h2 className="docs-section__title">apimaker serve</h2>
            <p className="docs-section__text">
              Sirve un proyecto existente de la base de datos del builder como una API independiente
              en un puerto separado. Útil para tener el mock corriendo sin depender del builder.
            </p>
            <div className="docs-code">apimaker serve &lt;slug&gt; [opciones]</div>
            <table className="docs-table">
              <thead><tr><th>Opción</th><th>Default</th><th>Descripción</th></tr></thead>
              <tbody>
                <tr><td><code className="docs-code--inline">--port</code></td><td>8081</td><td>Puerto del servidor</td></tr>
                <tr><td><code className="docs-code--inline">--host</code></td><td>0.0.0.0</td><td>Host de escucha</td></tr>
              </tbody>
            </table>
            <p className="docs-subsection__text">Ejemplo:</p>
            <div className="docs-code"><span className="comment"># Servir proyecto existente de la DB</span>
apimaker serve pokedex-demo --port 8081

<span className="comment"># El builder sigue en :8000, el mock en :8081</span></div>
          </div>

          <div className="docs-section" id="cli-init">
            <h2 className="docs-section__title">apimaker init</h2>
            <p className="docs-section__text">
              Exporta un proyecto de la base de datos del builder a un archivo JSON listo para
              desplegar con <code className="docs-code--inline">apimaker deploy</code>.
            </p>
            <div className="docs-code">apimaker init &lt;slug&gt; [-o archivo.json]</div>
            <table className="docs-table">
              <thead><tr><th>Opción</th><th>Descripción</th></tr></thead>
              <tbody>
                <tr><td><code className="docs-code--inline">--output, -o</code></td><td>Ruta del archivo JSON de salida (default: &lt;slug&gt;.json)</td></tr>
              </tbody>
            </table>
            <p className="docs-subsection__text">Ejemplo:</p>
            <div className="docs-code"><span className="comment"># Exportar a archivo</span>
apimaker init pokedex-demo -o mi-api.json

<span className="comment"># Desplegarlo después</span>
apimaker deploy mi-api.json --port 3000</div>
          </div>

          <div className="docs-section" id="cli-ssh">
            <h2 className="docs-section__title">Deploy remoto (SSH)</h2>
            <p className="docs-section__text">
              Despliega el proyecto directamente en un servidor remoto vía SSH + Docker.
              El CLI copia el archivo, genera un <code className="docs-code--inline">docker-compose.yml</code>
              y levanta los contenedores automáticamente.
            </p>
            <div className="docs-code"><span className="comment"># Desplegar en VPS</span>
apimaker deploy proyecto.json --ssh usuario@midominio.com --port 80

<span className="comment"># El servidor remoto debe tener Docker instalado</span></div>
            <p className="docs-section__text">
              Una vez completado, la API estará disponible en <code className="docs-code--inline">http://midominio.com/api</code>.
            </p>
          </div>
        </div>

        {/* ========== Arquitectura ========== */}
        <div className="docs-section" id="arquitectura">
          <h2 className="docs-section__title">Arquitectura</h2>
          <p className="docs-section__text">
            API Maker genera código listo para producción separado en capas bien definidas.
          </p>
          <div className="info-stacks">
            <div className="info-stack">
              <div className="info-stack__head">
                <span className="info-stack__dot" style={{ background: '#6366f1' }} />
                <strong>Modelos / Schemas</strong>
              </div>
              <p className="info-stack__desc">
                Define tus datasets con tipos, validaciones, relaciones y generación con Faker. Se traducen a SQLModel (Python),
                Sequelize (Express) o TypeORM (NestJS) según el stack.
              </p>
            </div>
            <div className="info-stack">
              <div className="info-stack__head">
                <span className="info-stack__dot" style={{ background: '#0ea5e9' }} />
                <strong>Controladores / Routers</strong>
              </div>
              <p className="info-stack__desc">
                Endpoints REST generados automáticamente con CRUD completo (list, get, create, update, delete)
                más rutas personalizadas. Rutas con parámetros dinámicos {'{id}'} y vinculación directa a datasets.
              </p>
            </div>
            <div className="info-stack">
              <div className="info-stack__head">
                <span className="info-stack__dot" style={{ background: '#10b981' }} />
                <strong>Seguridad</strong>
              </div>
              <p className="info-stack__desc">
                Autenticación JWT con tokens de acceso (24h) y refresh (7 días). API Key opcional para machine-to-machine.
                Rate limiting configurable por endpoint.
              </p>
            </div>
            <div className="info-stack">
              <div className="info-stack__head">
                <span className="info-stack__dot" style={{ background: '#f59e0b' }} />
                <strong>Despliegue</strong>
              </div>
              <p className="info-stack__desc">
                Docker Compose multi-etapa, seeds automáticos, health checks, variables de entorno incluidos en el bundle generado.
                Templates para Railway, Render y CI/CD con GitHub Actions.
              </p>
            </div>
          </div>
        </div>

        {/* ========== Instalación ========== */}
        <div className="docs-section" id="instalacion">
          <h2 className="docs-section__title">Instalación</h2>
          <div className="info-grid">
            <div className="info-card">
              <h3 className="info-card__title">1 comando</h3>
              <p className="info-card__desc">
                <code className="docs-code--inline">./install.sh</code> en Linux/macOS o <code className="docs-code--inline">install.bat</code> en Windows.
                El instalador crea el entorno virtual, instala dependencias y lanza el Setup Wizard.
              </p>
            </div>
            <div className="info-card">
              <h3 className="info-card__title">Setup Wizard</h3>
              <p className="info-card__desc">
                Al primer arranque, el wizard guía la configuración del administrador (usuario + contraseña) y la base de datos
                (SQLite sin configuración o PostgreSQL con datos de conexión).
              </p>
            </div>
            <div className="info-card">
              <h3 className="info-card__title">Base de Datos</h3>
              <p className="info-card__desc">
                Soporte nativo para SQLite (default, zero-config) y PostgreSQL. La configuración se persiste en
                <code className="docs-code--inline"> admin_config.json</code>.
              </p>
            </div>
            <div className="info-card">
              <h3 className="info-card__title">Docker</h3>
              <p className="info-card__desc">
                Opción de levantar con <code className="docs-code--inline">docker compose up -d --build</code> directamente desde el instalador.
                Backend en :8000, frontend en :5173.
              </p>
            </div>
          </div>
        </div>

        {/* ========== Stacks ========== */}
        <div className="docs-section" id="stacks">
          <h2 className="docs-section__title">Stacks de Implementación</h2>
          <div className="info-stacks" style={{ gap: '0.75rem' }}>
            <div className="info-stack">
              <div className="info-stack__head">
                <span className="info-stack__dot" style={{ background: '#3b82f6' }} />
                <strong>FastAPI (Python)</strong>
                <span className="info-stack__badge">Recomendado</span>
              </div>
              <p className="info-stack__desc">
                Framework moderno con soporte async, documentación OpenAPI automática, Pydantic v2 para validación,
                SQLAlchemy + SQLModel. Incluye Alembic para migraciones y uvicorn como servidor ASGI.
              </p>
            </div>
            <div className="info-stack">
              <div className="info-stack__head">
                <span className="info-stack__dot" style={{ background: '#10b981' }} />
                <strong>Express (Node.js)</strong>
              </div>
              <p className="info-stack__desc">
                Framework Node.js maduro con Sequelize ORM, Swagger automático, JWT, rate limiting y
                Docker Compose con PostgreSQL. Ideal para equipos full-stack JavaScript.
              </p>
            </div>
            <div className="info-stack">
              <div className="info-stack__head">
                <span className="info-stack__dot" style={{ background: '#8b5cf6' }} />
                <strong>NestJS (Node.js)</strong>
              </div>
              <p className="info-stack__desc">
                Arquitectura modular con TypeORM, decoradores Swagger, AuthGuard, DTOs tipados y
                estructura empresarial lista para producción con soporte de inyección de dependencias.
              </p>
            </div>
          </div>
        </div>

        {/* ========== Flujo ========== */}
        <div className="docs-section" id="flujo">
          <h2 className="docs-section__title">Flujo de Trabajo</h2>
          <div className="info-steps">
            <div className="info-step">
              <span className="info-step__num">1</span>
              <div>
                <strong>Instala y configura</strong>
                <p>Ejecuta <code className="docs-code--inline">./install.sh</code>. El Setup Wizard te guía en la creación del admin, elección de BD y carga opcional de datos demo (Pokedex).</p>
              </div>
            </div>
            <div className="info-step">
              <span className="info-step__num">2</span>
              <div>
                <strong>Define tus Datasets</strong>
                <p>Crea modelos con tipos de campo, valores por defecto, enumeraciones, claves primarias y foráneas. Importa desde CSV, Excel o introspecciona bases de datos externas.</p>
              </div>
            </div>
            <div className="info-step">
              <span className="info-step__num">3</span>
              <div>
                <strong>Diseña Endpoints REST</strong>
                <p>Genera rutas CRUD automáticas vinculadas a tus datasets o crea endpoints personalizados con método, path y parámetros propios.</p>
              </div>
            </div>
            <div className="info-step">
              <span className="info-step__num">4</span>
              <div>
                <strong>Configura Relaciones (Mappings)</strong>
                <p>Conecta campos entre datasets con el editor visual de mappings. Soporta transformaciones directas, conversión de tipos, concatenación y formateo condicional.</p>
              </div>
            </div>
            <div className="info-step">
              <span className="info-step__num">5</span>
              <div>
                <strong>Prueba con el Simulador</strong>
                <p>Lanza el mock server integrado y prueba todos tus endpoints en tiempo real. Soporta filtros por query params y búsqueda por ID.</p>
              </div>
            </div>
            <div className="info-step">
              <span className="info-step__num">6</span>
              <div>
                <strong>Despliega</strong>
                <p>Usa <code className="docs-code--inline">apimaker deploy</code> para levantar tu API al instante, descarga el bundle .zip, o despliega vía SSH + Docker con un solo comando.</p>
              </div>
            </div>
          </div>
        </div>

        {/* ========== Funcionalidades ========== */}
        <div className="docs-section" id="funcionalidades">
          <h2 className="docs-section__title">Funcionalidades</h2>
          <div className="info-grid">
            <div className="info-card">
              <h3 className="info-card__title">Mock Server</h3>
              <p className="info-card__desc">Servidor mock integrado que se levanta por proyecto. Simula endpoints con datos realistas. Datos persistentes en base de datos.</p>
            </div>
            <div className="info-card">
              <h3 className="info-card__title">Versionado</h3>
              <p className="info-card__desc">Cada proyecto mantiene un historial de snapshots. Puedes crear versiones manualmente y restaurar cualquier versión anterior.</p>
            </div>
            <div className="info-card">
              <h3 className="info-card__title">Webhooks</h3>
              <p className="info-card__desc">Registra URLs externas que reciben notificaciones en tiempo real cuando los datos del mock server cambian. Soporta eventos create, update y delete.</p>
            </div>
            <div className="info-card">
              <h3 className="info-card__title">Share Links</h3>
              <p className="info-card__desc">Genera enlaces públicos de solo lectura con protección por contraseña y fecha de expiración configurable.</p>
            </div>
            <div className="info-card">
              <h3 className="info-card__title">SDKs Generados</h3>
              <p className="info-card__desc">Clientes TypeScript y Python generados automáticamente en cada bundle. Incluyen tipado completo de tus datasets.</p>
            </div>
            <div className="info-card">
              <h3 className="info-card__title">Base de Datos Externa</h3>
              <p className="info-card__desc">Conecta e introspecciona esquemas de PostgreSQL, MySQL o SQLite. Convierte tablas en datasets editables automáticamente.</p>
            </div>
            <div className="info-card">
              <h3 className="info-card__title">Mappings</h3>
              <p className="info-card__desc">Editor visual de relaciones entre campos de distintos datasets. Define transformaciones: copia directa, cast, concat o expresiones.</p>
            </div>
            <div className="info-card">
              <h3 className="info-card__title">CLI Deploy</h3>
              <p className="info-card__desc">
                <span className="docs-badge docs-badge--new">NUEVO</span>{' '}
                Despliega tu API en cualquier servidor con un solo comando. Exporta, sirve o despliega vía SSH sin depender de la UI.
              </p>
            </div>
          </div>
        </div>

        {/* ========== Recursos ========== */}
        <div className="docs-section" id="recursos">
          <h2 className="docs-section__title">Recursos y APIs</h2>
          <div className="info-grid">
            <div className="info-card">
              <h3 className="info-card__title">OpenAPI / Swagger</h3>
              <p className="info-card__desc">Cada proyecto expone un documento OpenAPI 3.1 y una interfaz Redoc interactiva. Compatible con Postman, Insomnia y Swagger UI.</p>
            </div>
            <div className="info-card">
              <h3 className="info-card__title">API del Backend</h3>
              <p className="info-card__desc">30+ endpoints REST documentados para gestionar proyectos, datasets, endpoints, mappings, shares, webhooks, versiones y mock servers.</p>
            </div>
            <div className="info-card">
              <h3 className="info-card__title">Instalador</h3>
              <p className="info-card__desc"><code className="docs-code--inline">./install.sh</code> para Linux/macOS y <code className="docs-code--inline">install.bat</code> para Windows. Un solo comando configura todo el entorno.</p>
            </div>
            <div className="info-card">
              <h3 className="info-card__title">Docker Compose</h3>
              <p className="info-card__desc">docker-compose.yml + docker-compose.prod.yml con PostgreSQL, health checks y configuración vía variables de entorno.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar TOC */}
      <aside className="docs-sidebar">
        <div className="docs-sidebar__title">En esta página</div>
        <ul className="docs-toc">
          {SECTIONS.map(s => (
            <li key={s.id} className="docs-toc__item">
              <button
                className={`docs-toc__link ${activeSection === s.id ? 'docs-toc__link--active' : ''}`}
                onClick={() => scrollTo(s.id)}
              >
                {s.label}
              </button>
              {s.sub?.map(sub => (
                <button
                  key={sub.id}
                  className={`docs-toc__link docs-toc__link--sub ${activeSection === sub.id ? 'docs-toc__link--active' : ''}`}
                  onClick={() => scrollTo(sub.id)}
                >
                  {sub.label}
                </button>
              ))}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}
