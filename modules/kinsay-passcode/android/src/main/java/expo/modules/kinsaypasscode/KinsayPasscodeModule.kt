package expo.modules.kinsaypasscode

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class KinsayPasscodeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("KinsayPasscode")

    // Expo AsyncFunction runs on its native modules queue, never the JS/UI thread.
    AsyncFunction("deriveAsync") { pin: String, saltHex: String, rounds: Int ->
      PasscodeDerivation.derive(pin, saltHex, rounds)
    }
  }
}
