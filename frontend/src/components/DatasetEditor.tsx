import { useEffect, useMemo, useRef, useState } from 'react'
import { read, utils } from 'xlsx'

import type { DatasetMeta, FieldSchema, FakerCategory } from '../types/schemas'
import { generateFakeRows, inferFakerCategory, generateFakeValue } from '../lib/faker'
import { DataEditor } from './DataEditor'

interface Props {
  dataset?: DatasetMeta
  onCommit: (dataset: DatasetMeta) => void
  otherDatasets?: { id: string; name: string; fields: FieldSchema[] }[]
}

const FIELD_TYPES: Array<{ value: FieldSchema['type']; label: string; icon: string }> = [
  { value: 'string', label: 'Texto', icon: 'Aa' },
  { value: 'integer', label: 'Entero', icon: '123' },
  { value: 'float', label: 'Decimal', icon: '1.5' },
  { value: 'boolean', label: 'Booleano', icon: 'B' },
  { value: 'datetime', label: 'Fecha', icon: 'DT' },
  { value: 'email', label: 'Email', icon: '@' },
  { value: 'uuid', label: 'UUID', icon: 'ID' },
]

const FAKER_CATEGORIES: Array<{ value: FakerCategory; label: string }> = [
  { value: 'auto', label: 'Automático' },
  { value: 'name', label: 'Nombre' },
  { value: 'email', label: 'Email' },
  { value: 'company', label: 'Empresa' },
  { value: 'address', label: 'Dirección' },
  { value: 'phone', label: 'Teléfono' },
  { value: 'product', label: 'Producto' },
  { value: 'date', label: 'Fecha' },
  { value: 'number', label: 'Número' },
  { value: 'boolean', label: 'Booleano' },
  { value: 'text', label: 'Texto' },
  { value: 'uuid', label: 'UUID' },
]

const emptyField = (): FieldSchema => ({
  id: crypto.randomUUID(),
  name: '',
  type: 'string',
  required: true,
  description: '',
  fakerCategory: 'auto',
})

export function DatasetEditor({ dataset, onCommit, otherDatasets: _otherDatasets = [] }: Props) {
  const [name, setName] = useState(dataset?.name ?? 'Dataset principal')
  const [description, setDescription] = useState(dataset?.description ?? '')
  const [sourceType, setSourceType] = useState<DatasetMeta['sourceType']>(dataset?.sourceType ?? 'manual')
  const [fields, setFields] = useState<FieldSchema[]>(dataset?.fields ?? [])
  const [sampleRows, setSampleRows] = useState<Array<Record<string, string>>>(dataset?.sampleRows ?? [])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [activeSubTab, setActiveSubTab] = useState<'schema' | 'data' | 'import'>('schema')
  const [expandedFieldId, setExpandedFieldId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const hasValidFields = useMemo(() => fields.every((f) => f.name.trim().length > 0), [fields])

  // Sync when dataset prop changes
  useEffect(() => {
    if (dataset?.id) {
      setFields(dataset.fields ?? [])
      setSampleRows(dataset.sampleRows ?? [])
      setName(dataset.name ?? 'Dataset principal')
      setDescription(dataset.description ?? '')
      setSourceType(dataset.sourceType ?? 'manual')
    }
  }, [dataset?.id])

  // Auto-commit on schema changes (debounced)
  useEffect(() => {
    if (sourceType === 'manual' && hasValidFields) {
      const timer = setTimeout(() => handleCommit(), 500)
      return () => clearTimeout(timer)
    }
  }, [fields, name, description, sourceType])

  // ─── Field operations ──────────────────────────────────────
  const addField = () => {
    const newField = emptyField()
    setFields(prev => [...prev, newField])
    setExpandedFieldId(newField.id)
  }

  const removeField = (id: string) => {
    setFields(prev => prev.filter(f => f.id !== id))
    setExpandedFieldId(prev => prev === id ? null : prev)
  }

  const updateField = (id: string, patch: Partial<FieldSchema>) => {
    setFields(prev => prev.map(f => (f.id === id ? { ...f, ...patch } : f)))
  }

  const moveField = (id: string, direction: 'up' | 'down') => {
    const idx = fields.findIndex(f => f.id === id)
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === fields.length - 1)) return
    const newFields = [...fields]
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    ;[newFields[idx], newFields[swapIdx]] = [newFields[swapIdx], newFields[idx]]
    setFields(newFields)
  }

  const duplicateField = (id: string) => {
    const field = fields.find(f => f.id === id)
    if (!field) return
    const copy = { ...field, id: crypto.randomUUID(), name: field.name + '_copy' }
    const idx = fields.findIndex(f => f.id === id)
    const newFields = [...fields]
    newFields.splice(idx + 1, 0, copy)
    setFields(newFields)
    setExpandedFieldId(copy.id)
  }

  // ─── Data generation ───────────────────────────────────────
  const generateData = (count = 10) => {
    if (fields.length === 0) return
    const rows = generateFakeRows(fields, count)
    setSampleRows(rows)
    handleCommit()
  }

  const regenerateRow = (rowIndex: number) => {
    const newRow: Record<string, string> = {}
    fields.forEach((field, fieldIdx) => {
      const key = field.name || `field_${fieldIdx + 1}`
      newRow[key] = generateFakeValue(field, rowIndex)
    })
    setSampleRows(prev => {
      const next = [...prev]
      next[rowIndex] = newRow
      return next
    })
    handleCommit()
  }

  const updateRow = (rowIndex: number, cellKey: string, value: string) => {
    setSampleRows(prev => {
      const next = [...prev]
      next[rowIndex] = { ...next[rowIndex], [cellKey]: value }
      return next
    })
    handleCommit()
  }

  const addRow = () => {
    const newRow: Record<string, string> = {}
    fields.forEach((field, fieldIdx) => {
      const key = field.name || `field_${fieldIdx + 1}`
      newRow[key] = generateFakeValue(field, sampleRows.length)
    })
    setSampleRows(prev => [...prev, newRow])
    handleCommit()
  }

  const removeRow = (rowIndex: number) => {
    setSampleRows(prev => prev.filter((_, i) => i !== rowIndex))
    handleCommit()
  }

  // ─── CSV/Excel import ──────────────────────────────────────
  const inferType = (values: string[]): FieldSchema['type'] => {
    const trimmed = values.map(v => v?.trim()).filter(Boolean)
    if (trimmed.length === 0) return 'string'
    if (trimmed.every(v => ['true', 'false', '0', '1', 'yes', 'no'].includes(v.toLowerCase()))) return 'boolean'
    if (trimmed.every(v => /^-?\d+$/.test(v))) return 'integer'
    if (trimmed.every(v => /^-?\d+(\.\d+)?$/.test(v))) return 'float'
    if (trimmed.every(v => !Number.isNaN(Date.parse(v)))) return 'datetime'
    if (trimmed.some(v => v.includes('@') && v.includes('.'))) return 'email'
    return 'string'
  }

  const handleFile = async (file: File) => {
    setUploadError(null)
    try {
      const buffer = await file.arrayBuffer()
      const workbook = read(buffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      if (!sheetName) throw new Error('El archivo no tiene contenido')
      const jsonRows = utils.sheet_to_json<Record<string, string>>(workbook.Sheets[sheetName], { defval: '' })
      if (!jsonRows.length) throw new Error('El archivo está vacío')

      const headers = new Set<string>()
      jsonRows.forEach(row => Object.keys(row).forEach(key => headers.add(key)))

      const fieldList: FieldSchema[] = Array.from(headers).map(header => ({
        id: crypto.randomUUID(),
        name: header,
        type: inferType(jsonRows.map(row => row[header] ?? '')),
        required: true,
        description: '',
        fakerCategory: 'auto',
      }))

      setFields(fieldList)
      setSampleRows(jsonRows.slice(0, 20))
      setSourceType('upload')
      setActiveSubTab('schema')
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Error al procesar archivo')
    }
  }

  // ─── Commit ────────────────────────────────────────────────
  const handleCommit = () => {
    onCommit({
      id: dataset?.id ?? crypto.randomUUID(),
      name,
      description,
      sourceType,
      fields,
      sampleRows,
      uploadedFrom: sourceType === 'upload' ? dataset?.uploadedFrom : undefined,
    })
  }

  // ─── Render ────────────────────────────────────────────────
  return (
    <div className="dataset-editor">
      {/* Header: name, icon, description */}
      <div className="dataset-editor__header">
        <div className="dataset-editor__identity">
          <input
            type="text"
            className="dataset-editor__name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nombre del dataset"
          />
        </div>
        <input
          type="text"
          className="dataset-editor__desc"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Descripción (opcional) — ej: 'Usuarios registrados en la plataforma'"
        />
      </div>

      {/* Sub-tabs */}
      <div className="dataset-editor__tabs">
        <button
          type="button"
          className={activeSubTab === 'schema' ? 'active' : ''}
          onClick={() => setActiveSubTab('schema')}
        >
          Esquema
          <span className="badge">{fields.length}</span>
        </button>
        <button
          type="button"
          className={activeSubTab === 'data' ? 'active' : ''}
          onClick={() => setActiveSubTab('data')}
        >
          Datos
          <span className="badge">{sampleRows.length}</span>
        </button>
        <button
          type="button"
          className={activeSubTab === 'import' ? 'active' : ''}
          onClick={() => setActiveSubTab('import')}
        >
          Importar
        </button>
      </div>

      {/* Sub-tab content */}
      <div className="dataset-editor__content">
        {activeSubTab === 'schema' && (
          <div className="schema-editor">
            <div className="schema-editor__toolbar">
              <button type="button" className="btn ghost btn-sm" onClick={addField}>
                + Campo
              </button>
            </div>

            <div className="schema-editor__fields">
              {fields.map((field, index) => {
                const isExpanded = expandedFieldId === field.id
                return (
                  <div key={field.id} className={`schema-field ${isExpanded ? 'expanded' : ''}`}>
                    {/* Row 1: quick edit */}
                    <div className="schema-field__quick">
                      <span className="schema-field__handle" onClick={() => moveField(field.id, 'up')}>::</span>
                      <span className="schema-field__idx">{index + 1}</span>
                      <input
                        type="text"
                        className="schema-field__name"
                        placeholder="nombre_campo"
                        value={field.name}
                        onChange={e => updateField(field.id, { name: e.target.value })}
                        onFocus={() => setExpandedFieldId(field.id)}
                      />
                      <select
                        className="schema-field__type"
                        value={field.type}
                        onChange={e => {
                          const newType = e.target.value as FieldSchema['type']
                          updateField(field.id, { type: newType })
                          // Auto-infer faker category
                          if (!field.fakerCategory || field.fakerCategory === 'auto') {
                            updateField(field.id, { fakerCategory: inferFakerCategory({ ...field, type: newType }) })
                          }
                        }}
                      >
                        {FIELD_TYPES.map(t => (
                          <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                        ))}
                      </select>
                      <label className="schema-field__required" title="Campo obligatorio">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={e => updateField(field.id, { required: e.target.checked })}
                        />
                        <span>Req</span>
                      </label>
                      <label className="schema-field__pk" title="Clave primaria">
                        <input
                          type="checkbox"
                          checked={field.isPrimaryKey ?? false}
                          onChange={e => updateField(field.id, { isPrimaryKey: e.target.checked })}
                        />
                        <span>PK</span>
                      </label>
                      <button type="button" className="schema-field__expand" onClick={() => setExpandedFieldId(isExpanded ? null : field.id)}>
                        {isExpanded ? '▾' : '▸'}
                      </button>
                      <button type="button" className="schema-field__dup" onClick={() => duplicateField(field.id)} title="Duplicar">⧉</button>
                      <button type="button" className="schema-field__remove" onClick={() => removeField(field.id)} disabled={fields.length === 1}>✕</button>
                    </div>

                    {/* Row 2: expanded properties */}
                    {isExpanded && (
                      <div className="schema-field__details">
                        <label className="schema-field__detail">
                          <span>Descripción</span>
                          <input
                            type="text"
                            value={field.description ?? ''}
                            onChange={e => updateField(field.id, { description: e.target.value })}
                            placeholder="Qué representa este campo..."
                          />
                        </label>
                        <label className="schema-field__detail">
                          <span>Generador de datos</span>
                          <select
                            value={field.fakerCategory ?? 'auto'}
                            onChange={e => updateField(field.id, { fakerCategory: e.target.value as FakerCategory })}
                          >
                            {FAKER_CATEGORIES.map(c => (
                              <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                          </select>
                          {field.fakerCategory !== 'auto' && (
                            <span className="schema-field__hint">
                              Ejemplo: {generateFakeValue({ ...field, fakerCategory: field.fakerCategory as FakerCategory }, 0)}
                            </span>
                          )}
                        </label>
                        <label className="schema-field__detail">
                          <span>Valores permitidos (enum)</span>
                          <input
                            type="text"
                            value={(field.enum ?? []).join(', ')}
                            onChange={e => updateField(field.id, {
                              enum: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                            })}
                            placeholder="activo, pendiente, cancelado"
                          />
                          <span className="schema-field__hint">Separados por coma</span>
                        </label>
                        <label className="schema-field__detail">
                          <span>Valor por defecto</span>
                          <input
                            type="text"
                            value={field.defaultValue ?? ''}
                            onChange={e => updateField(field.id, { defaultValue: e.target.value })}
                            placeholder="Valor inicial..."
                          />
                        </label>
                      </div>
                    )}
                  </div>
                )
              })}

              {fields.length === 0 && (
                <div className="schema-editor__empty">
                  <p>No hay campos definidos</p>
                  <button type="button" className="btn primary" onClick={addField}>
                    + Añadir primer campo
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeSubTab === 'data' && (
          <div className="data-editor">
            <div className="data-editor__toolbar">
              <span className="data-editor__count">{sampleRows.length} filas</span>
              <button type="button" className="btn ghost btn-sm" onClick={addRow}>+ Fila</button>
              <button type="button" className="btn ghost btn-sm" onClick={() => generateData(10)}>Regenerar 10</button>
              <button type="button" className="btn ghost btn-sm" onClick={() => generateData(50)}>Regenerar 50</button>
            </div>
            <DataEditor
              fields={fields}
              rows={sampleRows}
              onUpdateRow={updateRow}
              onRemoveRow={removeRow}
              onRegenerateRow={regenerateRow}
              onAddRow={addRow}
            />
          </div>
        )}

        {activeSubTab === 'import' && (
          <div className="import-panel">
            <h3>Importar desde CSV / Excel</h3>
            <p className="muted-text">Sube un archivo .csv, .xlsx o .xls y se inferirá el esquema automáticamente.</p>
            <div className="import-panel__dropzone" onClick={() => fileInputRef.current?.click()}>
              <span className="import-panel__icon"></span>
              <p>Arrastra un archivo o haz clic para seleccionar</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.xlsx,.xls"
                className="file-upload__input"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) handleFile(file)
                }}
              />
            </div>
            {uploadError && <p className="error-text">{uploadError}</p>}
            <div className="import-panel__note">
              <p><strong>Nota:</strong> Los tipos de datos se inferirán automáticamente del contenido del archivo.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
