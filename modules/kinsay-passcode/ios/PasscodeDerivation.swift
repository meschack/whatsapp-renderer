import CommonCrypto
import Foundation

enum PasscodeDerivation {
  enum Failure: Error { case invalidParameters, derivationFailed }

  static func derive(pin: String, saltHex: String, rounds: Int) throws -> String {
    guard pin.range(of: "^[0-9]{6,12}$", options: .regularExpression) != nil,
          saltHex.range(of: "^[a-f0-9]{32}$", options: .regularExpression) != nil,
          (600_000...1_000_000).contains(rounds) else {
      throw Failure.invalidParameters
    }
    let hex = Array(saltHex)
    var salt = stride(from: 0, to: hex.count, by: 2).map {
      UInt8(String(hex[$0...($0 + 1)]), radix: 16)!
    }
    var password = Array(pin.utf8)
    var digest = [UInt8](repeating: 0, count: 32)
    defer {
      salt.withUnsafeMutableBytes { $0.initializeMemory(as: UInt8.self, repeating: 0) }
      password.withUnsafeMutableBytes { $0.initializeMemory(as: UInt8.self, repeating: 0) }
      digest.withUnsafeMutableBytes { $0.initializeMemory(as: UInt8.self, repeating: 0) }
    }
    let status = password.withUnsafeBytes { passwordBytes in
      salt.withUnsafeBytes { saltBytes in
        digest.withUnsafeMutableBytes { digestBytes in
          CCKeyDerivationPBKDF(
            CCPBKDFAlgorithm(kCCPBKDF2),
            passwordBytes.baseAddress!.assumingMemoryBound(to: Int8.self), passwordBytes.count,
            saltBytes.baseAddress!.assumingMemoryBound(to: UInt8.self), saltBytes.count,
            CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256), UInt32(rounds),
            digestBytes.baseAddress!.assumingMemoryBound(to: UInt8.self), digestBytes.count
          )
        }
      }
    }
    guard status == kCCSuccess else { throw Failure.derivationFailed }
    return digest.map { String(format: "%02x", $0) }.joined()
  }
}
