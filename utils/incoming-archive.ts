export const INCOMING_ARCHIVE_PARAM = 'incomingArchive'
export const INCOMING_ARCHIVE_REQUEST_PARAM = 'incomingArchiveRequest'
export const INCOMING_ARCHIVE_ERROR_PARAM = 'incomingArchiveError'

export function isIncomingArchiveUrl(url: string | null | undefined): url is string {
  if (!url) return false
  if (url.startsWith('content://')) return true
  if (!url.startsWith('file://')) return false
  return /\.(zip|txt)$/i.test(decodeIncomingPath(url))
}

function decodeIncomingPath(url: string): string {
  let decoded = url.split(/[?#]/, 1)[0]
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const next = decodeURIComponent(decoded)
      if (next === decoded) break
      decoded = next
    } catch {
      break
    }
  }
  return decoded
}

export function createIncomingArchiveErrorRoute(message: string): string {
  return `/?${INCOMING_ARCHIVE_ERROR_PARAM}=${encodeURIComponent(message)}`
}

export function isIncomingShareUrl(path: string): boolean {
  try {
    return new URL(path).hostname === 'expo-sharing'
  } catch {
    return false
  }
}

export function getSharedArchiveUri(payloads: { value?: string; shareType?: string }[]): string {
  const files = payloads.filter(payload => isIncomingArchiveUrl(payload.value))
  if (files.length !== 1) throw new Error('Share one exported chat ZIP or TXT file at a time.')
  return files[0].value!
}

export function createIncomingArchiveRoute(url: string, requestId: string): string {
  return `/?${INCOMING_ARCHIVE_PARAM}=${encodeURIComponent(url)}&${INCOMING_ARCHIVE_REQUEST_PARAM}=${encodeURIComponent(requestId)}`
}

export function getIncomingArchiveName(url: string): string {
  const decoded = decodeIncomingPath(url)
  const filename = decoded.split('/').pop()?.trim() ?? ''
  return /\.(zip|txt)$/i.test(filename) ? filename : 'WhatsApp Chat.zip'
}

/** Inspect a small local prefix: Android providers often hide filenames behind numeric IDs. */
export function getIncomingArchiveType(prefix: Uint8Array): 'zip' | 'txt' {
  if (
    prefix[0] === 0x50 &&
    prefix[1] === 0x4b &&
    ((prefix[2] === 3 && prefix[3] === 4) ||
      (prefix[2] === 5 && prefix[3] === 6) ||
      (prefix[2] === 7 && prefix[3] === 8))
  )
    return 'zip'
  if (!prefix.length || prefix.some(byte => byte < 32 && ![9, 10, 13].includes(byte))) {
    throw new Error('This file is not a supported chat ZIP or UTF-8 TXT export.')
  }
  return 'txt'
}

export interface IncomingArchiveStageDependencies {
  cacheDirectory: string | null
  copyArchive(options: { from: string; to: string }): Promise<void>
  readPrefix(uri: string): Promise<Uint8Array>
  wrapTranscript(source: string, target: string): Promise<void>
  removeArchive(uri: string): Promise<void>
  now(): number
}

let stagingSequence = 0

export async function stageIncomingArchive(
  sourceUri: string,
  dependencies: IncomingArchiveStageDependencies
): Promise<{ uri: string; name: string }> {
  if (!isIncomingArchiveUrl(sourceUri))
    throw new Error('Only chat ZIP or TXT exports can be imported.')
  if (!dependencies.cacheDirectory) throw new Error('The app cache is unavailable.')

  const cacheRoot = dependencies.cacheDirectory.endsWith('/')
    ? dependencies.cacheDirectory
    : `${dependencies.cacheDirectory}/`
  const temporaryArchiveUri = `${cacheRoot}kinsay-incoming-${dependencies.now()}-${++stagingSequence}.zip`
  const transcriptUri = `${temporaryArchiveUri}.txt`
  try {
    // Read only our own copy; content URI grants may expire once the sending app closes.
    await dependencies.copyArchive({ from: sourceUri, to: temporaryArchiveUri })
    const type = getIncomingArchiveType(await dependencies.readPrefix(temporaryArchiveUri))
    const name = getIncomingArchiveName(sourceUri).replace(/\.(zip|txt)$/i, `.${type}`)
    if (type === 'txt') {
      await dependencies.copyArchive({ from: temporaryArchiveUri, to: transcriptUri })
      await dependencies.wrapTranscript(transcriptUri, temporaryArchiveUri)
    }
    return { uri: temporaryArchiveUri, name }
  } catch (error) {
    await dependencies.removeArchive(temporaryArchiveUri).catch(() => undefined)
    throw error
  } finally {
    await dependencies.removeArchive(transcriptUri).catch(() => undefined)
  }
}
