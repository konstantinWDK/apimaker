import { create } from 'zustand'

import type { ApiEndpoint, DatasetMeta, ProjectDraft } from '../types/schemas'

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
  isGenerating: boolean
  setIsGenerating: (val: boolean) => void
}

const STORAGE_KEY = 'apimaker-project'
export const PROJECTS_STORAGE_KEY = 'apimaker-projects'
const createId = () => crypto.randomUUID()

const createDefaultProject = (): ProjectDraft => {
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
  // Explicitly preserve sampleRows from the source dataset
  const sampleRows = (dataset as any).sampleRows ?? dataset.sampleRows ?? []
  return {
    id: dataset.id,
    name: dataset.name,
    sourceType: dataset.sourceType ?? 'manual',
    fields: dataset.fields ?? [],
    sampleRows,
    uploadedFrom: (dataset as any).uploadedFrom,
  }
}

// ─── API helpers ────────────────────────────────────────────────
const getBaseUrl = (): string => {
  if (typeof window === 'undefined') return 'http://localhost:8000'
  return (localStorage.getItem('apimaker-backend-url') || 'http://localhost:8000').replace(/\/$/, '')
}

const getAuthHeaders = (): HeadersInit => {
  const token = typeof window !== 'undefined' ? window.sessionStorage.getItem('apimaker-jwt-token') : null
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

const api = {
  async listProjects(): Promise<ProjectDraft[]> {
    const res = await fetch(`${getBaseUrl()}/projects`)
    if (!res.ok) return []
    const data = await res.json()
    return data.map((p: any) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description || '',
      authMethod: p.auth_method || 'none',
      apiKey: p.api_key || '',
      jwtSecret: p.jwt_secret || '',
      rateLimit: p.rate_limit || 0,
      targetStack: p.target_stack || 'fastapi',
      endpoints: (p.endpoints || []).map((ep: any) => ({
        id: ep.id,
        name: ep.name,
        method: ep.method,
        path: ep.path,
        summary: ep.summary || '',
        operationType: ep.operation_type || 'custom',
      })),
      datasets: p.datasets ? p.datasets.map((d: any) => sanitizeDataset({
        id: d.id,
        name: d.name,
        sourceType: d.source_type,
        fields: (d.fields || []).map((f: any) => ({
          id: createId(),
          name: f.name,
          type: f.type,
          required: f.required,
          description: f.description,
        })),
        sampleRows: d.sample_rows || [],
      })) : (p.dataset ? [sanitizeDataset({
        id: p.dataset.id,
        name: p.dataset.name,
        sourceType: p.dataset.source_type,
        fields: (p.dataset.fields || []).map((f: any) => ({
          id: createId(),
          name: f.name,
          type: f.type,
          required: f.required,
          description: f.description,
        })),
        sampleRows: p.dataset.sample_rows || [],
      })!] : []),
      remoteId: p.slug || p.id,
    }))
  },

  async createProject(draft: ProjectDraft): Promise<ProjectDraft | null> {
    const body: any = {
      name: draft.name,
      slug: draft.slug,
      description: draft.description,
      auth_method: draft.authMethod || 'none',
      api_key: draft.apiKey,
      jwt_secret: draft.jwtSecret,
      rate_limit: draft.rateLimit,
      target_stack: draft.targetStack,
    }
    if (draft.datasets && draft.datasets.length > 0) {
      body.datasets = draft.datasets.map(ds => ({
        id: ds.id,
        name: ds.name,
        source_type: ds.sourceType || 'manual',
        fields: (ds.fields || []).map(f => ({
          name: f.name,
          type: f.type,
          required: f.required ?? true,
          description: f.description,
        })),
        sample_rows: ds.sampleRows || [],
      }))
    }
    const res = await fetch(`${getBaseUrl()}/projects`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    })
    if (!res.ok) return null
    const data = await res.json()
    return {
      id: data.id,
      name: data.name,
      description: data.description || '',
      authMethod: data.auth_method || 'none',
      apiKey: data.api_key || '',
      jwtSecret: data.jwt_secret || '',
      rateLimit: data.rate_limit || 0,
      targetStack: data.target_stack || 'fastapi',
      endpoints: (data.endpoints || []).map((ep: any) => ({
        id: ep.id,
        name: ep.name,
        method: ep.method,
        path: ep.path,
        summary: ep.summary || '',
        operationType: ep.operation_type || 'custom',
      })),
      datasets: (data.datasets || []).map((d: any) => ({
        id: d.id,
        name: d.name,
        sourceType: d.source_type,
        fields: (d.fields || []).map((f: any) => ({
          id: createId(),
          name: f.name,
          type: f.type,
          required: f.required,
          description: f.description,
        })),
        sampleRows: d.sample_rows || [],
      })),
      remoteId: data.slug || data.id,
    }
  },

  async updateProject(id: string, updates: { name?: string; slug?: string; description?: string; auth_method?: string; api_key?: string; jwt_secret?: string; rate_limit?: number; target_stack?: string }): Promise<boolean> {
    const res = await fetch(`${getBaseUrl()}/projects/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    })
    return res.ok
  },

  async syncDataset(projectId: string, dataset: DatasetMeta): Promise<boolean> {
    const res = await fetch(`${getBaseUrl()}/projects/${projectId}/dataset`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        id: dataset.id,
        name: dataset.name,
        source_type: dataset.sourceType,
        fields: (dataset.fields || []).map(f => ({
          name: f.name,
          type: f.type,
          required: f.required ?? true,
          description: f.description,
        })),
        sample_rows: dataset.sampleRows,
      }),
    })
    return res.ok
  },

  async syncEndpoints(projectId: string, endpoints: ApiEndpoint[]): Promise<boolean> {
    const res = await fetch(`${getBaseUrl()}/projects/${projectId}/endpoints`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        endpoints: endpoints.map(ep => ({
          id: ep.id,
          name: ep.name,
          method: ep.method,
          path: ep.path,
          summary: ep.summary,
          operation_type: ep.operationType || 'custom',
          target_dataset_id: ep.targetDatasetId,
        })),
      }),
    })
    return res.ok
  },

  async startMock(projectId: string): Promise<{ ok: boolean; msg?: string }> {
    const res = await fetch(`${getBaseUrl()}/projects/${projectId}/mock/start`, {
      method: 'POST',
      headers: getAuthHeaders(),
    })
    if (!res.ok) {
      const err = await res.text()
      if (err.includes('not found') || err.includes('404')) {
        return { ok: false, msg: 'Proyecto no encontrado. Sincroniza el proyecto primero.' }
      }
      if (err.includes('401') || err.includes('403')) {
        return { ok: false, msg: 'No tienes permisos. Inicia sesión.' }
      }
      return { ok: false, msg: err }
    }
    return { ok: true }
  },

  async stopMock(projectId: string): Promise<boolean> {
    const res = await fetch(`${getBaseUrl()}/projects/${projectId}/mock/stop`, {
      method: 'POST',
      headers: getAuthHeaders(),
    })
    return res.ok
  },

  async getMockStatus(projectId: string): Promise<'running' | 'stopped'> {
    try {
      const res = await fetch(`${getBaseUrl()}/projects/${projectId}/mock/status`)
      if (!res.ok) return 'stopped'
      const data = await res.json()
      return data.status === 'running' ? 'running' : 'stopped'
    } catch {
      return 'stopped'
    }
  },

  async deleteProject(projectId: string): Promise<boolean> {
    const res = await fetch(`${getBaseUrl()}/projects/${projectId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
    return res.ok
  },
}

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

// Persist helper
const persist = (project: ProjectDraft, selectedDatasetId: string | null) => {
  if (typeof window !== 'undefined') {
    const data = { ...project, selectedDatasetId }
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
  isGenerating: false,
  setIsGenerating: (val) => set({ isGenerating: val }),

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
      if (nextProject.remoteId || nextProject.id) {
        const saveId = nextProject.remoteId || nextProject.id
        queueSave(async () => {
          const changes: any = {}
          if (payload.name !== undefined) changes.name = payload.name
          if (payload.description !== undefined) changes.description = payload.description
          if (payload.authMethod !== undefined) changes.auth_method = payload.authMethod
          if (payload.apiKey !== undefined) changes.api_key = payload.apiKey
          if (payload.jwtSecret !== undefined) changes.jwt_secret = payload.jwtSecret
          if (payload.rateLimit !== undefined) changes.rate_limit = payload.rateLimit
          if (payload.targetStack !== undefined) changes.target_stack = payload.targetStack
          if (Object.keys(changes).length > 0) {
            await api.updateProject(saveId, changes)
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
      const saveId = nextProject.remoteId || nextProject.id
      queueSave(async () => {
        // For now, we still use syncDataset but we'll need to update it to handle multiple
        // Or send the first one as primary for compatibility
        await api.syncDataset(saveId, dataset)
      })
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
      const saveId = nextProject.remoteId || nextProject.id
      queueSave(async () => {
        await api.syncEndpoints(saveId, nextEndpoints)
      })
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
        await api.syncEndpoints(saveId, nextEndpoints)
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

      // Ensure the project list also reflects this new project if it's not already there
      const projects = state.projects.find(p => p.id === next.id)
        ? state.projects
        : [next, ...state.projects]

      return { project: next, projects, history: state.history, mockRunning: false, selectedDatasetId: null }
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
          await api.updateProject(snapshot.remoteId, {
            name: snapshot.name,
            description: snapshot.description,
            target_stack: snapshot.targetStack,
          })
          // Sync dataset and endpoints
          if (snapshot.datasets && snapshot.datasets.length > 0) {
            for (const ds of snapshot.datasets) {
              await api.syncDataset(snapshot.remoteId, ds)
            }
          }
          if (snapshot.endpoints.length > 0) {
            await api.syncEndpoints(snapshot.remoteId, snapshot.endpoints)
          }
        } else {
          // Create new project in DB
          const created = await api.createProject(snapshot)
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
      // Create a unified list that includes the current project if it's a local draft
      let unifiedProjects = [...projects]
      const currentIsLocal = !state.project.remoteId
      if (currentIsLocal && !projects.find(p => p.id === state.project.id)) {
        unifiedProjects = [state.project, ...projects]
      }

      const nextState: Partial<BuilderState> = { projects: unifiedProjects }
      
      const currentExists = unifiedProjects.find(p => p.id === state.project.id)
      if (!currentExists && state.project.remoteId) {
        if (unifiedProjects.length > 0) {
          nextState.project = unifiedProjects[0]
        }
      }
      
      return nextState as BuilderState
    }),

  refreshProjects: async () => {
    const projects = await api.listProjects()
    get().loadProjects(projects)
  },

  startMock: async () => {
    const project = get().project
    if (!project.remoteId) {
      set({ mockError: 'Debes guardar el proyecto primero (clic en "Actualizar API")' })
      return
    }
    set({ mockLoading: true, mockError: null })
    const result = await api.startMock(project.remoteId)
    set({ mockLoading: false })
    if (!result.ok) {
      set({ mockRunning: false, mockError: result.msg || 'Error desconocido' })
    } else {
      set({ mockRunning: true, mockError: null })
    }
  },

  stopMock: async () => {
    const project = get().project
    if (!project.remoteId) return
    set({ mockLoading: true })
    const ok = await api.stopMock(project.remoteId)
    set({ mockLoading: false, mockRunning: !ok, mockError: null })
  },

  checkMockStatus: async () => {
    const project = get().project
    if (!project.remoteId && !project.id) return
    const status = await api.getMockStatus(project.remoteId || project.id)
    set({ mockRunning: status === 'running' })
  },

  deleteProject: async (id: string) => {
    // First try to delete from DB (requires remoteId)
    const project = get().projects.find(p => p.id === id)
    if (project && (project.remoteId || project.id)) {
      await api.deleteProject(project.remoteId || project.id)
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
    const token = typeof window !== 'undefined' ? window.sessionStorage.getItem('apimaker-jwt-token') : null
    if (!token) {
      console.error('No hay token de sesión')
      return null
    }

    set({ isGenerating: true })
    try {
      let effectiveId = project.remoteId
      let currentProject = { ...project }

      if (!effectiveId) {
        let created = await api.createProject(currentProject)
        
        if (!created && currentProject.slug) {
          // If creation failed (probably due to unique slug), try to link to existing project
          const all = await api.listProjects()
          const existing = all.find(p => p.slug === currentProject.slug)
          if (existing) {
            created = existing as any
          }
        }

        if (created) {
          effectiveId = created.slug || created.id
          currentProject = { ...currentProject, remoteId: effectiveId }
          set({ project: currentProject })
          persist(currentProject, get().selectedDatasetId)
        } else {
          throw new Error('Error al sincronizar el proyecto con el servidor')
        }
      } else {
        await api.updateProject(effectiveId, {
          name: currentProject.name,
          slug: currentProject.slug,
          description: currentProject.description,
          auth_method: currentProject.authMethod,
          api_key: currentProject.apiKey,
          jwt_secret: currentProject.jwtSecret,
          rate_limit: currentProject.rateLimit,
          target_stack: currentProject.targetStack,
        })
      }

      // Sync datasets and endpoints
      if (effectiveId) {
        if (currentProject.datasets.length > 0) {
          for (const ds of currentProject.datasets) {
            await api.syncDataset(effectiveId, ds)
          }
        }
        if (currentProject.endpoints.length > 0) {
          await api.syncEndpoints(effectiveId, currentProject.endpoints)
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
      console.error('Error saving project:', error)
      return null
    } finally {
      set({ isGenerating: false })
    }
  },
}))
