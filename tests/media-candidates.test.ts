import { describe, expect, it } from 'vitest'
import { findAmbiguousMedia, unambiguousMediaCandidates } from '../utils/media-candidates'
import { createMediaIndexer, type MediaCandidate } from '../utils/media-indexer'
import { createArchiveFingerprint } from '../utils/archive-identity'
import { visitWhatsAppChatStream } from '../utils/whatsapp-chat-parser'

const candidates: MediaCandidate[] = [
  {
    filename: 'photo.jpg',
    relativePath: 'a/photo.jpg',
    uri: 'file:///a/photo.jpg',
    type: 'image',
    size: 12
  },
  {
    filename: 'photo.jpg',
    relativePath: 'b/photo.jpg',
    uri: 'file:///b/photo.jpg',
    type: 'image',
    size: 12
  },
  {
    filename: 'unique.jpg',
    relativePath: 'a/unique.jpg',
    uri: 'file:///a/unique.jpg',
    type: 'image',
    size: 10
  }
]
describe('attachment basename safety', () => {
  it('retains both paths and excludes all ambiguous matches regardless of archive order', () => {
    expect(findAmbiguousMedia(candidates)).toEqual([
      { filename: 'photo.jpg', relativePaths: ['a/photo.jpg', 'b/photo.jpg'] }
    ])
    expect(unambiguousMediaCandidates([...candidates].reverse())).toEqual([candidates[2]])
    expect(createArchiveFingerprint('transcript', candidates)).not.toBe(
      createArchiveFingerprint(
        'transcript',
        candidates.map(candidate => ({ ...candidate, relativePath: undefined }))
      )
    )
  })
  it('does not inspect or persist one arbitrary colliding file', async () => {
    const inspected: string[] = []
    const index = createMediaIndexer({
      inspect: async candidate => {
        inspected.push(candidate.uri)
        return { width: null, height: null, duration: null, previewUri: null, waveform: null }
      },
      yieldToMainThread: async () => {}
    })
    const result = await index(candidates)
    expect(inspected).toEqual(['file:///a/unique.jpg'])
    expect(result.has('photo.jpg')).toBe(false)
  })
  it('cancels during the date-inference pass before parsing messages', async () => {
    const controller = new AbortController()
    let visited = 0
    const open = async function* () {
      yield '23/08/26, 10:00 - Alice: hi\n'
      controller.abort()
      yield '23/08/26, 10:01 - Alice: bye\n'
    }
    await expect(
      visitWhatsAppChatStream(
        open,
        new Map(),
        undefined,
        () => {
          visited++
        },
        controller.signal
      )
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(visited).toBe(0)
  })
})
