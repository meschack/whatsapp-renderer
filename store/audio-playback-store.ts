export interface AudioRowSnapshot {
  isActive: boolean
  isPlaying: boolean
  progress: number
  currentTime: number
  duration: number
  hasPlayed: boolean
  playbackRate: number
  waveform: number[] | null
}

type ActiveStatus = Pick<
  AudioRowSnapshot,
  'isPlaying' | 'progress' | 'currentTime' | 'duration' | 'hasPlayed'
>

const DEFAULT_SNAPSHOT: AudioRowSnapshot = {
  isActive: false,
  isPlaying: false,
  progress: 0,
  currentTime: 0,
  duration: 0,
  hasPlayed: false,
  playbackRate: 1,
  waveform: null
}

const MAX_CACHED_ROWS = 200

export class AudioPlaybackStore {
  private activeUri: string | null = null
  private snapshots = new Map<string, AudioRowSnapshot>()
  private listeners = new Map<string, Set<() => void>>()

  getSnapshot(uri: string): AudioRowSnapshot {
    return this.snapshots.get(uri) ?? DEFAULT_SNAPSHOT
  }

  subscribe(uri: string, listener: () => void): () => void {
    const listeners = this.listeners.get(uri) ?? new Set()
    listeners.add(listener)
    this.listeners.set(uri, listeners)

    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) this.listeners.delete(uri)
    }
  }

  setActiveUri(uri: string | null): void {
    if (uri === this.activeUri) return
    const previousUri = this.activeUri
    this.activeUri = uri

    if (previousUri) {
      this.updateRow(previousUri, {
        isActive: false,
        isPlaying: false,
        progress: 0,
        currentTime: 0,
        hasPlayed: false,
        playbackRate: 1
      })
    }

    if (uri) {
      this.updateRow(uri, {
        isActive: true,
        isPlaying: false,
        progress: 0,
        currentTime: 0,
        hasPlayed: false,
        playbackRate: 1
      })
    }
  }

  updateActiveStatus(status: ActiveStatus): void {
    if (!this.activeUri) return
    this.updateRow(this.activeUri, status)
  }

  setDuration(uri: string, duration: number): void {
    if (duration <= 0 || this.getSnapshot(uri).duration === duration) return
    this.updateRow(uri, { duration })
  }

  setWaveform(uri: string, waveform: number[]): void {
    this.updateRow(uri, { waveform })
  }

  setPlaybackRate(rate: number): void {
    if (!this.activeUri) return
    this.updateRow(this.activeUri, { playbackRate: rate })
  }

  private updateRow(uri: string, changes: Partial<AudioRowSnapshot>): void {
    const current = this.snapshots.get(uri) ?? DEFAULT_SNAPSHOT
    const next = { ...current, ...changes }
    this.snapshots.delete(uri)
    this.snapshots.set(uri, next)
    this.trimCache()

    for (const listener of this.listeners.get(uri) ?? []) listener()
  }

  private trimCache(): void {
    if (this.snapshots.size <= MAX_CACHED_ROWS) return

    for (const uri of this.snapshots.keys()) {
      if (uri === this.activeUri || this.listeners.has(uri)) continue
      this.snapshots.delete(uri)
      if (this.snapshots.size <= MAX_CACHED_ROWS) return
    }
  }
}

export const audioPlaybackStore = new AudioPlaybackStore()
