import { View, Text, Pressable } from '@/src/tw'
import { Image } from 'expo-image'
import { Linking } from 'react-native'
import { useEffect, useState, useCallback } from 'react'

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

export function LinkPreview({ url, isMine }: LinkPreviewProps) {
  const [ogData, setOgData] = useState<OgData | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false

    const fetchOg = async () => {
      try {
        const response = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WhatsAppRenderer/1.0)' }
        })
        const html = await response.text()
        // Only parse the first 10KB to avoid memory issues
        const head = html.slice(0, 10000)

        const title = extractMeta(head, 'og:title') ?? extractMeta(head, 'twitter:title')
        const description =
          extractMeta(head, 'og:description') ?? extractMeta(head, 'twitter:description')
        const image = extractMeta(head, 'og:image') ?? extractMeta(head, 'twitter:image')
        const siteName = extractMeta(head, 'og:site_name')

        if (cancelled) return

        if (title || image) {
          setOgData({ title, description, image, siteName })
        } else {
          setFailed(true)
        }
      } catch {
        if (!cancelled) setFailed(true)
      }
    }

    fetchOg()
    return () => {
      cancelled = true
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
}

function extractMeta(html: string, property: string): string | null {
  // Match both property="..." and name="..." patterns
  const regex = new RegExp(
    `<meta[^>]*(?:property|name)=["']${escapeRegex(property)}["'][^>]*content=["']([^"']*)["']`,
    'i'
  )
  const match = html.match(regex)
  if (match) return decodeHtmlEntities(match[1])

  // Also match reversed order: content before property
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
