import type { ProjectDraft } from '../types/schemas'

export const getPreviewData = (project: ProjectDraft, datasetId?: string) => {
  const dataset = datasetId 
    ? project.datasets.find(d => d.id === datasetId) 
    : project.datasets[0]

  const columns = dataset?.fields || []
  const rows = dataset?.sampleRows || []
  const payload = JSON.stringify(rows.slice(0, 5), null, 2)
  
  return { columns, rows, payload }
}
