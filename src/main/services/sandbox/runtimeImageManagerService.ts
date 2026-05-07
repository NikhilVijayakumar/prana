import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { RuntimeImage, RuntimeImageManifest } from './sandboxTypes'

const imageCache = new Map<string, RuntimeImage>()

const computeChecksum = (manifest: RuntimeImageManifest): string => {
  const content = JSON.stringify(manifest)
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) - hash + content.charCodeAt(i)) | 0
  }
  return Math.abs(hash).toString(16)
}

export const createRuntimeImageManager = () => {
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
      const manifestPath = join(imagePath, 'runtime.json')
      if (!existsSync(manifestPath)) {
        throw new Error(`runtime manifest not found: ${manifestPath}`)
      }

      const raw = await readFile(manifestPath, 'utf-8')
      const manifest = JSON.parse(raw) as RuntimeImageManifest
      this.validateManifest(manifest)

      const entry = join(imagePath, manifest.runtime.entry)
      if (!existsSync(entry)) {
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
