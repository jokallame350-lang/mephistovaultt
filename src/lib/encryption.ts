import { PBKDF2_ITERATIONS, AES_KEY_LENGTH, IV_LENGTH } from './constants';

/**
 * Derive an AES-256-GCM key from the share code PIN using PBKDF2.
 *
 * @param shareCode - Full share code like "abc-xyz#1234"
 * @returns CryptoKey suitable for AES-GCM encrypt/decrypt
 */
const keyCache = new Map<string, CryptoKey>();

/**
 * Derive an AES-256-GCM key from the share code PIN using PBKDF2.
 * Memoized per share code to avoid expensive PBKDF2 re-derivation on every chunk.
 */
export async function deriveKey(shareCode: string): Promise<CryptoKey> {
  const cleanShareCode = shareCode.trim().toLowerCase();
  if (keyCache.has(cleanShareCode)) {
    return keyCache.get(cleanShareCode)!;
  }

  const parts = cleanShareCode.split('#');
  const pin = parts[1] || '0';
  const salt = parts[0] || 'mephisto-default-salt';

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    false,
    ['encrypt', 'decrypt'],
  );

  keyCache.set(cleanShareCode, derivedKey);
  return derivedKey;
}

/** Clear key cache on disconnect */
export function clearKeyCache() {
  keyCache.clear();
}

/** Compute SHA-256 checksum hex string for a blob or buffer */
export async function calculateSHA256(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Encrypt a chunk with AES-256-GCM.
 * Returns IV (12 bytes) + ciphertext as a single ArrayBuffer.
 */
export async function encryptChunk(
  data: ArrayBuffer,
  key: CryptoKey,
): Promise<ArrayBuffer> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data,
  );

  // Prepend IV to ciphertext: [IV (12 bytes)][ciphertext]
  const result = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(ciphertext), IV_LENGTH);

  return result.buffer;
}

/**
 * Decrypt a chunk that was encrypted with encryptChunk.
 * Expects IV (12 bytes) + ciphertext format.
 */
export async function decryptChunk(
  data: ArrayBuffer,
  key: CryptoKey,
): Promise<ArrayBuffer> {
  const dataView = new Uint8Array(data);
  const iv = dataView.slice(0, IV_LENGTH);
  const ciphertext = dataView.slice(IV_LENGTH);

  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  );
}
