// WhatsApp Dark Mode color palette
export const DARK_COLORS = {
  // Backgrounds
  background: '#0B141A',
  chatBackground: '#0B141A',
  headerBackground: '#1F2C34',
  inputBackground: '#1F2C34',

  // Bubbles
  bubbleMine: '#005C4B',
  bubbleOther: '#1F2C34',
  bubbleSystem: 'transparent',

  // Text
  textPrimary: '#E9EDEF',
  textSecondary: '#8696A0',
  textSender: '#06CF9C',
  textTimestamp: '#8696A0',
  textTimestampMine: 'rgba(255, 255, 255, 0.6)',
  textSystem: '#8696A0',

  // Accents
  accent: '#00A884',
  onAccent: '#071A16',
  accentLight: '#06CF9C',
  iconColor: '#8696A0',
  divider: '#222D34',

  // Status
  checkmark: '#53BDEB',

  // Media
  audioWaveform: '#8696A0',
  audioWaveformActive: '#06CF9C',
  audioBackground: 'rgba(0, 0, 0, 0.15)',

  // Misc
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0, 0, 0, 0.5)',
  error: '#FF6B6B'
}

export type AppColors = { [K in keyof typeof DARK_COLORS]: string }
export const LIGHT_COLORS: AppColors = {
  ...DARK_COLORS,
  background: '#F7F9FA',
  chatBackground: '#F2EDE5',
  headerBackground: '#FFFFFF',
  inputBackground: '#EDF2F4',
  bubbleMine: '#D9FDD3',
  bubbleOther: '#FFFFFF',
  textPrimary: '#17252D',
  textSecondary: '#536772',
  textSender: '#087F63',
  textTimestamp: '#627680',
  textTimestampMine: '#52715A',
  textSystem: '#536772',
  accent: '#00856A',
  onAccent: '#FFFFFF',
  accentLight: '#087F63',
  iconColor: '#536772',
  divider: '#DCE5E9',
  audioWaveform: '#627680',
  audioWaveformActive: '#087F63',
  audioBackground: 'rgba(0, 0, 0, 0.06)',
  error: '#B72F3C'
}
export const COLORS = DARK_COLORS

export const SPACING = {
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24
}

export const FONT_SIZE = {
  xs: 11,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22
}

export const BORDER_RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  bubble: 8
}
