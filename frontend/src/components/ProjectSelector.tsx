import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import type { ProjectDraft } from '../types/schemas'

interface Props {
  project: ProjectDraft
  projects: ProjectDraft[]
  onCreate: () => void
  onSwitchProject: (project: ProjectDraft) => void
  onDelete: (id: string) => void
}

const isSameProject = (left: ProjectDraft, right: ProjectDraft) => {
  const leftKeys = [left.id, left.remoteId, left.slug].filter(Boolean)
  const rightKeys = [right.id, right.remoteId, right.slug].filter(Boolean)
  return leftKeys.some((key) => rightKeys.includes(key))
}

export function ProjectSelector({ project, projects, onCreate, onSwitchProject, onDelete }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const sorted = [...projects].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
  const epCount = project.endpoints?.length ?? 0
  const dsCount = project.datasets?.length ?? 0

  return (
    <div ref={ref} className="project-selector" style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.4rem 0.75rem', borderRadius: 8,
          border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)',
          cursor: 'pointer', minWidth: 180,
        }}
      >
        <div style={{ textAlign: 'left', minWidth: 0 }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {project.name || t('sidebar.newProject')}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            {project.targetStack} · {epCount} ep · {dsCount} ds
          </div>
        </div>
        <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 100, minWidth: 280,
          background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
          borderRadius: 10, padding: '0.35rem',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.6rem 0.4rem 0.7rem', borderBottom: '1px solid var(--border-color)', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('sidebar.projects')}</span>
            <button type="button" onClick={() => { onCreate(); setOpen(false) }}
              style={{ border: 'none', background: 'none', color: 'var(--accent-blue)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', padding: '0.15rem 0.4rem', borderRadius: 4 }}>
              {t('sidebar.new')}
            </button>
          </div>
          {sorted.length === 0 ? (
            <p style={{ padding: '1rem', fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>{t('sidebar.saveHint')}</p>
          ) : sorted.map(item => {
            const active = isSameProject(item, project)
            return (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <button
                  type="button"
                  onClick={() => { onSwitchProject(item); setOpen(false) }}
                  style={{
                    flex: 1, display: 'flex', flexDirection: 'column', gap: '0.1rem',
                    padding: '0.4rem 0.7rem', borderRadius: 6, border: 'none', cursor: 'pointer',
                    textAlign: 'left', fontSize: '0.82rem',
                    background: active ? 'var(--bg-hover)' : 'transparent',
                    color: 'var(--text-primary)', fontWeight: active ? 600 : 400,
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-tertiary)' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {item.targetStack} · {item.endpoints?.length ?? 0} ep · {item.datasets?.length ?? 0} ds
                  </span>
                </button>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); onDelete(item.id) }}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-light)', padding: '0.3rem', borderRadius: 4, fontSize: '1rem', lineHeight: 1 }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-red)'; e.currentTarget.style.background = 'rgba(220,38,38,0.1)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-light)'; e.currentTarget.style.background = 'transparent' }}
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
