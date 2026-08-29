import { Directory, File, Paths } from 'expo-file-system'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'

import { getCustomWallpaperResize } from './chat-appearance'

interface PickedWallpaperImage {
  uri: string
  width: number
  height: number
}

const WALLPAPER_DIRECTORY = 'chat-wallpapers'

export async function persistCustomChatWallpaper(
  chatId: string,
  image: PickedWallpaperImage
): Promise<string> {
  const context = ImageManipulator.manipulate(image.uri)
  const resize = getCustomWallpaperResize(image.width, image.height)
  if (resize) context.resize(resize)

  const rendered = await context.renderAsync()
  const optimized = await rendered.saveAsync({
    compress: 0.86,
    format: SaveFormat.JPEG
  })

  const directory = new Directory(Paths.document, WALLPAPER_DIRECTORY)
  directory.create({ idempotent: true, intermediates: true })
  const safeChatId = chatId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 72) || 'chat'
  const destination = new File(directory, `${safeChatId}-${Date.now()}.jpg`)
  new File(optimized.uri).copy(destination)
  return destination.uri
}

export function deleteCustomChatWallpaper(uri: string | null | undefined): void {
  if (!uri || !uri.includes(`/${WALLPAPER_DIRECTORY}/`)) return
  try {
    const file = new File(uri)
    if (file.exists) file.delete()
  } catch (error) {
    console.warn('Failed to remove custom chat wallpaper', error)
  }
}
