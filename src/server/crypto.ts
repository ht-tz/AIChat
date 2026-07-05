// AES-256-GCM 加密工具
// 用于加密存储敏感数据（如 API Key）
// 使用 Node.js 内置 crypto 模块，无需额外依赖

import crypto from "crypto";

function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!key && process.env.NODE_ENV === "production") {
    throw new Error("ENCRYPTION_KEY or JWT_SECRET must be set in production");
  }
  return key || "dev-encryption-key-change-in-production-32ch";
}

// P2 优化：缓存 SHA-256 哈希结果，避免每次加密/解密都重新计算
let cachedKey: Buffer | null = null;
function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  cachedKey = crypto.createHash("sha256").update(getEncryptionKey()).digest();
  return cachedKey;
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const key = getKey();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted format");
  }
  const [ivHex, tagHex, dataHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(tagHex, "hex");
  const encrypted = Buffer.from(dataHex, "hex");
  const key = getKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

export function maskKey(key: string): string {
  if (!key || key.length <= 8) return "••••••••";
  return `${key.slice(0, 4)}••••••${key.slice(-4)}`;
}

export function keyPrefix(key: string): string {
  return key.slice(0, 8);
}
