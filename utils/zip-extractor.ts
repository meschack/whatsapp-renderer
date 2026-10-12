import { throwIfImportAborted, yieldImportWork } from './import-cancellation'
import { Directory, Paths } from 'expo-file-system'
import * as LegacyFS from 'expo-file-system/legacy'
import JSZip from 'jszip'

/**
 * Extract a .zip file to the app's document directory.
 *
 * Strategy to handle large zip files:
 * 1. Try native extraction via react-native-zip-archive (dev client only)
 * 2. Fallback: use JSZip with legacy FileSystem API, processing entries
 *    one at a time and releasing memory between each entry.
 */
export const extractZip = async (
  zipUri: string,
  signal?: AbortSignal,
  onProgress?: (progress: { completed: number; total: number; filename?: string }) => void
): Promise<string> => {
  throwIfImportAborted(signal)
  const timestamp = Date.now()
  const chatsRoot = new Directory(Paths.document, 'whatsapp-chats')
  if (!chatsRoot.exists) {
    chatsRoot.create()
  }
  const extractDir = new Directory(chatsRoot, `chat-${timestamp}`)
  if (!extractDir.exists) {
    extractDir.create()
  }

  try {
    // Try native zip extraction first (works in dev client, not Expo Go)
    let nativeUnzip: ((source: string, target: string) => Promise<string>) | undefined
    try {
      const { unzip } = require('react-native-zip-archive')
      nativeUnzip = unzip
    } catch {
      // Native module unavailable in Expo Go.
    }
    if (nativeUnzip) {
      try {
        // Native unzip has no abort API. Await its completion before removing output.
        onProgress?.({
          completed: 0,
          total: 1,
          filename: 'Native extraction (cancellation waits for extraction to finish)'
        })
        throwIfImportAborted(signal)
        await nativeUnzip(zipUri.replace('file://', ''), extractDir.uri.replace('file://', ''))
        throwIfImportAborted(signal)
        onProgress?.({ completed: 1, total: 1 })
        return extractDir.uri
      } catch (error) {
        throwIfImportAborted(signal)
        // A failed native engine can still fall back to JSZip.
      }
    }

    // Fallback: JSZip with legacy API. The try/finally ensures our
    // internal cache copy is removed even if reading or extracting fails.
    let completed = 0
    let total = 0
    const cacheZipPath = `${LegacyFS.cacheDirectory}import-${timestamp}.zip`
    try {
      await LegacyFS.copyAsync({ from: zipUri, to: cacheZipPath })

      throwIfImportAborted(signal)
      const zipContent = await LegacyFS.readAsStringAsync(cacheZipPath, {
        encoding: LegacyFS.EncodingType.Base64
      })
      throwIfImportAborted(signal)
      const zip = await JSZip.loadAsync(zipContent, { base64: true })

      throwIfImportAborted(signal)
      total = Object.keys(zip.files).length
      // Process entries one at a time to minimize memory usage.
      for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
        await yieldImportWork(signal)
        onProgress?.({ completed: completed++, total, filename: relativePath })
        throwIfImportAborted(signal)
        if (zipEntry.dir) {
          const dirPath = `${LegacyFS.documentDirectory}whatsapp-chats/chat-${timestamp}/${relativePath}`
          const dirInfo = await LegacyFS.getInfoAsync(dirPath)
          if (!dirInfo.exists) {
            await LegacyFS.makeDirectoryAsync(dirPath, { intermediates: true })
          }
          continue
        }

        if (relativePath.includes('/')) {
          const parentPath = relativePath.substring(0, relativePath.lastIndexOf('/'))
          const fullParentPath = `${LegacyFS.documentDirectory}whatsapp-chats/chat-${timestamp}/${parentPath}`
          const parentInfo = await LegacyFS.getInfoAsync(fullParentPath)
          if (!parentInfo.exists) {
            await LegacyFS.makeDirectoryAsync(fullParentPath, { intermediates: true })
          }
        }

        const fullPath = `${LegacyFS.documentDirectory}whatsapp-chats/chat-${timestamp}/${relativePath}`
        if (relativePath.endsWith('.txt')) {
          const content = await zipEntry.async('string')
          throwIfImportAborted(signal)
          await LegacyFS.writeAsStringAsync(fullPath, content, {
            encoding: LegacyFS.EncodingType.UTF8
          })
        } else {
          const content = await zipEntry.async('base64')
          throwIfImportAborted(signal)
          await LegacyFS.writeAsStringAsync(fullPath, content, {
            encoding: LegacyFS.EncodingType.Base64
          })
        }
      }
    } finally {
      await LegacyFS.deleteAsync(cacheZipPath, { idempotent: true })
    }

    throwIfImportAborted(signal)
    onProgress?.({ completed: total, total })
    return extractDir.uri
  } catch (error) {
    cleanupExtractedChat(extractDir.uri)
    throw error
  }
}

/** Remove the app-owned cache copy returned by DocumentPicker. */
export const cleanupTemporaryArchive = async (archiveUri: string): Promise<void> => {
  await LegacyFS.deleteAsync(archiveUri, { idempotent: true })
}

/**
 * Clean up extracted chat directory
 */
export const cleanupExtractedChat = (directoryUri: string): void => {
  const dir = new Directory(directoryUri)
  if (dir.exists) {
    dir.delete()
  }
}

/**
 * List all previously extracted chats
 */
export const listExtractedChats = (): string[] => {
  const chatsDir = new Directory(Paths.document, 'whatsapp-chats')
  if (!chatsDir.exists) return []

  return chatsDir
    .list()
    .filter((item): item is Directory => item instanceof Directory)
    .map(d => d.uri)
}
