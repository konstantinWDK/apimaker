import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DatasetMeta, MappingRule } from '../types/schemas'

interface Props {
  datasets: DatasetMeta[]
  mappings: MappingRule[]
  onAddMapping: (sourceFieldId: string, targetFieldId: string) => void
  onRemoveMapping: (mappingId: string) => void
}

const TRANSFORM_OPTIONS = [
  { value: 'direct', label: 'Directa (1:1)' },
  { value: 'cast', label: 'Conversión de tipo' },
  { value: 'concat', label: 'Concatenar' },
  { value: 'format', label: 'Formatear' },
]

export function DataMappingPanel({ datasets, mappings, onAddMapping, onRemoveMapping }: Props) {
  const [sourceDsId, setSourceDsId] = useState(datasets[0]?.id ?? '')
  const [targetDsId, setTargetDsId] = useState(datasets[1]?.id ?? datasets[0]?.id ?? '')
  const [selectedSource, setSelectedSource] = useState<string | null>(null)
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [lines, setLines] = useState<Array<{ id: string; x1: number; y1: number; x2: number; y2: number }>>([])

  const sourceDataset = useMemo(() => datasets.find(d => d.id === sourceDsId), [datasets, sourceDsId])
  const targetDataset = useMemo(() => datasets.find(d => d.id === targetDsId), [datasets, targetDsId])

  const getFieldById = useCallback((datasetId: string, fieldId: string) => {
    const ds = datasets.find(d => d.id === datasetId)
    return ds?.fields.find(f => f.id === fieldId)
  }, [datasets])

  const isMapped = useCallback((fieldId: string, datasetId: string) => {
    return mappings.some(m =>
      (m.sourceFieldId === fieldId && m.sourceDatasetId === datasetId) ||
      (m.targetFieldId === fieldId && m.targetDatasetId === datasetId)
    )
  }, [mappings])

  const getMappingForField = useCallback((fieldId: string, datasetId: string) => {
    return mappings.find(m =>
      (m.sourceFieldId === fieldId && m.sourceDatasetId === datasetId) ||
      (m.targetFieldId === fieldId && m.targetDatasetId === datasetId)
    )
  }, [mappings])

  const handleSourceClick = (fieldId: string) => {
    if (isMapped(fieldId, sourceDsId)) return
    setSelectedSource(prev => prev === fieldId ? null : fieldId)
  }

  const handleTargetClick = (fieldId: string) => {
    if (isMapped(fieldId, targetDsId)) return
    setSelectedTarget(prev => prev === fieldId ? null : fieldId)
  }

  useEffect(() => {
    if (selectedSource && selectedTarget) {
      onAddMapping(selectedSource, selectedTarget)
      setSelectedSource(null)
      setSelectedTarget(null)
    }
  }, [selectedSource, selectedTarget, onAddMapping])

  const recalcLines = useCallback(() => {
    if (!containerRef.current) return
    const container = containerRef.current.getBoundingClientRect()
    const newLines = mappings.map(m => {
      const srcEl = containerRef.current?.querySelector(`[data-field-id="${m.sourceFieldId}"][data-ds-id="${m.sourceDatasetId}"]`)
      const tgtEl = containerRef.current?.querySelector(`[data-field-id="${m.targetFieldId}"][data-ds-id="${m.targetDatasetId}"]`)
      if (!srcEl || !tgtEl) return null
      const src = srcEl.getBoundingClientRect()
      const tgt = tgtEl.getBoundingClientRect()
      return {
        id: m.id,
        x1: src.right - container.left,
        y1: src.top + src.height / 2 - container.top,
        x2: tgt.left - container.left,
        y2: tgt.top + tgt.height / 2 - container.top,
      }
    }).filter(Boolean) as Array<{ id: string; x1: number; y1: number; x2: number; y2: number }>
    setLines(newLines)
  }, [mappings])

  useEffect(() => {
    recalcLines()
    const onResize = () => recalcLines()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [recalcLines, datasets, mappings.length])

  const sourceFieldList = useMemo(() => sourceDataset?.fields ?? [], [sourceDataset])
  const targetFieldList = useMemo(() => targetDataset?.fields ?? [], [targetDataset])

  const getConnectionLabel = (m: MappingRule): string => {
    const srcField = getFieldById(m.sourceDatasetId, m.sourceFieldId)
    const tgtField = getFieldById(m.targetDatasetId, m.targetFieldId)
    const srcName = srcField?.name ?? m.sourceFieldId
    const tgtName = tgtField?.name ?? m.targetFieldId
    const trans = m.transformation?.type ?? 'direct'
    const transLabel = TRANSFORM_OPTIONS.find(t => t.value === trans)?.label ?? trans
    return `${srcName} → ${tgtName} (${transLabel})`
  }

  return (
    <div className="data-mapping">
      <div className="data-mapping__header">
        <h3 className="data-mapping__title">Mapeo de Campos</h3>
        <p className="data-mapping__subtitle">
          Selecciona un campo origen y luego un campo destino para crear una conexión
        </p>
      </div>

      {/* Dataset selectors */}
      <div className="data-mapping__selectors">
        <div className="data-mapping__selector">
          <label>Dataset Origen</label>
          <select value={sourceDsId} onChange={e => { setSourceDsId(e.target.value); setSelectedSource(null); setSelectedTarget(null) }}>
            {datasets.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div className="data-mapping__arrow">→</div>
        <div className="data-mapping__selector">
          <label>Dataset Destino</label>
          <select value={targetDsId} onChange={e => { setTargetDsId(e.target.value); setSelectedSource(null); setSelectedTarget(null) }}>
            {datasets.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {sourceDsId === targetDsId && (
        <div className="data-mapping__warning">
          Selecciona dos datasets diferentes para crear un mapeo
        </div>
      )}

      {sourceDsId !== targetDsId && (
        <div className="data-mapping__workspace" ref={containerRef}>
          {/* SVG connection lines */}
          <svg className="data-mapping__svg">
            {lines.map(line => (
              <g key={line.id}>
                <defs>
                  <marker id={`arrowhead-${line.id}`} markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#6366f1" />
                  </marker>
                </defs>
                <path
                  d={`M${line.x1},${line.y1} C${line.x1 + 60},${line.y1} ${line.x2 - 60},${line.y2} ${line.x2},${line.y2}`}
                  stroke="#6366f1"
                  strokeWidth="2"
                  fill="none"
                  markerEnd={`url(#arrowhead-${line.id})`}
                  className="data-mapping__line"
                />
              </g>
            ))}
          </svg>

          {/* Source fields */}
          <div className="data-mapping__column data-mapping__column--source">
            <div className="data-mapping__column-header">
              <span className="data-mapping__column-title">{sourceDataset?.name}</span>
              <span className="data-mapping__column-count">{sourceFieldList.length} campos</span>
            </div>
            <div className="data-mapping__fields">
              {sourceFieldList.map(f => {
                const mapped = isMapped(f.id, sourceDsId)
                const mapping = getMappingForField(f.id, sourceDsId)
                const isSelected = selectedSource === f.id
                return (
                  <div
                    key={f.id}
                    data-field-id={f.id}
                    data-ds-id={sourceDsId}
                    className={`data-mapping__field ${mapped ? 'mapped' : ''} ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSourceClick(f.id)}
                  >
                    <div className="data-mapping__field-info">
                      <span className="data-mapping__field-name">{f.name}</span>
                      <span className="data-mapping__field-type">{f.type}</span>
                    </div>
                    {mapped && mapping && (
                      <div className="data-mapping__field-mapped-to" title={getConnectionLabel(mapping)}>
                        → {getFieldById(mapping.targetDatasetId, mapping.targetFieldId)?.name ?? '?'}
                      </div>
                    )}
                  </div>
                )
              })}
              {sourceFieldList.length === 0 && (
                <div className="data-mapping__empty">Sin campos</div>
              )}
            </div>
          </div>

          {/* Target fields */}
          <div className="data-mapping__column data-mapping__column--target">
            <div className="data-mapping__column-header">
              <span className="data-mapping__column-title">{targetDataset?.name}</span>
              <span className="data-mapping__column-count">{targetFieldList.length} campos</span>
            </div>
            <div className="data-mapping__fields">
              {targetFieldList.map(f => {
                const mapped = isMapped(f.id, targetDsId)
                const mapping = getMappingForField(f.id, targetDsId)
                const isSelected = selectedTarget === f.id
                return (
                  <div
                    key={f.id}
                    data-field-id={f.id}
                    data-ds-id={targetDsId}
                    className={`data-mapping__field ${mapped ? 'mapped' : ''} ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleTargetClick(f.id)}
                  >
                    <div className="data-mapping__field-info">
                      <span className="data-mapping__field-name">{f.name}</span>
                      <span className="data-mapping__field-type">{f.type}</span>
                    </div>
                    {mapped && mapping && (
                      <div className="data-mapping__field-mapped-to" title={getConnectionLabel(mapping)}>
                        ← {getFieldById(mapping.sourceDatasetId, mapping.sourceFieldId)?.name ?? '?'}
                      </div>
                    )}
                  </div>
                )
              })}
              {targetFieldList.length === 0 && (
                <div className="data-mapping__empty">Sin campos</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Existing mappings list */}
      {mappings.length > 0 && (
        <div className="data-mapping__list">
          <h4>Conexiones ({mappings.length})</h4>
          <div className="data-mapping__list-items">
            {mappings.map(m => {
              const srcField = getFieldById(m.sourceDatasetId, m.sourceFieldId)
              const tgtField = getFieldById(m.targetDatasetId, m.targetFieldId)
              const srcDs = datasets.find(d => d.id === m.sourceDatasetId)
              const tgtDs = datasets.find(d => d.id === m.targetDatasetId)
              return (
                <div key={m.id} className="data-mapping__list-item">
                  <div className="data-mapping__list-info">
                    <span className="data-mapping__list-src">
                      {srcDs?.name ?? '?'}.{srcField?.name ?? '?'}
                    </span>
                    <span className="data-mapping__list-arrow">→</span>
                    <span className="data-mapping__list-tgt">
                      {tgtDs?.name ?? '?'}.{tgtField?.name ?? '?'}
                    </span>
                    <span className="data-mapping__list-trans">
                      {TRANSFORM_OPTIONS.find(t => t.value === (m.transformation?.type ?? 'direct'))?.label ?? m.transformation?.type}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="data-mapping__list-remove"
                    onClick={() => onRemoveMapping(m.id)}
                    title="Eliminar conexión"
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
