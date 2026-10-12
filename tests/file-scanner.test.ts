import { beforeEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ entries: new Map<string, unknown[]>() }))
vi.mock('expo-file-system', () => ({
  Directory: class {
    uri: string
    constructor(uri: string) {
      this.uri = uri
    }
    list() {
      return state.entries.get(this.uri) ?? []
    }
  },
  File: class {
    name: string
    size = 1
    constructor(public uri: string) {
      this.name = uri.split('/').pop()!
    }
  }
}))
import { Directory, File } from 'expo-file-system'
import { discoverChatArchive, scanForMedia } from '../utils/file-scanner'

describe('archive discovery', () => {
  beforeEach(() => state.entries.clear())
  it('preserves paths for colliding basenames discovered in separate folders', async () => {
    state.entries.set('file:///chat', [
      new File('file:///chat/_chat.txt'),
      new Directory('file:///chat/a'),
      new Directory('file:///chat/b')
    ])
    state.entries.set('file:///chat/a', [new File('file:///chat/a/photo.jpg')])
    state.entries.set('file:///chat/b', [new File('file:///chat/b/photo.jpg')])
    expect(scanForMedia('file:///chat').map(file => file.relativePath)).toEqual([
      'a/photo.jpg',
      'b/photo.jpg'
    ])
    const found = await discoverChatArchive('file:///chat')
    expect(found.transcriptUri).toBe('file:///chat/_chat.txt')
    expect(found.mediaCandidates.map(file => file.relativePath)).toEqual([
      'a/photo.jpg',
      'b/photo.jpg'
    ])
  })
  it('stops examining files after cancellation from discovery progress', async () => {
    state.entries.set('file:///chat', [
      new File('file:///chat/_chat.txt'),
      ...Array.from({ length: 100 }, (_, index) => new File(`file:///chat/${index}.jpg`))
    ])
    const controller = new AbortController()
    let examined = 0
    await expect(
      discoverChatArchive('file:///chat', controller.signal, progress => {
        examined = progress.completed
        if (examined === 3) controller.abort()
      })
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(examined).toBe(3)
  })
})
