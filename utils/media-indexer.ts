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
  waveform: number[] | null
}

export interface MediaIndexProgress {
  completed: number
  total: number
  filename: string
}

interface MediaIndexerDependencies {
  inspect: (
    candidate: MediaCandidate,
    index: number,
    signal?: AbortSignal
  ) => Promise<MediaInspection>
  yieldToMainThread: () => Promise<void>
}

const EMPTY_INSPECTION: MediaInspection = {
  width: null,
  height: null,
  duration: null,
  previewUri: null,
  waveform: null
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return
  const error = new Error('Media indexing cancelled')
  error.name = 'AbortError'
  throw error
}

export function createMediaIndexer(dependencies: MediaIndexerDependencies) {
  return async function indexMedia(
    candidates: MediaCandidate[],
    onProgress?: (progress: MediaIndexProgress) => void,
    signal?: AbortSignal
  ): Promise<MediaMap> {
    const mediaMap: MediaMap = new Map()

    for (let index = 0; index < candidates.length; index++) {
      throwIfAborted(signal)
      const candidate = candidates[index]
      let inspection = EMPTY_INSPECTION
      try {
        inspection = await dependencies.inspect(candidate, index, signal)
        throwIfAborted(signal)
      } catch (error) {
        if (signal?.aborted) throw error
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
