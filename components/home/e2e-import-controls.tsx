import Constants from 'expo-constants'
import { Directory, File, Paths } from 'expo-file-system'
import { useState } from 'react'
import { Pressable, Text, View } from '@/src/tw'

const IS_E2E = process.env.EXPO_PUBLIC_E2E === '1' && Constants.expoConfig?.extra?.e2eBuild === true

/** Opt-in smoke APK/IPA only. Exercise the real import/review/navigation path. */
export function E2EImportControls({
  onImport
}: {
  onImport(request: { uri: string; name: string }): Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!IS_E2E) return null
  const run = async (updated: boolean) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const { createE2EExportFixtures } = await import('@/utils/e2e-fixture')
      const fixtures = await createE2EExportFixtures()
      const directory = new Directory(Paths.cache, 'e2e-imports')
      directory.create({ intermediates: true, idempotent: true })
      const file = new File(directory, updated ? 'update.zip' : 'initial.zip')
      if (file.exists) file.delete()
      file.create()
      file.write(updated ? fixtures.update : fixtures.initial)
      await onImport({ uri: file.uri, name: updated ? fixtures.updateName : fixtures.initialName })
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Fixture import failed')
    } finally {
      setBusy(false)
    }
  }
  return (
    <View className='bg-wa-header gap-2 p-4'>
      <Text className='text-wa-text-primary'>Smoke-test exports</Text>
      <Pressable
        testID='e2e-import-initial'
        accessibilityRole='button'
        disabled={busy}
        onPress={() => void run(false)}
        className='min-h-11 justify-center'
      >
        <Text className='text-wa-accent'>Import initial fixture</Text>
      </Pressable>
      <Pressable
        testID='e2e-import-update'
        accessibilityRole='button'
        disabled={busy}
        onPress={() => void run(true)}
        className='min-h-11 justify-center'
      >
        <Text className='text-wa-accent'>Import update fixture</Text>
      </Pressable>
      {error && (
        <Text accessibilityRole='alert' className='text-wa-error'>
          {error}
        </Text>
      )}
    </View>
  )
}
