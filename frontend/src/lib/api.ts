import type { ProjectDraft } from '../types/schemas'
import { readBackendConfig } from './backendConfig'

const cleanBaseUrl = (value: string) => value.replace(/\/$/, '')

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
  // Try to login automatically with default credentials
  const { baseUrl } = readBackendConfig()
  if (!baseUrl) return null
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin' }),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (data.access_token && typeof window !== 'undefined') {
      window.sessionStorage.setItem('apimaker-jwt-token', data.access_token)
      return data.access_token
    }
  } catch {
    /* ignore */
  }
  return null
}
const ensureBaseUrl = (): string => {
  const { baseUrl } = readBackendConfig()
  if (!baseUrl) throw new Error('Configura la URL del backend antes de sincronizar')
  return cleanBaseUrl(baseUrl)
}

const toDatasetPayload = (project: ProjectDraft) => {
  const dataset = project.dataset
  if (!dataset) return null
  return {
    name: dataset.name,
    source_type: dataset.sourceType ?? 'manual',
    fields: dataset.fields.map((field) => ({
      name: field.name,
      type: field.type,
      required: field.required,
      description: field.description,
    })),
  }
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
      }),
    })
    const created = await handleResponse(createResponse)
    remoteId = created.id
  }

  if (!remoteId) {
    throw new Error('No se pudo obtener el identificador remoto del proyecto')
  }

  const datasetPayload = toDatasetPayload(project)
  if (datasetPayload) {
    const datasetResponse = await fetch(`${baseUrl}/projects/${remoteId}/dataset`, {
      method: 'POST',
      headers,
      body: JSON.stringify(datasetPayload),
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
    name: item.name,
    description: item.description ?? undefined,
    targetStack: item.target_stack,
    dataset: item.dataset
      ? {
          id: item.dataset.id,
          name: item.dataset.name,
          sourceType: item.dataset.source_type,
          fields: item.dataset.fields ?? [],
          sampleRows: [],
        }
      : undefined,
    endpoints: item.endpoints ?? [],
    updatedAt: item.updated_at ?? undefined,
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
    id: data.id,
    remoteId: data.id,
    name: data.name,
    description: data.description ?? undefined,
    targetStack: data.target_stack,
    dataset: undefined,
    endpoints: [],
    updatedAt: data.updated_at,
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
    id: data.id,
    remoteId: data.id,
    name: data.name,
    description: data.description ?? undefined,
    targetStack: data.target_stack,
    dataset: data.dataset
      ? {
          id: data.dataset.id,
          name: data.dataset.name,
          sourceType: data.dataset.source_type,
          fields: data.dataset.fields ?? [],
          sampleRows: [],
        }
      : undefined,
    endpoints: data.endpoints ?? [],
    updatedAt: data.updated_at ?? undefined,
  }
}

/**
 * Health check the backend.
 */
export const healthCheck = async (): Promise<{ status: string; environment: string }> => {
  const baseUrl = ensureBaseUrl()
  const response = await fetch(`${baseUrl}/health`)
  return handleResponse(response)
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
