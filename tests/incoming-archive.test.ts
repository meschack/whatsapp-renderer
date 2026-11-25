import appConfig from '../app.json'
import { redirectSystemPath } from '../app/+native-intent'
import {
  createIncomingArchiveRoute,
  getIncomingArchiveName,
  getIncomingArchiveType,
  getSharedArchiveUri,
  isIncomingArchiveUrl,
  stageIncomingArchive
} from '../utils/incoming-archive'
import { describe, expect, it, vi } from 'vitest'

const { getSharedPayloads } = vi.hoisted(() => ({
  getSharedPayloads: vi.fn(() => [] as { value: string }[])
}))
vi.mock('expo-sharing', () => ({ getSharedPayloads }))

const zipPrefix = new Uint8Array([0x50, 0x4b, 3, 4])
function dependencies() {
  return {
    cacheDirectory: 'file:///cache/',
    copyArchive: vi.fn(async () => undefined),
    readPrefix: vi.fn(async () => zipPrefix),
    wrapTranscript: vi.fn(async () => undefined),
    removeArchive: vi.fn(async () => undefined),
    now: () => 123
  }
}

describe('opening exported chats from other apps', () => {
  it('accepts ZIP and TXT locations without hijacking unrelated links', () => {
    expect(isIncomingArchiveUrl('content://com.android.providers.downloads/document/42')).toBe(true)
    expect(isIncomingArchiveUrl('file:///private/Inbox/WhatsApp%20Chat%20-%20Armel.zip')).toBe(true)
    expect(isIncomingArchiveUrl('file:///private/Inbox/Armel.TXT')).toBe(true)
    expect(isIncomingArchiveUrl('file:///private/Inbox/Armel%2Etxt')).toBe(true)
    expect(isIncomingArchiveUrl('file:///private/Inbox/photo.jpg')).toBe(false)
    expect(isIncomingArchiveUrl('https://example.com/chat.zip')).toBe(false)
    expect(isIncomingArchiveUrl('whatsapprenderer://chat')).toBe(false)
  })

  it('rewrites cold and warm native file opens into unique home import requests', () => {
    const source = 'content://downloads/document/primary%3ADownload%2FArmel.zip'
    expect(createIncomingArchiveRoute(source, 'request-7')).toBe(
      `/?incomingArchive=${encodeURIComponent(source)}&incomingArchiveRequest=request-7`
    )
    const cold = new URL(
      redirectSystemPath({ path: source, initial: true }),
      'https://kinsay.local'
    )
    const warm = new URL(
      redirectSystemPath({ path: source, initial: false }),
      'https://kinsay.local'
    )
    expect(cold.pathname).toBe('/')
    expect(cold.searchParams.get('incomingArchive')).toBe(source)
    expect(warm.searchParams.get('incomingArchiveRequest')).not.toBe(
      cold.searchParams.get('incomingArchiveRequest')
    )
    expect(redirectSystemPath({ path: 'whatsapprenderer://chat', initial: false })).toBe(
      'whatsapprenderer://chat'
    )
  })

  it('routes Android and iPhone share extension links through the same importer', () => {
    getSharedPayloads.mockReturnValue([{ value: 'content://shared/42' }])
    const route = new URL(
      redirectSystemPath({ path: 'whatsapprenderer://expo-sharing', initial: false }),
      'https://kinsay.local'
    )
    expect(route.searchParams.get('incomingArchive')).toBe('content://shared/42')
    getSharedPayloads.mockReturnValue([])
    const invalid = new URL(
      redirectSystemPath({ path: 'whatsapprenderer://expo-sharing', initial: true }),
      'https://kinsay.local'
    )
    expect(invalid.searchParams.get('incomingArchiveError')).toMatch(/one exported chat/)
    expect(() => getSharedArchiveUri([{ value: 'https://example.com/chat.zip' }])).toThrow()
    expect(() =>
      getSharedArchiveUri([{ value: 'content://one' }, { value: 'content://two' }])
    ).toThrow()
  })

  it('recovers ZIP/TXT names from encoded document-provider URLs', () => {
    expect(
      getIncomingArchiveName(
        'content://downloads/document/primary%3ADownload%2FDiscussion%20WhatsApp%20avec%20Armel.zip'
      )
    ).toBe('Discussion WhatsApp avec Armel.zip')
    expect(getIncomingArchiveName('file:///Inbox/Discussion%20WhatsApp%20avec%20Armel.txt')).toBe(
      'Discussion WhatsApp avec Armel.txt'
    )
    expect(getIncomingArchiveName('content://downloads/document/42')).toBe('WhatsApp Chat.zip')
  })

  it('recognizes ZIP signatures and text even when provider URLs have no extension', () => {
    expect(getIncomingArchiveType(zipPrefix)).toBe('zip')
    expect(getIncomingArchiveType(new Uint8Array([0x50, 0x4b, 5, 6]))).toBe('zip')
    expect(
      getIncomingArchiveType(new TextEncoder().encode('\ufeff[01/01/2026, 12:00] Armel: Hi\n'))
    ).toBe('txt')
    expect(() => getIncomingArchiveType(new Uint8Array([0, 1, 2, 3]))).toThrow(/UTF-8 TXT/)
    expect(() => getIncomingArchiveType(new Uint8Array())).toThrow(/UTF-8 TXT/)
  })

  it('stages ZIP data in app-owned cache without modifying the source', async () => {
    const deps = dependencies()
    const source = 'content://downloads/document/42'
    const staged = await stageIncomingArchive(source, deps)
    expect(staged).toEqual({
      uri: expect.stringMatching(/^file:\/\/\/cache\/kinsay-incoming-123-\d+\.zip$/),
      name: 'WhatsApp Chat.zip'
    })
    expect(deps.copyArchive).toHaveBeenCalledWith({ from: source, to: staged.uri })
    expect(deps.wrapTranscript).not.toHaveBeenCalled()
    expect(deps.removeArchive).toHaveBeenCalledOnce()
    expect(deps.removeArchive).not.toHaveBeenCalledWith(source)
  })

  it('wraps a provider TXT transcript into the existing ZIP import path', async () => {
    const deps = dependencies()
    deps.readPrefix.mockResolvedValue(new TextEncoder().encode('01/01/2026, 12:00 - Armel: Hi'))
    const staged = await stageIncomingArchive('content://downloads/document/42', deps)
    expect(staged.name).toBe('WhatsApp Chat.txt')
    expect(deps.wrapTranscript).toHaveBeenCalledWith(`${staged.uri}.txt`, staged.uri)
    expect(deps.removeArchive).toHaveBeenCalledWith(`${staged.uri}.txt`)
    expect(deps.removeArchive).not.toHaveBeenCalledWith(staged.uri)
  })

  it('cleans partial staging copies when reading, copying or wrapping fails', async () => {
    for (const method of ['copyArchive', 'readPrefix', 'wrapTranscript'] as const) {
      const deps = dependencies()
      deps.readPrefix.mockResolvedValue(new TextEncoder().encode('Armel: Hi'))
      deps[method].mockRejectedValue(new Error('Provider unavailable'))
      await expect(stageIncomingArchive('file:///Inbox/Armel.txt', deps)).rejects.toThrow(
        'Provider unavailable'
      )
      expect(deps.removeArchive).toHaveBeenCalledWith(expect.stringMatching(/\.zip$/))
      expect(deps.removeArchive).toHaveBeenCalledWith(expect.stringMatching(/\.zip\.txt$/))
    }
  })

  it('registers ZIP/TXT viewers and single-file shares on Android and iOS', () => {
    const config = appConfig.expo
    const mimeTypes = config.android.intentFilters.flatMap(filter =>
      filter.data.map(data => data.mimeType)
    )
    expect(mimeTypes).toEqual(
      expect.arrayContaining(['application/zip', 'application/x-zip-compressed', 'text/plain'])
    )
    expect(
      config.ios.infoPlist.CFBundleDocumentTypes.flatMap(type => type.LSItemContentTypes)
    ).toEqual(expect.arrayContaining(['public.zip-archive', 'public.plain-text']))
    expect(config.ios.infoPlist.LSSupportsOpeningDocumentsInPlace).toBe(false)
    expect(config.plugins).toContainEqual([
      'expo-sharing',
      expect.objectContaining({
        android: {
          enabled: true,
          singleShareMimeTypes: expect.arrayContaining(['application/zip', 'text/plain'])
        },
        ios: expect.objectContaining({ enabled: true })
      })
    ])
  })
})
