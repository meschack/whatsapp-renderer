import { Pressable, Text, View } from '@/src/tw'
import {
  getCachedLinkPreview,
  getPersistedLinkPreview,
  loadLinkPreview,
  type LinkPreviewData
} from '@/utils/link-preview-service'
import { Ionicons } from '@expo/vector-icons'
import { useRecyclingState } from '@shopify/flash-list'
import { Image } from 'expo-image'
import { memo, useCallback, useEffect, useRef } from 'react'
import { ActivityIndicator, Linking } from 'react-native'
import { useChatAppearance } from './chat-appearance-context'

interface LinkPreviewProps {
  url: string
  isMine: boolean
}

export const LinkPreview = memo(function LinkPreview({ url, isMine }: LinkPreviewProps) {
  const { textScale } = useChatAppearance()
  const cached = getCachedLinkPreview(url)
  const [preview, setPreview] = useRecyclingState<LinkPreviewData | null>(cached.data, [url])
  const [status, setStatus] = useRecyclingState<
    'checking' | 'idle' | 'loading' | 'loaded' | 'failed'
  >(cached.isCached ? (cached.data ? 'loaded' : 'failed') : 'checking', [url])
  const requestRef = useRef<AbortController | null>(null)

  useEffect(() => {
    let active = true
    requestRef.current?.abort()
    requestRef.current = null

    void getPersistedLinkPreview(url).then(
      result => {
        if (!active) return
        setPreview(result.data, true)
        setStatus(result.isCached ? (result.data ? 'loaded' : 'failed') : 'idle', true)
      },
      error => {
        if (!active) return
        console.error('Failed to read saved link preview', error)
        setPreview(null, true)
        setStatus('idle', true)
      }
    )

    return () => {
      active = false
      requestRef.current?.abort()
      requestRef.current = null
    }
  }, [setPreview, setStatus, url])

  const handlePress = useCallback(async () => {
    if (status === 'loaded') {
      void Linking.openURL(url)
      return
    }
    if (status === 'checking' || status === 'loading') return

    const controller = new AbortController()
    requestRef.current?.abort()
    requestRef.current = controller
    setStatus('loading', true)
    try {
      const result = await loadLinkPreview(url, {
        signal: controller.signal,
        force: status === 'failed'
      })
      if (controller.signal.aborted || requestRef.current !== controller) return
      setPreview(result, true)
      setStatus(result ? 'loaded' : 'failed', true)
    } catch (error) {
      if (controller.signal.aborted) return
      console.error('Failed to load link preview', error)
      setStatus('failed', true)
    } finally {
      if (requestRef.current === controller) requestRef.current = null
    }
  }, [setPreview, setStatus, status, url])

  const domain = getDomain(url)

  return (
    <Pressable
      accessibilityLabel={status === 'loaded' ? `Open ${domain}` : `Load preview from ${domain}`}
      accessibilityRole={status === 'loaded' ? 'link' : 'button'}
      onPress={() => void handlePress()}
      className={`mt-1 mb-1 h-22 flex-row overflow-hidden rounded-lg ${
        isMine ? 'bg-wa-bubble-mine/80' : 'bg-wa-bubble-other/80'
      }`}
    >
      <View className='min-w-0 flex-1 justify-center px-3 py-2'>
        <Text
          className='text-wa-text-secondary'
          numberOfLines={1}
          style={{ fontSize: 11 * textScale }}
        >
          {preview?.siteName ?? domain}
        </Text>
        <Text
          className='text-wa-text-primary mt-0.5 font-medium'
          numberOfLines={2}
          style={{ fontSize: 13 * textScale }}
        >
          {preview?.title ?? getStatusLabel(status, domain)}
        </Text>
        {preview?.description && (
          <Text
            className='text-wa-text-secondary mt-0.5'
            numberOfLines={1}
            style={{ fontSize: 11 * textScale }}
          >
            {preview.description}
          </Text>
        )}
      </View>

      {status === 'loaded' && preview?.image ? (
        <Image
          source={{ uri: preview.image }}
          recyclingKey={`${url}-${preview.image}`}
          style={{ width: 88, height: 88 }}
          contentFit='cover'
        />
      ) : (
        <View className='h-22 w-22 items-center justify-center bg-black/10'>
          {status === 'checking' || status === 'loading' ? (
            <ActivityIndicator size='small' color='#00A884' />
          ) : (
            <Ionicons
              name={status === 'idle' ? 'shield-checkmark-outline' : 'link'}
              size={22}
              color={status === 'idle' ? '#00A884' : '#8696A0'}
            />
          )}
        </View>
      )}
    </Pressable>
  )
})

function getStatusLabel(
  status: 'checking' | 'idle' | 'loading' | 'loaded' | 'failed',
  domain: string
): string {
  switch (status) {
    case 'checking':
      return 'Checking saved preview…'
    case 'idle':
      return 'Tap to load preview privately'
    case 'loading':
      return 'Loading preview…'
    case 'failed':
      return 'Preview unavailable · tap to retry'
    default:
      return domain
  }
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
