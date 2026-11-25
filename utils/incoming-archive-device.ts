import * as LegacyFS from 'expo-file-system/legacy'
import { File } from 'expo-file-system'
import JSZip from 'jszip'
import { clearSharedPayloads, getSharedPayloads } from 'expo-sharing'

import { stageIncomingArchive } from '@/utils/incoming-archive'

export async function stageIncomingArchiveFromDevice(sourceUri: string) {
  const archive = await stageIncomingArchive(sourceUri, {
    cacheDirectory: LegacyFS.cacheDirectory,
    copyArchive: LegacyFS.copyAsync,
    readPrefix: async uri => {
      const handle = new File(uri).open()
      try {
        return handle.readBytes(512)
      } finally {
        handle.close()
      }
    },
    wrapTranscript: async (source, target) => {
      const zip = new JSZip()
      zip.file('_chat.txt', await LegacyFS.readAsStringAsync(source), {
        date: new Date('1980-01-01T00:00:00.000Z')
      })
      // Keep TXT on the same review, parser, cancellation and duplicate-detection path as ZIP.
      const encoded = await zip.generateAsync({ type: 'base64', compression: 'STORE' })
      await LegacyFS.writeAsStringAsync(target, encoded, { encoding: LegacyFS.EncodingType.Base64 })
    },
    removeArchive: uri => LegacyFS.deleteAsync(uri, { idempotent: true }),
    now: Date.now
  })
  try {
    // Clearing Expo's payload also deletes its cached copies. Wait for our copy first,
    // and leave a newer incoming share alone if it arrived while this one was staged.
    const payloads = getSharedPayloads()
    if (payloads.some(payload => payload.value === sourceUri)) clearSharedPayloads()
  } catch {
    // Older development clients may not expose the incoming-sharing methods yet.
  }
  return archive
}
