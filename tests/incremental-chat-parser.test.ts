import { describe, expect, it } from 'vitest'

import { createIncrementalChatParser } from '../utils/incremental-chat-parser'
import { decodeUtf8Chunks } from '../utils/utf8-stream'
import type { Message } from '../models/types'

function chunkText(content: string, sizes: number[]): () => AsyncIterable<string> {
  return async function* openTranscript() {
    let offset = 0
    let sizeIndex = 0
    while (offset < content.length) {
      const size = sizes[sizeIndex % sizes.length]
      yield content.slice(offset, offset + size)
      offset += size
      sizeIndex++
    }
  }
}

describe('incremental chat parser', () => {
  it('decodes French characters when a UTF-8 sequence spans byte chunks', async () => {
    const encoded = new TextEncoder().encode('Première ligne · Médias omis')
    const chunks = async function* () {
      for (let index = 0; index < encoded.length; index += 2) {
        yield encoded.slice(index, index + 2)
      }
    }
    let decoded = ''

    for await (const chunk of decodeUtf8Chunks(chunks())) decoded += chunk

    expect(decoded).toBe('Première ligne · Médias omis')
  })

  it('preserves French dates, localized media, and multiline messages across chunk boundaries', async () => {
    const content = [
      '13/05/2026, 08:00 - Les messages sont chiffrés de bout en bout.',
      '05/06/2026, 08:01 - Alice: Première ligne',
      'Deuxième ligne',
      '05/06/2026, 08:02 - Bob: IMG-20260605-WA0002.jpg (fichier joint)',
      '05/06/2026, 08:03 - Alice: Corrigé <Ce message a été modifié>'
    ].join('\r\n')
    const written: Message[] = []
    const parseTranscript = createIncrementalChatParser({
      batchSize: 2,
      writeBatch: async (_chatId, batch) => {
        written.push(...batch)
      },
      yieldToMainThread: async () => {}
    })

    const result = await parseTranscript({
      chatId: 'chat-fr',
      openTranscript: chunkText(content, [1, 7, 2, 19, 3]),
      mediaMap: new Map([
        [
          'IMG-20260605-WA0002.jpg',
          {
            filename: 'IMG-20260605-WA0002.jpg',
            uri: 'file:///chat/IMG-20260605-WA0002.jpg',
            type: 'image',
            size: 100,
            width: 80,
            height: 60,
            duration: null,
            previewUri: 'file:///chat/previews/photo.jpg',
            waveform: null
          } as const
        ]
      ]),
      myName: 'Alice'
    })

    expect(result).toMatchObject({ participants: ['Alice', 'Bob'], messageCount: 4 })
    expect(result.diagnostics.counts).toEqual({
      'missing-files': 0,
      'unsupported-formats': 0,
      'ambiguous-dates': 0,
      'malformed-records': 0,
      'skipped-content': 0
    })
    expect(written[0]).toMatchObject({ sender: null, isSystem: true })
    expect(written[1]).toMatchObject({
      text: 'Première ligne\nDeuxième ligne',
      timestamp: new Date(2026, 5, 5, 8, 1),
      isMine: true
    })
    expect(written[2]).toMatchObject({
      mediaType: 'image',
      mediaUri: 'file:///chat/IMG-20260605-WA0002.jpg',
      text: null
    })
    expect(written[3]).toMatchObject({ text: 'Corrigé', isEdited: true })
  })

  it('keeps a large transcript bounded, ordered, and cooperative', async () => {
    const messageCount = 20_000
    const batchSizes: number[] = []
    let transcriptOpenCount = 0
    let writtenCount = 0
    let firstText: string | null = null
    let lastText: string | null = null
    let yieldCount = 0

    const openTranscript = async function* () {
      transcriptOpenCount++
      for (let index = 0; index < messageCount; index++) {
        const day = index % 2 === 0 ? 13 : 14
        yield `${day}/05/2026, 08:00 - ${index % 2 === 0 ? 'Alice' : 'Bob'}: message-${index}\n`
      }
    }
    const parseTranscript = createIncrementalChatParser({
      batchSize: 128,
      writeBatch: async (_chatId, batch) => {
        batchSizes.push(batch.length)
        firstText ??= batch[0]?.text ?? null
        lastText = batch.at(-1)?.text ?? null
        writtenCount += batch.length
      },
      yieldToMainThread: async () => {
        yieldCount++
      }
    })

    const result = await parseTranscript({
      chatId: 'chat-large',
      openTranscript,
      mediaMap: new Map()
    })

    expect(result).toMatchObject({ participants: ['Alice', 'Bob'], messageCount })
    expect(transcriptOpenCount).toBe(2)
    expect(writtenCount).toBe(messageCount)
    expect(Math.max(...batchSizes)).toBe(128)
    expect(batchSizes.at(-1)).toBeLessThanOrEqual(128)
    expect(yieldCount).toBe(batchSizes.length)
    expect(firstText).toBe('message-0')
    expect(lastText).toBe(`message-${messageCount - 1}`)
  })
})
