import type { ProjectDraft } from '../types/schemas'

const fallbackScalar = (type: string, index: number): string => {
  const names = ['Aurora Vega', 'Luis Prado', 'Maya Singh', 'Noah Chen']
  const integers = ['12', '48', '203', '999']
  const floats = ['12.5', '48.2', '203.4', '999.9']
  const booleans = ['true', 'false']

  switch (type) {
    case 'integer':
      return integers[index % integers.length]
    case 'float':
      return floats[index % floats.length]
    case 'boolean':
      return booleans[index % booleans.length]
    case 'datetime':
      return new Date(Date.now() + index * 86_400_000).toISOString()
    default:
      return names[index % names.length]
  }
}

const buildFallbackRow = (project: ProjectDraft): Record<string, string> | undefined => {
  const fields = project.dataset?.fields
  if (!fields || fields.length === 0) return undefined
  return fields.reduce<Record<string, string>>((acc, field, index) => {
    const key = field.name || `field_${index + 1}`
    acc[key] = fallbackScalar(field.type, index)
    return acc
  }, {})
}

export const getPreviewData = (project: ProjectDraft) => {
  const columns = project.dataset?.fields ?? []
  const fallbackRow = buildFallbackRow(project)
  const rows = project.dataset?.sampleRows?.length
    ? project.dataset.sampleRows
    : fallbackRow
      ? [fallbackRow]
      : []

  const payload = {
    endpoint: project.endpoints[0]?.path ?? '/records',
    method: project.endpoints[0]?.method ?? 'GET',
    data: rows.length ? rows : [fallbackRow ?? { ejemplo: 'Sample value' }],
  }

  return { columns, rows, payload }
}
