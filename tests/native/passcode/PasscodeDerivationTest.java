package expo.modules.kinsaypasscode;

import java.util.Arrays;

public final class PasscodeDerivationTest {
  public static void main(String[] args) throws Exception {
    long started = System.nanoTime();
    check(PasscodeDerivation.derive("739182", "000102030405060708090a0b0c0d0e0f", 600_000),
        "f99a98861f9ba5c5676b140ef0287e5fc6020991611a4941f2b1a25db1df9d84");
    System.out.printf("Native PBKDF2 600k: %.0f ms (JVM, not a device measurement)%n",
        (System.nanoTime() - started) / 1_000_000.0);
    check(PasscodeDerivation.derive("000000", "00000000000000000000000000000000", 1_000_000),
        "8c55fa360b6c194c7bba2a218535a377c2099db3fe8b53f48d570bea7e9f2a64");
    reject("12345", "00000000000000000000000000000000", 600_000);
    reject("123456", "invalid", 600_000);
    reject("123456", "00000000000000000000000000000000", 1);
    reject("123456", "00000000000000000000000000000000", 1_000_001);
    byte[] salt = new byte[16];
    for (int i = 0; i < salt.length; i++) salt[i] = (byte) i;
    byte[] legacy = PasscodeDerivation.deriveWithMac("739182".toCharArray(), salt, 600_000);
    StringBuilder hex = new StringBuilder();
    for (byte value : legacy) hex.append(String.format("%02x", value & 0xff));
    check(hex.toString(), "f99a98861f9ba5c5676b140ef0287e5fc6020991611a4941f2b1a25db1df9d84");
    Arrays.fill(legacy, (byte) 0);
    System.out.println("Native Android passcode vectors and parameter checks passed.");
  }

  private static void check(String actual, String expected) {
    if (!actual.equals(expected)) throw new AssertionError("PBKDF2 vector mismatch");
  }

  private static void reject(String pin, String salt, int rounds) throws Exception {
    try {
      PasscodeDerivation.derive(pin, salt, rounds);
      throw new AssertionError("Unsafe parameters accepted");
    } catch (IllegalArgumentException expected) {}
  }
}
