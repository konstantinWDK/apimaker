/**
 * DocsPage — Extracted from App.tsx
 * Shows architecture documentation, stack details, workflow, integrations, and resources.
 */
export function DocsPage() {
  return (
    <div className="info-page">
      <div className="info-hero">
        <div className="info-hero__content">
          <h1 className="info-hero__title">Documentación</h1>
          <p className="info-hero__subtitle">
            Arquitectura, stacks de implementación y guía de uso de API Maker
          </p>
        </div>
      </div>

      {/* Arquitectura */}
      <div className="info-section">
        <h2 className="info-section__title">Arquitectura</h2>
        <p className="muted-text" style={{ marginBottom: '1rem' }}>
          API Maker genera código listo para producción separado en capas bien definidas.
        </p>
        <div className="info-stacks">
          <div className="info-stack">
            <div className="info-stack__head">
              <span className="info-stack__dot" style={{ background: '#6366f1' }} />
              <strong>Modelos / Schemas</strong>
            </div>
            <p className="info-stack__desc">
              Define tus datasets con tipos, validaciones y relaciones. Se traducen a SQLModel (Python),
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
              más rutas personalizadas. Cada endpoint se vincula a un dataset.
            </p>
          </div>
          <div className="info-stack">
            <div className="info-stack__head">
              <span className="info-stack__dot" style={{ background: '#10b981' }} />
              <strong>Seguridad</strong>
            </div>
            <p className="info-stack__desc">
              JWT, API Key, rate limiting y roles incluidos en el código generado. Configura desde el panel
              de seguridad antes de generar.
            </p>
          </div>
          <div className="info-stack">
            <div className="info-stack__head">
              <span className="info-stack__dot" style={{ background: '#f59e0b' }} />
              <strong>Despliegue</strong>
            </div>
            <p className="info-stack__desc">
              Docker Compose multi-etapa, seeds automáticos, health checks y configuración de entorno
              incluidos en el bundle generado.
            </p>
          </div>
        </div>
      </div>

      {/* Stacks de implementación */}
      <div className="info-section">
        <h2 className="info-section__title">Stacks de Implementación</h2>
        <div className="info-stacks" style={{ gap: '0.75rem' }}>
          <div className="info-stack">
            <div className="info-stack__head">
              <span className="info-stack__dot" style={{ background: '#3b82f6' }} />
              <strong>FastAPI (Python)</strong>
              <span className="info-stack__badge">Recomendado</span>
            </div>
            <p className="info-stack__desc">
              Framework moderno con soporte async, documentación OpenAPI automática, Pydantic v2 para validación,
              SQLAlchemy + SQLModel para base de datos. Ideal para APIs de alto rendimiento.
            </p>
          </div>
          <div className="info-stack">
            <div className="info-stack__head">
              <span className="info-stack__dot" style={{ background: '#10b981' }} />
              <strong>Express (Node.js)</strong>
            </div>
            <p className="info-stack__desc">
              Framework Node.js maduro con Sequelize ORM, Swagger automático, JWT, rate limiting y
              Docker Compose con PostgreSQL.
            </p>
          </div>
          <div className="info-stack">
            <div className="info-stack__head">
              <span className="info-stack__dot" style={{ background: '#8b5cf6' }} />
              <strong>NestJS (Node.js)</strong>
            </div>
            <p className="info-stack__desc">
              Arquitectura modular con TypeORM, decoradores Swagger, AuthGuard, DTOs tipados y
              estructura empresarial lista para producción.
            </p>
          </div>
        </div>
      </div>

      {/* Cómo usar */}
      <div className="info-section">
        <h2 className="info-section__title">Flujo de Trabajo</h2>
        <div className="info-steps">
          <div className="info-step">
            <span className="info-step__num">1</span>
            <div>
              <strong>Define tus Datasets</strong>
              <p>Crea modelos con tipos de campo, valores por defecto, enumeraciones y relaciones. Puedes importar desde CSV, Excel o bases de datos externas.</p>
            </div>
          </div>
          <div className="info-step">
            <span className="info-step__num">2</span>
            <div>
              <strong>Diseña Endpoints REST</strong>
              <p>Genera rutas CRUD automáticas vinculadas a tus datasets o crea endpoints personalizados. El Simulador te permite probarlos en vivo.</p>
            </div>
          </div>
          <div className="info-step">
            <span className="info-step__num">3</span>
            <div>
              <strong>Configura Relaciones (Mappings)</strong>
              <p>Usa el tab Mappings para conectar campos entre datasets, modelando claves foráneas y transformaciones de datos.</p>
            </div>
          </div>
          <div className="info-step">
            <span className="info-step__num">4</span>
            <div>
              <strong>Prueba con el Simulador</strong>
              <p>Lanza el mock server y prueba todos tus endpoints en tiempo real con datos de ejemplo generados automáticamente.</p>
            </div>
          </div>
          <div className="info-step">
            <span className="info-step__num">5</span>
            <div>
              <strong>Genera y Despliega</strong>
              <p>Descarga el bundle con código listo para producción (Docker, tests, seeds, documentación) y despliega donde quieras.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Integraciones */}
      <div className="info-section">
        <h2 className="info-section__title">Integraciones</h2>
        <div className="info-grid">
          <div className="info-card">
            <h3 className="info-card__title">Webhooks</h3>
            <p className="info-card__desc">
              Configura notificaciones a URLs externas cuando los datos cambian. Soporta eventos create, update y delete.
            </p>
          </div>
          <div className="info-card">
            <h3 className="info-card__title">Base de Datos Externa</h3>
            <p className="info-card__desc">
              Conecta e introspecciona esquemas de PostgreSQL, MySQL o SQLite para importarlos como datasets automáticamente.
            </p>
          </div>
          <div className="info-card">
            <h3 className="info-card__title">Mappings</h3>
            <p className="info-card__desc">
              Mapeo visual de campos entre datasets con soporte para transformaciones directas, conversión de tipos y formato.
            </p>
          </div>
          <div className="info-card">
            <h3 className="info-card__title">SDKs Generados</h3>
            <p className="info-card__desc">
              Clientes TypeScript y Python generados automáticamente para consumir tu API desde cualquier aplicación.
            </p>
          </div>
        </div>
      </div>

      {/* Recursos */}
      <div className="info-section">
        <h2 className="info-section__title">Recursos</h2>
        <div className="info-grid">
          <div className="info-card">
            <h3 className="info-card__title">OpenAPI / Swagger</h3>
            <p className="info-card__desc">
              Cada proyecto genera un documento OpenAPI 3.1 completo accesible desde <code>/projects/&#123;id&#125;/openapi.json</code> y una interfaz Redoc en <code>/projects/&#123;id&#125;/docs</code>.
            </p>
          </div>
          <div className="info-card">
            <h3 className="info-card__title">Versiones</h3>
            <p className="info-card__desc">
              El panel de versiones mantiene un historial de cambios de tu proyecto. Puedes crear, listar y restaurar versiones anteriores.
            </p>
          </div>
          <div className="info-card">
            <h3 className="info-card__title">Compartir</h3>
            <p className="info-card__desc">
              Crea snapshots de solo lectura con protección por contraseña y expiración para compartir tu API sin dar acceso al editor.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
