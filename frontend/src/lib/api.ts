import type { ProjectDraft } from '../types/schemas'
import { readBackendConfig } from './backendConfig'

const cleanBaseUrl = (value: string) => value.replace(/\/$/, '')

const handleResponse = async (response: Response) => {
  if (response.ok) {
    if (response.status === 204) return null
    return response.json()
  }
  const message = await response.text()
  throw new Error(message || 'Error en la API del backend')
}

const buildHeaders = () => {
  const { apiKey } = readBackendConfig()
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (apiKey) headers['X-API-Key'] = apiKey
  return headers
}

const ensureBaseUrl = () => {
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
  // fallback simple uuid v4-ish
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

export const syncProjectWithBackend = async (project: ProjectDraft): Promise<SyncResult> => {
  const baseUrl = ensureBaseUrl()
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
