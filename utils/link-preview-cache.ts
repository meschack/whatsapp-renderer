export interface LinkPreviewData {
  title: string | null
  description: string | null
  image: string | null
  siteName: string | null
}

export interface StoredLinkPreview {
  data: LinkPreviewData | null
  expiresAt: number
}

export interface CachedLinkPreview {
  isCached: boolean
  data: LinkPreviewData | null
}

export interface LinkPreviewRepository {
  get(url: string, now: number): Promise<StoredLinkPreview | null>
  save(url: string, data: LinkPreviewData | null, expiresAt: number, now: number): Promise<void>
}

interface LinkPreviewLoaderOptions {
  repository: LinkPreviewRepository
  fetcher?: typeof fetch
  now?: () => number
  timeoutMs?: number
  maxResponseBytes?: number
  maxConcurrentRequests?: number
}

const MAX_MEMORY_ENTRIES = 200
const SUCCESS_TTL_MS = 7 * 24 * 60 * 60 * 1_000
const FAILURE_TTL_MS = 24 * 60 * 60 * 1_000
const DEFAULT_TIMEOUT_MS = 6_000
const DEFAULT_MAX_RESPONSE_BYTES = 64 * 1_024
const DEFAULT_MAX_CONCURRENT_REQUESTS = 2

export function createLinkPreviewLoader(options: LinkPreviewLoaderOptions) {
  const repository = options.repository
  const fetcher = options.fetcher ?? fetch
  const now = options.now ?? Date.now
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES
  const queue = new RequestQueue(options.maxConcurrentRequests ?? DEFAULT_MAX_CONCURRENT_REQUESTS)
  const memory = new Map<string, StoredLinkPreview>()

  const remember = (url: string, entry: StoredLinkPreview) => {
    memory.delete(url)
    memory.set(url, entry)
    if (memory.size > MAX_MEMORY_ENTRIES) {
      const oldest = memory.keys().next().value
      if (oldest) memory.delete(oldest)
    }
  }

  const peek = (url: string): CachedLinkPreview => {
    const entry = memory.get(url)
    if (!entry) return { isCached: false, data: null }
    if (entry.expiresAt <= now()) {
      memory.delete(url)
      return { isCached: false, data: null }
    }
    return { isCached: true, data: entry.data }
  }

  const read = async (url: string): Promise<CachedLinkPreview> => {
    const cached = peek(url)
    if (cached.isCached) return cached
    const stored = await repository.get(url, now())
    if (!stored) return { isCached: false, data: null }
    remember(url, stored)
    return { isCached: true, data: stored.data }
  }

  const load = async (
    url: string,
    request: { signal?: AbortSignal; force?: boolean } = {}
  ): Promise<LinkPreviewData | null> => {
    if (!request.force) {
      const cached = await read(url)
      if (cached.isCached) return cached.data
    }
    throwIfAborted(request.signal)

    let data: LinkPreviewData | null
    try {
      data = await queue.run(
        () => fetchPreview(url, fetcher, timeoutMs, maxResponseBytes, request.signal),
        request.signal
      )
    } catch (error) {
      if (request.signal?.aborted && isAbortError(error)) throw error
      data = null
    }

    throwIfAborted(request.signal)
    const timestamp = now()
    const entry = {
      data,
      expiresAt: timestamp + (data ? SUCCESS_TTL_MS : FAILURE_TTL_MS)
    }
    remember(url, entry)
    await repository.save(url, data, entry.expiresAt, timestamp)
    return data
  }

  return { peek, read, load }
}

class RequestQueue {
  private active = 0
  private readonly pending: (() => void)[] = []

  constructor(private readonly limit: number) {
    if (!Number.isInteger(limit) || limit < 1) throw new Error('Concurrency must be positive.')
  }

  run<T>(work: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let started = false
      const abort = () => {
        if (started) return
        const index = this.pending.indexOf(start)
        if (index >= 0) this.pending.splice(index, 1)
        reject(createAbortError())
      }
      const start = () => {
        if (signal?.aborted) {
          abort()
          return
        }
        started = true
        signal?.removeEventListener('abort', abort)
        this.active++
        void work()
          .then(resolve, reject)
          .finally(() => {
            this.active--
            this.pending.shift()?.()
          })
      }

      signal?.addEventListener('abort', abort, { once: true })
      if (this.active < this.limit) start()
      else this.pending.push(start)
    })
  }
}

async function fetchPreview(
  initialUrl: string,
  fetcher: typeof fetch,
  timeoutMs: number,
  maxResponseBytes: number,
  externalSignal?: AbortSignal
): Promise<LinkPreviewData | null> {
  let url = validatePreviewUrl(initialUrl)
  const controller = new AbortController()
  const abort = () => controller.abort()
  externalSignal?.addEventListener('abort', abort, { once: true })
  const timeout = setTimeout(abort, timeoutMs)

  try {
    for (let redirects = 0; redirects <= 3; redirects++) {
      const response = await fetcher(url, {
        headers: { 'User-Agent': 'WhatsAppRenderer/1.0' },
        redirect: 'manual',
        signal: controller.signal
      })
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        if (!location || redirects === 3) return null
        url = validatePreviewUrl(new URL(location, url).toString())
        continue
      }
      if (!response.ok) return null
      const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
      if (contentType && !contentType.includes('text/html')) return null
      const contentLength = Number(response.headers.get('content-length'))
      if (Number.isFinite(contentLength) && contentLength > maxResponseBytes) return null
      const html = await readBoundedText(response, maxResponseBytes, controller.signal)
      return extractOpenGraphData(html, url)
    }
    return null
  } finally {
    clearTimeout(timeout)
    externalSignal?.removeEventListener('abort', abort)
  }
}

async function readBoundedText(
  response: Response,
  maxBytes: number,
  signal: AbortSignal
): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) {
    throwIfAborted(signal)
    const text = await response.text()
    throwIfAborted(signal)
    return text.length <= maxBytes ? text : text.slice(0, maxBytes)
  }
  const decoder = new TextDecoder()
  let html = ''
  let bytesRead = 0
  try {
    while (bytesRead < maxBytes) {
      throwIfAborted(signal)
      const { done, value } = await reader.read()
      if (done) break
      const remaining = maxBytes - bytesRead
      const chunk = value.byteLength > remaining ? value.slice(0, remaining) : value
      bytesRead += chunk.byteLength
      html += decoder.decode(chunk, { stream: true })
      if (html.toLowerCase().includes('</head>')) break
    }
    return html + decoder.decode()
  } finally {
    void reader.cancel()
  }
}

export function validatePreviewUrl(value: string): string {
  const url = new URL(value)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only HTTP links can be previewed.')
  }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (isPrivateHostname(hostname)) throw new Error('Private network links cannot be previewed.')
  return url.toString()
}

function isPrivateHostname(hostname: string): boolean {
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    return true
  }
  if (hostname === '::1' || hostname.startsWith('fc') || hostname.startsWith('fd')) return true
  if (
    hostname.startsWith('fe8') ||
    hostname.startsWith('fe9') ||
    hostname.startsWith('fea') ||
    hostname.startsWith('feb')
  )
    return true

  const parts = hostname.split('.').map(Number)
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false
  }
  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    parts[0] === 0
  )
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw createAbortError()
}

function createAbortError(): Error {
  const error = new Error('Link preview request cancelled')
  error.name = 'AbortError'
  return error
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
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
      image = validatePreviewUrl(new URL(rawImage, pageUrl).toString())
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
  const reversed = new RegExp(
    `<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${escapeRegex(property)}["']`,
    'i'
  )
  const reversedMatch = html.match(reversed)
  return reversedMatch ? decodeHtmlEntities(reversedMatch[1]) : null
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
