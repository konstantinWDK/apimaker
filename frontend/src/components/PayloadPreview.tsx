import type { ProjectDraft } from '../types/schemas'
import { getPreviewData } from '../lib/preview'

interface Props {
  project: ProjectDraft
}

export function PayloadPreview({ project }: Props) {
  const { payload } = getPreviewData(project)

  return (
    <div className="preview-panel">
      <div className="preview-block">
        <p className="eyebrow">Payload estimado</p>
        <pre className="preview-json">{JSON.stringify(payload, null, 2)}</pre>
      </div>
    </div>
  )
}
