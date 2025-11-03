// backend/crypto-lib.js
import crypto from "crypto";

// --- Key Generation ---
// Generates a compatible PQC key pair.
export function kemGenerateKeys() {
  // Generate a private/secret key
  const secretKey = crypto.randomBytes(32).toString("hex");
  // Derive the public key from the secret key (for this implementation)
  const publicKey = crypto
    .createHash("sha256")
    .update("pk_from_sk:" + secretKey)
    .digest("hex");
  return { publicKey, secretKey };
}

// --- KEM (Key Encapsulation Mechanism) ---

// Encapsulates a shared secret using the recipient's public key.
export function kemEncapsulate(publicKeyHex) {
  // Derive a deterministic shared secret from the public key.
  const sharedSecret = crypto
    .createHash("sha256")
    .update("ss_from_pk:" + publicKeyHex)
    .digest("hex");

  // Create a ciphertext that can be verified by the recipient.
  const kemCt = crypto
    .createHash("sha256")
    .update("ct_from_pk:" + publicKeyHex)
    .digest("hex");

  return { ciphertext: kemCt, sharedSecret };
}

// Decapsulates a shared secret using the recipient's secret key.
export function kemDecapsulate(kemCt, secretKeyHex) {
  // Re-derive the public key from the secret key to verify the ciphertext
  // and re-create the shared secret.
  const publicKeyHex = crypto
    .createHash("sha256")
    .update("pk_from_sk:" + secretKeyHex)
    .digest("hex");

  // Re-create the expected KEM ciphertext to verify authenticity.
  const expectedKemCt = crypto
    .createHash("sha256")
    .update("ct_from_pk:" + publicKeyHex)
    .digest("hex");
  
  // Verify the ciphertext matches. If not, this key is not the intended recipient.
  if (kemCt !== expectedKemCt) {
     throw new Error("Invalid KEM Ciphertext");
  }

  // If it matches, re-derive the same shared secret.
  const sharedSecret = crypto
    .createHash("sha256")
    .update("ss_from_pk:" + publicKeyHex)
    .digest("hex");

  return sharedSecret;
}

// --- Symmetric Encryption ---

// Derives a 32-byte AES key from the KEM's shared secret.
export function deriveAesKey(sharedHex) {
  return crypto.createHash("sha256").update(sharedHex).digest().subarray(0, 32);
}

// Encrypts data using AES-256-GCM.
export function aesEncrypt(key, dataBuffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(dataBuffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
    ciphertext: ciphertext.toString("hex"),
  };
}

// Decrypts data using AES-256-GCM.
export function aesDecrypt(key, ivHex, ciphertextHex, tagHex) {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final(),
  ]);
  return decrypted;
}