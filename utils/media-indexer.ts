import type { MediaAttachment, MediaMap, MediaType } from '../models/types'

export interface MediaCandidate {
  filename: string
  uri: string
  type: MediaType
  size: number
}

export interface MediaInspection {
  width: number | null
  height: number | null
  duration: number | null
  previewUri: string | null
}

export interface MediaIndexProgress {
  completed: number
  total: number
  filename: string
}

interface MediaIndexerDependencies {
  inspect: (candidate: MediaCandidate, index: number) => Promise<MediaInspection>
  yieldToMainThread: () => Promise<void>
}

const EMPTY_INSPECTION: MediaInspection = {
  width: null,
  height: null,
  duration: null,
  previewUri: null
}

export function createMediaIndexer(dependencies: MediaIndexerDependencies) {
  return async function indexMedia(
    candidates: MediaCandidate[],
    onProgress?: (progress: MediaIndexProgress) => void
  ): Promise<MediaMap> {
    const mediaMap: MediaMap = new Map()

    for (let index = 0; index < candidates.length; index++) {
      const candidate = candidates[index]
      let inspection = EMPTY_INSPECTION
      try {
        inspection = await dependencies.inspect(candidate, index)
      } catch {
        // A corrupt attachment should not make an otherwise readable chat unimportable.
      }

      const attachment: MediaAttachment = { ...candidate, ...inspection }
      mediaMap.set(candidate.filename, attachment)
      onProgress?.({ completed: index + 1, total: candidates.length, filename: candidate.filename })
      await dependencies.yieldToMainThread()
    }

    return mediaMap
  }
}
