import { create } from 'zustand'

import type { ApiEndpoint, DatasetMeta, ProjectDraft } from '../types/schemas'
import { fireToast } from '../components/Toast'
import {
  fetchRemoteProjects,
  createProjectFromDraft,
  updateProject as updateRemoteProject,
  syncDataset as syncDatasetRemote,
  syncEndpoints as syncEndpointsRemote,
  startMockServer,
  stopMockServer,
  getMockStatus as getMockServerStatus,
  deleteRemoteProject,
} from '../lib/api'

interface BuilderState {
  project: ProjectDraft
  history: ProjectDraft[]
  projects: ProjectDraft[]
  selectedDatasetId: string | null
  mockRunning: boolean
  mockLoading: boolean
  mockError: string | null
  startMock: () => Promise<void>
  stopMock: () => Promise<void>
  checkMockStatus: () => Promise<void>
  deleteProject: (id: string) => Promise<void>
  updateProject: (payload: Partial<ProjectDraft>) => void
  upsertDataset: (dataset: DatasetMeta) => void
  removeDataset: (id: string) => void
  upsertEndpoint: (endpoint: ApiEndpoint) => void
  removeEndpoint: (id: string) => void
  replaceProject: (project: ProjectDraft) => void
  setGenerationResult: (payload: Partial<ProjectDraft>) => void
  setSelectedDatasetId: (id: string | null) => void
  saveSnapshot: () => void
  loadSnapshot: (id: string) => void
  deleteSnapshot: (id: string) => void
  loadProjects: (projects: ProjectDraft[]) => void
  refreshProjects: () => Promise<void>
  saveProject: () => Promise<string | null>
  isSyncing: boolean
  setIsSyncing: (val: boolean) => void
  isGenerating: boolean
  setIsGenerating: (val: boolean) => void
  globalDeployState: 'idle' | 'deploying' | 'success' | 'error'
  globalDeployStatus: string
  setGlobalDeployState: (state: 'idle' | 'deploying' | 'success' | 'error', status?: string) => void
}

const STORAGE_KEY = 'doapi-project'
export const PROJECTS_STORAGE_KEY = 'doapi-projects'
const createId = () => crypto.randomUUID()

export const createDefaultProject = (): ProjectDraft => {
  const id = createId()
  return {
    id,
    name: 'Nueva API',
    description: 'Diseña tu API declarando datos y endpoints',
    authMethod: 'none',
    targetStack: 'fastapi',
    endpoints: [],
    datasets: [
      {
        id: createId(),
        name: 'Usuarios',
        sourceType: 'manual',
        fields: [
          { id: createId(), name: 'nombre', type: 'string', required: true, description: 'Nombre del usuario' },
          { id: createId(), name: 'email', type: 'string', required: true, description: 'Correo electrónico' }
        ],
        sampleRows: [
          { nombre: 'Juan Perez', email: 'juan@example.com' }
        ]
      }
    ]
  }
}


const sanitizeDataset = (dataset?: DatasetMeta): DatasetMeta | undefined => {
  if (!dataset) return undefined
  // Explicitly preserve all properties from the source dataset
  const sampleRows = (dataset as any).sampleRows ?? dataset.sampleRows ?? []
  const savedRequests = (dataset as any).savedRequests ?? (dataset as any).saved_requests ?? dataset.savedRequests ?? []
  return {
    id: dataset.id,
    name: dataset.name,
    sourceType: dataset.sourceType ?? 'manual',
    fields: (dataset.fields ?? []).map((f) => ({
      ...f,
      id: f.id || crypto.randomUUID(),
    })),
    sampleRows,
    savedRequests,
    description: dataset.description,
    icon: dataset.icon,
    uploadedFrom: (dataset as any).uploadedFrom,
  }
}

// ─── API helpers ────────────────────────────────────────────────
// All API calls now come from lib/api.ts — no duplication.

// ─── Debounced save queue ──────────────────────────────────────
let saveTimeout: ReturnType<typeof setTimeout> | null = null
let pendingSave: (() => void) | null = null

const queueSave = (fn: () => void) => {
  pendingSave = fn
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => {
    if (pendingSave) {
      pendingSave()
      pendingSave = null
    }
  }, 1000)  // 1s debounce
}

// ─── Store ─────────────────────────────────────────────────────
// Load from localStorage on startup
const loadFromStorage = (): { project: ProjectDraft; selectedDatasetId: string | null } => {
  if (typeof window === 'undefined') return { project: createDefaultProject(), selectedDatasetId: null }
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return { project: createDefaultProject(), selectedDatasetId: null }
  try {
    const parsed = JSON.parse(raw) as Partial<ProjectDraft> & { selectedDatasetId?: string | null }
    return {
      project: {
        ...createDefaultProject(),
        ...parsed,
        id: parsed.id ?? createId(),
        endpoints: parsed.endpoints ?? [],
        datasets: (parsed as any).datasets ? (parsed as any).datasets.map(sanitizeDataset) : ((parsed as any).dataset ? [sanitizeDataset((parsed as any).dataset)] : []),
      },
      selectedDatasetId: parsed.selectedDatasetId ?? null,
    }
  } catch {
    return { project: createDefaultProject(), selectedDatasetId: null }
  }
}

// Persist helper — strips sensitive fields before writing to localStorage
const persist = (project: ProjectDraft, selectedDatasetId: string | null) => {
  if (typeof window !== 'undefined') {
    const { apiKey, jwtSecret, ...safe } = project
    const data = { ...safe, selectedDatasetId }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }
}

const initialProject = loadFromStorage()

export const useProjectBuilder = create<BuilderState>((set, get) => ({
  project: initialProject.project,
  history: [],
  projects: [],
  selectedDatasetId: initialProject.selectedDatasetId,
  mockRunning: false,
  mockLoading: false,
  mockError: null,
  isSyncing: false,
  setIsSyncing: (val) => set({ isSyncing: val }),
  isGenerating: false,
  setIsGenerating: (val) => set({ isGenerating: val }),
  globalDeployState: 'idle',
  globalDeployStatus: '',
  setGlobalDeployState: (state, status = '') => set({ globalDeployState: state, globalDeployStatus: status }),

  setSelectedDatasetId: (id) =>
    set((state) => {
      persist(state.project, id)
      return { selectedDatasetId: id }
    }),

  updateProject: (payload) =>
    set((state) => {
      const nextProject = { ...state.project, ...payload, updatedAt: new Date().toISOString() }
      persist(nextProject, state.selectedDatasetId)

      // Update the project in the projects list too
      const nextProjects = state.projects.map(p => p.id === nextProject.id ? nextProject : p)

      // Queue API save
      if (nextProject.remoteId) {
        const saveId = nextProject.remoteId
        queueSave(async () => {
          const changes: any = {}
          if (payload.name !== undefined) changes.name = payload.name
          if (payload.description !== undefined) changes.description = payload.description
          if (payload.authMethod !== undefined) changes.auth_method = payload.authMethod
          if (payload.apiKey !== undefined) changes.api_key = payload.apiKey
          if (payload.jwtSecret !== undefined) changes.jwt_secret = payload.jwtSecret
          if (payload.rateLimit !== undefined) changes.rate_limit = payload.rateLimit
          if (payload.targetStack !== undefined) changes.target_stack = payload.targetStack
          if (payload.includeData !== undefined) changes.include_data = payload.includeData
          if (Object.keys(changes).length > 0) {
            await updateRemoteProject(saveId, changes)
          }
        })
      }
      return { project: nextProject, projects: nextProjects }
    }),

  upsertDataset: (dataset) =>
    set((state) => {
      const exists = state.project.datasets.find((d) => d.id === dataset.id)
      const nextDatasets = exists
        ? state.project.datasets.map((d) => (d.id === dataset.id ? sanitizeDataset(dataset)! : d))
        : [...state.project.datasets, sanitizeDataset(dataset)!]

      const nextProject = { ...state.project, datasets: nextDatasets, updatedAt: new Date().toISOString() }
      persist(nextProject, state.selectedDatasetId)

      const nextProjects = state.projects.map(p => p.id === nextProject.id ? nextProject : p)
      if (nextProject.remoteId) {
        const saveId = nextProject.remoteId
        queueSave(async () => {
          await syncDatasetRemote(saveId, dataset)
        })
      }
      return { project: nextProject, projects: nextProjects }
    }),

  removeDataset: (id) =>
    set((state) => {
      const nextDatasets = state.project.datasets.filter((d) => d.id !== id)
      const nextProject = { ...state.project, datasets: nextDatasets, updatedAt: new Date().toISOString() }
      persist(nextProject, state.selectedDatasetId)
      const nextProjects = state.projects.map(p => p.id === nextProject.id ? nextProject : p)
      return { project: nextProject, projects: nextProjects }
    }),

  upsertEndpoint: (endpoint) =>
    set((state) => {
      const exists = state.project.endpoints.find((e) => e.id === endpoint.id)
      const nextEndpoints = exists
        ? state.project.endpoints.map((e) => (e.id === endpoint.id ? endpoint : e))
        : [...state.project.endpoints, endpoint]

      const nextProject = { ...state.project, endpoints: nextEndpoints, updatedAt: new Date().toISOString() }
      persist(nextProject, state.selectedDatasetId)

      // Update the project in the projects list too
      const nextProjects = state.projects.map(p => p.id === nextProject.id ? nextProject : p)

      // Queue API save
      if (nextProject.remoteId) {
        const saveId = nextProject.remoteId
        queueSave(async () => {
          await syncEndpointsRemote(saveId, nextEndpoints)
        })
      }
      return { project: nextProject, projects: nextProjects }
    }),

  removeEndpoint: (id) =>
    set((state) => {
      const nextEndpoints = state.project.endpoints.filter((e) => e.id !== id)
      const nextProject = { ...state.project, endpoints: nextEndpoints, updatedAt: new Date().toISOString() }
      persist(nextProject, state.selectedDatasetId)

      // Update the project in the projects list too
      const nextProjects = state.projects.map(p => p.id === nextProject.id ? nextProject : p)

      // Queue API save
      const saveId = nextProject.remoteId || nextProject.id
      queueSave(async () => {
        await syncEndpointsRemote(saveId, nextEndpoints)
      })
      return { project: nextProject, projects: nextProjects }
    }),

  replaceProject: (project) =>
    set((state) => {
      const next = {
        ...createDefaultProject(),
        ...project,
        id: project.id ?? createId(),
        datasets: (project as any).datasets ? (project as any).datasets.map(sanitizeDataset) : ((project as any).dataset ? [sanitizeDataset((project as any).dataset)] : []),
        endpoints: project.endpoints ?? [],
        updatedAt: new Date().toISOString(),
      }
      persist(next, null)

      // Auto-select first dataset
      const firstDsId = next.datasets.length > 0 ? next.datasets[0].id : null

      // Ensure the project list also reflects this new project if it's not already there
      const projects = state.projects.find(p => p.id === next.id)
        ? state.projects
        : [next, ...state.projects]

      return { project: next, projects, history: state.history, mockRunning: false, selectedDatasetId: firstDsId }
    }),

  setGenerationResult: (payload) =>
    set((state) => {
      const project = {
        ...state.project,
        ...payload,
        updatedAt: new Date().toISOString(),
      }
      persist(project, state.selectedDatasetId)
      let history = state.history.map((item) => (item.id === project.id ? { ...item, ...project } : item))
      if (!history.some((item) => item.id === project.id)) {
        history = [project, ...history]
      }
      return { project, history }
    }),

  saveSnapshot: () =>
    set((state) => {
      const snapshot = { ...state.project, updatedAt: new Date().toISOString() }
      const history = [snapshot, ...state.history.filter((item) => item.id !== snapshot.id)]
      persist(snapshot, state.selectedDatasetId)
      // Also save to database
      const saveProject = async () => {
        if (snapshot.remoteId) {
          // Already exists, update
          await updateRemoteProject(snapshot.remoteId, {
            name: snapshot.name,
            description: snapshot.description,
            target_stack: snapshot.targetStack,
          })
          // Sync dataset and endpoints
          if (snapshot.datasets && snapshot.datasets.length > 0) {
            for (const ds of snapshot.datasets) {
              await syncDatasetRemote(snapshot.remoteId, ds)
            }
          }
          if (snapshot.endpoints.length > 0) {
            await syncEndpointsRemote(snapshot.remoteId, snapshot.endpoints)
          }
        } else {
          // Create new project in DB
          const created = await createProjectFromDraft(snapshot)
          if (created) {
            // Update the project with the server-assigned ID
            persist(created, state.selectedDatasetId)
            set((s) => ({
              project: created,
              history: [created, ...s.history.filter((item) => item.id !== snapshot.id)],
            }))
          }
        }
      }
      saveProject()
      // Refresh projects list
      get().refreshProjects()
      return { project: snapshot, history }
    }),

  loadSnapshot: (id) =>
    set((state) => {
      const found = state.history.find((item) => item.id === id)
      if (!found) return state
      persist(found, state.selectedDatasetId)
      return { project: found }
    }),

  deleteSnapshot: (id) =>
    set((state) => {
      const history = state.history.filter((item) => item.id !== id)
      if (state.project.id === id) {
        const fallback = history[0] ?? createDefaultProject()
        persist(fallback, state.selectedDatasetId)
        return { project: fallback, history }
      }
      return { history }
    }),

  loadProjects: (projects) =>
    set((state) => {
      // SAFEGUARD: Always preserve the current localStorage project
      let unifiedProjects = [...projects]
      const currentProject = state.project
      const currentInBackend = projects.find(p => p.id === currentProject.id)

      // Add current project to list if not already present
      if (!currentInBackend) {
        unifiedProjects = [currentProject, ...projects]
      }

      const nextState: Partial<BuilderState> = { projects: unifiedProjects }

      // Only replace current project if we have a valid backend project
      // AND the current one is a stale remote project (not localStorage)
      const currentExists = unifiedProjects.find(p => p.id === currentProject.id)
      if (!currentExists && currentProject.remoteId && unifiedProjects.length > 0) {
        nextState.project = unifiedProjects[0]
      }

      return nextState as BuilderState
    }),

  refreshProjects: async () => {
    const projects = await fetchRemoteProjects()
    get().loadProjects(projects)
  },

  startMock: async () => {
    const project = get().project
    const pid = project.remoteId || project.slug || project.id
    if (!pid) {
      set({ mockError: 'Save the project first.' })
      return
    }
    set({ mockLoading: true, mockError: null })
    try {
      const result = await startMockServer(pid)
      set({ mockLoading: false })
      if (!result.ok) {
        set({ mockRunning: false, mockError: result.msg || 'Unknown error' })
      } else {
        set({ mockRunning: true, mockError: null })
      }
    } catch (e) {
      set({ mockLoading: false, mockRunning: false, mockError: String(e) })
    }
  },

  stopMock: async () => {
    const project = get().project
    const pid = project.remoteId || project.slug || project.id
    if (!pid) return
    set({ mockLoading: true })
    const ok = await stopMockServer(pid)
    set({ mockLoading: false, mockRunning: !ok, mockError: null })
  },

  checkMockStatus: async () => {
    const project = get().project
    if (!project.remoteId && !project.id) return
    try {
      const status = await getMockServerStatus(project.remoteId || project.id)
      set({ mockRunning: status === 'running' })
    } catch {
      set({ mockRunning: false })
    }
  },

  deleteProject: async (id: string) => {
    // First try to delete from DB (requires remoteId)
    const project = get().projects.find(p => p.id === id)
    if (project && (project.remoteId || project.id)) {
      try {
        await deleteRemoteProject(project.remoteId || project.id)
      } catch {
        // Ignore backend errors during local deletion
      }
    }
    // Also clear from localStorage if it's the current project
    const state = get()
    if (state.project.id === id) {
      const remaining = get().projects.filter(p => p.id !== id)
      const next = remaining.length > 0 ? remaining[0] : createDefaultProject()
      persist(next, null)
      set({ project: next, selectedDatasetId: null })
    }
    // Refresh projects list
    await get().refreshProjects()
  },

  saveProject: async () => {
    const { project, refreshProjects } = get()
    const token = typeof window !== 'undefined' ? window.sessionStorage.getItem('doapi-jwt-token') : null
    if (!token) {
      fireToast('No hay sesión activa. Inicia sesión primero.', 'error')
      return null
    }

    set({ isSyncing: true })
    try {
      let effectiveId = project.remoteId
      let currentProject = { ...project }

      if (!effectiveId) {
        let created = await createProjectFromDraft(currentProject)
        
        if (!created && currentProject.slug) {
          // If creation failed (probably due to unique slug), try to link to existing project
          const all = await fetchRemoteProjects()
          const existing = all.find(p => p.slug === currentProject.slug)
          if (existing) {
            created = existing as any
          }
        }

        if (created) {
          effectiveId = created.slug || created.id
          currentProject = { ...currentProject, id: created.id, remoteId: effectiveId }
          set({ project: currentProject })
          persist(currentProject, get().selectedDatasetId)
        } else {
          throw new Error('Error al sincronizar el proyecto con el servidor')
        }
      } else {
        const updated = await updateRemoteProject(effectiveId, {
          name: currentProject.name,
          slug: currentProject.slug,
          description: currentProject.description,
          auth_method: currentProject.authMethod,
          api_key: currentProject.apiKey,
          jwt_secret: currentProject.jwtSecret,
          rate_limit: currentProject.rateLimit,
          target_stack: currentProject.targetStack,
          include_data: currentProject.includeData,
        })
        if (!updated) {
          // Project might have been deleted on backend; try to find by slug or recreate
          const all = await fetchRemoteProjects()
          const existing = all.find(p => p.slug === currentProject.slug)
          if (existing) {
            effectiveId = existing.slug || existing.id
            currentProject = { ...currentProject, id: existing.id, remoteId: effectiveId }
            set({ project: currentProject })
            persist(currentProject, get().selectedDatasetId)
          } else {
            let created = await createProjectFromDraft(currentProject)
            if (created) {
              effectiveId = created.slug || created.id
              currentProject = { ...currentProject, id: created.id, remoteId: effectiveId }
              set({ project: currentProject })
              persist(currentProject, get().selectedDatasetId)
            } else {
              throw new Error('Error al sincronizar el proyecto con el servidor')
            }
          }
        }
      }

      // Sync datasets and endpoints
      if (effectiveId) {
        if (currentProject.datasets.length > 0) {
          for (const ds of currentProject.datasets) {
            await syncDatasetRemote(effectiveId, ds)
          }
        }
        if (currentProject.endpoints.length > 0) {
          await syncEndpointsRemote(effectiveId, currentProject.endpoints)
        }
        
        // Update remoteId in state if slug changed
        const finalId = currentProject.slug || effectiveId
        set((state) => ({
          project: { ...state.project, remoteId: finalId },
          projects: state.projects.map(p => p.id === state.project.id ? { ...p, remoteId: finalId, slug: currentProject.slug } : p)
        }))
        effectiveId = finalId
      }

      await refreshProjects()
      // Use latest from store after refresh
      const currentState = get()
      persist(currentState.project, currentState.selectedDatasetId)
      return effectiveId
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error desconocido al guardar'
      fireToast(msg, 'error')
      return null
    } finally {
      set({ isSyncing: false })
    }
  },
}))
