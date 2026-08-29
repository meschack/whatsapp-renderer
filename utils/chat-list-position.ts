export const MAINTAIN_BOTTOM_POSITION = {
  startRenderingFromBottom: true
} as const

export const MAINTAIN_RESTORED_POSITION = {
  ...MAINTAIN_BOTTOM_POSITION,
  startRenderingFromBottom: false
} as const
