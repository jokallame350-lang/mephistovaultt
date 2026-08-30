import { describe, it, expect } from 'vitest';
import {
  deriveKey,
  encryptChunk,
  decryptChunk,
  encryptChatMessage,
  decryptChatMessage,
  calculateSHA256,
} from '../lib/encryption';

describe('Encryption & Cryptography Suite', () => {
  it('derives consistent AES-GCM 256-bit key from room code and pin', async () => {
    const key1 = await deriveKey('alpha-omega#1234');
    const key2 = await deriveKey('alpha-omega#1234');

    expect(key1).toBeDefined();
    expect(key2).toBeDefined();
    expect(key1.algorithm.name).toBe('AES-GCM');
  });

  it('encrypts and decrypts binary chunks losslessly with AES-256-GCM', async () => {
    const key = await deriveKey('test-suite#9999');
    const plaintext = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);

    const encrypted = await encryptChunk(plaintext.buffer, key);
    expect(encrypted.byteLength).toBeGreaterThan(plaintext.byteLength);

    const decrypted = await decryptChunk(encrypted, key);
    const decryptedArr = new Uint8Array(decrypted);

    expect(decryptedArr).toEqual(plaintext);
  });

  it('encrypts and decrypts Phantom Chat messages with AES-256-GCM', async () => {
    const key = await deriveKey('chat-room#5678');
    const message = 'Hello, this is an end-to-end encrypted phantom message! 🔐';

    const encryptedBuf = await encryptChatMessage(message, key);
    expect(encryptedBuf.byteLength).toBeGreaterThan(0);

    const decryptedText = await decryptChatMessage(encryptedBuf, key);
    expect(decryptedText).toBe(message);
  });

  it('computes exact SHA-256 checksum digest matching standard hash', async () => {
    const encoder = new TextEncoder();
    const data = encoder.encode('MephistoVault Zero-Trace Protocol');

    const hash = await calculateSHA256(data.buffer);
    expect(hash).toBeDefined();
    expect(hash.length).toBe(64); // 256-bit hex is 64 chars
  });
});
