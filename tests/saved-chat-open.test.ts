import { describe, expect, it, vi } from 'vitest'
import type { SavedChat } from '../models/types'
import { openSavedChat, type OpenSavedChatDependencies } from '../utils/open-saved-chat'

const chat: SavedChat = {
  id: 'chat',
  chatName: 'Alice',
  myName: 'Me',
  participants: ['Alice', 'Me'],
  extractDirUri: 'file:///latest',
  messageCount: 100,
  lastMessageText: 'Saved text',
  lastMessageTime: '2026-08-01',
  importedAt: '2026-08-01'
}
function harness(savedMessages = true, available: string[] = []) {
  const dependencies: OpenSavedChatDependencies = {
    sourceDirectories: () => ['file:///earlier', 'file:///latest'],
    directoryExists: uri => available.includes(uri),
    hasMessages: () => savedMessages,
    prepareMedia: vi.fn(async () => {}),
    migrateMessages: vi.fn(async () => {}),
    messageCount: () => 100,
    participants: () => ['Alice', 'Me']
  }
  return dependencies
}
describe('opening a durable chat with missing media', () => {
  it('opens stored text even when every extracted source was removed', async () => {
    const dependencies = harness()
    const result = await openSavedChat(chat, dependencies)
    expect(result).toEqual({
      messageCount: 100,
      participants: ['Alice', 'Me'],
      missingMediaSources: 2
    })
    expect(dependencies.migrateMessages).not.toHaveBeenCalled()
    expect(chat.messageCount).toBe(100)
  })
  it('uses surviving earlier sources when the latest update directory is gone', async () => {
    const dependencies = harness(true, ['file:///earlier'])
    const result = await openSavedChat(chat, dependencies)
    expect(dependencies.prepareMedia).toHaveBeenCalledWith(chat, ['file:///earlier'], false)
    expect(result.missingMediaSources).toBe(1)
  })
  it('keeps a legacy chat entry and reports recovery when its transcript is unavailable', async () => {
    await expect(openSavedChat(chat, harness(false))).rejects.toThrow('chat entry has been kept')
    expect(chat.id).toBe('chat')
  })
})
