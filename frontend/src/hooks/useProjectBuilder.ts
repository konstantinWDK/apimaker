import { create } from 'zustand'

import type { ApiEndpoint, DatasetMeta, ProjectDraft } from '../types/schemas'

interface BuilderState {
  project: ProjectDraft
  history: ProjectDraft[]
  updateProject: (payload: Partial<ProjectDraft>) => void
  setDataset: (dataset: DatasetMeta) => void
  upsertEndpoint: (endpoint: ApiEndpoint) => void
  removeEndpoint: (id: string) => void
  replaceProject: (project: ProjectDraft) => void
  setGenerationResult: (payload: Partial<ProjectDraft>) => void
  saveSnapshot: () => void
  loadSnapshot: (id: string) => void
  deleteSnapshot: (id: string) => void
}

const STORAGE_KEY = 'apimaker-project'
export const PROJECTS_STORAGE_KEY = 'apimaker-projects'
const createId = () => crypto.randomUUID()

const createDefaultProject = (): ProjectDraft => ({
  id: createId(),
  name: 'Nuevo proyecto',
  description: 'Diseña tu API declarando datos y endpoints',
  targetStack: 'fastapi',
  endpoints: [],
})

const sanitizeDataset = (dataset?: DatasetMeta): DatasetMeta | undefined => {
  if (!dataset) return undefined
  return {
    ...dataset,
    sourceType: dataset.sourceType ?? 'manual',
    fields: dataset.fields ?? [],
    sampleRows: dataset.sampleRows ?? [],
  }
}

const loadProject = (): ProjectDraft => {
  if (typeof window === 'undefined') return createDefaultProject()
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return createDefaultProject()
  try {
    const parsed = JSON.parse(raw) as Partial<ProjectDraft>
    return {
      ...createDefaultProject(),
      ...parsed,
      id: parsed.id ?? createId(),
      endpoints: parsed.endpoints ?? [],
      dataset: sanitizeDataset(parsed.dataset),
    }
  } catch {
    return createDefaultProject()
  }
}

const persistProject = (project: ProjectDraft) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
}

const loadProjectHistory = (): ProjectDraft[] => {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem(PROJECTS_STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as ProjectDraft[]
    return parsed.map((item) => ({ ...createDefaultProject(), ...item, dataset: sanitizeDataset(item.dataset) }))
  } catch {
    return []
  }
}

const persistHistory = (history: ProjectDraft[]) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(history))
}

const initialProject = loadProject()
const initialHistory = loadProjectHistory()

export const useProjectBuilder = create<BuilderState>((set) => ({
  project: initialProject,
  history: initialHistory,
  updateProject: (payload) =>
    set((state) => {
      const project = { ...state.project, ...payload }
      persistProject(project)
      return { project }
    }),
  setDataset: (dataset) =>
    set((state) => {
      const project = { ...state.project, dataset }
      persistProject(project)
      return { project }
    }),
  upsertEndpoint: (endpoint) =>
    set((state) => {
      const exists = state.project.endpoints.some((item) => item.id === endpoint.id)
      const endpoints = exists
        ? state.project.endpoints.map((item) => (item.id === endpoint.id ? endpoint : item))
        : [...state.project.endpoints, endpoint]
      const project = { ...state.project, endpoints }
      persistProject(project)
      return { project }
    }),
  removeEndpoint: (id) =>
    set((state) => {
      const project = {
        ...state.project,
        endpoints: state.project.endpoints.filter((item) => item.id !== id),
      }
      persistProject(project)
      return { project }
    }),
  replaceProject: (project) =>
    set((state) => {
      const next = {
        ...createDefaultProject(),
        ...project,
        id: project.id ?? createId(),
        dataset: sanitizeDataset(project.dataset),
        endpoints: project.endpoints ?? [],
        updatedAt: new Date().toISOString(),
      }
      persistProject(next)
      return { project: next, history: state.history }
    }),
  setGenerationResult: (payload) =>
    set((state) => {
      const project = {
        ...state.project,
        ...payload,
        updatedAt: new Date().toISOString(),
      }
      persistProject(project)
      let history = state.history.map((item) => (item.id === project.id ? { ...item, ...project } : item))
      if (!history.some((item) => item.id === project.id)) {
        history = [project, ...history]
      }
      persistHistory(history)
      return { project, history }
    }),
  saveSnapshot: () =>
    set((state) => {
      const snapshot = { ...state.project, updatedAt: new Date().toISOString() }
      const history = [snapshot, ...state.history.filter((item) => item.id !== snapshot.id)]
      persistProject(snapshot)
      persistHistory(history)
      return { project: snapshot, history }
    }),
  loadSnapshot: (id) =>
    set((state) => {
      const found = state.history.find((item) => item.id === id)
      if (!found) return state
      persistProject(found)
      return { project: found }
    }),
  deleteSnapshot: (id) =>
    set((state) => {
      const history = state.history.filter((item) => item.id !== id)
      persistHistory(history)
      if (state.project.id === id) {
        const fallback = history[0] ?? createDefaultProject()
        persistProject(fallback)
        return { project: fallback, history }
      }
      return { history }
    }),
}))
