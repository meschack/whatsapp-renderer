import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  aborted: new AbortController(),
  writes: [] as string[],
  deleted: [] as string[],
  entries: {} as Record<string, { dir: boolean; async: () => Promise<string> }>
}))
vi.mock('expo-file-system', () => ({
  Paths: { document: 'file:///documents' },
  Directory: class {
    uri: string
    exists = true
    constructor(...parts: Array<string | { uri: string }>) {
      this.uri = parts.map(part => (typeof part === 'string' ? part : part.uri)).join('/')
    }
    create() {}
    delete() {
      state.deleted.push(this.uri)
    }
  }
}))
vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  documentDirectory: 'file:///documents/',
  EncodingType: { Base64: 'base64', UTF8: 'utf8' },
  copyAsync: vi.fn(async () => {}),
  readAsStringAsync: vi.fn(async () => 'zip'),
  getInfoAsync: vi.fn(async () => ({ exists: true })),
  makeDirectoryAsync: vi.fn(async () => {}),
  writeAsStringAsync: vi.fn(async (path: string) => {
    state.writes.push(path)
    state.aborted.abort()
  }),
  deleteAsync: vi.fn(async (path: string) => {
    state.deleted.push(path)
  })
}))
vi.mock('jszip', () => ({ default: { loadAsync: vi.fn(async () => ({ files: state.entries })) } }))
import { extractZip } from '../utils/zip-extractor'

describe('cooperative ZIP cancellation', () => {
  beforeEach(() => {
    state.aborted = new AbortController()
    state.writes = []
    state.deleted = []
    state.entries = {
      '_chat.txt': { dir: false, async: async () => 'chat' },
      'photo.jpg': { dir: false, async: async () => 'photo' }
    }
  })
  it('stops before the next entry and removes internal ZIP cache and partial extraction', async () => {
    await expect(
      extractZip('file:///cache/export.zip', state.aborted.signal)
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(state.writes).toHaveLength(1)
    expect(state.deleted.some(path => /cache\/import-.*\.zip$/.test(path))).toBe(true)
    expect(state.deleted.some(path => /whatsapp-chats\/chat-\d+$/.test(path))).toBe(true)
  })
  it('checks cancellation after decoding and before writing an entry', async () => {
    state.entries['_chat.txt'].async = async () => {
      state.aborted.abort()
      return 'chat'
    }
    await expect(
      extractZip('file:///cache/export.zip', state.aborted.signal)
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(state.writes).toEqual([])
    expect(state.deleted).toHaveLength(2)
  })
})
