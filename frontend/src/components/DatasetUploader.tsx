import { useEffect, useMemo, useRef, useState } from 'react'
import { read, utils } from 'xlsx'

import type { DatasetMeta, FieldSchema } from '../types/schemas'

interface Props {
  dataset?: DatasetMeta
  onCommit: (dataset: DatasetMeta) => void
}

const typeOptions: Array<{ value: FieldSchema['type']; label: string }> = [
  { value: 'string', label: 'Texto' },
  { value: 'integer', label: 'Número entero' },
  { value: 'float', label: 'Número decimal' },
  { value: 'boolean', label: 'Booleano' },
  { value: 'datetime', label: 'Fecha/Hora' },
]

const emptyField = (): FieldSchema => ({
  id: crypto.randomUUID(),
  name: '',
  type: 'string',
  required: true,
})

const sampleStrings = ['Aurora Vega', 'Fabricio Costa', 'Lucía Morales', 'Zhao Lin']
const sampleIntegers = ['12', '87', '203', '999']
const sampleFloats = ['12.5', '87.4', '203.1', '999.9']
const sampleBooleans = ['true', 'false']

const sampleValue = (type: FieldSchema['type'], idx: number) => {
  switch (type) {
    case 'integer':
      return sampleIntegers[idx % sampleIntegers.length]
    case 'float':
      return sampleFloats[idx % sampleFloats.length]
    case 'boolean':
      return sampleBooleans[idx % sampleBooleans.length]
    case 'datetime':
      return new Date(Date.now() + idx * 86_400_000).toISOString()
    default:
      return sampleStrings[idx % sampleStrings.length]
  }
}

const generateSampleRows = (fields: FieldSchema[], count = 3) => {
  if (fields.length === 0) return []
  return Array.from({ length: count }, (_, rowIndex) => {
    const row: Record<string, string> = {}
    fields.forEach((field, fieldIndex) => {
      const key = field.name || `field_${fieldIndex + 1}`
      row[key] = sampleValue(field.type, rowIndex + fieldIndex)
    })
    return row
  })
}

export function DatasetUploader({ dataset, onCommit }: Props) {
  const [name, setName] = useState(dataset?.name ?? 'Dataset principal')
  const [sourceType, setSourceType] = useState<DatasetMeta['sourceType']>(dataset?.sourceType ?? 'manual')
  const [fields, setFields] = useState<FieldSchema[]>(dataset?.fields ?? [emptyField()])
  const [sampleRows, setSampleRows] = useState<Array<Record<string, string>>>(dataset?.sampleRows ?? [])
  const [uploadName, setUploadName] = useState(dataset?.uploadedFrom ?? '')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (sourceType === 'manual' && fields.length) {
      setSampleRows((prev) => (prev.length ? prev : generateSampleRows(fields)))
    }
  }, [sourceType, fields])

  const hasValidFields = useMemo(() => fields.every((field) => field.name.trim().length > 0), [fields])

  const syncSampleRows = (nextFields: FieldSchema[]) => {
    if (sourceType === 'manual') {
      setSampleRows(generateSampleRows(nextFields))
    }
  }

  const updateField = (id: string, patch: Partial<FieldSchema>) => {
    setFields((current) => {
      const next = current.map((field) => (field.id === id ? { ...field, ...patch } : field))
      syncSampleRows(next)
      return next
    })
  }

  const addField = () => {
    const next = [...fields, emptyField()]
    setFields(next)
    syncSampleRows(next)
  }

  const removeField = (id: string) => {
    const next = fields.filter((field) => field.id !== id)
    setFields(next)
    syncSampleRows(next)
  }

  const inferType = (values: string[]): FieldSchema['type'] => {
    const trimmed = values.map((value) => value?.trim()).filter(Boolean)
    if (trimmed.length === 0) return 'string'
    const isBoolean = trimmed.every((value) => ['true', 'false', '0', '1', 'yes', 'no'].includes(value.toLowerCase()))
    if (isBoolean) return 'boolean'
    const isInteger = trimmed.every((value) => /^-?\d+$/.test(value))
    if (isInteger) return 'integer'
    const isFloat = trimmed.every((value) => /^-?\d+(\.\d+)?$/.test(value))
    if (isFloat) return 'float'
    const isDate = trimmed.every((value) => !Number.isNaN(Date.parse(value)))
    if (isDate) return 'datetime'
    return 'string'
  }

  const parseFromRows = (rows: Array<Record<string, string>>) => {
    const headers = new Set<string>()
    rows.forEach((row) => Object.keys(row).forEach((key) => headers.add(key)))
    const fieldList: FieldSchema[] = Array.from(headers).map((header) => ({
      id: crypto.randomUUID(),
      name: header,
      type: inferType(rows.map((row) => row[header] ?? '')),
      required: true,
    }))
    setFields(fieldList.length ? fieldList : [emptyField()])
    setSampleRows(rows)
  }

  const parseCsv = async (file: File) => {
    // Use xlsx library for robust CSV parsing (handles quoted commas, etc.)
    const buffer = await file.arrayBuffer()
    const workbook = read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) throw new Error('El archivo CSV no se pudo parsear')
    const jsonRows = utils.sheet_to_json<Record<string, string>>(workbook.Sheets[sheetName], { defval: '' })
    if (!jsonRows.length) throw new Error('El archivo está vacío')
    parseFromRows(jsonRows.slice(0, 5))
  }

  const parseExcel = async (file: File) => {
    const buffer = await file.arrayBuffer()
    const workbook = read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) throw new Error('El archivo no contiene hojas')
    const jsonRows = utils.sheet_to_json<Record<string, string>>(workbook.Sheets[sheetName], { defval: '' })
    if (!jsonRows.length) throw new Error('La hoja seleccionada está vacía')
    parseFromRows(jsonRows.slice(0, 5))
  }

  const handleFile = async (file: File) => {
    setUploadError(null)
    setUploadName(file.name)
    try {
      const extension = file.name.split('.').pop()?.toLowerCase()
      if (extension === 'csv' || extension === 'tsv') {
        await parseCsv(file)
      } else if (extension && ['xlsx', 'xls'].includes(extension)) {
        await parseExcel(file)
      } else {
        throw new Error('Formato no soportado. Usa CSV o Excel')
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'No se pudo procesar el archivo')
    }
  }

  const datasetPayload = (rowsOverride?: Array<Record<string, string>>) => ({
    id: dataset?.id ?? crypto.randomUUID(),
    name,
    sourceType,
    fields,
    sampleRows: rowsOverride ?? (sampleRows.length ? sampleRows : generateSampleRows(fields)),
    uploadedFrom: uploadName || undefined,
  })

  const handleCommit = () => {
    if (!hasValidFields) return
    let nextRows = sampleRows
    if (sourceType === 'manual') {
      const generated = generateSampleRows(fields)
      nextRows = generated
      setSampleRows(generated)
    }
    onCommit(datasetPayload(nextRows))
  }

  return (
    <div className="dataset-builder">
      <div className="dataset-builder__controls">
        <label className="form-field">
          <span className="label">Data source</span>
          <select
            value={sourceType}
            onChange={(event) => setSourceType(event.target.value as DatasetMeta['sourceType'])}
            className="field"
          >
            <option value="manual">Manual builder</option>
            <option value="upload">Upload CSV / Excel</option>
          </select>
        </label>
        <label className="form-field">
          <span className="label">Dataset name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} className="field" />
        </label>
        {sourceType === 'upload' ? (
          <div className="form-field file-upload">
            <span className="label">Archivo</span>
            <div className="file-upload__row">
              <button type="button" className="btn ghost btn-small" onClick={() => fileInputRef.current?.click()}>
                Seleccionar archivo
              </button>
              <span className="file-upload__name">{uploadName || 'Ningún archivo seleccionado'}</span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.xlsx,.xls"
              className="file-upload__input"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void handleFile(file)
              }}
            />
            {uploadError ? <span className="error-text">{uploadError}</span> : null}
          </div>
        ) : null}
      </div>

      <div className="dataset-builder__columns">
        {fields.map((field, index) => (
          <div key={field.id} className="dataset-column compact">
            <span className="dataset-column__title">#{index + 1}</span>
            <div className="dataset-column__row">
              <input
                placeholder="Column"
                value={field.name}
                onChange={(event) => updateField(field.id, { name: event.target.value })}
                className="field"
              />
              <select
                value={field.type}
                onChange={(event) => updateField(field.id, { type: event.target.value as FieldSchema['type'] })}
                className="field"
              >
                {typeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <label className="checkbox-label small">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(event) => updateField(field.id, { required: event.target.checked })}
                />
                <span>Req.</span>
              </label>
              <button type="button" className="chip" onClick={() => removeField(field.id)} disabled={fields.length === 1}>
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="dataset-builder__footer">
        <button type="button" className="btn ghost" onClick={addField}>
          + Añadir columna
        </button>
        <button type="button" className="btn primary" onClick={handleCommit} disabled={!hasValidFields}>
          Guardar esquema
        </button>
      </div>
    </div>
  )
}
