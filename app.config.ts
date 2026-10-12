import type { ConfigContext, ExpoConfig } from 'expo/config'

/** Smoke builds have their own sandbox and never replace a user's real archive. */
export default function configureApp({ config }: ConfigContext): ExpoConfig {
  const e2e = process.env.E2E_BUILD === '1'
  return {
    ...config,
    name: config.name ?? 'Kinsay',
    slug: config.slug ?? 'whatsapp-renderer',
    android: {
      ...config.android,
      package: e2e ? 'com.godwingbewezoun.whatsapprenderer.e2e' : config.android?.package
    },
    ios: {
      ...config.ios,
      bundleIdentifier: e2e
        ? 'com.godwingbewezoun.whatsapprenderer.e2e'
        : config.ios?.bundleIdentifier
    },
    extra: { ...config.extra, e2eBuild: e2e }
  }
}
