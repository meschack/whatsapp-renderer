export const EDITED_MARKER = '<This message was edited>'

const EDITED_MARKER_REGEX = /\s*<This message was edited>\s*/g

export function stripEditedMarker(text: string): {
  cleanText: string | null
  isEdited: boolean
} {
  const isEdited = text.includes(EDITED_MARKER)

  if (!isEdited) {
    return { cleanText: text, isEdited: false }
  }

  const cleanText = text
    .replace(EDITED_MARKER_REGEX, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return {
    cleanText: cleanText.length > 0 ? cleanText : null,
    isEdited: true
  }
}
