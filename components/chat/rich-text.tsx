import { Text } from '@/src/tw'
import { memo, useCallback, useMemo, type ReactNode } from 'react'
import { Linking } from 'react-native'
import { extractFirstUrl, URL_REGEX } from '@/utils/message-links'

interface RichTextProps {
  text: string
  isMine: boolean
  trailing?: ReactNode
}

export const RichText = memo(function RichText({ text, isMine, trailing }: RichTextProps) {
  const handleLinkPress = useCallback((url: string) => {
    Linking.openURL(url)
  }, [])

  const parts = useMemo(() => parseTextWithLinks(text), [text])

  return (
    <Text className='text-wa-text-primary shrink text-[15px] leading-5'>
      {parts.map((part, i) =>
        part.type === 'text' ? (
          (part.value as ReactNode)
        ) : (
          <Text
            key={i}
            className='text-[15px] leading-5 text-[#25d366] underline'
            onPress={() => handleLinkPress(part.value)}
          >
            {part.value}
          </Text>
        )
      )}
      {trailing}
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

export { extractFirstUrl }
