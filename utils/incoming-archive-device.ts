import * as LegacyFS from 'expo-file-system/legacy'

import { stageIncomingArchive } from '@/utils/incoming-archive'

export function stageIncomingArchiveFromDevice(sourceUri: string) {
  return stageIncomingArchive(sourceUri, {
    cacheDirectory: LegacyFS.cacheDirectory,
    copyArchive: LegacyFS.copyAsync,
    now: Date.now
  })
}
