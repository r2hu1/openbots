import crypto from "node:crypto";

/**
 * Returns a 32-byte Buffer encryption key derived from ENCRYPTION_KEY or BETTER_AUTH_SECRET or a persistent salt.
 */
function getEncryptionKey(): Buffer {
  const secret =
    process.env.ENCRYPTION_KEY ||
    process.env.BETTER_AUTH_SECRET ||
    "openbots-default-encryption-secret-key-must-be-configured";

  // Derive 32 bytes using SHA-256
  return crypto.createHash("sha256").update(secret).digest();
}

export interface EncryptedData {
  encryptedKey: string;
  iv: string;
  authTag: string;
  keyHint: string;
}

/**
 * Encrypt plaintext using AES-256-GCM.
 */
export function encryptApiKey(plaintext: string): EncryptedData {
  const trimmed = plaintext.trim();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);

  let encrypted = cipher.update(trimmed, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");

  // Key hint: last 4 chars if length >= 6, else "***"
  const keyHint = trimmed.length >= 6 ? trimmed.slice(-4) : trimmed.slice(0, 3);

  return {
    encryptedKey: encrypted,
    iv: iv.toString("hex"),
    authTag,
    keyHint,
  };
}

/**
 * Decrypt ciphertext using AES-256-GCM.
 */
export function decryptApiKey(
  encryptedKey: string,
  ivHex: string,
  authTagHex: string,
): string {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivHex, "hex"),
  );

  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  let decrypted = decipher.update(encryptedKey, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
