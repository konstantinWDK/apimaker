import { type PropsWithChildren } from 'react'
import { clsx } from 'clsx'

interface Props extends PropsWithChildren {
  title: string
  subtitle?: string
  accent?: 'sky' | 'emerald' | 'slate' | 'amber'
  fullWidth?: boolean
}

export function SectionCard({ title, subtitle, children, accent = 'slate', fullWidth = false }: Props) {
  const hasHeader = title || subtitle
  return (
    <section className={clsx('section-card', `section-card--${accent}`, fullWidth && 'section-card--full')}>
      {hasHeader && (
        <div className="section-card__header">
          <h2 className="section-card__title">{title}</h2>
          {subtitle ? <p className="section-card__subtitle">{subtitle}</p> : null}
        </div>
      )}
      {children}
    </section>
  )
}
