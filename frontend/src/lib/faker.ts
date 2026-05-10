import type { FieldSchema, FakerCategory } from '../types/schemas'

// ─── Realistic data pools ──────────────────────────────────────
const FIRST_NAMES = ['Ana', 'Carlos', 'María', 'Javier', 'Lucía', 'Pedro', 'Elena', 'Miguel', 'Sofía', 'Diego', 'Carmen', 'Roberto', 'Isabel', 'Fernando', 'Laura', 'Alejandro', 'Paula', 'Ricardo', 'Teresa', 'Andrés']
const LAST_NAMES = ['García', 'López', 'Martínez', 'Rodríguez', 'Fernández', 'González', 'Sánchez', 'Pérez', 'Gómez', 'Ruiz', 'Díaz', 'Torres', 'Moreno', 'Álvarez', 'Romero', 'Jiménez', 'Herrera', 'Molina', 'Navarro', 'Castro']
const COMPANIES = ['TechCorp', 'DataFlow', 'CloudBase', 'NexGen', 'InnoSoft', 'CodeLab', 'PixelWorks', 'ByteForge', 'SmartSys', 'WebScale', 'NetPioneer', 'AppVenture', 'DevSphere', 'InfoMatrix', 'LogicEdge']
const CITIES = ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Bilbao', 'Málaga', 'Zaragoza', 'Murcia', 'Palma', 'Las Palmas', 'Alicante', 'Córdoba', 'Valladolid', 'Vigo', 'Gijón']
const STREETS = ['Calle Mayor', 'Av. de la Constitución', 'Calle Gran Vía', 'Paseo de Gracia', 'Calle Serrano', 'Av. Diagonal', 'Calle Alcalá', 'Rambla Catalunya', 'Calle Princesa', 'Av. del Puerto']
const PRODUCTS = ['Laptop Pro 15"', 'Auriculares BT', 'Teclado Mecánico', 'Monitor 4K', 'Ratón Ergonómico', 'Webcam HD', 'Hub USB-C', 'SSD 1TB', 'RAM 16GB', 'Tablet 10"']
const CATEGORIES = ['Electrónica', 'Hogar', 'Ropa', 'Alimentación', 'Deportes', 'Libros', 'Juguetes', 'Salud', 'Automoción', 'Oficina']
const STATUSES = ['activo', 'pendiente', 'completado', 'cancelado', 'en_proceso']
const TAGS = ['importante', 'urgente', 'revisión', 'aprobado', 'borrador', 'archivado', 'prioritario', 'normal']
const DOMAINS = ['gmail.com', 'outlook.com', 'yahoo.es', 'company.es', 'techcorp.io', 'datamail.com', 'work.org', 'mail.net']

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min

/** Generate a random UUID (8-char hex) */
const shortUuid = () => {
  const chars = '0123456789abcdef'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * 16)]).join('')
}

/** Generate a realistic first name */
const firstName = () => pick(FIRST_NAMES)

/** Generate a realistic last name */
const lastName = () => pick(LAST_NAMES)

/** Generate a realistic email */
const email = () => {
  const name = firstName().toLowerCase()
  const suffix = randInt(1, 99)
  return `${name}${suffix}@${pick(DOMAINS)}`
}

/** Generate a realistic phone number */
const phone = () => `+34 ${randInt(600, 699)} ${randInt(100, 999)} ${randInt(100, 999)}`

/** Generate a realistic address */
const address = () => `${pick(STREETS)} ${randInt(1, 150)}, ${pick(CITIES)}`

/** Generate a realistic company name */
const company = () => pick(COMPANIES)

/** Generate a product name */
const product = () => pick(PRODUCTS)

/** Generate a category name */
const randomCategory = () => pick(CATEGORIES)

/** Generate a status */
const status = () => pick(STATUSES)

/** Generate a tag */
const tag = () => pick(TAGS)

/** Generate a date within a range */
const date = (daysBack = 365, daysForward = 30) => {
  const start = Date.now() - daysBack * 86_400_000
  const range = (daysBack + daysForward) * 86_400_000
  return new Date(start + Math.random() * range).toISOString().split('T')[0]
}

/** Generate a datetime */
const datetime = (daysBack = 30) => {
  const start = Date.now() - daysBack * 86_400_000
  const range = daysBack * 86_400_000
  return new Date(start + Math.random() * range).toISOString()
}

/** Generate text/lorem */
const text = (words = 5) => {
  const loremWords = ['lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit', 'sed', 'eiusmod', 'tempor', 'incididunt', 'labore', 'dolore', 'magna', 'aliqua', 'enim', 'minim', 'veniam', 'quis']
  return Array.from({ length: words }, () => pick(loremWords)).join(' ')
}

// ─── Smart type inference from field name ─────────────────────
const inferFakerCategory = (field: FieldSchema): FakerCategory => {
  // Explicit type mappings
  if (field.type === 'email') return 'email'
  if (field.type === 'uuid') return 'uuid'
  if (field.type === 'boolean') return 'boolean'
  if (field.type === 'datetime') return 'date'

  // Name-based inference
  const name = field.name.toLowerCase()
  if (name.includes('email') || name.includes('correo') || name.includes('mail')) return 'email'
  if (name.includes('phone') || name.includes('teléfono') || name.includes('telefono') || name.includes('tel')) return 'phone'
  if (name.includes('name') || name.includes('nombre') || name.includes('first') || name.includes('last') || name.includes('apellido')) return 'name'
  if (name.includes('company') || name.includes('empresa') || name.includes('organización')) return 'company'
  if (name.includes('address') || name.includes('dirección') || name.includes('ciudad') || name.includes('city')) return 'address'
  if (name.includes('product') || name.includes('producto') || name.includes('item')) return 'product'
  if (name.includes('category') || name.includes('categoría') || name.includes('tipo')) return 'text'
  if (name.includes('status') || name.includes('estado')) return 'text'
  if (name.includes('price') || name.includes('precio') || name.includes('cost') || name.includes('coste') || name.includes('amount') || name.includes('monto') || name.includes('salary') || name.includes('salario')) return 'number'
  if (name.includes('date') || name.includes('fecha') || name.includes('created') || name.includes('creado') || name.includes('updated') || name.includes('actualizado')) return 'date'
  if (name.includes('desc') || name.includes('description') || name.includes('descripción') || name.includes('note') || name.includes('nota') || name.includes('comment') || name.includes('comentario')) return 'text'
  if (name.includes('tag') || name.includes('etiqueta') || name.includes('label') || name.includes('role') || name.includes('rol')) return 'text'
  if (name.includes('id') || name.includes('uuid') || name.includes('slug')) return 'uuid'

  return 'auto'
}

// ─── Main generator ────────────────────────────────────────────
const generateValue = (field: FieldSchema, rowIndex: number): string => {
  const category = field.fakerCategory || inferFakerCategory(field)

  // Handle enum values
  if (field.enum && field.enum.length > 0) {
    return pick(field.enum)
  }

  // Handle primary key
  if (field.isPrimaryKey && (field.type === 'integer' || category === 'uuid')) {
    if (category === 'uuid') return shortUuid()
    return String(rowIndex + 1)
  }

  // Type-based generation with faker category
  switch (category) {
    case 'name':
      return field.name.toLowerCase().includes('last') || field.name.toLowerCase().includes('apellido')
        ? lastName()
        : firstName()
    case 'email':
      return email()
    case 'company':
      return company()
    case 'address':
      return address()
    case 'phone':
      return phone()
    case 'product':
      return product()
    case 'date':
      return field.type === 'datetime' ? datetime() : date()
    case 'number': {
      const name = field.name.toLowerCase()
      if (name.includes('price') || name.includes('precio') || name.includes('cost') || name.includes('salary') || name.includes('salario')) {
        return (randInt(10, 500) + Math.random()).toFixed(2)
      }
      if (name.includes('age') || name.includes('edad')) return String(randInt(18, 80))
      if (name.includes('quantity') || name.includes('cantidad') || name.includes('stock')) return String(randInt(0, 1000))
      if (name.includes('rating') || name.includes('puntuación')) return (randInt(1, 5) + Math.random() * 0.9).toFixed(1)
      return String(randInt(1, 10000))
    }
    case 'boolean':
      return Math.random() > 0.5 ? 'true' : 'false'
    case 'uuid':
      return shortUuid()
    case 'text': {
      const name = field.name.toLowerCase()
      if (name.includes('status') || name.includes('estado')) return status()
      if (name.includes('tag') || name.includes('etiqueta')) return tag()
      if (name.includes('category') || name.includes('categoría')) return randomCategory()
      return text(randInt(3, 8))
    }
    default:
      // Fallback based on type
      switch (field.type) {
        case 'integer': return String(randInt(1, 1000))
        case 'float': return (randInt(1, 100) + Math.random()).toFixed(2)
        case 'boolean': return Math.random() > 0.5 ? 'true' : 'false'
        case 'datetime': return datetime()
        case 'email': return email()
        case 'uuid': return shortUuid()
        default: return text(randInt(2, 5))
      }
  }
}

/** Generate sample rows with realistic fake data */
export const generateFakeRows = (fields: FieldSchema[], count = 10): Array<Record<string, string>> => {
  if (fields.length === 0) return []
  return Array.from({ length: count }, (_, rowIdx) => {
    const row: Record<string, string> = {}
    fields.forEach((field, fieldIdx) => {
      const key = field.name || `field_${fieldIdx + 1}`
      row[key] = generateValue(field, rowIdx)
    })
    return row
  })
}

/** Generate a single sample value for a field */
export const generateFakeValue = (field: FieldSchema, rowIndex = 0): string => {
  return generateValue(field, rowIndex)
}

/** Infer faker category for a field based on its name */
export { inferFakerCategory }
