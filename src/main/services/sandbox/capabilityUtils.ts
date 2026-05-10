import type { RuntimeCapabilities } from './sandboxTypes'

export const intersectCapabilities = (
  requested: RuntimeCapabilities,
  allowed: RuntimeCapabilities,
): RuntimeCapabilities => {
  const result: RuntimeCapabilities = {}
  for (const key of Object.keys(allowed) as (keyof RuntimeCapabilities)[]) {
    const req = requested[key] as Record<string, boolean> | undefined
    const all = allowed[key] as Record<string, boolean> | undefined
    if (!req || !all) continue
    const merged: Record<string, boolean> = {}
    for (const op of Object.keys(all)) {
      if (req[op] && all[op]) merged[op] = true
    }
    if (Object.keys(merged).length > 0) (result as Record<string, unknown>)[key] = merged
  }
  return result
}
