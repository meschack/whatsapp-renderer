import * as Device from 'expo-device'
import { useEffect, useMemo, useState } from 'react'
import { Platform } from 'react-native'

import { selectTimelineBudget, type TimelineMemoryCapacity } from '@/utils/timeline-budget'

export interface TimelineDeviceProfile extends TimelineMemoryCapacity {
  modelName: string | null
  osName: string | null
  osVersion: string | null
}

export function useTimelineBudget() {
  const [maxMemoryBytes, setMaxMemoryBytes] = useState<number | null | undefined>(
    Platform.OS === 'android' ? undefined : null
  )

  useEffect(() => {
    if (Platform.OS !== 'android') return

    let active = true
    let settled = false
    const finish = (value: number | null) => {
      if (!active || settled) return
      settled = true
      setMaxMemoryBytes(value)
    }
    const fallback = setTimeout(() => finish(null), 2000)
    void Device.getMaxMemoryAsync().then(
      value => {
        finish(value)
      },
      () => {
        finish(null)
      }
    )

    return () => {
      active = false
      clearTimeout(fallback)
    }
  }, [])

  const profile = useMemo<TimelineDeviceProfile>(
    () => ({
      modelName: Device.modelName,
      osName: Device.osName,
      osVersion: Device.osVersion,
      totalMemoryBytes: Device.totalMemory,
      maxMemoryBytes: maxMemoryBytes ?? null
    }),
    [maxMemoryBytes]
  )

  const budget = useMemo(() => selectTimelineBudget(profile), [profile])

  return { budget, profile, isReady: maxMemoryBytes !== undefined }
}
