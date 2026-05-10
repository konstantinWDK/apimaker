export const getPreviewData = (project: ProjectDraft) => {
  const columns = project.dataset?.fields ?? []

  // ONLY use actual sampleRows from dataset
  const rows = project.dataset?.sampleRows ?? []

  const payload = {
    endpoint: project.endpoints[0]?.path ?? '/records',
    method: project.endpoints[0]?.method ?? 'GET',
    data: rows.length ? rows : [{ info: 'Configura un dataset o carga la demo para ver datos' }],
  }

  return { columns, rows, payload }
}
