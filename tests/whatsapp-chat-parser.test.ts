import { describe, expect, it } from 'vitest'

import { parseWhatsAppChat } from '../utils/whatsapp-chat-parser'
import type { MediaAttachment } from '../models/types'

function image(filename: string, uri: string): MediaAttachment {
  return {
    filename,
    uri,
    type: 'image',
    size: 100,
    width: 80,
    height: 60,
    duration: null,
    previewUri: `${uri}.preview.jpg`
  }
}

describe('parseWhatsAppChat', () => {
  it('parses French Android exports using DMY dates and localized attachments', () => {
    const content = [
      '13/05/2026, 08:00 - Les messages et les appels sont chiffrés de bout en bout.',
      '05/06/2026, 08:01 - Alice: Bonjour',
      '05/06/2026, 08:02 - Bob: Première ligne',
      'Deuxième ligne',
      '05/06/2026, 08:03 - Bob: STK-20260605-WA0001.webp (fichier joint)',
      '05/06/2026, 08:04 - Alice: IMG-20260605-WA0002.jpg (fichier joint)',
      '05/06/2026, 08:05 - Alice: Corrigé <Ce message a été modifié>'
    ].join('\n')
    const media = new Map([
      [
        'STK-20260605-WA0001.webp',
        image('STK-20260605-WA0001.webp', 'file:///chat/STK-20260605-WA0001.webp')
      ],
      [
        'IMG-20260605-WA0002.jpg',
        image('IMG-20260605-WA0002.jpg', 'file:///chat/IMG-20260605-WA0002.jpg')
      ]
    ])

    const result = parseWhatsAppChat(content, media, 'Alice')

    expect(result.participants).toEqual(['Alice', 'Bob'])
    expect(result.messages).toHaveLength(6)
    expect(result.messages[0]).toMatchObject({ sender: null, isSystem: true })
    expect(result.messages[1].timestamp).toEqual(new Date(2026, 5, 5, 8, 1))
    expect(result.messages[2].text).toBe('Première ligne\nDeuxième ligne')
    expect(result.messages[3]).toMatchObject({
      mediaType: 'image',
      mediaUri: 'file:///chat/STK-20260605-WA0001.webp',
      text: null
    })
    expect(result.messages[4]).toMatchObject({
      mediaType: 'image',
      mediaUri: 'file:///chat/IMG-20260605-WA0002.jpg',
      mediaFilename: 'IMG-20260605-WA0002.jpg',
      mediaSize: 100,
      mediaWidth: 80,
      mediaHeight: 60,
      mediaPreviewUri: 'file:///chat/IMG-20260605-WA0002.jpg.preview.jpg',
      text: null
    })
    expect(result.messages[5]).toMatchObject({
      text: 'Corrigé',
      isEdited: true,
      isMine: true
    })
  })

  it('continues to parse bracketed US exports using MDY dates and 12-hour time', () => {
    const content = [
      '[4/13/2025, 5:29:01 PM] Alice: Hello',
      '[4/13/2025, 5:30:00 PM] Bob: Hi'
    ].join('\n')

    const result = parseWhatsAppChat(content, new Map(), 'Alice')

    expect(result.messages).toHaveLength(2)
    expect(result.messages[0].timestamp).toEqual(new Date(2025, 3, 13, 17, 29, 1))
    expect(result.messages[0].isMine).toBe(true)
    expect(result.messages[1].isMine).toBe(false)
  })

  it('drops localized omitted-media placeholders without dropping real attachments', () => {
    const content = [
      '13/05/2026, 08:00 - Alice: <Médias omis>',
      '13/05/2026, 08:01 - Bob: photo.jpg (fichier joint)'
    ].join('\n')
    const media = new Map([['photo.jpg', image('photo.jpg', 'file:///chat/photo.jpg')]])

    const result = parseWhatsAppChat(content, media, 'Alice')

    expect(result.messages).toHaveLength(1)
    expect(result.messages[0]).toMatchObject({ mediaUri: 'file:///chat/photo.jpg', text: null })
  })
})
