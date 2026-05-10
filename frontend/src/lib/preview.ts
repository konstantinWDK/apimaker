import type { ProjectDraft } from '../types/schemas'

export const getPreviewData = (project: ProjectDraft) => {
  const columns = project.dataset?.fields || []
  const rows = project.dataset?.sampleRows || []
  const payload = JSON.stringify(rows.slice(0, 5), null, 2)
  
  return { columns, rows, payload }
}
