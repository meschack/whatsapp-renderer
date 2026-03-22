import { View, Text, Pressable } from '@/src/tw'
import { Image } from 'expo-image'
import { Linking } from 'react-native'
import { memo, useEffect, useState, useCallback, useRef } from 'react'

interface OgData {
  title: string | null
  description: string | null
  image: string | null
  siteName: string | null
}

interface LinkPreviewProps {
  url: string
  isMine: boolean
}

// Global cache so we never re-fetch the same URL
const ogCache = new Map<string, OgData | null>()

export const LinkPreview = memo(function LinkPreview({ url, isMine }: LinkPreviewProps) {
  const [ogData, setOgData] = useState<OgData | null>(() => ogCache.get(url) ?? null)
  const [failed, setFailed] = useState(() => ogCache.has(url) && ogCache.get(url) === null)
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    // Already cached (hit or miss)
    if (ogCache.has(url)) {
      const cached = ogCache.get(url)
      if (cached) setOgData(cached)
      else setFailed(true)
      return
    }

    const controller = new AbortController()
    controllerRef.current = controller

    const fetchOg = async () => {
      try {
        const response = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WhatsAppRenderer/1.0)' },
          signal: controller.signal
        })

        // Read only first 10KB using the reader to avoid downloading huge pages
        const reader = response.body?.getReader()
        if (!reader) {
          ogCache.set(url, null)
          setFailed(true)
          return
        }

        const decoder = new TextDecoder()
        let head = ''
        const MAX_BYTES = 10000

        while (head.length < MAX_BYTES) {
          const { done, value } = await reader.read()
          if (done) break
          head += decoder.decode(value, { stream: true })
          // Stop early if we've passed </head>
          if (head.includes('</head>')) break
        }

        reader.cancel()

        if (controller.signal.aborted) return

        const title = extractMeta(head, 'og:title') ?? extractMeta(head, 'twitter:title')
        const description =
          extractMeta(head, 'og:description') ?? extractMeta(head, 'twitter:description')
        const image = extractMeta(head, 'og:image') ?? extractMeta(head, 'twitter:image')
        const siteName = extractMeta(head, 'og:site_name')

        if (title || image) {
          const data: OgData = { title, description, image, siteName }
          ogCache.set(url, data)
          setOgData(data)
        } else {
          ogCache.set(url, null)
          setFailed(true)
        }
      } catch {
        if (!controller.signal.aborted) {
          ogCache.set(url, null)
          setFailed(true)
        }
      }
    }

    fetchOg()
    return () => {
      controller.abort()
    }
  }, [url])

  const handlePress = useCallback(() => {
    Linking.openURL(url)
  }, [url])

  if (failed || !ogData) return null

  const domain = getDomain(url)

  return (
    <Pressable onPress={handlePress} className='mt-1 mb-1 overflow-hidden rounded-lg'>
      {ogData.image && (
        <Image
          source={{ uri: ogData.image }}
          style={{ width: '100%', height: 150 }}
          contentFit='cover'
          recyclingKey={url}
        />
      )}
      <View
        className={`px-3 py-2 ${isMine ? 'bg-wa-bubble-mine/80' : 'bg-wa-bubble-other/80'}`}
      >
        {ogData.siteName && (
          <Text className='text-wa-text-secondary text-[11px] uppercase mb-0.5'>
            {ogData.siteName}
          </Text>
        )}
        {ogData.title && (
          <Text className='text-wa-text-primary text-[13px] font-medium' numberOfLines={2}>
            {ogData.title}
          </Text>
        )}
        {ogData.description && (
          <Text className='text-wa-text-secondary text-[12px] mt-0.5' numberOfLines={2}>
            {ogData.description}
          </Text>
        )}
        <Text className='text-wa-text-secondary text-[11px] mt-1'>{domain}</Text>
      </View>
    </Pressable>
  )
})

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
  if (matchReversed) return decodeHtmlEntities(matchReversed[1])

  return null
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return url
  }
}
