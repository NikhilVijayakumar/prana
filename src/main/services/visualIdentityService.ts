import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { getPranaRuntimeConfig } from './pranaRuntimeConfig'

export interface VisualTokenSnapshot {
  version: string
  source: 'astra'
  checksum: string
  tokens: {
    color: Record<string, unknown>
    typography: Record<string, unknown>
    spacing: Record<string, unknown>
    layout: Record<string, unknown>
  }
}

const DEFAULT_TOKENS: VisualTokenSnapshot['tokens'] = {
  color: {
    primary: '#111827',
    secondary: '#374151',
    background: '#f9fafb',
    text: '#111827'
  },
  typography: {
    display: '"Segoe UI", sans-serif',
    bodyFont: '"Segoe UI", sans-serif',
    h1: { size: 42, weight: 700, lineHeight: 1.2 },
    h2: { size: 30, weight: 600, lineHeight: 1.25 },
    bodyScale: { size: 16, weight: 400, lineHeight: 1.45 }
  },
  spacing: {
    base: 16,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32
  },
  layout: {
    maxWidth: 1080,
    radius: 10,
    borderWidth: 1
  }
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

const flattenTokenEntries = (
  value: unknown,
  path: string[] = [],
  output: Array<{ key: string; value: string }> = []
): Array<{ key: string; value: string }> => {
  if (value === null || value === undefined) {
    return output
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    const key = path.join('-').toLowerCase()
    output.push({ key, value: String(value) })
    return output
  }

  for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
    flattenTokenEntries(childValue, [...path, childKey], output)
  }

  return output
}

const toObject = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  return value as Record<string, unknown>
}

const getRegistryRoot = (): string | null => {
  const runtimeConfig = getPranaRuntimeConfig()
  if (!runtimeConfig?.registryRoot || runtimeConfig.registryRoot.trim().length === 0) {
    return null
  }
  return runtimeConfig.registryRoot
}

const readRegistryJson = async (relativePath: string): Promise<Record<string, unknown> | null> => {
  const registryRoot = getRegistryRoot()
  if (!registryRoot) {
    return null
  }

  const filePath = join(registryRoot, relativePath)
  if (!existsSync(filePath)) {
    return null
  }

  try {
    const raw = await readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null
    }
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

const buildTokenSnapshot = async (): Promise<VisualTokenSnapshot> => {
  const [themeConfig, typographyConfig] = await Promise.all([
    readRegistryJson(join('branding', 'theme.json')),
    readRegistryJson(join('branding', 'typography.json'))
  ])

  const tokens: VisualTokenSnapshot['tokens'] = {
    color: {
      ...DEFAULT_TOKENS.color,
      ...toObject(themeConfig?.colors)
    },
    typography: {
      ...DEFAULT_TOKENS.typography,
      ...toObject(typographyConfig)
    },
    spacing: {
      ...DEFAULT_TOKENS.spacing,
      ...toObject(themeConfig?.spacing)
    },
    layout: {
      ...DEFAULT_TOKENS.layout,
      ...toObject(themeConfig?.layout)
    }
  }

  const checksum = hashString(canonicalStringify(tokens))
  return {
    version: `astra-${checksum.slice(0, 12)}`,
    source: 'astra',
    checksum,
    tokens
  }
}

const renderTokenStyleBlock = (tokens: VisualTokenSnapshot['tokens']): string => {
  const entries = flattenTokenEntries(tokens).sort((a, b) => a.key.localeCompare(b.key))
  const variableLines = entries
    .filter((entry) => entry.key.length > 0)
    .map((entry) => `  --token-${entry.key}: ${entry.value};`)
    .join('\n')

  if (!variableLines) {
    return ''
  }

  return `<style id="visual-identity-token-style">\n:root {\n${variableLines}\n}\n</style>`
}

export const visualIdentityService = {
  async getTokenSnapshot(): Promise<VisualTokenSnapshot> {
    return buildTokenSnapshot()
  },

  renderTokenStyleBlock
}
