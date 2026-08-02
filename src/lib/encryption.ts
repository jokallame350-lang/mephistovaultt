import { PBKDF2_ITERATIONS, AES_KEY_LENGTH, IV_LENGTH } from './constants';

const keyCache = new Map<string, CryptoKey>();

/**
 * Safely wipe sensitive data from an ArrayBuffer or TypedArray by zeroing out bytes in memory.
 */
export function wipeMemory(data: ArrayBuffer | ArrayBufferView | null | undefined): void {
  if (!data) return;
  try {
    if (ArrayBuffer.isView(data)) {
      new Uint8Array(data.buffer, data.byteOffset, data.byteLength).fill(0);
    } else if (data instanceof ArrayBuffer) {
      new Uint8Array(data).fill(0);
    }
  } catch {
    // Ignore error if buffer is detached or non-transferable
  }
}

/**
 * Derive an AES-256-GCM key from the share code PIN using PBKDF2.
 * Memoized per share code to avoid expensive PBKDF2 re-derivation on every chunk.
 *
 * @param shareCode - Full share code like "abc-xyz#1234"
 * @returns CryptoKey suitable for AES-GCM encrypt/decrypt
 */
export async function deriveKey(shareCode: string): Promise<CryptoKey> {
  const cleanShareCode = shareCode.trim().toLowerCase();
  if (keyCache.has(cleanShareCode)) {
    return keyCache.get(cleanShareCode)!;
  }

  const parts = cleanShareCode.split('#');
  const roomCode = parts[0] || 'mephisto-room';
  const pin = parts[1] || '0000';
  const secret = `${roomCode}#${pin}`;

  const encoder = new TextEncoder();
  const secretBytes = encoder.encode(secret);
  const saltBytes = encoder.encode(`mephistovault-pbkdf2-salt-${roomCode}`);

  let keyMaterial: CryptoKey;
  try {
    keyMaterial = await crypto.subtle.importKey(
      'raw',
      secretBytes,
      'PBKDF2',
      false,
      ['deriveKey'],
    );
  } finally {
    wipeMemory(secretBytes);
  }

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
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
export function clearKeyCache(): void {
  keyCache.clear();
}

/** Compute SHA-256 checksum hex string for an ArrayBuffer in a memory-efficient manner */
export async function calculateSHA256(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashView = new Uint8Array(hashBuffer);
  let hex = '';
  for (let i = 0; i < hashView.length; i++) {
    hex += hashView[i].toString(16).padStart(2, '0');
  }
  return hex;
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
  if (data.byteLength < IV_LENGTH + 16) {
    throw new Error('Invalid ciphertext: buffer shorter than IV and authentication tag combined.');
  }

  const dataView = new Uint8Array(data);
  const iv = dataView.subarray(0, IV_LENGTH);
  const ciphertext = dataView.subarray(IV_LENGTH);

  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  );
}

