export const INCOMING_ARCHIVE_PARAM = 'incomingArchive'
export const INCOMING_ARCHIVE_REQUEST_PARAM = 'incomingArchiveRequest'

export function isIncomingArchiveUrl(url: string | null | undefined): url is string {
  if (!url) return false
  if (url.startsWith('content://')) return true
  if (!url.startsWith('file://')) return false
  return url.split(/[?#]/, 1)[0].toLowerCase().endsWith('.zip')
}

export function createIncomingArchiveRoute(url: string, requestId: string): string {
  return `/?${INCOMING_ARCHIVE_PARAM}=${encodeURIComponent(url)}&${INCOMING_ARCHIVE_REQUEST_PARAM}=${encodeURIComponent(requestId)}`
}

export function getIncomingArchiveName(url: string): string {
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

  const filename = decoded.split('/').pop()?.trim() ?? ''
  return filename.toLowerCase().endsWith('.zip') ? filename : 'WhatsApp Chat.zip'
}

export interface IncomingArchiveStageDependencies {
  cacheDirectory: string | null
  copyArchive(options: { from: string; to: string }): Promise<void>
  now(): number
}

export async function stageIncomingArchive(
  sourceUri: string,
  dependencies: IncomingArchiveStageDependencies
): Promise<{ uri: string; name: string }> {
  if (!isIncomingArchiveUrl(sourceUri)) throw new Error('Only ZIP archives can be imported.')
  if (!dependencies.cacheDirectory) throw new Error('The app cache is unavailable.')

  const cacheRoot = dependencies.cacheDirectory.endsWith('/')
    ? dependencies.cacheDirectory
    : `${dependencies.cacheDirectory}/`
  const temporaryArchiveUri = `${cacheRoot}kinsay-incoming-${dependencies.now()}.zip`
  await dependencies.copyArchive({ from: sourceUri, to: temporaryArchiveUri })

  return {
    uri: temporaryArchiveUri,
    name: getIncomingArchiveName(sourceUri)
  }
}
