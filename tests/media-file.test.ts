import { describe, expect, it } from 'vitest'

import {
  getAdjacentMediaSequence,
  formatFileSize,
  getDecodedFilename,
  getDocumentPresentation,
  getMediaMimeType,
  getSafeMediaFilename
} from '../utils/media-file'
import type { AttachmentRecord } from '../utils/media-library'

function record(
  sequence: number,
  filename: string | null,
  type: 'image' | 'video'
): AttachmentRecord {
  return {
    sequence,
    messageId: `msg-${sequence}`,
    type,
    sender: 'Alice',
    timestamp: new Date(sequence * 1_000),
    text: null,
    mediaUri: `file:///${sequence}`,
    previewUri: null,
    filename,
    size: 100,
    width: 80,
    height: 60,
    duration: type === 'video' ? 4 : null,
    url: null
  }
}

describe('media viewer file presentation', () => {
  it('decodes and sanitizes source filenames while preserving useful MIME types', () => {
    const photo = record(4, 'WhatsApp%20Image%202026%2F08.jpg', 'image')
    const video = record(5, null, 'video')

    expect(getSafeMediaFilename(photo)).toBe('WhatsApp Image 2026_08.jpg')
    expect(getMediaMimeType(photo)).toBe('image/jpeg')
    expect(getSafeMediaFilename(video)).toBe('whatsapp-5.mp4')
    expect(getMediaMimeType(video)).toBe('video/mp4')
  })

  it('navigates the descending filtered window without crossing its edges', () => {
    const records = [
      record(9, '9.jpg', 'image'),
      record(7, '7.jpg', 'image'),
      record(3, '3.jpg', 'image')
    ]

    expect(getAdjacentMediaSequence(records, 7, 'newer')).toBe(9)
    expect(getAdjacentMediaSequence(records, 7, 'older')).toBe(3)
    expect(getAdjacentMediaSequence(records, 9, 'newer')).toBeNull()
    expect(getAdjacentMediaSequence(records, 3, 'older')).toBeNull()
  })

  it('normalizes document names, supported types, and readable sizes', () => {
    expect(getDecodedFilename('Quarterly%20Report.xlsx', 'Document')).toBe('Quarterly Report.xlsx')
    expect(getDocumentPresentation('Quarterly Report.xlsx')).toEqual({
      label: 'Excel',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    expect(getDocumentPresentation('payload.exe')).toBeNull()
    expect(formatFileSize(950)).toBe('950 B')
    expect(formatFileSize(2_560)).toBe('2.5 KB')
    expect(formatFileSize(3 * 1_048_576)).toBe('3.0 MB')
    expect(formatFileSize(null)).toBe('Unknown size')
  })
})
