package expo.modules.kinsaypasscode;

import java.security.GeneralSecurityException;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;
import javax.crypto.Mac;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;

/** Platform PBKDF2-HMAC-SHA256, compatible with the original stored v1 digest. */
public final class PasscodeDerivation {
  private PasscodeDerivation() {}

  public static String derive(String pin, String saltHex, int rounds)
      throws GeneralSecurityException {
    if (!pin.matches("[0-9]{6,12}") || !saltHex.matches("[a-f0-9]{32}")
        || rounds < 600_000 || rounds > 1_000_000) {
      throw new IllegalArgumentException("Invalid passcode derivation parameters");
    }
    byte[] salt = new byte[16];
    for (int i = 0; i < salt.length; i++) {
      salt[i] = (byte) Integer.parseInt(saltHex.substring(i * 2, i * 2 + 2), 16);
    }
    char[] password = pin.toCharArray();
    PBEKeySpec spec = new PBEKeySpec(password, salt, rounds, 256);
    byte[] digest = null;
    try {
      try {
        digest = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
            .generateSecret(spec).getEncoded();
      } catch (NoSuchAlgorithmException unavailableOnAndroid7) {
        // The factory was added in API 26. HmacSHA256 exists on our API 24/25
        // devices too; RFC 8018's single-block expansion keeps v1 compatible.
        digest = deriveWithMac(password, salt, rounds);
      }
      char[] hex = new char[digest.length * 2];
      final char[] alphabet = "0123456789abcdef".toCharArray();
      for (int i = 0; i < digest.length; i++) {
        int value = digest[i] & 0xff;
        hex[i * 2] = alphabet[value >>> 4];
        hex[i * 2 + 1] = alphabet[value & 15];
      }
      return new String(hex);
    } finally {
      spec.clearPassword();
      Arrays.fill(password, '\0');
      Arrays.fill(salt, (byte) 0);
      if (digest != null) Arrays.fill(digest, (byte) 0);
    }
  }

  static byte[] deriveWithMac(char[] password, byte[] salt, int rounds)
      throws GeneralSecurityException {
    byte[] passwordBytes = new byte[password.length];
    for (int i = 0; i < password.length; i++) passwordBytes[i] = (byte) password[i];
    byte[] block = Arrays.copyOf(salt, salt.length + 4);
    block[block.length - 1] = 1;
    byte[] current = new byte[32];
    byte[] next = new byte[32];
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(passwordBytes, "HmacSHA256"));
      mac.update(block);
      mac.doFinal(current, 0);
      byte[] result = current.clone();
      for (int iteration = 1; iteration < rounds; iteration++) {
        mac.update(current);
        mac.doFinal(next, 0);
        for (int i = 0; i < result.length; i++) result[i] ^= next[i];
        byte[] swap = current;
        current = next;
        next = swap;
      }
      return result;
    } finally {
      Arrays.fill(passwordBytes, (byte) 0);
      Arrays.fill(block, (byte) 0);
      Arrays.fill(current, (byte) 0);
      Arrays.fill(next, (byte) 0);
    }
  }
}
