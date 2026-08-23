import { Pressable, Text, View } from '@/src/tw'
import {
  getCachedLinkPreview,
  loadLinkPreview,
  type LinkPreviewData
} from '@/utils/link-preview-cache'
import { Ionicons } from '@expo/vector-icons'
import { useRecyclingState } from '@shopify/flash-list'
import { Image } from 'expo-image'
import { memo, useCallback, useEffect } from 'react'
import { InteractionManager, Linking } from 'react-native'

interface LinkPreviewProps {
  url: string
  isMine: boolean
}

export const LinkPreview = memo(function LinkPreview({ url, isMine }: LinkPreviewProps) {
  const cached = getCachedLinkPreview(url)
  const [preview, setPreview] = useRecyclingState<LinkPreviewData | null>(cached.data, [url])
  const [settled, setSettled] = useRecyclingState(cached.isCached, [url])

  useEffect(() => {
    if (getCachedLinkPreview(url).isCached) return

    let active = true
    const interaction = InteractionManager.runAfterInteractions(() => {
      void loadLinkPreview(url).then(result => {
        if (!active) return
        setPreview(result, true)
        setSettled(true, true)
      })
    })

    return () => {
      active = false
      interaction.cancel()
    }
  }, [setPreview, setSettled, url])

  const handlePress = useCallback(() => {
    void Linking.openURL(url)
  }, [url])

  const domain = getDomain(url)

  return (
    <Pressable
      onPress={handlePress}
      className={`mt-1 mb-1 h-22 flex-row overflow-hidden rounded-lg ${
        isMine ? 'bg-wa-bubble-mine/80' : 'bg-wa-bubble-other/80'
      }`}
    >
      <View className='min-w-0 flex-1 justify-center px-3 py-2'>
        <Text className='text-wa-text-secondary text-[11px]' numberOfLines={1}>
          {preview?.siteName ?? domain}
        </Text>
        <Text className='text-wa-text-primary mt-0.5 text-[13px] font-medium' numberOfLines={2}>
          {preview?.title ?? (settled ? domain : 'Loading preview…')}
        </Text>
        {preview?.description && (
          <Text className='text-wa-text-secondary mt-0.5 text-[11px]' numberOfLines={1}>
            {preview.description}
          </Text>
        )}
      </View>

      {preview?.image ? (
        <Image
          source={{ uri: preview.image }}
          recyclingKey={`${url}-${preview.image}`}
          style={{ width: 88, height: 88 }}
          contentFit='cover'
        />
      ) : (
        <View className='bg-black/10 h-22 w-22 items-center justify-center'>
          <Ionicons name='link' size={22} color='#8696A0' />
        </View>
      )}
    </Pressable>
  )
})

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
