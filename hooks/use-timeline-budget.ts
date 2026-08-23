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
  const [maxMemoryBytes, setMaxMemoryBytes] = useState<number | null>(null)

  useEffect(() => {
    if (Platform.OS !== 'android') return

    let active = true
    void Device.getMaxMemoryAsync().then(
      value => {
        if (active) setMaxMemoryBytes(value)
      },
      () => {
        // Total memory still provides a safe cross-platform budget signal.
      }
    )

    return () => {
      active = false
    }
  }, [])

  const profile = useMemo<TimelineDeviceProfile>(
    () => ({
      modelName: Device.modelName,
      osName: Device.osName,
      osVersion: Device.osVersion,
      totalMemoryBytes: Device.totalMemory,
      maxMemoryBytes
    }),
    [maxMemoryBytes]
  )

  const budget = useMemo(() => selectTimelineBudget(profile), [profile])

  return { budget, profile }
}
