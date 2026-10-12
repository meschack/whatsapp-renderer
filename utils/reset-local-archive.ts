import { resetAfterArchiveOperations } from './archive-operations'
import { Image } from 'expo-image'
import { Directory, File, Paths } from 'expo-file-system'
import { getArchiveDatabase } from '@/store/archive-database'

/** Destructive passcode recovery. Call only after the user confirms removal. */
export async function resetLocalArchive(): Promise<void> {
  await resetAfterArchiveOperations(async () => {
    // Delete media before committing archive removal. On any failure the lock
    // stays in place, and the caller can retry; no credential is cleared here.
    for (const name of ['whatsapp-chats', 'chat-wallpapers']) {
      const directory = new Directory(Paths.document, name)
      if (directory.exists) directory.delete()
    }
    for (const name of ['DocumentPicker', 'ImagePicker', 'e2e-imports']) {
      const directory = new Directory(Paths.cache, name)
      if (directory.exists) directory.delete()
    }
    for (const entry of new Directory(Paths.cache).list()) {
      if (entry instanceof File && /^(kinsay-incoming-|import-).*\.zip$/.test(entry.name))
        entry.delete()
    }
    await Image.clearMemoryCache()
    await Image.clearDiskCache()
    const db = getArchiveDatabase()
    db.withTransactionSync(() => {
      for (const table of [
        'messages',
        'message_bookmarks',
        'chat_positions',
        'chat_sources',
        'chat_appearance',
        'saved_chats',
        'link_previews',
        'app_preferences'
      ]) {
        db.runSync(`DELETE FROM ${table}`)
      }
    })
  })
}
