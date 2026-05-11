export function DocsPage() {
  return (
    <div className="info-page">
      <div className="info-hero">
        <div className="info-hero__content">
          <h1 className="info-hero__title">Documentación</h1>
          <p className="info-hero__subtitle">
            Arquitectura, stacks de implementacion y guia completa de API Maker
          </p>
        </div>
      </div>

      {/* Arquitectura */}
      <div className="info-section">
        <h2 className="info-section__title">Arquitectura</h2>
        <p className="muted-text" style={{ marginBottom: '1rem' }}>
          API Maker genera codigo listo para produccion separado en capas bien definidas.
        </p>
        <div className="info-stacks">
          <div className="info-stack">
            <div className="info-stack__head">
              <span className="info-stack__dot" style={{ background: '#6366f1' }} />
              <strong>Modelos / Schemas</strong>
            </div>
            <p className="info-stack__desc">
              Define tus datasets con tipos, validaciones, relaciones y generacion con Faker. Se traducen a SQLModel (Python),
              Sequelize (Express) o TypeORM (NestJS) segun el stack.
            </p>
          </div>
          <div className="info-stack">
            <div className="info-stack__head">
              <span className="info-stack__dot" style={{ background: '#0ea5e9' }} />
              <strong>Controladores / Routers</strong>
            </div>
            <p className="info-stack__desc">
              Endpoints REST generados automaticamente con CRUD completo (list, get, create, update, delete)
              mas rutas personalizadas. Rutas con parametros dinamicos &#123;id&#125; y vinculacion directa a datasets.
            </p>
          </div>
          <div className="info-stack">
            <div className="info-stack__head">
              <span className="info-stack__dot" style={{ background: '#10b981' }} />
              <strong>Seguridad</strong>
            </div>
            <p className="info-stack__desc">
              Autenticacion JWT con tokens de acceso (24h) y refresh (7 dias). API Key opcional para machine-to-machine.
              Rate limiting configurable por endpoint. Cambio de credenciales y reseteo desde el panel.
            </p>
          </div>
          <div className="info-stack">
            <div className="info-stack__head">
              <span className="info-stack__dot" style={{ background: '#f59e0b' }} />
              <strong>Despliegue</strong>
            </div>
            <p className="info-stack__desc">
              Docker Compose multi-etapa, seeds automaticos, health checks, variables de entorno y configuracion
              incluidos en el bundle generado. Templates para Railway, Render y CI/CD con GitHub Actions.
            </p>
          </div>
        </div>
      </div>

      {/* Instalacion */}
      <div className="info-section">
        <h2 className="info-section__title">Instalacion</h2>
        <div className="info-grid">
          <div className="info-card">
            <h3 className="info-card__title">1 comando</h3>
            <p className="info-card__desc">
              <code>./install.sh</code> en Linux/macOS o <code>install.bat</code> en Windows. El instalador crea el entorno virtual,
              instala dependencias Python y Node, y lanza el Setup Wizard.
            </p>
          </div>
          <div className="info-card">
            <h3 className="info-card__title">Setup Wizard</h3>
            <p className="info-card__desc">
              Al primer arranque, el wizard guia la configuracion del administrador (usuario + contrasena) y la base de datos
              (SQLite sin configuracion o PostgreSQL con datos de conexion).
            </p>
          </div>
          <div className="info-card">
            <h3 className="info-card__title">Base de Datos</h3>
            <p className="info-card__desc">
              Soporte nativo para SQLite (default, zero-config) y PostgreSQL. La configuracion se persiste en
              <code> admin_config.json</code> y se puede cambiar desde el backend.
            </p>
          </div>
          <div className="info-card">
            <h3 className="info-card__title">Docker</h3>
            <p className="info-card__desc">
              Opcion de levantar con <code>docker compose up -d --build</code> directamente desde el instalador. Backend en :8000, frontend en :5173.
            </p>
          </div>
        </div>
      </div>

      {/* Stacks de implementacion */}
      <div className="info-section">
        <h2 className="info-section__title">Stacks de Implementacion</h2>
        <div className="info-stacks" style={{ gap: '0.75rem' }}>
          <div className="info-stack">
            <div className="info-stack__head">
              <span className="info-stack__dot" style={{ background: '#3b82f6' }} />
              <strong>FastAPI (Python)</strong>
              <span className="info-stack__badge">Recomendado</span>
            </div>
            <p className="info-stack__desc">
              Framework moderno con soporte async, documentacion OpenAPI automatica, Pydantic v2 para validacion,
              SQLAlchemy + SQLModel. Incluye Alembic para migraciones y uvicorn como servidor ASGI.
            </p>
          </div>
          <div className="info-stack">
            <div className="info-stack__head">
              <span className="info-stack__dot" style={{ background: '#10b981' }} />
              <strong>Express (Node.js)</strong>
            </div>
            <p className="info-stack__desc">
              Framework Node.js maduro con Sequelize ORM, Swagger automatico, JWT, rate limiting y
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
              estructura empresarial lista para produccion con soporte de inyeccion de dependencias.
            </p>
          </div>
        </div>
      </div>

      {/* Flujo de Trabajo */}
      <div className="info-section">
        <h2 className="info-section__title">Flujo de Trabajo</h2>
        <div className="info-steps">
          <div className="info-step">
            <span className="info-step__num">1</span>
            <div>
              <strong>Instala y configura</strong>
              <p>Ejecuta <code>./install.sh</code>. El Setup Wizard te guia en la creacion del admin, eleccion de BD y carga opcional de datos demo (Pokedex).</p>
            </div>
          </div>
          <div className="info-step">
            <span className="info-step__num">2</span>
            <div>
              <strong>Define tus Datasets</strong>
              <p>Crea modelos con tipos de campo, valores por defecto, enumeraciones, claves primarias y foraneas. Importa desde CSV, Excel o introspecciona bases de datos externas (PostgreSQL, MySQL, SQLite).</p>
            </div>
          </div>
          <div className="info-step">
            <span className="info-step__num">3</span>
            <div>
              <strong>Disena Endpoints REST</strong>
              <p>Genera rutas CRUD automaticas vinculadas a tus datasets o crea endpoints personalizados con metodo, path y parametros propios.</p>
            </div>
          </div>
          <div className="info-step">
            <span className="info-step__num">4</span>
            <div>
              <strong>Configura Relaciones (Mappings)</strong>
              <p>Conecta campos entre datasets con el editor visual de mappings. Soporta transformaciones directas, conversion de tipos (cast), concatenacion (concat) y formateo condicional (format).</p>
            </div>
          </div>
          <div className="info-step">
            <span className="info-step__num">5</span>
            <div>
              <strong>Prueba con el Simulador</strong>
              <p>Lanza el mock server integrado y prueba todos tus endpoints en tiempo real con datos de ejemplo generados automaticamente. Soporta filtros por query params y busqueda por ID.</p>
            </div>
          </div>
          <div className="info-step">
            <span className="info-step__num">6</span>
            <div>
              <strong>Genera, versiona y despliega</strong>
              <p>Descarga el bundle .zip con codigo listo para produccion. Usa el panel de versiones para guardar snapshots del proyecto. Despliega con Docker, Railway, Render o tu propio VPS.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Funcionalidades nuevas */}
      <div className="info-section">
        <h2 className="info-section__title">Funcionalidades</h2>
        <div className="info-grid">
          <div className="info-card">
            <h3 className="info-card__title">Mock Server</h3>
            <p className="info-card__desc">
              Servidor mock integrado que se levanta por proyecto. Simula endpoints con datos realistas generados por Faker.
              Arranca/para desde el panel o automaticamente al cargar un proyecto sincronizado.
            </p>
          </div>
          <div className="info-card">
            <h3 className="info-card__title">Versionado</h3>
            <p className="info-card__desc">
              Cada proyecto mantiene un historial de snapshots. Pudes crear versiones manualmente, listar el historial
              completo y restaurar cualquier version anterior con un clic. Ideal para iteracion segura.
            </p>
          </div>
          <div className="info-card">
            <h3 className="info-card__title">Webhooks</h3>
            <p className="info-card__desc">
              Registra URLs externas que reciben notificaciones en tiempo real cuando los datos del mock server cambian.
              Soporta eventos create, update y delete con payloads JSON completos.
            </p>
          </div>
          <div className="info-card">
            <h3 className="info-card__title">Share Links</h3>
            <p className="info-card__desc">
              Genera enlaces publicos de solo lectura con proteccion por contrasena y fecha de expiracion configurable.
              Comparte la documentacion y el playground sin exponer el editor del proyecto.
            </p>
          </div>
          <div className="info-card">
            <h3 className="info-card__title">SDKs Generados</h3>
            <p className="info-card__desc">
              Clientes TypeScript y Python generados automaticamente en cada bundle. Incluyen tipado completo de tus
              datasets y metodos para cada endpoint. Listos para importar en cualquier proyecto.
            </p>
          </div>
          <div className="info-card">
            <h3 className="info-card__title">Base de Datos Externa</h3>
            <p className="info-card__desc">
              Conecta e introspecciona esquemas de PostgreSQL, MySQL o SQLite. El sistema lee las tablas, columnas y tipos
              y los convierte en datasets editables automaticamente.
            </p>
          </div>
          <div className="info-card">
            <h3 className="info-card__title">Mappings</h3>
            <p className="info-card__desc">
              Editor visual de relaciones entre campos de distintos datasets. Define como se transforman los datos al
              cruzar tablas: copia directa, conversion de tipos, concatenacion o expresiones personalizadas.
            </p>
          </div>
          <div className="info-card">
            <h3 className="info-card__title">Datos con Faker</h3>
            <p className="info-card__desc">
              Cada campo puede configurar una categoria Faker (nombres, emails, direcciones, telefonos, UUIDs, etc.)
              para generar datos realistas automaticamente en el mock server y en los seeds del bundle.
            </p>
          </div>
        </div>
      </div>

      {/* Recursos */}
      <div className="info-section">
        <h2 className="info-section__title">Recursos y APIs</h2>
        <div className="info-grid">
          <div className="info-card">
            <h3 className="info-card__title">OpenAPI / Swagger</h3>
            <p className="info-card__desc">
              Cada proyecto expone un documento OpenAPI 3.1 en <code>/projects/&#123;id&#125;/openapi.json</code> y una
              interfaz Redoc interactiva en <code>/projects/&#123;id&#125;/docs</code>. Compatible con Postman, Insomnia y Swagger UI.
            </p>
          </div>
          <div className="info-card">
            <h3 className="info-card__title">API del Backend</h3>
            <p className="info-card__desc">
              30+ endpoints REST documentados para gestionar proyectos, datasets, endpoints, mappings, shares, webhooks,
              versiones y mock servers. Autenticacion JWT en todas las rutas de escritura.
            </p>
          </div>
          <div className="info-card">
            <h3 className="info-card__title">Instalador</h3>
            <p className="info-card__desc">
              <code>./install.sh</code> para Linux/macOS y <code>install.bat</code> para Windows. Un solo comando configura
              todo el entorno: Python venv, dependencias, admin user, base de datos y datos demo opcionales.
            </p>
          </div>
          <div className="info-card">
            <h3 className="info-card__title">Docker Compose</h3>
            <p className="info-card__desc">
              <code>docker compose up -d --build</code> levanta backend (FastAPI en :8000) y frontend (Vite en :5173) con
              volumenes montados para datos persistentes. Configuracion via variables de entorno.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
