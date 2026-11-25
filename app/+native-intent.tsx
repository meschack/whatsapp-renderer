import { getSharedPayloads } from 'expo-sharing'
import {
  createIncomingArchiveErrorRoute,
  createIncomingArchiveRoute,
  getSharedArchiveUri,
  isIncomingArchiveUrl,
  isIncomingShareUrl
} from '../utils/incoming-archive'

let requestSequence = 0

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const source = isIncomingShareUrl(path) ? getSharedArchiveUri(getSharedPayloads()) : path
    if (!isIncomingArchiveUrl(source)) return path
    requestSequence += 1
    return createIncomingArchiveRoute(source, `${Date.now()}-${requestSequence}`)
  } catch (error) {
    return createIncomingArchiveErrorRoute(
      error instanceof Error ? error.message : 'Unable to open this chat export.'
    )
  }
}
