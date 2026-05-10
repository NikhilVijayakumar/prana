import { access, readFile } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import type { RuntimeImage, RuntimeImageManifest } from './sandboxTypes'

let permittedImageBasePath: string | null = null

export const setPermittedImageBasePath = (basePath: string): void => {
  permittedImageBasePath = resolve(basePath)
}

const assertPathPermitted = (imagePath: string): void => {
  const normalized = resolve(imagePath)
  if (permittedImageBasePath !== null) {
    const base = permittedImageBasePath.endsWith(sep)
      ? permittedImageBasePath
      : permittedImageBasePath + sep
    if (!normalized.startsWith(base) && normalized !== permittedImageBasePath) {
      throw new Error(`image path outside permitted directory: ${normalized}`)
    }
  }
}

const computeChecksum = (manifest: RuntimeImageManifest): string => {
  const content = JSON.stringify(manifest)
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) - hash + content.charCodeAt(i)) | 0
  }
  return Math.abs(hash).toString(16)
}

export const createRuntimeImageManager = () => {
  const imageCache = new Map<string, RuntimeImage>()

  return {
    validateManifest(manifest: RuntimeImageManifest): void {
      if (!manifest.schemaVersion || manifest.schemaVersion < 1) {
        throw new Error('invalid manifest: schemaVersion must be >= 1')
      }
      if (!manifest.runtime?.id) throw new Error('invalid manifest: runtime.id required')
      if (!manifest.runtime?.version) throw new Error('invalid manifest: runtime.version required')
      if (!manifest.runtime?.entry) throw new Error('invalid manifest: runtime.entry required')
    },

    async resolveFromPath(imagePath: string): Promise<RuntimeImage> {
      assertPathPermitted(imagePath)
      const manifestPath = join(resolve(imagePath), 'runtime.json')
      try {
        await access(manifestPath)
      } catch {
        throw new Error(`runtime manifest not found: ${manifestPath}`)
      }

      const raw = await readFile(manifestPath, 'utf-8')
      const manifest = JSON.parse(raw) as RuntimeImageManifest
      this.validateManifest(manifest)

      const resolvedImagePath = resolve(imagePath)
      const entry = resolve(join(resolvedImagePath, manifest.runtime.entry))
      if (!entry.startsWith(resolvedImagePath + sep) && entry !== resolvedImagePath) {
        throw new Error(`runtime entry escapes image directory: ${entry}`)
      }
      try {
        await access(entry)
      } catch {
        throw new Error(`runtime entry not found: ${entry}`)
      }

      const image: RuntimeImage = {
        id: manifest.runtime.id,
        version: manifest.runtime.version,
        entry,
        manifest,
        checksum: computeChecksum(manifest),
        cachedAt: Date.now(),
      }

      imageCache.set(image.id, image)
      return image
    },

    resolveFromManifest(manifest: RuntimeImageManifest, entryPath: string): RuntimeImage {
      this.validateManifest(manifest)
      const image: RuntimeImage = {
        id: manifest.runtime.id,
        version: manifest.runtime.version,
        entry: entryPath,
        manifest,
        checksum: computeChecksum(manifest),
        cachedAt: Date.now(),
      }
      imageCache.set(image.id, image)
      return image
    },

    getCached(imageId: string): RuntimeImage | undefined {
      return imageCache.get(imageId)
    },

    listCached(): RuntimeImage[] {
      return [...imageCache.values()]
    },

    evict(imageId: string): void {
      imageCache.delete(imageId)
    },

    clearCache(): void {
      imageCache.clear()
    },
  }
}

export type RuntimeImageManager = ReturnType<typeof createRuntimeImageManager>

export const runtimeImageManagerService = createRuntimeImageManager()
