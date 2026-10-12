import type { SavedChat } from '../models/types'

export interface OpenSavedChatDependencies {
  sourceDirectories(chatId: string): string[]
  directoryExists(uri: string): boolean
  hasMessages(chatId: string): boolean
  prepareMedia(chat: SavedChat, sources: string[], migrateMessages: boolean): Promise<void>
  migrateMessages(chat: SavedChat, sources: string[]): Promise<void>
  messageCount(chatId: string): number
  participants(chatId: string): string[]
}

/** Missing media never authorizes deleting a durable conversation. */
export async function openSavedChat(chat: SavedChat, dependencies: OpenSavedChatDependencies) {
  const sources = [...new Set([chat.extractDirUri, ...dependencies.sourceDirectories(chat.id)])]
  const available = sources.filter(dependencies.directoryExists)
  const migrate = !dependencies.hasMessages(chat.id)
  if (migrate && available.length === 0) {
    throw new Error(
      'The original export is missing. Your chat entry has been kept. Restore or reimport the export to read it.'
    )
  }
  await dependencies.prepareMedia(chat, available, migrate)
  if (migrate) await dependencies.migrateMessages(chat, available)
  return {
    messageCount: dependencies.messageCount(chat.id),
    participants: dependencies.participants(chat.id),
    missingMediaSources: sources.length - available.length
  }
}
