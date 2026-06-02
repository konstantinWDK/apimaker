export type FieldType = 'string' | 'integer' | 'float' | 'boolean' | 'datetime' | 'email' | 'uuid'

/** Fake data generator category for each field type */
export type FakerCategory = 'name' | 'email' | 'company' | 'address' | 'phone' | 'product' | 'date' | 'number' | 'boolean' | 'text' | 'uuid' | 'auto'

export interface SavedRequest {
  id: string
  name: string
  method: string
  path: string
  params: Array<{ key: string, value: string }>
  headers: Array<{ key: string, value: string }>
  body: string
}

export interface FieldSchema {
  id: string
  name: string
  type: FieldType
  required: boolean
  description?: string
  /** Default value for new records */
  defaultValue?: string
  /** For strings: minimum length */
  minLength?: number
  /** For strings/numbers: maximum length/value */
  maxLength?: number
  /** For strings: regex pattern validation */
  pattern?: string
  /** For strings/numbers: allowed values (enum) */
  enum?: string[]
  /** Whether this field is a primary key */
  isPrimaryKey?: boolean
  /** Faker category for realistic data generation */
  fakerCategory?: FakerCategory
  /** Foreign key reference to another dataset's field */
  references?: {
    datasetId: string
    fieldName: string
  }
}

export interface DatasetMeta {
  id: string
  name: string
  sourceType: 'upload' | 'manual' | 'database'
  fields: FieldSchema[]
  sampleRows: Array<Record<string, string>>
  uploadedFrom?: string
  /** Optional description of what this dataset represents */
  description?: string
  /** Icon/emoji for visual identification */
  icon?: string
  /** Saved requests for this dataset (Postman-style) */
  savedRequests?: SavedRequest[]
}

export interface ApiEndpoint {
  id: string
  name: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  summary?: string
  operationType?: 'list' | 'get' | 'create' | 'update' | 'delete' | 'list_related' | 'custom'
  targetDatasetId?: string // Link to a specific dataset in the project
}

export interface DeploymentInfo {
  host: string
  user: string
  port: string
  apiPort: string
  authType: 'password' | 'key'
  deployedAt: string
  lastCheckAt?: string
  status?: 'running' | 'stopped' | 'unknown'
}

export interface ProjectDraft {
  id: string
  name: string
  slug?: string
  description?: string
  authMethod: 'none' | 'apikey' | 'jwt'
  apiKey?: string
  jwtSecret?: string
  rateLimit?: number // requests per minute
  targetStack: 'fastapi' | 'express' | 'nest'
  includeData?: boolean
  includeSdk?: boolean
  datasets: DatasetMeta[]
  endpoints: ApiEndpoint[]
  updatedAt?: string
  sharePath?: string
  lastGeneration?: GenerationResult
  remoteId?: string
  workspaceId?: string
  deployment?: DeploymentInfo
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
  stack?: string
}
