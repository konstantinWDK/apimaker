import type { GenerationResult, ProjectDraft } from '../types/schemas'

export interface ShareSnapshot {
  id: string
  slug: string
  createdAt: string
  project: ProjectDraft
  result: GenerationResult
}

const SHARE_STORAGE_KEY = 'apimaker-share-snapshots'

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const readStore = (): Record<string, ShareSnapshot> => {
  if (typeof window === 'undefined') return {}
  const raw = window.localStorage.getItem(SHARE_STORAGE_KEY)
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, ShareSnapshot>
  } catch {
    return {}
  }
}

const persistStore = (records: Record<string, ShareSnapshot>) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SHARE_STORAGE_KEY, JSON.stringify(records))
}

export const saveShareSnapshot = (snapshot: ShareSnapshot) => {
  if (typeof window === 'undefined') return
  const store = readStore()
  store[snapshot.id] = clone(snapshot)
  persistStore(store)
}

export const getShareSnapshot = (id: string): ShareSnapshot | null => {
  if (!id) return null
  const store = readStore()
  return store[id] ?? null
}

export const listShareSnapshots = (): ShareSnapshot[] => Object.values(readStore())
