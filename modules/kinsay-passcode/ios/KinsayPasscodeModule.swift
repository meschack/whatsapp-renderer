import ExpoModulesCore

public class KinsayPasscodeModule: Module {
  private let worker = DispatchQueue(label: "kinsay.passcode", qos: .userInitiated)

  public func definition() -> ModuleDefinition {
    Name("KinsayPasscode")

    AsyncFunction("deriveAsync") { (pin: String, saltHex: String, rounds: Int) throws -> String in
      try PasscodeDerivation.derive(pin: pin, saltHex: saltHex, rounds: rounds)
    }.runOnQueue(worker)
  }
}
