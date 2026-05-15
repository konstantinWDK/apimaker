import { useState } from 'react'
import { DatabaseConfigPanel } from './DatabaseConfigPanel'
import { CredentialPanel } from './CredentialPanel'
import { TestRunnerPanel } from './TestRunnerPanel'

interface Props {
  currentUsername: string
  onUpdateCredentials: (newUsername: string, newPassword: string, currentPassword: string) => Promise<void>
  onResetCredentials: () => Promise<void>
}

export function ConfigPanel({ currentUsername, onUpdateCredentials, onResetCredentials }: Props) {
  const [activeTab, setActiveTab] = useState<'database' | 'admin' | 'tests'>('database')

  return (
    <div className="config-panel">
      <div className="config-panel__tabs">
        <button
          type="button"
          className={activeTab === 'database' ? 'active' : ''}
          onClick={() => setActiveTab('database')}
        >
          Base de datos
        </button>
        <button
          type="button"
          className={activeTab === 'admin' ? 'active' : ''}
          onClick={() => setActiveTab('admin')}
        >
          Administración
        </button>
        <button
          type="button"
          className={activeTab === 'tests' ? 'active' : ''}
          onClick={() => setActiveTab('tests')}
        >
          Tests
        </button>
      </div>

      <div className="config-panel__content">
        {activeTab === 'database' && (
          <div className="config-section">
            <p className="config-section__desc">Configura la conexión a base de datos para desarrollo y producción. Soporta SQLite y PostgreSQL.</p>
            <DatabaseConfigPanel />
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="config-section">
            <p className="config-section__desc">
              Actualiza el usuario y contraseña que protegen este builder. Tras guardar, deberás iniciar sesión de nuevo.
              También puedes restablecer a los valores por defecto (admin / admin).
            </p>
            <CredentialPanel
              currentUsername={currentUsername}
              onUpdate={onUpdateCredentials}
              onReset={onResetCredentials}
            />
            <p className="muted-text" style={{ marginTop: '1rem', fontSize: '0.85rem' }}>
              Consejo: cambia estas credenciales después de cada despliegue y guarda el acceso en un gestor seguro.
            </p>
          </div>
        )}

        {activeTab === 'tests' && (
          <div className="config-section">
            <TestRunnerPanel />
          </div>
        )}
      </div>

      <style>{`
        .config-panel { }
        .config-panel__tabs {
          display: flex; gap: 0; border-bottom: 2px solid #e2e8f0; margin-bottom: 1.5rem;
        }
        .config-panel__tabs button {
          padding: 0.6rem 1.2rem; border: none; background: none;
          font-size: 0.9rem; color: #64748b; cursor: pointer;
          border-bottom: 2px solid transparent; margin-bottom: -2px;
          transition: all 0.15s;
        }
        .config-panel__tabs button:hover { color: #1e293b; }
        .config-panel__tabs button.active {
          color: #3b82f6; border-bottom-color: #3b82f6; font-weight: 600;
        }
        .config-section__desc {
          color: #64748b; font-size: 0.85rem; margin-bottom: 1.25rem;
        }
      `}</style>
    </div>
  )
}
