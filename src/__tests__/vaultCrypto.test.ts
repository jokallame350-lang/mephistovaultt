import { describe, it, expect } from 'vitest';
import {
  generateVaultKey,
  importVaultKey,
  encryptVaultBuffer,
  decryptVaultBuffer,
  hashPasswordForVault,
  bufferToBase64Url,
  base64UrlToBuffer,
  encryptFileToBlob,
  decryptBlobToFile,
} from '../lib/vaultCrypto';

describe('Vault Share Cryptographic Suite', () => {
  it('generates a 256-bit Vault key and imports it back accurately from secret string', async () => {
    const { key, secretString } = await generateVaultKey();
    expect(secretString).toBeTypeOf('string');
    expect(secretString.length).toBeGreaterThan(30);

    const importedKey = await importVaultKey(secretString);
    expect(importedKey).toBeDefined();

    // Verify roundtrip encryption/decryption with imported key
    const data = new TextEncoder().encode('Confidential Vault Share Data').buffer;
    const encrypted = await encryptVaultBuffer(data, key);
    const decrypted = await decryptVaultBuffer(encrypted, importedKey);

    expect(new TextDecoder().decode(decrypted)).toBe('Confidential Vault Share Data');
  });

  it('rejects tampered ciphertext or wrong key', async () => {
    const { key: key1 } = await generateVaultKey();
    const { key: key2 } = await generateVaultKey();

    const data = new TextEncoder().encode('Sensitive Payload').buffer;
    const encrypted = await encryptVaultBuffer(data, key1);

    // Try decrypting with different key
    await expect(decryptVaultBuffer(encrypted, key2)).rejects.toThrow();

    // Try decrypting corrupted payload
    const corrupted = new Uint8Array(encrypted);
    corrupted[corrupted.length - 1] ^= 0xff; // Flip a bit in auth tag
    await expect(decryptVaultBuffer(corrupted.buffer, key1)).rejects.toThrow();
  });

  it('hashes passwords with PBKDF2 salt deterministically', async () => {
    const password = 'CorrectHorseBatteryStaple123!';
    const { hash: hash1, salt } = await hashPasswordForVault(password);
    const { hash: hash2 } = await hashPasswordForVault(password, salt);

    expect(hash1).toBe(hash2);

    const { hash: hashWrong } = await hashPasswordForVault('WrongPassword!', salt);
    expect(hashWrong).not.toBe(hash1);
  });

  it('handles File encryption and decryption to authentic Blob/File', async () => {
    const { key } = await generateVaultKey();
    const originalText = 'Hello MephistoVault File Content 🚀';
    const testFile = new File([originalText], 'report.txt', { type: 'text/plain' });

    const encryptedBlob = await encryptFileToBlob(testFile, key);
    expect(encryptedBlob.size).toBeGreaterThan(testFile.size); // IV + tag overhead

    const decryptedFile = await decryptBlobToFile(encryptedBlob, key, 'report.txt', 'text/plain');
    expect(decryptedFile.name).toBe('report.txt');
    expect(decryptedFile.type).toBe('text/plain');

    const text = await decryptedFile.text();
    expect(text).toBe(originalText);
  });

  it('handles Base64URL roundtripping for arbitrary byte sequences', () => {
    const bytes = new Uint8Array([0, 1, 255, 128, 64, 32, 16, 8, 4, 2]);
    const b64 = bufferToBase64Url(bytes);
    expect(b64).not.toContain('+');
    expect(b64).not.toContain('/');
    expect(b64).not.toContain('=');

    const decoded = base64UrlToBuffer(b64);
    expect(Array.from(decoded)).toEqual(Array.from(bytes));
  });
});
