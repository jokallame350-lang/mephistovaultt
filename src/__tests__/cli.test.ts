import { describe, it, expect } from 'vitest';
import {
  generateRoomCode,
  deriveCryptoKey,
  encryptBuffer,
  decryptBuffer,
  formatBytes,
  formatSpeed,
} from '../../bin/mephisto.js';

describe('Mephisto CLI Engine Suite', () => {
  it('generates a valid 6-char room code with 4-digit PIN', () => {
    const code = generateRoomCode();
    expect(code).toMatch(/^[a-z0-9]{3}-[a-z0-9]{3}#[0-9]{4}$/);
  });

  it('derives consistent 256-bit AES key with PBKDF2', () => {
    const key1 = deriveCryptoKey('cipher-core#1234');
    const key2 = deriveCryptoKey('cipher-core#1234');
    expect(key1).toHaveLength(32);
    expect(key1).toEqual(key2);
  });

  it('encrypts and decrypts binary payloads losslessly with AES-256-GCM', () => {
    const key = deriveCryptoKey('test-pipe#5555');
    const plaintext = Buffer.from('MephistoVault CLI Standalone E2E Zero-Trace Transport Stream');

    const encrypted = encryptBuffer(plaintext, key);
    expect(encrypted.length).toBeGreaterThan(plaintext.length);

    const decrypted = decryptBuffer(encrypted, key);
    expect(decrypted.toString()).toBe(plaintext.toString());
  });

  it('formats transfer metrics accurately', () => {
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatSpeed(5 * 1024 * 1024)).toBe('5 MB/s');
  });
});
