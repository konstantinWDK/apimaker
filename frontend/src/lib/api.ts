import type { MappingRule, ProjectDraft } from '../types/schemas'
import { readBackendConfig } from './backendConfig'

const cleanBaseUrl = (value: string) => value.replace(/\/$/, '')

export const readToken = (): string | null =>
  typeof window !== 'undefined' ? window.sessionStorage.getItem('apimaker-jwt-token') : null

export const apiFetch = async (path: string, init?: RequestInit) => {
  const token = readToken()
  const config = readBackendConfig()
  const baseUrl = config.baseUrl?.replace(/\/$/, '') || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8000')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers as Record<string, string> || {}) },
  })
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'Error al contactar el backend')
  }
  return response
}

const handleResponse = async (response: Response) => {
  if (response.ok) {
    if (response.status === 204) return null
    return response.json()
  }
  const message = await response.text()
  // Try to parse FastAPI error response
  try {
    const parsed = JSON.parse(message)
    const detail = typeof parsed.detail === 'string' ? parsed.detail : JSON.stringify(parsed.detail)
    throw new Error(detail)
  } catch (e) {
    if (e instanceof Error) throw e
    throw new Error(message || 'Error en la API del backend')
  }
}

const buildHeaders = (): HeadersInit => {
  const { apiKey } = readBackendConfig()
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  // Prefer JWT token over API key
  if (typeof window !== 'undefined') {
    const token = window.sessionStorage.getItem('apimaker-jwt-token')
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    } else if (apiKey) {
      headers['X-API-Key'] = apiKey
    }
  } else if (apiKey) {
    headers['X-API-Key'] = apiKey
  }
  return headers
}

const ensureAuthToken = async (): Promise<string | null> => {
  // Check if we already have a JWT token
  if (typeof window !== 'undefined') {
    const existing = window.sessionStorage.getItem('apimaker-jwt-token')
    if (existing) return existing
  }
  // No token — user needs to login manually
  return null

}
const ensureBaseUrl = (): string => {
  const { baseUrl } = readBackendConfig()
  if (!baseUrl) throw new Error('Configura la URL del backend antes de sincronizar')
  return cleanBaseUrl(baseUrl)
}

const toFieldPayload = (field: ProjectDraft['datasets'][0]['fields'][0]) => ({
  name: field.name,
  type: field.type,
  required: field.required,
  description: field.description,
  is_primary_key: field.isPrimaryKey ?? false,
  default_value: field.defaultValue,
  faker_category: field.fakerCategory,
  enum_values: field.enum ?? null,
  references: field.references ?? null,
})

const toDatasetsPayload = (project: ProjectDraft) => {
  return project.datasets.map((dataset) => ({
    id: dataset.id,
    name: dataset.name,
    source_type: dataset.sourceType ?? 'manual',
    fields: dataset.fields.map(toFieldPayload),
    sample_rows: dataset.sampleRows || [],
  }))
}

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

const normalizeEndpointId = (endpointId: string) => {
  if (isUuid(endpointId)) return endpointId
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export interface SyncResult {
  remoteId: string
  docsUrl: string
  openapiUrl: string
}

/**
 * Sync a local project draft with the backend.
 * Creates the project if no remoteId exists, otherwise updates dataset + endpoints.
 */
export const syncProjectWithBackend = async (project: ProjectDraft): Promise<SyncResult> => {
  const baseUrl = ensureBaseUrl()
  // Auto-login if no token
  await ensureAuthToken()
  const headers = buildHeaders()
  let remoteId = project.remoteId

  if (!remoteId) {
    const createResponse = await fetch(`${baseUrl}/projects`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: project.name,
        description: project.description,
        target_stack: project.targetStack,
        workspace_id: (project as any).workspaceId,
      }),
    })
    const created = await handleResponse(createResponse)
    remoteId = created.id
  }

  if (!remoteId) {
    throw new Error('No se pudo obtener el identificador remoto del proyecto')
  }

  const datasetsPayload = toDatasetsPayload(project)
  for (const dsPayload of datasetsPayload) {
    const datasetResponse = await fetch(`${baseUrl}/projects/${remoteId}/dataset`, {
      method: 'POST',
      headers,
      body: JSON.stringify(dsPayload),
    })
    await handleResponse(datasetResponse)
  }

  const endpointsResponse = await fetch(`${baseUrl}/projects/${remoteId}/endpoints`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      endpoints: project.endpoints.map((endpoint) => ({
        ...endpoint,
        id: normalizeEndpointId(endpoint.id),
      })),
    }),
  })
  await handleResponse(endpointsResponse)

  return {
    remoteId,
    docsUrl: `${baseUrl}/projects/${remoteId}/docs`,
    openapiUrl: `${baseUrl}/projects/${remoteId}/openapi.json`,
  }
}

/**
 * Fetch all projects from the backend.
 */
/**
 * Map a backend project response to ProjectDraft.
 */
const mapProjectResponse = (item: any): ProjectDraft => ({
  id: item.id,
  remoteId: item.slug || item.id,
  slug: item.slug,
  name: item.name,
  description: item.description || '',
  authMethod: item.auth_method || 'none',
  apiKey: item.api_key || '',
  jwtSecret: item.jwt_secret || '',
  rateLimit: item.rate_limit || 0,
  targetStack: item.target_stack || 'fastapi',
  includeData: item.include_data !== false,
  datasets: (item.datasets || []).map((d: any) => ({
    id: d.id,
    name: d.name,
    sourceType: d.source_type || 'manual',
    fields: (d.fields || []).map((f: any) => ({
      id: f.id || crypto.randomUUID(),
      name: f.name,
      type: f.type,
      required: f.required ?? true,
      description: f.description,
      isPrimaryKey: f.is_primary_key ?? false,
      defaultValue: f.default_value,
      fakerCategory: f.faker_category,
      enum: f.enum_values || undefined,
      references: f.references || undefined,
    })),
    sampleRows: d.sample_rows || [],
    savedRequests: d.saved_requests || [],
  })),
  endpoints: (item.endpoints || []).map((ep: any) => ({
    id: ep.id,
    name: ep.name,
    method: ep.method,
    path: ep.path,
    summary: ep.summary || '',
    operationType: ep.operation_type || 'custom',
    targetDatasetId: ep.target_dataset_id,
  })),
  updatedAt: item.updated_at,
  workspaceId: item.workspace_id,
})

export const fetchRemoteProjects = async (workspaceId?: string): Promise<ProjectDraft[]> => {
  const baseUrl = ensureBaseUrl()
  const headers = buildHeaders()
  const url = workspaceId ? `${baseUrl}/projects?workspace_id=${workspaceId}` : `${baseUrl}/projects`
  const response = await fetch(url, { headers })
  if (!response.ok) return []
  const data = await response.json()
  return (data || []).map(mapProjectResponse)
}

/**
 * Create a new project on the backend with full data.
 */
export const createProjectFromDraft = async (draft: ProjectDraft): Promise<ProjectDraft | null> => {
  const baseUrl = ensureBaseUrl()
  const headers = buildHeaders()
  const body: any = {
    name: draft.name,
    slug: draft.slug,
    description: draft.description,
    auth_method: draft.authMethod || 'none',
    api_key: draft.apiKey,
    jwt_secret: draft.jwtSecret,
    rate_limit: draft.rateLimit,
    target_stack: draft.targetStack,
    include_data: draft.includeData !== false,
    workspace_id: (draft as any).workspace_id,
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
        is_primary_key: f.isPrimaryKey ?? false,
        default_value: f.defaultValue,
        faker_category: f.fakerCategory,
        enum_values: f.enum || null,
        references: f.references || null,
      })),
      sample_rows: ds.sampleRows || [],
      saved_requests: ds.savedRequests || [],
    }))
  }
  const response = await fetch(`${baseUrl}/projects`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const errorText = await response.text()
    console.error('[createProjectFromDraft] Backend error:', response.status, errorText)
    return null
  }
  const data = await response.json()
  return mapProjectResponse(data)
}

/**
 * Create a new project on the backend.
 */
export const createRemoteProject = async (
  name: string,
  description?: string,
  targetStack = 'fastapi',
): Promise<ProjectDraft> => {
  const baseUrl = ensureBaseUrl()
  const headers = buildHeaders()
  const response = await fetch(`${baseUrl}/projects`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name, description, target_stack: targetStack }),
  })
  const data = await handleResponse(response)
  return {
    id: data.project.id,
    remoteId: data.project.slug || data.project.id,
    slug: data.project.slug,
    name: data.project.name,
    description: data.project.description,
    authMethod: (data.project.auth_method as any) || 'none',
    targetStack: data.project.target_stack,
    datasets: (data.datasets || []).map((ds: any) => ({
      id: ds.id,
      name: ds.name,
      sourceType: ds.source_type,
      fields: (ds.fields || []).map((f: any) => ({
        id: f.id || crypto.randomUUID(),
        name: f.name,
        type: f.type,
        required: f.required ?? true,
        description: f.description,
        isPrimaryKey: f.is_primary_key ?? false,
        defaultValue: f.default_value,
        fakerCategory: f.faker_category,
        enum: f.enum_values || undefined,
        references: f.references || undefined,
      })),
      sampleRows: ds.sample_rows || [],
    })),
    endpoints: data.endpoints || [],
    updatedAt: data.project.updated_at,
  }
}

/**
 * Delete a project from the backend.
 */
export const deleteRemoteProject = async (projectId: string): Promise<void> => {
  const baseUrl = ensureBaseUrl()
  const headers = buildHeaders()
  const response = await fetch(`${baseUrl}/projects/${projectId}`, {
    method: 'DELETE',
    headers,
  })
  await handleResponse(response)
}

/**
 * Fetch a single project from the backend.
 */
export const fetchRemoteProject = async (projectId: string): Promise<ProjectDraft> => {
  const baseUrl = ensureBaseUrl()
  const headers = buildHeaders()
  const response = await fetch(`${baseUrl}/projects/${projectId}`, { headers })
  const data = await handleResponse(response)
  return {
    id: data.project.id,
    remoteId: data.project.slug || data.project.id,
    slug: data.project.slug,
    name: data.project.name,
    description: data.project.description,
    authMethod: (data.project.auth_method as any) || 'none',
    targetStack: data.project.target_stack,
    datasets: (data.datasets || []).map((ds: any) => ({
      id: ds.id,
      name: ds.name,
      sourceType: ds.source_type,
      fields: (ds.fields || []).map((f: any) => ({
        id: f.id || crypto.randomUUID(),
        name: f.name,
        type: f.type,
        required: f.required ?? true,
        description: f.description,
        isPrimaryKey: f.is_primary_key ?? false,
        defaultValue: f.default_value,
        fakerCategory: f.faker_category,
        enum: f.enum_values || undefined,
        references: f.references || undefined,
      })),
      sampleRows: ds.sample_rows || [],
    })),
    endpoints: data.endpoints || [],
    updatedAt: data.project.updated_at,
  }
}

/**
 * Start mock server for a project.
 */
export const startMockServer = async (projectId: string): Promise<{ ok: boolean; msg?: string }> => {
  const baseUrl = ensureBaseUrl()
  const headers = buildHeaders()
  const response = await fetch(`${baseUrl}/projects/${projectId}/mock/start`, {
    method: 'POST',
    headers,
  })
  if (!response.ok) {
    const err = await response.text()
    if (err.includes('not found') || err.includes('404')) {
      return { ok: false, msg: 'Proyecto no encontrado. Sincroniza el proyecto primero.' }
    }
    if (err.includes('401') || err.includes('403')) {
      return { ok: false, msg: 'No tienes permisos. Inicia sesión.' }
    }
    return { ok: false, msg: err }
  }
  return { ok: true }
}

/**
 * Stop mock server for a project.
 */
export const stopMockServer = async (projectId: string): Promise<boolean> => {
  const baseUrl = ensureBaseUrl()
  const headers = buildHeaders()
  const response = await fetch(`${baseUrl}/projects/${projectId}/mock/stop`, {
    method: 'POST',
    headers,
  })
  return response.ok
}

/**
 * Get mock server status.
 */
export const getMockStatus = async (projectId: string): Promise<'running' | 'stopped'> => {
  const baseUrl = ensureBaseUrl()
  const headers = buildHeaders()
  try {
    const response = await fetch(`${baseUrl}/projects/${projectId}/mock/status`, { headers })
    if (!response.ok) return 'stopped'
    const data = await response.json()
    return data.status === 'running' ? 'running' : 'stopped'
  } catch {
    return 'stopped'
  }
}

/**
 * Update a project's metadata on the backend.
 */
export const updateProject = async (
  id: string,
  updates: {
    name?: string
    slug?: string
    description?: string
    auth_method?: string
    api_key?: string
    jwt_secret?: string
    rate_limit?: number
    target_stack?: string
    include_data?: boolean
  },
): Promise<boolean> => {
  const baseUrl = ensureBaseUrl()
  const headers = buildHeaders()
  const response = await fetch(`${baseUrl}/projects/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(updates),
  })
  return response.ok
}

/**
 * Sync a single dataset to the backend.
 */
export const syncDataset = async (projectId: string, dataset: ProjectDraft['datasets'][0]): Promise<boolean> => {
  const baseUrl = ensureBaseUrl()
  const headers = buildHeaders()
  const response = await fetch(`${baseUrl}/projects/${projectId}/dataset`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      id: dataset.id,
      name: dataset.name,
      source_type: dataset.sourceType,
      fields: (dataset.fields || []).map(f => ({
        name: f.name,
        type: f.type,
        required: f.required ?? true,
        description: f.description,
        is_primary_key: f.isPrimaryKey ?? false,
        default_value: f.defaultValue,
        faker_category: f.fakerCategory,
        enum_values: f.enum || null,
        references: f.references || null,
      })),
      sample_rows: dataset.sampleRows,
      saved_requests: dataset.savedRequests,
    }),
  })
  return response.ok
}

/**
 * Sync all endpoints for a project to the backend.
 */
export const syncEndpoints = async (projectId: string, endpoints: ProjectDraft['endpoints']): Promise<boolean> => {
  const baseUrl = ensureBaseUrl()
  const headers = buildHeaders()
  const response = await fetch(`${baseUrl}/projects/${projectId}/endpoints`, {
    method: 'POST',
    headers,
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
  return response.ok
}

/**
 * Create a share snapshot.
 */
export const createShare = async (
  projectId: string,
  password?: string,
  expiresDays = 30,
): Promise<{ id: string; slug: string; url: string }> => {
  const baseUrl = ensureBaseUrl()
  const headers = buildHeaders()
  const response = await fetch(`${baseUrl}/share/projects/${projectId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ password, expires_days: expiresDays }),
  })
  return handleResponse(response)
}

/**
 * Get a share snapshot (public).
 */
// ─── Mapping Rules API ─────────────────────────────────────────

export interface MappingPayload {
  source_dataset_id: string
  source_field_id: string
  target_dataset_id: string
  target_field_id: string
  transformation?: Record<string, any> | null
}

const mapMappingResponse = (m: any): MappingRule => ({
  id: m.id,
  projectId: m.project_id,
  sourceDatasetId: m.source_dataset_id,
  sourceFieldId: m.source_field_id,
  targetDatasetId: m.target_dataset_id,
  targetFieldId: m.target_field_id,
  transformation: m.transformation || undefined,
  createdAt: m.created_at,
  updatedAt: m.updated_at,
})

export const fetchMappings = async (projectId: string): Promise<MappingRule[]> => {
  const baseUrl = ensureBaseUrl()
  const headers = buildHeaders()
  const response = await fetch(`${baseUrl}/projects/${projectId}/mappings`, { headers })
  const data = await handleResponse(response)
  return (data || []).map(mapMappingResponse)
}

export const createMapping = async (projectId: string, payload: MappingPayload): Promise<MappingRule> => {
  const baseUrl = ensureBaseUrl()
  const headers = buildHeaders()
  const response = await fetch(`${baseUrl}/projects/${projectId}/mappings`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })
  const data = await handleResponse(response)
  return mapMappingResponse(data)
}

export const deleteMapping = async (projectId: string, mappingId: string): Promise<void> => {
  const baseUrl = ensureBaseUrl()
  const headers = buildHeaders()
  const response = await fetch(`${baseUrl}/projects/${projectId}/mappings/${mappingId}`, {
    method: 'DELETE',
    headers,
  })
  await handleResponse(response)
}

export const getShareSnapshot = async (
  snapshotId: string,
  slug: string,
  password?: string,
): Promise<any> => {
  const baseUrl = ensureBaseUrl()
  const params = new URLSearchParams()
  if (password) params.set('password', password)
  const response = await fetch(`${baseUrl}/share/${snapshotId}/${slug}?${params}`)
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'Share not found')
  }
  return response.json()
}

// ── Database Connections ──

export interface DbConnectionInfo {
  id: string
  name: string
  db_type: string
  host: string | null
  port: number | null
  username: string | null
  database: string | null
  ssl_mode: string | null
  created_at: string
  updated_at: string
}

export interface TableInfo {
  name: string
  kind?: string
}

export interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  is_primary_key: boolean
  default: string | null
  foreign_key: string | null
}

export const listConnections = async (projectId: string): Promise<DbConnectionInfo[]> => {
  const res = await apiFetch(`/api/connections/project/${projectId}`)
  return res.json()
}

export const createConnection = async (projectId: string, data: any): Promise<DbConnectionInfo> => {
  const res = await apiFetch(`/api/connections/project/${projectId}`, {
    method: 'POST', body: JSON.stringify(data),
  })
  return res.json()
}

export const updateConnection = async (id: string, data: any): Promise<DbConnectionInfo> => {
  const res = await apiFetch(`/api/connections/${id}`, {
    method: 'PUT', body: JSON.stringify(data),
  })
  return res.json()
}

export const deleteConnection = async (id: string): Promise<void> => {
  await apiFetch(`/api/connections/${id}`, { method: 'DELETE' })
}

export const testConnection = async (id: string): Promise<{ success: boolean; message: string; server_version?: string }> => {
  const res = await apiFetch(`/api/connections/${id}/test`, { method: 'POST' })
  return res.json()
}

export const listTables = async (id: string): Promise<TableInfo[]> => {
  const res = await apiFetch(`/api/connections/${id}/tables`)
  return res.json()
}

export const getTableSchema = async (id: string, table: string): Promise<{ table: string; columns: ColumnInfo[] }> => {
  const res = await apiFetch(`/api/connections/${id}/tables/${encodeURIComponent(table)}/schema`)
  return res.json()
}

// Product operations inspired by internal-tool builders

export const listDatasources = async (projectId: string): Promise<any[]> => {
  const res = await apiFetch(`/projects/${projectId}/datasources`)
  return res.json()
}

export const createDatasource = async (projectId: string, data: any): Promise<any> => {
  const res = await apiFetch(`/projects/${projectId}/datasources`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return res.json()
}

export const listSavedQueries = async (projectId: string): Promise<any[]> => {
  const res = await apiFetch(`/projects/${projectId}/queries`)
  return res.json()
}

export const createSavedQuery = async (projectId: string, data: any): Promise<any> => {
  const res = await apiFetch(`/projects/${projectId}/queries`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return res.json()
}

export const runSavedQuery = async (projectId: string, queryId: string, params: Record<string, any> = {}): Promise<any> => {
  const res = await apiFetch(`/projects/${projectId}/queries/${queryId}/run`, {
    method: 'POST',
    body: JSON.stringify({ params }),
  })
  return res.json()
}

export const listRuntimeLogs = async (projectId: string, eventType?: string): Promise<any[]> => {
  const suffix = eventType ? `?event_type=${encodeURIComponent(eventType)}` : ''
  const res = await apiFetch(`/projects/${projectId}/runtime-logs${suffix}`)
  return res.json()
}

export const listReleases = async (projectId: string): Promise<any[]> => {
  const res = await apiFetch(`/projects/${projectId}/releases`)
  return res.json()
}

export const createRelease = async (projectId: string, message = ''): Promise<any> => {
  const res = await apiFetch(`/projects/${projectId}/releases`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  })
  return res.json()
}

export const listAutomations = async (projectId: string): Promise<any[]> => {
  const res = await apiFetch(`/projects/${projectId}/automations`)
  return res.json()
}

export const createAutomation = async (projectId: string, data: any): Promise<any> => {
  const res = await apiFetch(`/projects/${projectId}/automations`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return res.json()
}

export const importContract = async (projectId: string, data: any): Promise<any> => {
  const res = await apiFetch(`/projects/${projectId}/imports`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return res.json()
}

export const listDeployProviders = async (): Promise<any[]> => {
  const res = await apiFetch('/api/platform/deploy-providers')
  return res.json()
}

export const listPlugins = async (): Promise<any> => {
  const res = await apiFetch('/api/platform/plugins')
  return res.json()
}
