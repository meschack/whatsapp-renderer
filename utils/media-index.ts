import { createAudioPlayer, type AudioStatus } from 'expo-audio'
import { Directory, File } from 'expo-file-system'
import { Image } from 'expo-image'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { createVideoPlayer } from 'expo-video'

import { readImageDimensions } from '@/utils/image-dimensions'
import { MEDIA_PREVIEW_DIRECTORY } from '@/utils/media-file'
import {
  createMediaIndexer,
  type MediaCandidate,
  type MediaIndexProgress,
  type MediaInspection
} from '@/utils/media-indexer'

const PREVIEW_MAX_SIZE = 640
const HEADER_READ_LIMIT = 512 * 1024

function persistPreview(cacheUri: string, previewDirectory: Directory, index: number): string {
  const source = new File(cacheUri)
  const destination = new File(previewDirectory, `preview-${index}.jpg`)
  if (destination.exists) destination.delete()
  source.move(destination)
  return destination.uri
}

function dimensionsFromHeader(uri: string): { width: number | null; height: number | null } {
  const file = new File(uri)
  const handle = file.open()
  try {
    const dimensions = readImageDimensions(
      handle.readBytes(Math.min(handle.size ?? HEADER_READ_LIMIT, HEADER_READ_LIMIT))
    )
    return { width: dimensions?.width ?? null, height: dimensions?.height ?? null }
  } finally {
    handle.close()
  }
}

async function createImagePreview(
  candidate: MediaCandidate,
  previewDirectory: Directory,
  index: number
): Promise<MediaInspection> {
  const dimensions = dimensionsFromHeader(candidate.uri)
  const source = await Image.loadAsync(candidate.uri, {
    maxWidth: PREVIEW_MAX_SIZE,
    maxHeight: PREVIEW_MAX_SIZE
  })
  const context = ImageManipulator.manipulate(source)
  let rendered: Awaited<ReturnType<typeof context.renderAsync>> | null = null
  try {
    rendered = await context.renderAsync()
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.76 })
    return {
      ...dimensions,
      duration: null,
      previewUri: persistPreview(saved.uri, previewDirectory, index)
    }
  } finally {
    rendered?.release()
    context.release()
    source.release()
  }
}

async function createVideoPreview(
  candidate: MediaCandidate,
  previewDirectory: Directory,
  index: number
): Promise<MediaInspection> {
  const player = createVideoPlayer(candidate.uri)
  let thumbnail: Awaited<ReturnType<typeof player.generateThumbnailsAsync>>[number] | null = null
  let context: ReturnType<typeof ImageManipulator.manipulate> | null = null
  let rendered: Awaited<ReturnType<ReturnType<typeof ImageManipulator.manipulate>['renderAsync']>> | null = null
  try {
    const thumbnails = await player.generateThumbnailsAsync(0, {
      maxWidth: PREVIEW_MAX_SIZE,
      maxHeight: PREVIEW_MAX_SIZE
    })
    thumbnail = thumbnails[0] ?? null
    if (!thumbnail) throw new Error(`Unable to generate a preview for ${candidate.filename}`)
    const track = player.videoTrack
    context = ImageManipulator.manipulate(thumbnail)
    rendered = await context.renderAsync()
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.76 })
    return {
      width: track?.size.width ?? thumbnail.width,
      height: track?.size.height ?? thumbnail.height,
      duration: player.duration > 0 ? player.duration : null,
      previewUri: persistPreview(saved.uri, previewDirectory, index)
    }
  } finally {
    rendered?.release()
    context?.release()
    thumbnail?.release()
    player.release()
  }
}

function waitForAudioDuration(uri: string): Promise<number | null> {
  const player = createAudioPlayer(uri, { updateInterval: 100 })
  return new Promise(resolve => {
    let settled = false
    let subscription: { remove: () => void } | null = null
    let timeout: ReturnType<typeof setTimeout> | null = null
    const finish = (duration: number | null) => {
      if (settled) return
      settled = true
      if (timeout) clearTimeout(timeout)
      subscription?.remove()
      player.release()
      resolve(duration)
    }
    const accept = (status: AudioStatus) => {
      if (status.isLoaded) finish(status.duration > 0 ? status.duration : null)
    }
    subscription = player.addListener('playbackStatusUpdate', accept)
    timeout = setTimeout(() => finish(null), 4_000)
    accept(player.currentStatus)
  })
}

export function createNativeMediaIndexer(directoryUri: string) {
  const previewDirectory = new Directory(directoryUri, MEDIA_PREVIEW_DIRECTORY)
  previewDirectory.create({ idempotent: true, intermediates: true })

  return createMediaIndexer({
    inspect: async (candidate, index) => {
      if (candidate.type === 'image') {
        return createImagePreview(candidate, previewDirectory, index)
      }
      if (candidate.type === 'video') {
        return createVideoPreview(candidate, previewDirectory, index)
      }
      if (candidate.type === 'audio') {
        return {
          width: null,
          height: null,
          duration: await waitForAudioDuration(candidate.uri),
          previewUri: null
        }
      }
      return { width: null, height: null, duration: null, previewUri: null }
    },
    yieldToMainThread: () => new Promise(resolve => setTimeout(resolve, 0))
  })
}

export function indexMedia(
  candidates: MediaCandidate[],
  directoryUri: string,
  onProgress?: (progress: MediaIndexProgress) => void
) {
  return createNativeMediaIndexer(directoryUri)(candidates, onProgress)
}
