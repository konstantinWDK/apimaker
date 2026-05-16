import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('doapi-theme') : null
    if (saved) return saved === 'dark'
    return true
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    window.localStorage.setItem('doapi-theme', dark ? 'dark' : 'light')
  }, [dark])

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => setDark(!dark)}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  )
}
