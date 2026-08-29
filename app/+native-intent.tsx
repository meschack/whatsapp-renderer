import { createIncomingArchiveRoute, isIncomingArchiveUrl } from '../utils/incoming-archive'

let requestSequence = 0

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    if (!isIncomingArchiveUrl(path)) return path
    requestSequence += 1
    return createIncomingArchiveRoute(path, `${Date.now()}-${requestSequence}`)
  } catch {
    return '/'
  }
}
