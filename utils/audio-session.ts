import type { AudioMode } from 'expo-audio'

export const VOICE_PLAYBACK_AUDIO_MODE = {
  playsInSilentMode: true,
  interruptionMode: 'doNotMix',
  allowsRecording: false,
  shouldPlayInBackground: true,
  shouldRouteThroughEarpiece: false
} satisfies Partial<AudioMode>

export interface PendingAudioTransition {
  uri: string
  generation: number
  sawUnloaded: boolean
}

interface TransitionStatus {
  isLoaded: boolean
  playing: boolean
  currentTime: number
  duration: number
}

export function advancePendingAudioTransition(
  pending: PendingAudioTransition,
  status: TransitionStatus
): { pending: PendingAudioTransition | null; shouldPlay: boolean } {
  if (!status.isLoaded) {
    return {
      pending: pending.sawUnloaded ? pending : { ...pending, sawUnloaded: true },
      shouldPlay: false
    }
  }

  const isFreshSource = pending.sawUnloaded || status.currentTime <= 0.05
  const isReady = isFreshSource && !status.playing && status.duration > 0
  return isReady ? { pending: null, shouldPlay: true } : { pending, shouldPlay: false }
}

export function shouldRestorePlaybackRate(
  preferredRate: number,
  nativeRate: number,
  hasActiveSource: boolean
): boolean {
  return hasActiveSource && Math.abs(preferredRate - nativeRate) > 0.001
}
