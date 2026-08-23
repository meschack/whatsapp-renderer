import {
  createLinkPreviewLoader,
  extractOpenGraphData,
  validatePreviewUrl,
  type LinkPreviewData,
  type StoredLinkPreview
} from '../utils/link-preview-cache'
import { afterEach, describe, expect, it, vi } from 'vitest'

function createRepository() {
  const entries = new Map<string, StoredLinkPreview>()
  return {
    entries,
    get: vi.fn(async (url: string) => entries.get(url) ?? null),
    save: vi.fn(async (url: string, data: LinkPreviewData | null, expiresAt: number) => {
      entries.set(url, { data, expiresAt })
    })
  }
}

function previewResponse(title = 'Fetched title'): Response {
  return new Response(`<meta property="og:title" content="${title}">`, {
    status: 200,
    headers: { 'content-type': 'text/html' }
  })
}

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

  it('rejects direct private-network and non-HTTP destinations', () => {
    expect(() => validatePreviewUrl('http://127.0.0.1/admin')).toThrow(/Private network/)
    expect(() => validatePreviewUrl('http://192.168.1.10')).toThrow(/Private network/)
    expect(() => validatePreviewUrl('file:///etc/passwd')).toThrow(/Only HTTP/)
    expect(validatePreviewUrl('https://example.com/path')).toBe('https://example.com/path')
  })
})

describe('privacy-safe link preview loader', () => {
  afterEach(() => vi.useRealTimers())

  it('reads persisted consent without contacting the destination automatically', async () => {
    const repository = createRepository()
    repository.entries.set('https://example.com/', {
      data: { title: 'Saved', description: null, image: null, siteName: 'Example' },
      expiresAt: 2_000
    })
    const fetcher = vi.fn<typeof fetch>()
    const loader = createLinkPreviewLoader({ repository, fetcher, now: () => 1_000 })

    await expect(loader.read('https://example.com/')).resolves.toMatchObject({
      isCached: true,
      data: { title: 'Saved' }
    })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('persists successful previews and bounded failures with different expiries', async () => {
    const repository = createRepository()
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(previewResponse())
      .mockResolvedValueOnce(
        new Response('too large', {
          status: 200,
          headers: { 'content-type': 'text/html', 'content-length': '5000' }
        })
      )
    const loader = createLinkPreviewLoader({
      repository,
      fetcher,
      now: () => 10_000,
      maxResponseBytes: 100
    })

    await expect(loader.load('https://example.com/success')).resolves.toMatchObject({
      title: 'Fetched title'
    })
    await expect(loader.load('https://example.com/large')).resolves.toBeNull()

    const success = repository.entries.get('https://example.com/success')!
    const failure = repository.entries.get('https://example.com/large')!
    expect(success.expiresAt - 10_000).toBe(7 * 24 * 60 * 60 * 1_000)
    expect(failure.expiresAt - 10_000).toBe(24 * 60 * 60 * 1_000)
    expect(failure.data).toBeNull()
  })

  it('times out and persists a failure without confusing it with user cancellation', async () => {
    vi.useFakeTimers()
    const repository = createRepository()
    const fetcher = vi.fn<typeof fetch>((_url, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('Timed out', 'AbortError'))
        )
      })
    })
    const loader = createLinkPreviewLoader({ repository, fetcher, timeoutMs: 50 })
    const request = loader.load('https://example.com/slow')

    await vi.advanceTimersByTimeAsync(50)

    await expect(request).resolves.toBeNull()
    expect(repository.save).toHaveBeenCalledWith(
      'https://example.com/slow',
      null,
      expect.any(Number),
      expect.any(Number)
    )
  })

  it('cancels an explicit request without persisting a false failure', async () => {
    const repository = createRepository()
    const fetcher = vi.fn<typeof fetch>((_url, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('Cancelled', 'AbortError'))
        )
      })
    })
    const loader = createLinkPreviewLoader({ repository, fetcher })
    const controller = new AbortController()
    const request = loader.load('https://example.com/cancel', { signal: controller.signal })

    controller.abort()

    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
    expect(repository.save).not.toHaveBeenCalled()
  })
})
