import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'

interface NavItem {
  label: string
  path: string
  icon?: React.ReactNode
}

interface Props {
  label: string
  icon: React.ReactNode
  items: NavItem[]
}

export function NavDropdown({ label, icon, items }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const location = useLocation()

  const isActive = items.some(item =>
    location.pathname === item.path || location.pathname.startsWith(item.path + '/')
  )

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="nav-dropdown" style={{ position: 'relative' }}>
      <button
        type="button"
        className={`nav-button ${isActive ? 'active' : ''}`}
        onClick={() => setOpen(!open)}
        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
      >
        {icon}
        <span>{label}</span>
        <ChevronDown size={12} style={{
          transition: 'transform 0.15s',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        }} />
      </button>
      {open && (
        <div
          className="nav-dropdown-menu"
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 100,
            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
            borderRadius: 10, padding: '0.35rem', minWidth: 180,
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          }}
        >
          {items.map(item => (
            <button
              key={item.path}
              type="button"
              className={`nav-dropdown-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => { navigate(item.path); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%',
                padding: '0.45rem 0.7rem', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: '0.82rem', fontWeight: 500, textAlign: 'left',
                background: location.pathname === item.path ? 'var(--bg-hover)' : 'transparent',
                color: location.pathname === item.path ? 'var(--accent-blue)' : 'var(--text-secondary)',
              }}
              onMouseEnter={e => { if (location.pathname !== item.path) e.currentTarget.style.background = 'var(--bg-tertiary)' }}
              onMouseLeave={e => { if (location.pathname !== item.path) e.currentTarget.style.background = 'transparent' }}
            >
              {item.icon && <span style={{ display: 'flex' }}>{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
