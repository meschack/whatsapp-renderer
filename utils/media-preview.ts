/** Stable cache name so resumable indexing cannot overwrite another attachment's preview. */
export function getMediaPreviewFilename(uri: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < uri.length; index += 1) {
    hash ^= uri.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `preview-${(hash >>> 0).toString(16).padStart(8, '0')}.jpg`
}
