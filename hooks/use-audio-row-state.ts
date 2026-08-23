import { useCallback, useSyncExternalStore } from 'react'
import { audioPlaybackStore } from '@/store/audio-playback-store'

export function useAudioRowState(uri: string) {
  const subscribe = useCallback(
    (listener: () => void) => audioPlaybackStore.subscribe(uri, listener),
    [uri]
  )
  const getSnapshot = useCallback(() => audioPlaybackStore.getSnapshot(uri), [uri])

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
