import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { read, utils } from 'xlsx'

import type { DatasetMeta, FieldSchema, FakerCategory } from '../types/schemas'
import { generateFakeRows, inferFakerCategory, generateFakeValue } from '../lib/faker'
import { DataEditor } from './DataEditor'

interface Props {
  dataset?: DatasetMeta
  onCommit: (dataset: DatasetMeta) => void
  otherDatasets?: { id: string; name: string; fields: FieldSchema[] }[]
}

export function DatasetEditor({ dataset, onCommit, otherDatasets: _otherDatasets = [] }: Props) {
  const { t } = useTranslation()
  const [name, setName] = useState(dataset?.name ?? t('datasetEditor.defaultName'))
  const [description, setDescription] = useState(dataset?.description ?? '')
  const [sourceType, setSourceType] = useState<DatasetMeta['sourceType']>(dataset?.sourceType ?? 'manual')
  const [fields, setFields] = useState<FieldSchema[]>(dataset?.fields ?? [])
  const [sampleRows, setSampleRows] = useState<Array<Record<string, string>>>(dataset?.sampleRows ?? [])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [activeSubTab, setActiveSubTab] = useState<'schema' | 'data' | 'import'>('schema')
  const [expandedFieldId, setExpandedFieldId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const FIELD_TYPES: Array<{ value: FieldSchema['type']; label: string; icon: string }> = useMemo(
    () => [
      { value: 'string', label: t('datasetEditor.text'), icon: 'Aa' },
      { value: 'integer', label: t('datasetEditor.integer'), icon: '123' },
      { value: 'float', label: t('datasetEditor.decimal'), icon: '1.5' },
      { value: 'boolean', label: t('datasetEditor.boolean'), icon: 'B' },
      { value: 'datetime', label: t('datasetEditor.date'), icon: 'DT' },
      { value: 'email', label: t('datasetEditor.email'), icon: '@' },
      { value: 'uuid', label: t('datasetEditor.uuid'), icon: 'ID' },
    ],
    [t],
  )

  const FAKER_CATEGORIES: Array<{ value: FakerCategory; label: string }> = useMemo(
    () => [
      { value: 'auto', label: t('datasetEditor.auto') },
      { value: 'name', label: t('datasetEditor.name') },
      { value: 'email', label: t('datasetEditor.email') },
      { value: 'company', label: t('datasetEditor.company') },
      { value: 'address', label: t('datasetEditor.address') },
      { value: 'phone', label: t('datasetEditor.phone') },
      { value: 'product', label: t('datasetEditor.product') },
      { value: 'date', label: t('datasetEditor.date') },
      { value: 'number', label: t('datasetEditor.number') },
      { value: 'boolean', label: t('datasetEditor.boolean') },
      { value: 'text', label: t('datasetEditor.text') },
      { value: 'uuid', label: t('datasetEditor.uuid') },
    ],
    [t],
  )

  const hasValidFields = useMemo(() => fields.every((f) => f.name.trim().length > 0), [fields])

  // Sync when dataset prop changes
  useEffect(() => {
    if (dataset?.id) {
      setFields(dataset.fields ?? [])
      setSampleRows(dataset.sampleRows ?? [])
      setName(dataset.name ?? t('datasetEditor.defaultName'))
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

  const emptyField = (): FieldSchema => ({
    id: crypto.randomUUID(),
    name: '',
    type: 'string',
    required: true,
    description: '',
    fakerCategory: 'auto',
  })

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
      if (!sheetName) throw new Error(t('datasetUploader.emptyFile'))
      const jsonRows = utils.sheet_to_json<Record<string, string>>(workbook.Sheets[sheetName], { defval: '' })
      if (!jsonRows.length) throw new Error(t('datasetUploader.fileEmpty'))

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
      setUploadError(error instanceof Error ? error.message : t('datasetUploader.processError'))
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
            placeholder={t('datasetEditor.namePlaceholder')}
          />
        </div>
        <input
          type="text"
          className="dataset-editor__desc"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder={t('datasetEditor.descPlaceholder')}
        />
      </div>

      {/* Sub-tabs */}
      <div className="dataset-editor__tabs">
        <button
          type="button"
          className={activeSubTab === 'schema' ? 'active' : ''}
          onClick={() => setActiveSubTab('schema')}
        >
          {t('datasetEditor.schema')}
          <span className="badge">{fields.length}</span>
        </button>
        <button
          type="button"
          className={activeSubTab === 'data' ? 'active' : ''}
          onClick={() => setActiveSubTab('data')}
        >
          {t('datasetEditor.data')}
          <span className="badge">{sampleRows.length}</span>
        </button>
        <button
          type="button"
          className={activeSubTab === 'import' ? 'active' : ''}
          onClick={() => setActiveSubTab('import')}
        >
          {t('datasetEditor.import')}
        </button>
      </div>

      {/* Sub-tab content */}
      <div className="dataset-editor__content">
        {activeSubTab === 'schema' && (
          <div className="schema-editor">
            <div className="schema-editor__toolbar">
              <button type="button" className="btn ghost btn-sm" onClick={addField}>
                {t('datasetEditor.addField')}
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
                        placeholder={t('datasetEditor.fieldNamePlaceholder')}
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
                      <label className="schema-field__required" title={t('datasetEditor.req')}>
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={e => updateField(field.id, { required: e.target.checked })}
                        />
                        <span>{t('datasetEditor.req')}</span>
                      </label>
                      <label className="schema-field__pk" title={t('datasetEditor.pk')}>
                        <input
                          type="checkbox"
                          checked={field.isPrimaryKey ?? false}
                          onChange={e => updateField(field.id, { isPrimaryKey: e.target.checked })}
                        />
                        <span>{t('datasetEditor.pk')}</span>
                      </label>
                      <button type="button" className="schema-field__expand" onClick={() => setExpandedFieldId(isExpanded ? null : field.id)}>
                        {isExpanded ? '▾' : '▸'}
                      </button>
                      <button type="button" className="schema-field__dup" onClick={() => duplicateField(field.id)} title={t('datasetEditor.duplicate')}>⧉</button>
                      <button type="button" className="schema-field__remove" onClick={() => removeField(field.id)} disabled={fields.length === 1}>✕</button>
                    </div>

                    {/* Row 2: expanded properties */}
                    {isExpanded && (
                      <div className="schema-field__details">
                        <label className="schema-field__detail">
                          <span>{t('datasetEditor.description')}</span>
                          <input
                            type="text"
                            value={field.description ?? ''}
                            onChange={e => updateField(field.id, { description: e.target.value })}
                            placeholder={t('datasetEditor.descFieldPlaceholder')}
                          />
                        </label>
                        <label className="schema-field__detail">
                          <span>{t('datasetEditor.dataGenerator')}</span>
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
                              {generateFakeValue({ ...field, fakerCategory: field.fakerCategory as FakerCategory }, 0)}
                            </span>
                          )}
                        </label>
                        <label className="schema-field__detail">
                          <span>{t('datasetEditor.enumValues')}</span>
                          <input
                            type="text"
                            value={(field.enum ?? []).join(', ')}
                            onChange={e => updateField(field.id, {
                              enum: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                            })}
                            placeholder={t('datasetEditor.enumPlaceholder')}
                          />
                          <span className="schema-field__hint">{t('datasetEditor.enumHint')}</span>
                        </label>
                        <label className="schema-field__detail">
                          <span>{t('datasetEditor.defaultValue')}</span>
                          <input
                            type="text"
                            value={field.defaultValue ?? ''}
                            onChange={e => updateField(field.id, { defaultValue: e.target.value })}
                            placeholder={t('datasetEditor.defaultPlaceholder')}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                )
              })}

              {fields.length === 0 && (
                <div className="schema-editor__empty">
                  <p>{t('datasetEditor.noFields')}</p>
                  <button type="button" className="btn primary" onClick={addField}>
                    {t('datasetEditor.addFirstField')}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeSubTab === 'data' && (
          <div className="data-editor">
            <div className="data-editor__toolbar">
              <span className="data-editor__count">{t('datasetEditor.rows', { count: sampleRows.length })}</span>
              <button type="button" className="btn ghost btn-sm" onClick={addRow}>{t('datasetEditor.addRow')}</button>
              <button type="button" className="btn ghost btn-sm" onClick={() => generateData(10)}>{t('datasetEditor.regenerate10')}</button>
              <button type="button" className="btn ghost btn-sm" onClick={() => generateData(50)}>{t('datasetEditor.regenerate50')}</button>
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
            <h3>{t('datasetEditor.importCsv')}</h3>
            <p className="muted-text">{t('datasetEditor.importCsvDesc')}</p>
            <div className="import-panel__dropzone" onClick={() => fileInputRef.current?.click()}>
              <span className="import-panel__icon"></span>
              <p>{t('datasetEditor.importDrag')}</p>
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
              <p>{t('datasetEditor.importNote')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
