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
export const extractZip = async (zipUri: string): Promise<string> => {
  const timestamp = Date.now()
  const chatsRoot = new Directory(Paths.document, 'whatsapp-chats')
  if (!chatsRoot.exists) {
    chatsRoot.create()
  }
  const extractDir = new Directory(chatsRoot, `chat-${timestamp}`)
  if (!extractDir.exists) {
    extractDir.create()
  }

  // Try native zip extraction first (works in dev client, not Expo Go)
  try {
    const { unzip } = require('react-native-zip-archive')
    if (unzip) {
      const sourcePath = zipUri.replace('file://', '')
      const targetPath = extractDir.uri.replace('file://', '')
      await unzip(sourcePath, targetPath)
      return extractDir.uri
    }
  } catch {
    // Native module not available, fall through to JSZip
  }

  // Fallback: JSZip with legacy API
  // Copy to a known cache location first (document picker URIs can be tricky)
  const cacheZipPath = `${LegacyFS.cacheDirectory}import-${timestamp}.zip`
  await LegacyFS.copyAsync({ from: zipUri, to: cacheZipPath })

  // Read zip as base64 using legacy API (supports large files better)
  const zipContent = await LegacyFS.readAsStringAsync(cacheZipPath, {
    encoding: LegacyFS.EncodingType.Base64
  })

  const zip = await JSZip.loadAsync(zipContent, { base64: true })

  // Process entries one at a time to minimize memory usage
  for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir) {
      const dirPath = `${LegacyFS.documentDirectory}whatsapp-chats/chat-${timestamp}/${relativePath}`
      const dirInfo = await LegacyFS.getInfoAsync(dirPath)
      if (!dirInfo.exists) {
        await LegacyFS.makeDirectoryAsync(dirPath, { intermediates: true })
      }
      continue
    }

    // Ensure parent directory exists
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
      await LegacyFS.writeAsStringAsync(fullPath, content, {
        encoding: LegacyFS.EncodingType.UTF8
      })
    } else {
      const content = await zipEntry.async('base64')
      await LegacyFS.writeAsStringAsync(fullPath, content, {
        encoding: LegacyFS.EncodingType.Base64
      })
    }
  }

  // Clean up cached zip
  await LegacyFS.deleteAsync(cacheZipPath, { idempotent: true })

  return extractDir.uri
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
