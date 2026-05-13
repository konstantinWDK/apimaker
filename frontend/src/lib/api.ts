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
export const fetchRemoteProjects = async (): Promise<ProjectDraft[]> => {
  const baseUrl = ensureBaseUrl()
  const response = await fetch(`${baseUrl}/projects`)
  const data = (await handleResponse(response)) as any[]
  return data.map((item) => ({
    id: item.id,
    remoteId: item.id,
    slug: item.slug,
    name: item.name,
    description: item.description,
    authMethod: (item.auth_method as any) || 'none',
    targetStack: item.target_stack,
      datasets: (item.datasets || []).map((ds: any) => ({
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
    endpoints: item.endpoints || [],
    updatedAt: item.updated_at,
  }))
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
  const response = await fetch(`${baseUrl}/projects/${projectId}`)
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
export const startMockServer = async (projectId: string): Promise<any> => {
  const baseUrl = ensureBaseUrl()
  const headers = buildHeaders()
  const response = await fetch(`${baseUrl}/projects/${projectId}/mock/start`, {
    method: 'POST',
    headers,
  })
  return handleResponse(response)
}

/**
 * Get mock server status.
 */
export const getMockStatus = async (projectId: string): Promise<any> => {
  const baseUrl = ensureBaseUrl()
  const response = await fetch(`${baseUrl}/projects/${projectId}/mock/status`)
  return handleResponse(response)
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
