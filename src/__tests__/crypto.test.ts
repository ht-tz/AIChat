import { describe, it, expect } from "vitest";
import { encrypt, decrypt, maskKey, keyPrefix } from "@/server/crypto";

describe("crypto", () => {
  it("encrypt and decrypt roundtrip", () => {
    const plaintext = "sk-test-api-key-12345";
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted.split(":")).toHaveLength(3);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("encrypt produces different ciphertext for same input", () => {
    const a = encrypt("hello");
    const b = encrypt("hello");
    expect(a).not.toBe(b);
  });

  it("maskKey masks correctly", () => {
    expect(maskKey("sk-1234567890")).toBe("sk-1••••••7890");
    expect(maskKey("short")).toBe("••••••••");
    expect(maskKey("")).toBe("••••••••");
  });

  it("keyPrefix returns first 8 chars", () => {
    expect(keyPrefix("sk-1234567890")).toBe("sk-12345");
    expect(keyPrefix("ab")).toBe("ab");
  });
});
