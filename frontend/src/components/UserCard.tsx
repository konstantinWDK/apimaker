interface Props {
  username: string
  mustChange?: boolean
  onOpenSettings: () => void
  onLogout: () => void
}

export function UserCard({ username, mustChange = false, onOpenSettings, onLogout }: Props) {
  return (
    <div className="user-card">
      <div className="user-card__info">
        <p className="user-card__label">Sesión activa</p>
        <p className="user-card__name">{username}</p>
        {mustChange ? <p className="user-card__warning">Cambia estas credenciales cuanto antes.</p> : null}
      </div>
      <div className="user-card__actions">
        <button type="button" className="user-card__link" onClick={onOpenSettings}>
          Configurar
        </button>
        <span className="user-card__dot">•</span>
        <button type="button" className="user-card__link" onClick={onLogout}>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
