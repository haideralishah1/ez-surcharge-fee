import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

/** Key derived from INTEGRATIONS_SECRET (preferred) or the app secret. */
function key(): Buffer {
  const secret = process.env.INTEGRATIONS_SECRET || process.env.SHOPIFY_API_SECRET || "";
  if (!secret) throw new Error("INTEGRATIONS_SECRET or SHOPIFY_API_SECRET must be set");
  return createHash("sha256").update(secret).digest();
}

/** AES-256-GCM; output is base64(iv | tag | ciphertext). */
export function encryptJson(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}

export function decryptJson<T = Record<string, string>>(blob: string, fallback: T): T {
  if (!blob) return fallback;
  try {
    const buf = Buffer.from(blob, "base64");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const body = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8")) as T;
  } catch {
    return fallback;
  }
}

export const hmacHex = (secret: string, payload: string) =>
  createHmac("sha256", secret).update(payload).digest("hex");
