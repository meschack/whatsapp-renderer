export const EDITED_MARKER = '<This message was edited>'

const EDITED_MARKERS = [EDITED_MARKER, '<Ce message a été modifié>']
const EDITED_MARKER_REGEX = /\s*<(?:This message was edited|Ce message a été modifié)>\s*/gi

export function stripEditedMarker(text: string): {
  cleanText: string | null
  isEdited: boolean
} {
  const isEdited = EDITED_MARKERS.some(marker => text.includes(marker))

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
