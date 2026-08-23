import * as Haptics from 'expo-haptics'

import { isHapticFeedbackEnabled } from '@/store/preference-database'
import { shouldPerformHapticFeedback, type HapticFeedbackEvent } from '@/utils/accessibility'

export function performHapticFeedback(event: HapticFeedbackEvent): void {
  if (!shouldPerformHapticFeedback(isHapticFeedbackEnabled(), event)) return

  const feedback =
    event === 'selection'
      ? Haptics.selectionAsync()
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  void feedback.catch(() => undefined)
}
