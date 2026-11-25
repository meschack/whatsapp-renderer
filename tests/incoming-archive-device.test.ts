import JSZip from 'jszip'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { stageIncomingArchiveFromDevice } from '../utils/incoming-archive-device'

const { fs, getSharedPayloads, clearSharedPayloads, close } = vi.hoisted(() => ({
  fs: new Map<string, string>(),
  getSharedPayloads: vi.fn(() => [] as { value: string }[]),
  clearSharedPayloads: vi.fn(),
  close: vi.fn()
}))
vi.mock('expo-sharing', () => ({ getSharedPayloads, clearSharedPayloads }))
vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  EncodingType: { Base64: 'base64' },
  copyAsync: vi.fn(async ({ from, to }: { from: string; to: string }) => {
    if (!fs.has(from)) throw new Error('Unreadable source')
    fs.set(to, fs.get(from)!)
  }),
  readAsStringAsync: vi.fn(async (uri: string) => fs.get(uri)),
  writeAsStringAsync: vi.fn(async (uri: string, data: string) => {
    fs.set(uri, data)
  }),
  deleteAsync: vi.fn(async (uri: string) => {
    fs.delete(uri)
  })
}))
vi.mock('expo-file-system', () => ({
  File: class {
    constructor(readonly uri: string) {}
    open() {
      return {
        readBytes: () => new TextEncoder().encode(fs.get(this.uri)?.slice(0, 512)),
        close
      }
    }
  }
}))

beforeEach(() => {
  fs.clear()
  vi.clearAllMocks()
  getSharedPayloads.mockReturnValue([])
})

describe('device transcript staging', () => {
  it('produces a real, repeatable ZIP and clears Expo payload only after copying it', async () => {
    const source = 'file:///share/Armel.txt'
    const transcript = '01/01/2026, 12:00 - Armel: Hello 👋\n'
    fs.set(source, transcript)
    getSharedPayloads.mockReturnValue([{ value: source }])
    clearSharedPayloads.mockImplementation(() => {
      fs.delete(source)
    })

    const first = await stageIncomingArchiveFromDevice(source)
    const encoded = fs.get(first.uri)!
    const archive = await JSZip.loadAsync(encoded, { base64: true })
    expect(await archive.file('_chat.txt')!.async('string')).toBe(transcript)
    expect(first.name).toBe('Armel.txt')
    expect(clearSharedPayloads).toHaveBeenCalledOnce()
    expect(fs.has(`${first.uri}.txt`)).toBe(false)
    expect(close).toHaveBeenCalledOnce()

    fs.set(source, transcript)
    const second = await stageIncomingArchiveFromDevice(source)
    expect(second.uri).not.toBe(first.uri)
    expect(fs.get(second.uri)).toBe(encoded)
  })

  it('keeps a newer shared file available while staging the previous one', async () => {
    const source = 'file:///share/Armel.txt'
    fs.set(source, '01/01/2026, 12:00 - Armel: Hi')
    getSharedPayloads.mockReturnValue([{ value: 'file:///share/Newer.zip' }])
    await stageIncomingArchiveFromDevice(source)
    expect(clearSharedPayloads).not.toHaveBeenCalled()
  })
})
