import { extractOpenGraphData } from '../utils/link-preview-cache'
import { describe, expect, it } from 'vitest'

describe('extractOpenGraphData', () => {
  it('parses common metadata and resolves relative images', () => {
    const html = `
      <head>
        <meta property="og:title" content="A useful page">
        <meta content="A short description" property="og:description">
        <meta property="og:image" content="/preview.jpg">
        <meta property="og:site_name" content="Example">
      </head>
    `

    expect(extractOpenGraphData(html, 'https://example.com/articles/1')).toEqual({
      title: 'A useful page',
      description: 'A short description',
      image: 'https://example.com/preview.jpg',
      siteName: 'Example'
    })
  })

  it('returns null when a page has no preview metadata', () => {
    expect(extractOpenGraphData('<html><head></head></html>', 'https://example.com')).toBeNull()
  })
})
