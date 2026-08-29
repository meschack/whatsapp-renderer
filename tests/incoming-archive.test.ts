import appConfig from '../app.json'
import { redirectSystemPath } from '../app/+native-intent'
import {
  createIncomingArchiveRoute,
  getIncomingArchiveName,
  isIncomingArchiveUrl,
  stageIncomingArchive
} from '../utils/incoming-archive'
import { describe, expect, it, vi } from 'vitest'

describe('opening exported chats from other apps', () => {
  it('accepts external zip locations without hijacking unrelated links', () => {
    expect(isIncomingArchiveUrl('content://com.android.providers.downloads/document/42')).toBe(true)
    expect(isIncomingArchiveUrl('file:///private/Inbox/WhatsApp%20Chat%20-%20Armel.zip')).toBe(true)
    expect(isIncomingArchiveUrl('file:///private/Inbox/photo.jpg')).toBe(false)
    expect(isIncomingArchiveUrl('https://example.com/chat.zip')).toBe(false)
    expect(isIncomingArchiveUrl('whatsapprenderer://chat')).toBe(false)
  })

  it('rewrites a native archive URL into one unique home-screen import request', () => {
    const source = 'content://downloads/document/primary%3ADownload%2FArmel.zip'

    expect(createIncomingArchiveRoute(source, 'request-7')).toBe(
      `/?incomingArchive=${encodeURIComponent(source)}&incomingArchiveRequest=request-7`
    )

    const redirected = new URL(
      redirectSystemPath({ path: source, initial: true }),
      'https://kinsay.local'
    )
    expect(redirected.pathname).toBe('/')
    expect(redirected.searchParams.get('incomingArchive')).toBe(source)
    expect(redirectSystemPath({ path: 'whatsapprenderer://chat', initial: false })).toBe(
      'whatsapprenderer://chat'
    )
  })

  it('recovers WhatsApp export names from encoded document-provider URLs', () => {
    expect(
      getIncomingArchiveName(
        'content://downloads/document/primary%3ADownload%2FDiscussion%20WhatsApp%20avec%20Armel.zip'
      )
    ).toBe('Discussion WhatsApp avec Armel.zip')
    expect(getIncomingArchiveName('content://downloads/document/42')).toBe('WhatsApp Chat.zip')
  })

  it('stages external data in app-owned cache before importing it', async () => {
    const copyArchive = vi.fn(async () => undefined)
    const source = 'content://downloads/document/42'

    await expect(
      stageIncomingArchive(source, {
        cacheDirectory: 'file:///cache/',
        copyArchive,
        now: () => 123
      })
    ).resolves.toEqual({
      uri: 'file:///cache/kinsay-incoming-123.zip',
      name: 'WhatsApp Chat.zip'
    })
    expect(copyArchive).toHaveBeenCalledWith({
      from: source,
      to: 'file:///cache/kinsay-incoming-123.zip'
    })
  })

  it('registers Kinsay as a zip viewer on Android and iOS', () => {
    const config = appConfig.expo as typeof appConfig.expo & {
      android: {
        intentFilters?: Array<{
          action: string
          data?: Array<{ scheme?: string; mimeType?: string }>
        }>
      }
      ios: {
        infoPlist?: {
          CFBundleDocumentTypes?: Array<{ LSItemContentTypes?: string[] }>
          LSSupportsOpeningDocumentsInPlace?: boolean
        }
      }
    }
    const zipViewer = config.android.intentFilters?.find(filter => filter.action === 'VIEW')

    expect(zipViewer?.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ scheme: 'content', mimeType: 'application/zip' }),
        expect.objectContaining({ scheme: 'file', mimeType: 'application/zip' })
      ])
    )
    expect(config.ios.infoPlist?.CFBundleDocumentTypes?.[0]?.LSItemContentTypes).toContain(
      'public.zip-archive'
    )
    expect(config.ios.infoPlist?.LSSupportsOpeningDocumentsInPlace).toBe(true)
  })
})
