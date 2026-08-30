import { describe, expect, it } from 'vitest'

import { parseWhatsAppChat } from '../utils/whatsapp-chat-parser'
import { getImportDiagnosticTotal } from '../utils/import-diagnostics'
import { formatImportDiagnosticsReport } from '../utils/import-diagnostics-report'
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
    previewUri: `${uri}.preview.jpg`,
    waveform: null
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

  it('parses Samsung French exports using localized day periods', () => {
    const content = [
      '13/05/2026, 4:15 matin - Alice: Avant le lever du soleil',
      '13/05/2026, 12:00 midi - Bob: À midi',
      '13/05/2026, 3:30 après-midi - Alice: Dans l’après-midi',
      '13/05/2026, 8:45 soir - Bob: Dans la soirée',
      '14/05/2026, 12:10 nuit - Alice: Après minuit',
      '14/05/2026, 2:05 nuit - Bob: Pendant la nuit'
    ].join('\n')

    const result = parseWhatsAppChat(content, new Map(), 'Alice')

    expect(result.messages.map(message => message.timestamp)).toEqual([
      new Date(2026, 4, 13, 4, 15),
      new Date(2026, 4, 13, 12, 0),
      new Date(2026, 4, 13, 15, 30),
      new Date(2026, 4, 13, 20, 45),
      new Date(2026, 4, 14, 0, 10),
      new Date(2026, 4, 14, 2, 5)
    ])
  })

  it('keeps localized omitted media as an unavailable attachment', () => {
    const content = [
      '13/05/2026, 08:00 - Alice: <Médias omis>',
      '13/05/2026, 08:01 - Bob: photo.jpg (fichier joint)'
    ].join('\n')
    const media = new Map([['photo.jpg', image('photo.jpg', 'file:///chat/photo.jpg')]])

    const result = parseWhatsAppChat(content, media, 'Alice')

    expect(result.messages).toHaveLength(2)
    expect(result.messages[0]).toMatchObject({
      mediaType: 'image',
      mediaUri: null,
      text: null
    })
    expect(result.messages[1]).toMatchObject({ mediaUri: 'file:///chat/photo.jpg', text: null })
  })

  it('removes an omitted-media marker while preserving its caption', () => {
    const content = [
      '13/05/2026, 08:00 - Alice: <Médias omis>',
      'Tu penses que ton visage est comme ça'
    ].join('\n')

    const result = parseWhatsAppChat(content, new Map(), 'Alice')

    expect(result.messages[0]).toMatchObject({
      mediaType: 'image',
      mediaUri: null,
      text: 'Tu penses que ton visage est comme ça'
    })
  })

  it('removes a localized attachment marker while preserving its caption', () => {
    const content = [
      '13/05/2026, 08:00 - Alice: photo.jpg (fichier joint)',
      "Regarde comment j'ai de jolis yeux 😹"
    ].join('\n')
    const media = new Map([['photo.jpg', image('photo.jpg', 'file:///chat/photo.jpg')]])

    const result = parseWhatsAppChat(content, media, 'Alice')

    expect(result.messages[0]).toMatchObject({
      mediaUri: 'file:///chat/photo.jpg',
      text: "Regarde comment j'ai de jolis yeux 😹"
    })
  })

  it('removes the localized attachment marker from video captions too', () => {
    const content = [
      '13/05/2026, 08:00 - Alice: VID-20260513-WA0001.mp4 (fichier joint)',
      "C'était les plus jolies en fait"
    ].join('\n')
    const media = new Map<string, MediaAttachment>([
      [
        'VID-20260513-WA0001.mp4',
        {
          ...image('VID-20260513-WA0001.mp4', 'file:///chat/VID-20260513-WA0001.mp4'),
          type: 'video',
          duration: 8.4
        }
      ]
    ])

    const result = parseWhatsAppChat(content, media, 'Alice')

    expect(result.messages[0]).toMatchObject({
      mediaType: 'video',
      mediaUri: 'file:///chat/VID-20260513-WA0001.mp4',
      text: "C'était les plus jolies en fait"
    })
  })

  it('keeps recoverable records and reports each import diagnostic category exactly', () => {
    const content = [
      'This line is not a WhatsApp record',
      '[02/03/2026, 10:00] Alice: <Media omitted>',
      '[02/03/2026, 10:01] Bob: archive.rar (file attached)',
      '[02/03/2026, 10:02] Alice: photo.jpg (file attached)'
    ].join('\n')

    const result = parseWhatsAppChat(content, new Map(), 'Alice')

    expect(result.messages).toHaveLength(3)
    expect(result.messages[1]).toMatchObject({
      sender: 'Bob',
      mediaType: 'document',
      mediaFilename: 'archive.rar',
      mediaUri: null
    })
    expect(result.diagnostics.counts).toEqual({
      'missing-files': 2,
      'unsupported-formats': 1,
      'ambiguous-dates': 3,
      'malformed-records': 1,
      'skipped-content': 0
    })
    expect(getImportDiagnosticTotal(result.diagnostics)).toBe(7)
    expect(formatImportDiagnosticsReport(result.diagnostics)).toContain('7 import notices')
    expect(formatImportDiagnosticsReport(result.diagnostics)).toContain('Missing files: 2')
    expect(formatImportDiagnosticsReport(result.diagnostics)).toContain('Unsupported formats: 1')
    expect(formatImportDiagnosticsReport(result.diagnostics)).toContain('Ambiguous dates: 3')
    expect(formatImportDiagnosticsReport(result.diagnostics)).toContain('Malformed records: 1')
    expect(formatImportDiagnosticsReport(result.diagnostics)).not.toContain('Skipped content')
  })
})
