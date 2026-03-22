import { Text } from '@/src/tw'
import { Linking } from 'react-native'
import { memo, useCallback, useMemo, type ReactNode } from 'react'

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g

interface RichTextProps {
  text: string
  isMine: boolean
}

export const RichText = memo(function RichText({ text, isMine }: RichTextProps) {
  const handleLinkPress = useCallback((url: string) => {
    Linking.openURL(url)
  }, [])

  const parts = useMemo(() => parseTextWithLinks(text), [text])

  return (
    <Text className='text-wa-text-primary text-[14.5px] leading-5 flex-shrink'>
      {parts.map((part, i) =>
        part.type === 'text' ? (
          part.value as ReactNode
        ) : (
          <Text
            key={i}
            className='text-[#53BDEB] text-[14.5px] leading-5 underline'
            onPress={() => handleLinkPress(part.value)}
          >
            {part.value}
          </Text>
        )
      )}
    </Text>
  )
})

interface TextPart {
  type: 'text' | 'link'
  value: string
}

function parseTextWithLinks(text: string): TextPart[] {
  const parts: TextPart[] = []
  let lastIndex = 0

  for (const match of text.matchAll(URL_REGEX)) {
    const matchIndex = match.index
    if (matchIndex > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, matchIndex) })
    }
    parts.push({ type: 'link', value: match[0] })
    lastIndex = matchIndex + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) })
  }

  return parts
}

export function extractFirstUrl(text: string): string | null {
  const match = text.match(URL_REGEX)
  return match ? match[0] : null
}
