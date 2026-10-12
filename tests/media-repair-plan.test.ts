import { describe, expect, it } from 'vitest'
import { planMediaRepair } from '../utils/media-repair-plan'
const candidate = {
  filename: 'photo.jpg',
  uri: 'file:///new/photo.jpg',
  type: 'image' as const,
  size: 20
}
describe('repairing attachments without collapsing historical exports', () => {
  it('refuses a reused filename from two distinct retained sources', () => {
    const result = planMediaRepair(
      [
        { id: 1, mediaFilename: 'photo.jpg', mediaUri: 'file:///old/photo.jpg' },
        { id: 2, mediaFilename: 'photo.jpg', mediaUri: 'file:///later/photo.jpg' }
      ],
      [candidate],
      () => false
    )
    expect(result.conflictingNames).toEqual(['photo.jpg'])
    expect(result.candidates).toEqual([])
    expect(result.missing).toHaveLength(2)
  })
  it('allows repeated references to the same file and ignores intact files', () => {
    const rows = [
      { id: 1, mediaFilename: 'photo.jpg', mediaUri: 'file:///old/photo.jpg' },
      { id: 2, mediaFilename: 'photo.jpg', mediaUri: 'file:///old/photo.jpg' }
    ]
    expect(planMediaRepair(rows, [candidate], () => false).candidates).toEqual([candidate])
    expect(planMediaRepair(rows, [candidate], () => true).candidates).toEqual([])
  })
})
