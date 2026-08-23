import { Directory, File } from 'expo-file-system'
import { getContentUriAsync } from 'expo-file-system/legacy'
import * as IntentLauncher from 'expo-intent-launcher'
import * as Sharing from 'expo-sharing'
import { Platform } from 'react-native'
import type { AttachmentRecord } from './media-library'
import { getMediaMimeType, getSafeMediaFilename } from './media-file'

export class MediaFileActionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MediaFileActionError'
  }
}

function requireMediaFile(record: AttachmentRecord): File {
  if (!record.mediaUri) throw new MediaFileActionError('The original media file is missing.')
  const file = new File(record.mediaUri)
  if (!file.exists)
    throw new MediaFileActionError('The original media file is no longer available.')
  return file
}

export interface LocalFileTarget {
  uri: string | null
  filename: string
  mimeType: string
}

function requireLocalFile(target: LocalFileTarget): File {
  if (!target.uri) throw new MediaFileActionError('The original file is missing.')
  const file = new File(target.uri)
  if (!file.exists) throw new MediaFileActionError('The original file is no longer available.')
  return file
}

export async function saveMediaFile(record: AttachmentRecord): Promise<'saved' | 'cancelled'> {
  const source = requireMediaFile(record)
  let directory: Directory
  try {
    directory = await Directory.pickDirectoryAsync()
  } catch (error) {
    if (error instanceof Error && /cancel/i.test(error.message)) return 'cancelled'
    throw new MediaFileActionError('The destination folder could not be opened.')
  }

  const filename = getSafeMediaFilename(record)
  let destination = new File(directory, filename)
  if (destination.exists) {
    const dot = filename.lastIndexOf('.')
    const stem = dot > 0 ? filename.slice(0, dot) : filename
    const extension = dot > 0 ? filename.slice(dot) : ''
    for (let suffix = 2; destination.exists; suffix++) {
      destination = new File(directory, `${stem}-${suffix}${extension}`)
    }
  }

  try {
    source.copy(destination)
    return 'saved'
  } catch {
    throw new MediaFileActionError('The media could not be saved to that folder.')
  }
}

export async function shareMediaFile(record: AttachmentRecord): Promise<void> {
  const source = requireMediaFile(record)
  return shareLocalFile({
    uri: source.uri,
    filename: getSafeMediaFilename(record),
    mimeType: getMediaMimeType(record)
  })
}

export async function shareLocalFile(target: LocalFileTarget): Promise<void> {
  const source = requireLocalFile(target)
  if (!(await Sharing.isAvailableAsync())) {
    throw new MediaFileActionError('Sharing is not available on this device.')
  }

  try {
    await Sharing.shareAsync(source.uri, {
      dialogTitle: `Share ${target.filename}`,
      mimeType: target.mimeType
    })
  } catch {
    throw new MediaFileActionError('The media could not be shared.')
  }
}

export async function openLocalFile(target: LocalFileTarget): Promise<void> {
  const source = requireLocalFile(target)
  try {
    if (Platform.OS === 'android') {
      const contentUri = await getContentUriAsync(source.uri)
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1,
        type: target.mimeType
      })
      return
    }

    if (Platform.OS === 'ios' && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(source.uri, {
        dialogTitle: `Open ${target.filename}`,
        mimeType: target.mimeType
      })
      return
    }
  } catch {
    throw new MediaFileActionError('No installed app could open this file type.')
  }

  throw new MediaFileActionError('Opening this file type is not supported on this device.')
}
