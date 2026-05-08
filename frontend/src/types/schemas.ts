export type FieldType = 'string' | 'integer' | 'float' | 'boolean' | 'datetime'

export interface FieldSchema {
  id: string
  name: string
  type: FieldType
  required: boolean
  description?: string
}

export interface DatasetMeta {
  id: string
  name: string
  sourceType: 'upload' | 'manual'
  fields: FieldSchema[]
  sampleRows: Array<Record<string, string>>
  uploadedFrom?: string
}

export interface ApiEndpoint {
  id: string
  name: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  summary?: string
}

export interface ProjectDraft {
  id: string
  name: string
  description?: string
  targetStack: 'fastapi' | 'express' | 'nest'
  dataset?: DatasetMeta
  endpoints: ApiEndpoint[]
  updatedAt?: string
  sharePath?: string
  lastGeneration?: GenerationResult
  remoteId?: string
}

export interface GeneratedEndpoint {
  method: string
  path: string
  description: string
}

export interface GenerationResult {
  apiUrl: string
  docsUrl: string
  message: string
  retentionNotice: string
  endpoints: GeneratedEndpoint[]
  shareUrl?: string
  projectName?: string
}
