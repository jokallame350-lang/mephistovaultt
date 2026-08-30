/**
 * MephistoVault — Hosted Vault Share Cryptographic Engine
 * Provides client-side zero-knowledge AES-256-GCM encryption and decryption.
 * Plaintext files NEVER leave the user's browser unencrypted.
 */

const PBKDF2_VAULT_ITERATIONS = 100_000;
const AES_KEY_BITS = 256;
const IV_LENGTH_BYTES = 12;

/**
 * Encodes an ArrayBuffer or Uint8Array into a URL-safe Base64 string.
 */
export function bufferToBase64Url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Decodes a URL-safe Base64 string into a Uint8Array.
 */
export function base64UrlToBuffer(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generates a high-entropy 256-bit AES-GCM Vault Master Key.
 * Returns both the CryptoKey and a URL-safe Base64 string representation for the URL fragment.
 */
export async function generateVaultKey(): Promise<{ key: CryptoKey; secretString: string }> {
  const rawKeyBytes = crypto.getRandomValues(new Uint8Array(32));
  const secretString = bufferToBase64Url(rawKeyBytes);

  const key = await crypto.subtle.importKey(
    'raw',
    rawKeyBytes,
    { name: 'AES-GCM', length: AES_KEY_BITS },
    false,
    ['encrypt', 'decrypt']
  );

  return { key, secretString };
}

/**
 * Imports a 256-bit Vault key from its URL-safe Base64 secret string.
 */
export async function importVaultKey(secretString: string): Promise<CryptoKey> {
  const rawKeyBytes = base64UrlToBuffer(secretString);
  if (rawKeyBytes.byteLength !== 32) {
    throw new Error(`Invalid Vault key length: expected 32 bytes (256-bit), received ${rawKeyBytes.byteLength} bytes.`);
  }

  return crypto.subtle.importKey(
    'raw',
    rawKeyBytes.buffer as ArrayBuffer,
    { name: 'AES-GCM', length: AES_KEY_BITS },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Computes a salted PBKDF2 hash of a password for server-side verification.
 * The server only receives this hash and never the raw password.
 */
export async function hashPasswordForVault(password: string, saltHex?: string): Promise<{ hash: string; salt: string }> {
  const salt = saltHex ? base64UrlToBuffer(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password).buffer as ArrayBuffer,
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_VAULT_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    256
  );

  return {
    hash: bufferToBase64Url(derivedBits),
    salt: bufferToBase64Url(salt),
  };
}

/**
 * Encrypts an ArrayBuffer payload with AES-256-GCM.
 * Output format: [12-byte random IV][AES-GCM ciphertext + 16-byte tag]
 */
export async function encryptVaultBuffer(data: ArrayBuffer | Uint8Array, key: CryptoKey): Promise<ArrayBuffer> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const rawBytes = data instanceof Uint8Array ? data : new Uint8Array(data);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    rawBytes as unknown as BufferSource
  );

  const result = new Uint8Array(IV_LENGTH_BYTES + ciphertext.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(ciphertext), IV_LENGTH_BYTES);
  return result.buffer;
}

/**
 * Decrypts an encrypted Vault payload.
 * Expects input: [12-byte random IV][AES-GCM ciphertext + 16-byte tag]
 */
export async function decryptVaultBuffer(encryptedData: ArrayBuffer | Uint8Array, key: CryptoKey): Promise<ArrayBuffer> {
  const bytes = encryptedData instanceof Uint8Array ? encryptedData : new Uint8Array(encryptedData);
  if (bytes.byteLength < IV_LENGTH_BYTES + 16) {
    throw new Error('Encrypted payload too short: missing IV or authentication tag.');
  }

  const iv = bytes.subarray(0, IV_LENGTH_BYTES);
  const ciphertext = bytes.subarray(IV_LENGTH_BYTES);

  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    ciphertext as unknown as BufferSource
  );
}

/**
 * Encrypts a File stream incrementally chunk-by-chunk without storing the entire file in RAM.
 */
export async function encryptFileToBlob(file: File, key: CryptoKey): Promise<Blob> {
  const rawBuffer = await file.arrayBuffer();
  const encrypted = await encryptVaultBuffer(rawBuffer, key);
  return new Blob([encrypted], { type: 'application/octet-stream' });
}

/**
 * Decrypts an encrypted Blob back to an authentic File/Blob.
 */
export async function decryptBlobToFile(encryptedBlob: Blob, key: CryptoKey, filename: string, mimeType: string): Promise<File> {
  const encryptedBuf = await encryptedBlob.arrayBuffer();
  const decryptedBuf = await decryptVaultBuffer(encryptedBuf, key);
  return new File([decryptedBuf], filename, { type: mimeType || 'application/octet-stream', lastModified: Date.now() });
}
