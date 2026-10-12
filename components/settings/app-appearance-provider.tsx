import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren
} from 'react'
import { useColorScheme } from 'react-native'
import { VariableContextProvider } from 'react-native-css'
import { getAppAppearanceSettings, saveAppAppearanceSettings } from '@/store/app-settings'
import { type AppColors } from '@/constants/theme'
import { type ChatTextScale } from '@/utils/chat-appearance'
import {
  DEFAULT_APP_APPEARANCE,
  getAppColors,
  getAppThemeVariables,
  resolveAppTheme,
  type AppAppearanceSettings,
  type AppThemeMode
} from '@/utils/app-theme'

interface AppAppearance extends AppAppearanceSettings {
  resolvedTheme: 'light' | 'dark'
  colors: AppColors
  setMode: (mode: AppThemeMode) => void
  setDefaultTextScale: (scale: ChatTextScale) => void
}
const AppAppearanceContext = createContext<AppAppearance>({
  ...DEFAULT_APP_APPEARANCE,
  resolvedTheme: 'dark',
  colors: getAppColors('dark'),
  setMode: () => {},
  setDefaultTextScale: () => {}
})
/** Mount after archive bootstrap: preferences live in the same local SQLite archive. */
export function AppAppearanceProvider({ children }: PropsWithChildren) {
  const [settings, setSettings] = useState(getAppAppearanceSettings)
  const currentSettings = useRef(settings)
  const system = useColorScheme()
  const resolvedTheme = resolveAppTheme(settings.mode, system)
  const update = useCallback((patch: Partial<AppAppearanceSettings>) => {
    const next = { ...currentSettings.current, ...patch }
    saveAppAppearanceSettings(next)
    currentSettings.current = next
    setSettings(next)
  }, [])
  const setMode = useCallback((mode: AppThemeMode) => update({ mode }), [update])
  const setDefaultTextScale = useCallback(
    (defaultTextScale: ChatTextScale) => update({ defaultTextScale }),
    [update]
  )
  const value = useMemo(
    () => ({
      ...settings,
      resolvedTheme,
      colors: getAppColors(resolvedTheme),
      setMode,
      setDefaultTextScale
    }),
    [settings, resolvedTheme, setMode, setDefaultTextScale]
  )
  const variables = useMemo(() => getAppThemeVariables(resolvedTheme), [resolvedTheme])
  return (
    <AppAppearanceContext.Provider value={value}>
      <VariableContextProvider value={variables}>{children}</VariableContextProvider>
    </AppAppearanceContext.Provider>
  )
}
export function useAppAppearance() {
  return useContext(AppAppearanceContext)
}
