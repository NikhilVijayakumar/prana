import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import initSqlJs, { Database, SqlJsStatic } from 'sql.js'
import { getAppDataRoot, mkdirSafe } from './governanceRepoService'
import { runtimeDocumentStoreService } from './runtimeDocumentStoreService'

const DB_FILE_NAME = 'visual-identity.sqlite'

type TemplateSyncStatus = 'PENDING' | 'SYNCED' | 'FAILED'

export type VisualTemplateType = 'document' | 'presentation' | 'slide' | 'poster' | 'table'
export type VisualTemplateFormat = 'html' | 'docs' | 'slides' | 'sheets' | 'pdf' | 'ppt'

export interface VisualTemplateRecord {
  templateId: string
  version: string
  templateType: VisualTemplateType
  name: string
  supportedFormats: VisualTemplateFormat[]
  requiredVariables: string[]
  checksum: string
  htmlContent?: string
  vaultPath: string
  syncStatus: TemplateSyncStatus
  createdAt: string
  updatedAt: string
}

export interface RegisterTemplateInput {
  templateId: string
  version: string
  templateType: VisualTemplateType
  name: string
  supportedFormats: VisualTemplateFormat[]
  htmlContent: string
  requiredVariables?: string[]
}

export interface TemplateValidationResult {
  valid: boolean
  errors: string[]
  detectedVariables: string[]
  requiredVariables: string[]
}

export interface TemplatePreviewResult {
  templateId: string
  version: string
  html: string
  requiredVariables: string[]
  missingVariables: string[]
  sourceDataHash: string
}

interface TemplateRow {
  template_id: string
  version: string
  template_type: string
  name: string
  supported_formats_json: string
  required_variables_json: string
  checksum: string
  html_content: string
  vault_path: string
  sync_status: string
  created_at: string
  updated_at: string
}

interface DefaultTemplateDefinition {
  templateId: string
  version: string
  templateType: VisualTemplateType
  name: string
  supportedFormats: VisualTemplateFormat[]
  requiredVariables: string[]
  htmlContent: string
}

const DEFAULT_TEMPLATE_VERSION = '1.0.0'

const DEFAULT_TEMPLATE_DEFINITIONS: DefaultTemplateDefinition[] = [
  {
    templateId: 'default-document-report',
    version: DEFAULT_TEMPLATE_VERSION,
    templateType: 'document',
    name: 'Default Document Report',
    supportedFormats: ['html', 'docs', 'pdf'],
    requiredVariables: ['title', 'summary', 'author', 'date'],
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>{{title}}</title>
  {{__TOKEN_STYLE_BLOCK__}}
  <style>
    body { font-family: var(--token-typography-display, 'Segoe UI', sans-serif); margin: 40px; color: var(--token-color-text, #111827); background: var(--token-color-background, #ffffff); }
    h1 { margin-bottom: 8px; }
    .meta { color: var(--token-color-secondary, #374151); margin-bottom: 24px; }
    .summary { line-height: 1.6; }
  </style>
</head>
<body>
  <article>
    <h1>{{title}}</h1>
    <p class="meta">{{author}} · {{date}}</p>
    <section class="summary">{{summary}}</section>
  </article>
</body>
</html>`
  },
  {
    templateId: 'default-presentation-deck',
    version: DEFAULT_TEMPLATE_VERSION,
    templateType: 'presentation',
    name: 'Default Presentation Deck',
    supportedFormats: ['html', 'slides', 'ppt', 'pdf'],
    requiredVariables: ['title', 'subtitle', 'agenda'],
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>{{title}}</title>
  {{__TOKEN_STYLE_BLOCK__}}
  <style>
    body { margin: 0; font-family: var(--token-typography-display, 'Segoe UI', sans-serif); background: var(--token-color-background, #f9fafb); }
    .slide { width: 1280px; height: 720px; padding: 56px; box-sizing: border-box; }
    h1 { margin: 0 0 12px; color: var(--token-color-primary, #111827); }
    .subtitle { color: var(--token-color-secondary, #374151); margin-bottom: 28px; }
    .agenda { white-space: pre-wrap; line-height: 1.5; }
  </style>
</head>
<body>
  <section class="slide">
    <h1>{{title}}</h1>
    <p class="subtitle">{{subtitle}}</p>
    <div class="agenda">{{agenda}}</div>
  </section>
</body>
</html>`
  },
  {
    templateId: 'default-slide-hero',
    version: DEFAULT_TEMPLATE_VERSION,
    templateType: 'slide',
    name: 'Default Slide Hero',
    supportedFormats: ['html', 'slides', 'ppt'],
    requiredVariables: ['headline', 'supporting_text'],
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>{{headline}}</title>
  {{__TOKEN_STYLE_BLOCK__}}
  <style>
    body { margin: 0; font-family: var(--token-typography-display, 'Segoe UI', sans-serif); }
    .canvas { width: 1280px; height: 720px; display: grid; place-content: center; background: linear-gradient(135deg, var(--token-color-primary, #111827), var(--token-color-secondary, #374151)); color: #ffffff; padding: 64px; box-sizing: border-box; text-align: center; }
    h1 { font-size: 56px; margin: 0 0 20px; }
    p { font-size: 24px; margin: 0; }
  </style>
</head>
<body>
  <section class="canvas">
    <div>
      <h1>{{headline}}</h1>
      <p>{{supporting_text}}</p>
    </div>
  </section>
</body>
</html>`
  },
  {
    templateId: 'default-poster-layout',
    version: DEFAULT_TEMPLATE_VERSION,
    templateType: 'poster',
    name: 'Default Poster Layout',
    supportedFormats: ['html', 'pdf'],
    requiredVariables: ['title', 'tagline', 'body'],
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>{{title}}</title>
  {{__TOKEN_STYLE_BLOCK__}}
  <style>
    body { margin: 0; font-family: var(--token-typography-body, 'Segoe UI', sans-serif); }
    .poster { width: 1080px; height: 1620px; padding: 72px; box-sizing: border-box; background: var(--token-color-background, #ffffff); color: var(--token-color-text, #111827); border: 12px solid var(--token-color-primary, #111827); }
    h1 { font-size: 72px; margin: 0 0 12px; }
    .tagline { font-size: 30px; margin-bottom: 32px; color: var(--token-color-secondary, #374151); }
    .body { font-size: 28px; line-height: 1.35; white-space: pre-wrap; }
  </style>
</head>
<body>
  <article class="poster">
    <h1>{{title}}</h1>
    <p class="tagline">{{tagline}}</p>
    <section class="body">{{body}}</section>
  </article>
</body>
</html>`
  },
  {
    templateId: 'default-table-audit',
    version: DEFAULT_TEMPLATE_VERSION,
    templateType: 'table',
    name: 'Default Table Audit',
    supportedFormats: ['html', 'sheets', 'docs'],
    requiredVariables: ['title', 'rows_html'],
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>{{title}}</title>
  {{__TOKEN_STYLE_BLOCK__}}
  <style>
    body { font-family: var(--token-typography-body, 'Segoe UI', sans-serif); margin: 24px; color: var(--token-color-text, #111827); }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid var(--token-color-secondary, #d1d5db); padding: 10px; text-align: left; }
    th { background: #f3f4f6; }
  </style>
</head>
<body>
  <h1>{{title}}</h1>
  <table>
    <thead>
      <tr><th>Column A</th><th>Column B</th><th>Column C</th></tr>
    </thead>
    <tbody>
      {{rows_html}}
    </tbody>
  </table>
</body>
</html>`
  }
]

let sqlRuntimePromise: Promise<SqlJsStatic> | null = null
let dbPromise: Promise<Database> | null = null
let writeQueue: Promise<void> = Promise.resolve()

const nowIso = (): string => new Date().toISOString()
const getDbPath = (): string => join(getAppDataRoot(), DB_FILE_NAME)

const resolveSqlJsAsset = (fileName: string): string => {
  const candidates = [
    join(process.cwd(), 'node_modules', 'sql.js', 'dist', fileName),
    join(
      process.resourcesPath ?? '',
      'app.asar.unpacked',
      'node_modules',
      'sql.js',
      'dist',
      fileName
    ),
    join(process.resourcesPath ?? '', 'node_modules', 'sql.js', 'dist', fileName)
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate
    }
  }

  return fileName
}

const getSqlRuntime = async (): Promise<SqlJsStatic> => {
  if (!sqlRuntimePromise) {
    sqlRuntimePromise = initSqlJs({ locateFile: (fileName) => resolveSqlJsAsset(fileName) })
  }

  return sqlRuntimePromise
}

const persistDatabase = async (database: Database): Promise<void> => {
  const bytes = database.export()
  await mkdirSafe(getAppDataRoot())
  await writeFile(getDbPath(), Buffer.from(bytes))
}

const initializeDatabase = async (): Promise<Database> => {
  const sqlRuntime = await getSqlRuntime()
  await mkdirSafe(getAppDataRoot())

  const database = existsSync(getDbPath())
    ? new sqlRuntime.Database(new Uint8Array(await readFile(getDbPath())))
    : new sqlRuntime.Database()

  database.run(`
    CREATE TABLE IF NOT EXISTS visual_templates (
      template_id TEXT NOT NULL,
      version TEXT NOT NULL,
      template_type TEXT NOT NULL,
      name TEXT NOT NULL,
      supported_formats_json TEXT NOT NULL,
      required_variables_json TEXT NOT NULL,
      checksum TEXT NOT NULL,
      html_content TEXT NOT NULL,
      vault_path TEXT NOT NULL,
      sync_status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (template_id, version)
    );
  `)

  database.run(
    'CREATE INDEX IF NOT EXISTS idx_visual_templates_type ON visual_templates (template_type);'
  )
  database.run(
    'CREATE INDEX IF NOT EXISTS idx_visual_templates_sync_status ON visual_templates (sync_status);'
  )

  await persistDatabase(database)
  return database
}

const getDatabase = async (): Promise<Database> => {
  if (!dbPromise) {
    dbPromise = initializeDatabase()
  }

  return dbPromise
}

const queueWrite = async (operation: () => Promise<void>): Promise<void> => {
  writeQueue = writeQueue.then(operation, operation)
  await writeQueue
}

const canonicalStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalStringify(item)).join(',')}]`
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b)
  )
  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalStringify(entryValue)}`)
    .join(',')}}`
}

const hashString = (value: string): string => createHash('sha256').update(value).digest('hex')

const sanitizeForHtml = (value: unknown): string => {
  const input = String(value ?? '')
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const normalizeUnique = <T extends string>(entries: T[]): T[] => {
  const seen = new Set<string>()
  const normalized: T[] = []

  for (const entry of entries) {
    const trimmed = entry.trim()
    if (trimmed.length === 0 || seen.has(trimmed)) {
      continue
    }
    seen.add(trimmed)
    normalized.push(trimmed as T)
  }

  return normalized.sort((a, b) => a.localeCompare(b))
}

const resolveVaultPath = (
  templateType: VisualTemplateType,
  templateId: string,
  version: string
): string => {
  return `vault/templates/${templateType}/${templateId}/${version}.html`
}

const parseJsonStringArray = (value: string): string[] => {
  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter((item): item is string => typeof item === 'string')
  } catch {
    return []
  }
}

const mapRowToRecord = (row: TemplateRow, includeContent: boolean): VisualTemplateRecord => {
  return {
    templateId: row.template_id,
    version: row.version,
    templateType: row.template_type as VisualTemplateType,
    name: row.name,
    supportedFormats: parseJsonStringArray(row.supported_formats_json) as VisualTemplateFormat[],
    requiredVariables: parseJsonStringArray(row.required_variables_json),
    checksum: row.checksum,
    htmlContent: includeContent ? row.html_content : undefined,
    vaultPath: row.vault_path,
    syncStatus: row.sync_status as TemplateSyncStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

const extractVariables = (htmlContent: string): string[] => {
  const matches = htmlContent.matchAll(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g)
  const values: string[] = []

  for (const match of matches) {
    if (match[1] && match[1] !== '__TOKEN_STYLE_BLOCK__') {
      values.push(match[1])
    }
  }

  return normalizeUnique(values)
}

const validateTemplateDefinition = (payload: {
  templateId: string
  version: string
  templateType: string
  name: string
  supportedFormats: string[]
  htmlContent: string
  requiredVariables?: string[]
}): TemplateValidationResult => {
  const errors: string[] = []
  const detectedVariables = extractVariables(payload.htmlContent)
  const requiredVariables = normalizeUnique(payload.requiredVariables ?? detectedVariables)

  if (!/^[a-z0-9][a-z0-9-]{2,127}$/i.test(payload.templateId)) {
    errors.push(
      'templateId must be 3-128 characters and contain only letters, numbers, and hyphens.'
    )
  }

  if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(payload.version)) {
    errors.push('version must follow semantic format major.minor.patch (for example 1.0.0).')
  }

  if (!['document', 'presentation', 'slide', 'poster', 'table'].includes(payload.templateType)) {
    errors.push('templateType must be one of: document, presentation, slide, poster, table.')
  }

  if (payload.name.trim().length < 3) {
    errors.push('name must be at least 3 characters long.')
  }

  if (!payload.htmlContent.includes('<') || !payload.htmlContent.includes('>')) {
    errors.push('htmlContent must contain valid HTML markup.')
  }

  const formats = normalizeUnique(payload.supportedFormats)
  if (formats.length === 0) {
    errors.push('supportedFormats must include at least one format.')
  }

  for (const variable of requiredVariables) {
    if (!detectedVariables.includes(variable)) {
      errors.push(`required variable "${variable}" is not declared in htmlContent.`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    detectedVariables,
    requiredVariables
  }
}

const computeTemplateChecksum = (input: {
  templateId: string
  version: string
  templateType: string
  supportedFormats: string[]
  requiredVariables: string[]
  htmlContent: string
}): string => {
  const canonical = canonicalStringify({
    templateId: input.templateId,
    version: input.version,
    templateType: input.templateType,
    supportedFormats: normalizeUnique(input.supportedFormats),
    requiredVariables: normalizeUnique(input.requiredVariables),
    htmlContent: input.htmlContent
  })
  return hashString(canonical)
}

const buildTemplateRow = (
  payload: RegisterTemplateInput,
  syncStatus: TemplateSyncStatus
): TemplateRow => {
  const requiredVariables = normalizeUnique(
    payload.requiredVariables ?? extractVariables(payload.htmlContent)
  )
  const supportedFormats = normalizeUnique(payload.supportedFormats)
  const timestamp = nowIso()

  return {
    template_id: payload.templateId,
    version: payload.version,
    template_type: payload.templateType,
    name: payload.name,
    supported_formats_json: JSON.stringify(supportedFormats),
    required_variables_json: JSON.stringify(requiredVariables),
    checksum: computeTemplateChecksum({
      templateId: payload.templateId,
      version: payload.version,
      templateType: payload.templateType,
      supportedFormats,
      requiredVariables,
      htmlContent: payload.htmlContent
    }),
    html_content: payload.htmlContent,
    vault_path: resolveVaultPath(payload.templateType, payload.templateId, payload.version),
    sync_status: syncStatus,
    created_at: timestamp,
    updated_at: timestamp
  }
}

const upsertTemplateRow = async (row: TemplateRow): Promise<void> => {
  await queueWrite(async () => {
    const db = await getDatabase()
    const statement = db.prepare(`
      INSERT INTO visual_templates (
        template_id, version, template_type, name, supported_formats_json,
        required_variables_json, checksum, html_content, vault_path, sync_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(template_id, version) DO UPDATE SET
        template_type = excluded.template_type,
        name = excluded.name,
        supported_formats_json = excluded.supported_formats_json,
        required_variables_json = excluded.required_variables_json,
        checksum = excluded.checksum,
        html_content = excluded.html_content,
        vault_path = excluded.vault_path,
        sync_status = excluded.sync_status,
        updated_at = excluded.updated_at
    `)

    statement.run([
      row.template_id,
      row.version,
      row.template_type,
      row.name,
      row.supported_formats_json,
      row.required_variables_json,
      row.checksum,
      row.html_content,
      row.vault_path,
      row.sync_status,
      row.created_at,
      row.updated_at
    ])
    statement.free()
    await persistDatabase(db)
  })
}

const readTemplateRow = async (
  templateId: string,
  version?: string
): Promise<TemplateRow | null> => {
  const db = await getDatabase()
  const query = version
    ? `
      SELECT *
      FROM visual_templates
      WHERE template_id = ? AND version = ?
      LIMIT 1
    `
    : `
      SELECT *
      FROM visual_templates
      WHERE template_id = ?
      ORDER BY updated_at DESC
      LIMIT 1
    `

  const statement = db.prepare(query)
  statement.bind(version ? [templateId, version] : [templateId])

  if (!statement.step()) {
    statement.free()
    return null
  }

  const row = statement.getAsObject() as Record<string, unknown>
  statement.free()

  return {
    template_id: String(row.template_id ?? ''),
    version: String(row.version ?? ''),
    template_type: String(row.template_type ?? 'document'),
    name: String(row.name ?? ''),
    supported_formats_json: String(row.supported_formats_json ?? '[]'),
    required_variables_json: String(row.required_variables_json ?? '[]'),
    checksum: String(row.checksum ?? ''),
    html_content: String(row.html_content ?? ''),
    vault_path: String(row.vault_path ?? ''),
    sync_status: String(row.sync_status ?? 'PENDING'),
    created_at: String(row.created_at ?? nowIso()),
    updated_at: String(row.updated_at ?? nowIso())
  }
}

const listLatestRows = async (templateType?: VisualTemplateType): Promise<TemplateRow[]> => {
  const db = await getDatabase()
  const statement = templateType
    ? db.prepare(`
        SELECT *
        FROM visual_templates
        WHERE template_type = ?
        ORDER BY template_id ASC, updated_at DESC
      `)
    : db.prepare(`
        SELECT *
        FROM visual_templates
        ORDER BY template_id ASC, updated_at DESC
      `)

  if (templateType) {
    statement.bind([templateType])
  }

  const rows: TemplateRow[] = []
  const seen = new Set<string>()
  while (statement.step()) {
    const row = statement.getAsObject() as Record<string, unknown>
    const templateId = String(row.template_id ?? '')
    if (!templateId || seen.has(templateId)) {
      continue
    }

    seen.add(templateId)
    rows.push({
      template_id: templateId,
      version: String(row.version ?? ''),
      template_type: String(row.template_type ?? 'document'),
      name: String(row.name ?? ''),
      supported_formats_json: String(row.supported_formats_json ?? '[]'),
      required_variables_json: String(row.required_variables_json ?? '[]'),
      checksum: String(row.checksum ?? ''),
      html_content: String(row.html_content ?? ''),
      vault_path: String(row.vault_path ?? ''),
      sync_status: String(row.sync_status ?? 'PENDING'),
      created_at: String(row.created_at ?? nowIso()),
      updated_at: String(row.updated_at ?? nowIso())
    })
  }

  statement.free()
  return rows
}

const listRowsBySyncStatus = async (syncStatuses: TemplateSyncStatus[]): Promise<TemplateRow[]> => {
  const db = await getDatabase()
  const placeholders = syncStatuses.map(() => '?').join(', ')
  const statement = db.prepare(`
    SELECT *
    FROM visual_templates
    WHERE sync_status IN (${placeholders})
    ORDER BY updated_at ASC
  `)
  statement.bind(syncStatuses)

  const rows: TemplateRow[] = []
  while (statement.step()) {
    const row = statement.getAsObject() as Record<string, unknown>
    rows.push({
      template_id: String(row.template_id ?? ''),
      version: String(row.version ?? ''),
      template_type: String(row.template_type ?? 'document'),
      name: String(row.name ?? ''),
      supported_formats_json: String(row.supported_formats_json ?? '[]'),
      required_variables_json: String(row.required_variables_json ?? '[]'),
      checksum: String(row.checksum ?? ''),
      html_content: String(row.html_content ?? ''),
      vault_path: String(row.vault_path ?? ''),
      sync_status: String(row.sync_status ?? 'PENDING'),
      created_at: String(row.created_at ?? nowIso()),
      updated_at: String(row.updated_at ?? nowIso())
    })
  }

  statement.free()
  return rows
}

const listTemplateVersionsRows = async (templateId: string): Promise<TemplateRow[]> => {
  const db = await getDatabase()
  const statement = db.prepare(`
    SELECT *
    FROM visual_templates
    WHERE template_id = ?
    ORDER BY updated_at DESC
  `)
  statement.bind([templateId])

  const rows: TemplateRow[] = []
  while (statement.step()) {
    const row = statement.getAsObject() as Record<string, unknown>
    rows.push({
      template_id: String(row.template_id ?? ''),
      version: String(row.version ?? ''),
      template_type: String(row.template_type ?? 'document'),
      name: String(row.name ?? ''),
      supported_formats_json: String(row.supported_formats_json ?? '[]'),
      required_variables_json: String(row.required_variables_json ?? '[]'),
      checksum: String(row.checksum ?? ''),
      html_content: String(row.html_content ?? ''),
      vault_path: String(row.vault_path ?? ''),
      sync_status: String(row.sync_status ?? 'PENDING'),
      created_at: String(row.created_at ?? nowIso()),
      updated_at: String(row.updated_at ?? nowIso())
    })
  }

  statement.free()
  return rows
}

const writeTemplateToVault = async (row: TemplateRow): Promise<void> => {
  await runtimeDocumentStoreService.writeText(row.vault_path, row.html_content, {
    syncStatus: 'PENDING'
  })
  await runtimeDocumentStoreService.flushPendingToVault(
    `visual-template sync ${row.template_id}@${row.version}`
  )
}

const setTemplateSyncStatus = async (
  templateId: string,
  version: string,
  syncStatus: TemplateSyncStatus
): Promise<void> => {
  const existing = await readTemplateRow(templateId, version)
  if (!existing) {
    return
  }

  await upsertTemplateRow({
    ...existing,
    sync_status: syncStatus,
    updated_at: nowIso()
  })
}

const renderTemplateWithData = (html: string, data: Record<string, unknown>): string => {
  return html.replace(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g, (_match, tokenName: string) => {
    if (tokenName === '__TOKEN_STYLE_BLOCK__') {
      return ''
    }

    const pathSegments = tokenName.split('.')
    let value: unknown = data
    for (const segment of pathSegments) {
      if (!value || typeof value !== 'object') {
        value = ''
        break
      }
      value = (value as Record<string, unknown>)[segment]
    }

    return sanitizeForHtml(value ?? '')
  })
}

export const templateService = {
  async ensureDefaultTemplates(): Promise<{ seeded: number; total: number }> {
    let seeded = 0

    for (const definition of DEFAULT_TEMPLATE_DEFINITIONS) {
      const existing = await readTemplateRow(definition.templateId, definition.version)
      if (existing) {
        continue
      }

      await this.registerTemplate({
        templateId: definition.templateId,
        version: definition.version,
        templateType: definition.templateType,
        name: definition.name,
        supportedFormats: definition.supportedFormats,
        requiredVariables: definition.requiredVariables,
        htmlContent: definition.htmlContent
      })
      seeded += 1
    }

    return {
      seeded,
      total: DEFAULT_TEMPLATE_DEFINITIONS.length
    }
  },

  async validateTemplate(payload: {
    templateId: string
    version: string
    templateType: VisualTemplateType
    name: string
    supportedFormats: VisualTemplateFormat[]
    htmlContent: string
    requiredVariables?: string[]
  }): Promise<TemplateValidationResult> {
    return validateTemplateDefinition(payload)
  },

  async registerTemplate(payload: RegisterTemplateInput): Promise<{
    record: VisualTemplateRecord
    synced: boolean
    error?: string
  }> {
    const validation = validateTemplateDefinition({
      templateId: payload.templateId,
      version: payload.version,
      templateType: payload.templateType,
      name: payload.name,
      supportedFormats: payload.supportedFormats,
      htmlContent: payload.htmlContent,
      requiredVariables: payload.requiredVariables
    })

    if (!validation.valid) {
      throw new Error(`Template validation failed: ${validation.errors.join('; ')}`)
    }

    const row = buildTemplateRow(
      {
        ...payload,
        requiredVariables: validation.requiredVariables
      },
      'PENDING'
    )

    await upsertTemplateRow(row)

    try {
      await writeTemplateToVault(row)
      await setTemplateSyncStatus(payload.templateId, payload.version, 'SYNCED')
      const updated = await readTemplateRow(payload.templateId, payload.version)
      return {
        record: mapRowToRecord(updated ?? row, false),
        synced: true
      }
    } catch (error) {
      await setTemplateSyncStatus(payload.templateId, payload.version, 'FAILED')
      const failed = await readTemplateRow(payload.templateId, payload.version)
      return {
        record: mapRowToRecord(failed ?? row, false),
        synced: false,
        error: error instanceof Error ? error.message : 'Failed to sync template into vault.'
      }
    }
  },

  async listTemplates(payload?: {
    templateType?: VisualTemplateType
    includeContent?: boolean
  }): Promise<VisualTemplateRecord[]> {
    const rows = await listLatestRows(payload?.templateType)
    return rows.map((row) => mapRowToRecord(row, payload?.includeContent ?? false))
  },

  async listTemplateVersions(payload: {
    templateId: string
    includeContent?: boolean
  }): Promise<VisualTemplateRecord[]> {
    const rows = await listTemplateVersionsRows(payload.templateId)
    return rows.map((row) => mapRowToRecord(row, payload.includeContent ?? false))
  },

  async getTemplate(payload: {
    templateId: string
    version?: string
    includeContent?: boolean
  }): Promise<VisualTemplateRecord | null> {
    const row = await readTemplateRow(payload.templateId, payload.version)
    if (!row) {
      return null
    }

    return mapRowToRecord(row, payload.includeContent ?? true)
  },

  async previewTemplate(payload: {
    templateId: string
    version?: string
    data: Record<string, unknown>
    tokenStyleBlock?: string
  }): Promise<TemplatePreviewResult> {
    const row = await readTemplateRow(payload.templateId, payload.version)
    if (!row) {
      throw new Error('Requested template was not found in registry.')
    }

    const requiredVariables = parseJsonStringArray(row.required_variables_json)
    const missingVariables = requiredVariables.filter((key) => {
      const pathSegments = key.split('.')
      let value: unknown = payload.data
      for (const segment of pathSegments) {
        if (!value || typeof value !== 'object') {
          return true
        }
        value = (value as Record<string, unknown>)[segment]
      }
      return value === null || value === undefined || String(value).trim().length === 0
    })

    const withTokenStyles = row.html_content.replace(
      '{{__TOKEN_STYLE_BLOCK__}}',
      payload.tokenStyleBlock ? payload.tokenStyleBlock : ''
    )

    const html = renderTemplateWithData(withTokenStyles, payload.data)
    const sourceDataHash = hashString(canonicalStringify(payload.data))

    return {
      templateId: row.template_id,
      version: row.version,
      html,
      requiredVariables,
      missingVariables,
      sourceDataHash
    }
  },

  async retryTemplateSync(): Promise<{ retried: number; synced: number; failed: number }> {
    const candidates = await listRowsBySyncStatus(['FAILED', 'PENDING'])
    if (candidates.length === 0) {
      return { retried: 0, synced: 0, failed: 0 }
    }

    let synced = 0
    let failed = 0

    for (const row of candidates) {
      try {
        await writeTemplateToVault(row)
        await setTemplateSyncStatus(row.template_id, row.version, 'SYNCED')
        synced += 1
      } catch {
        await setTemplateSyncStatus(row.template_id, row.version, 'FAILED')
        failed += 1
      }
    }

    return {
      retried: candidates.length,
      synced,
      failed
    }
  },

  async dispose(): Promise<void> {
    await writeQueue
    const db = await dbPromise
    if (db) {
      db.close()
    }
    dbPromise = null
  },

  async __resetForTesting(): Promise<void> {
    await writeQueue
    const db = await dbPromise
    if (db) {
      db.close()
    }
    dbPromise = null
    sqlRuntimePromise = null
    writeQueue = Promise.resolve()
    await rm(getDbPath(), { force: true })
  }
}
