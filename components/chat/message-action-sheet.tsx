import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Modal, Share } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import type { Message } from '@/models/types'
import { Pressable, Text, View } from '@/src/tw'
import { isMessageBookmarked, setMessageBookmarked } from '@/store/message-database'
import { buildMessageInfoRows, getMessageActionAvailability } from '@/utils/message-actions'

export interface MessageActionSelection {
  message: Message
  sequence: number
}

interface MessageActionSheetProps {
  chatId: string
  selection: MessageActionSelection | null
  onClose(): void
}

export function MessageActionSheet({ chatId, selection, onClose }: MessageActionSheetProps) {
  const insets = useSafeAreaInsets()
  const [showInformation, setShowInformation] = useState(false)
  const [bookmarked, setBookmarked] = useState<boolean | null>(null)
  const [isUpdatingBookmark, setIsUpdatingBookmark] = useState(false)
  const generationRef = useRef(0)
  const message = selection?.message ?? null
  const availability = useMemo(
    () => (message ? getMessageActionAvailability(message) : null),
    [message]
  )

  useEffect(() => {
    const generation = ++generationRef.current
    setShowInformation(false)
    setIsUpdatingBookmark(false)

    if (!selection || !availability?.bookmark) {
      setBookmarked(null)
      return
    }

    setBookmarked(null)
    void isMessageBookmarked(selection.sequence).then(
      value => {
        if (generationRef.current === generation) setBookmarked(value)
      },
      error => {
        console.error('Failed to load bookmark state', error)
        if (generationRef.current === generation) setBookmarked(false)
      }
    )
  }, [availability?.bookmark, selection])

  if (!selection || !message || !availability) return null

  const toggleBookmark = async () => {
    if (bookmarked === null || isUpdatingBookmark) return
    const next = !bookmarked
    setIsUpdatingBookmark(true)
    try {
      await setMessageBookmarked(chatId, selection.sequence, next)
      setBookmarked(next)
    } catch (error) {
      console.error('Failed to update bookmark', error)
    } finally {
      setIsUpdatingBookmark(false)
    }
  }

  const rows = showInformation ? buildMessageInfoRows(message) : []

  return (
    <Modal visible transparent animationType='slide' statusBarTranslucent onRequestClose={onClose}>
      <Pressable className='flex-1 justify-end bg-black/55' onPress={onClose}>
        <Pressable
          className='rounded-t-[24px] bg-[#202C33] px-4 pt-3'
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          onPress={event => event.stopPropagation()}
        >
          <View className='mb-3 h-1 w-10 self-center rounded-full bg-[#667781]' />

          {showInformation ? (
            <>
              <View className='mb-2 flex-row items-center'>
                <Pressable
                  accessibilityLabel='Back to message actions'
                  className='size-10 items-center justify-center rounded-full active:bg-white/10'
                  onPress={() => setShowInformation(false)}
                >
                  <Ionicons name='arrow-back' size={22} color='#E9EDEF' />
                </Pressable>
                <Text className='ml-1 text-[17px] font-medium text-[#E9EDEF]'>Message info</Text>
              </View>
              <View className='overflow-hidden rounded-xl bg-[#111B21]'>
                {rows.map(row => (
                  <View
                    key={row.label}
                    className='flex-row border-b border-white/5 px-4 py-3 last:border-b-0'
                  >
                    <Text className='w-24 text-[12px] text-[#8696A0]'>{row.label}</Text>
                    <Text className='flex-1 text-[13px] text-[#E9EDEF]' selectable>
                      {row.value}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <>
              <Text className='mb-2 px-2 text-[12px] text-[#8696A0]' numberOfLines={2}>
                {message.text ?? message.mediaFilename ?? 'Message'}
              </Text>
              {availability.copy && message.text && (
                <ActionRow
                  icon='copy-outline'
                  label='Copy text'
                  onPress={() => {
                    void Clipboard.setStringAsync(message.text!).then(
                      () => onClose(),
                      error => console.error('Failed to copy message text', error)
                    )
                  }}
                />
              )}
              {availability.share && message.text && (
                <ActionRow
                  icon='share-social-outline'
                  label='Share text'
                  onPress={() => {
                    onClose()
                    void Share.share({ message: message.text! }).catch(error => {
                      console.error('Failed to share message text', error)
                    })
                  }}
                />
              )}
              {availability.bookmark && (
                <ActionRow
                  icon={bookmarked ? 'bookmark' : 'bookmark-outline'}
                  label={bookmarked ? 'Remove bookmark' : 'Bookmark'}
                  disabled={bookmarked === null || isUpdatingBookmark}
                  trailing={
                    bookmarked === null || isUpdatingBookmark ? (
                      <ActivityIndicator size='small' color='#00A884' />
                    ) : undefined
                  }
                  onPress={() => void toggleBookmark()}
                />
              )}
              <ActionRow
                icon='information-circle-outline'
                label='Message info'
                onPress={() => setShowInformation(true)}
              />
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function ActionRow({
  icon,
  label,
  disabled = false,
  trailing,
  onPress
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  disabled?: boolean
  trailing?: React.ReactNode
  onPress(): void
}) {
  return (
    <Pressable
      accessibilityRole='button'
      disabled={disabled}
      className='flex-row items-center rounded-xl px-2 py-3 active:bg-white/5 disabled:opacity-60'
      onPress={onPress}
    >
      <View className='size-10 items-center justify-center rounded-full bg-[#00A884]/12'>
        <Ionicons name={icon} size={21} color='#00C896' />
      </View>
      <Text className='ml-3 flex-1 text-[15px] text-[#E9EDEF]'>{label}</Text>
      {trailing}
    </Pressable>
  )
}
