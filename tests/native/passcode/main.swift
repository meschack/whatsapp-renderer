import Foundation

func check(_ actual: String, _ expected: String) {
  precondition(actual == expected, "PBKDF2 vector mismatch")
}
func reject(_ pin: String, _ salt: String, _ rounds: Int) {
  do {
    _ = try PasscodeDerivation.derive(pin: pin, saltHex: salt, rounds: rounds)
    preconditionFailure("Unsafe parameters accepted")
  } catch PasscodeDerivation.Failure.invalidParameters {
  } catch {
    preconditionFailure("Unexpected derivation failure")
  }
}
let started = Date()
check(try PasscodeDerivation.derive(pin: "739182", saltHex: "000102030405060708090a0b0c0d0e0f", rounds: 600_000),
      "f99a98861f9ba5c5676b140ef0287e5fc6020991611a4941f2b1a25db1df9d84")
print("Native PBKDF2 600k: \(Int(Date().timeIntervalSince(started) * 1000)) ms (Mac, not a device measurement)")
check(try PasscodeDerivation.derive(pin: "000000", saltHex: "00000000000000000000000000000000", rounds: 1_000_000),
      "8c55fa360b6c194c7bba2a218535a377c2099db3fe8b53f48d570bea7e9f2a64")
reject("12345", "00000000000000000000000000000000", 600_000)
reject("123456", "invalid", 600_000)
reject("123456", "00000000000000000000000000000000", 1)
reject("123456", "00000000000000000000000000000000", 1_000_001)
print("Native iOS passcode vectors and parameter checks passed.")
