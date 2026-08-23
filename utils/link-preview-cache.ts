export interface LinkPreviewData {
  title: string | null
  description: string | null
  image: string | null
  siteName: string | null
}

export interface CachedLinkPreview {
  isCached: boolean
  data: LinkPreviewData | null
}

const MAX_CACHE_ENTRIES = 200
const MAX_CONCURRENT_REQUESTS = 2
const MAX_RESPONSE_BYTES = 10_000

const cache = new Map<string, LinkPreviewData | null>()
const inFlight = new Map<string, Promise<LinkPreviewData | null>>()
const requestQueue: (() => void)[] = []
let activeRequests = 0

export function getCachedLinkPreview(url: string): CachedLinkPreview {
  return { isCached: cache.has(url), data: cache.get(url) ?? null }
}

export function loadLinkPreview(url: string): Promise<LinkPreviewData | null> {
  if (cache.has(url)) return Promise.resolve(cache.get(url) ?? null)

  const existing = inFlight.get(url)
  if (existing) return existing

  const request = runQueued(() => fetchPreview(url))
    .then(result => {
      cacheResult(url, result)
      return result
    })
    .catch(() => {
      cacheResult(url, null)
      return null
    })
    .finally(() => inFlight.delete(url))

  inFlight.set(url, request)
  return request
}

function cacheResult(url: string, value: LinkPreviewData | null) {
  cache.delete(url)
  cache.set(url, value)

  const oldest = cache.keys().next().value
  if (cache.size > MAX_CACHE_ENTRIES && oldest) cache.delete(oldest)
}

function runQueued<T>(work: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      activeRequests++
      void work()
        .then(resolve, reject)
        .finally(() => {
          activeRequests--
          requestQueue.shift()?.()
        })
    }

    if (activeRequests < MAX_CONCURRENT_REQUESTS) run()
    else requestQueue.push(run)
  })
}

async function fetchPreview(url: string): Promise<LinkPreviewData | null> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WhatsAppRenderer/1.0)' }
  })
  if (!response.ok) return null

  const reader = response.body?.getReader()
  if (!reader) return null

  const decoder = new TextDecoder()
  let head = ''
  let bytesRead = 0

  while (bytesRead < MAX_RESPONSE_BYTES) {
    const { done, value } = await reader.read()
    if (done) break
    bytesRead += value.byteLength
    head += decoder.decode(value, { stream: true })
    if (head.includes('</head>')) break
  }

  void reader.cancel()
  return extractOpenGraphData(head, url)
}

export function extractOpenGraphData(html: string, pageUrl: string): LinkPreviewData | null {
  const title = extractMeta(html, 'og:title') ?? extractMeta(html, 'twitter:title')
  const description =
    extractMeta(html, 'og:description') ?? extractMeta(html, 'twitter:description')
  const rawImage = extractMeta(html, 'og:image') ?? extractMeta(html, 'twitter:image')
  const siteName = extractMeta(html, 'og:site_name')

  if (!title && !rawImage) return null

  let image: string | null = rawImage
  if (rawImage) {
    try {
      image = new URL(rawImage, pageUrl).toString()
    } catch {
      image = null
    }
  }

  return { title, description, image, siteName }
}

function extractMeta(html: string, property: string): string | null {
  const regex = new RegExp(
    `<meta[^>]*(?:property|name)=["']${escapeRegex(property)}["'][^>]*content=["']([^"']*)["']`,
    'i'
  )
  const match = html.match(regex)
  if (match) return decodeHtmlEntities(match[1])

  const regexReversed = new RegExp(
    `<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${escapeRegex(property)}["']`,
    'i'
  )
  const matchReversed = html.match(regexReversed)
  return matchReversed ? decodeHtmlEntities(matchReversed[1]) : null
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
}
