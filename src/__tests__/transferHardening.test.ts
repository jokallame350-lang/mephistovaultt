import { describe, it, expect } from 'vitest';
import { sanitizePath, buildFolderManifest, flattenManifest } from '../lib/folderManifest';
import { VirtualPackage } from '../lib/virtualPackage';
import { generateShareUrl, parseRoomCode } from '../lib/utils';
import { encryptChunk, decryptChunk, deriveKey, calculateSHA256 } from '../lib/encryption';
import { compressData, decompressData } from '../lib/compression';

describe('Transfer Hardening & Security Audit Suite', () => {
  describe('Folder Path Mapping & Deterministic Matching', () => {
    it('sanitizes dangerous directory traversal paths safely', () => {
      expect(sanitizePath('../../etc/passwd')).toBe('etc/passwd');
      expect(sanitizePath('..\\..\\windows\\system32\\cmd.exe')).toBe('windows/system32/cmd.exe');
      expect(sanitizePath('C:\\Users\\admin\\secret.txt')).toBe('Users/admin/secret.txt');
      expect(sanitizePath('/var/log/secret.log')).toBe('var/log/secret.log');
      expect(sanitizePath('foo\0bar.txt')).toBe('foobar.txt');
      expect(sanitizePath('')).toBe('unnamed_file');
    });

    it('builds deterministic folder manifest with exact relative paths', () => {
      const file1 = new File(['A'], 'file.txt', { type: 'text/plain' });
      const file2 = new File(['B'], 'file.txt', { type: 'text/plain' });
      // Same filename in different directories
      (file1 as unknown as { customPath: string }).customPath = 'dirA/file.txt';
      (file2 as unknown as { customPath: string }).customPath = 'dirB/file.txt';

      const manifest = buildFolderManifest([file1, file2]);
      const flat = flattenManifest(manifest);

      expect(flat.length).toBe(2);
      expect(flat[0].relativePath).toBe('dirA/file.txt');
      expect(flat[1].relativePath).toBe('dirB/file.txt');
      expect(flat[0].relativePath).not.toBe(flat[1].relativePath);
    });
  });

  describe('Zero-RAM Virtual Package Slicing', () => {
    it('slices virtual tar packages with exact byte precision', async () => {
      const payload1 = 'Content of file 1 in virtual tar';
      const payload2 = 'Content of file 2 in virtual tar';
      const file1 = new File([payload1], 'folder/one.txt', { type: 'text/plain' });
      const file2 = new File([payload2], 'folder/two.txt', { type: 'text/plain' });

      const pkg = new VirtualPackage([file1, file2]);
      const synthetic = pkg.toSyntheticFile();

      expect(synthetic.size).toBe(pkg.totalSize);

      // Read chunk spanning boundary
      const chunk = await synthetic.slice(0, 1024).arrayBuffer();
      expect(chunk.byteLength).toBe(1024);
    });
  });

  describe('Share URL Secret Privacy Audit', () => {
    it('strictly isolates the secret key in URL hash fragment and never in query params', () => {
      const shareCode = 'abc-xyz#9876';
      const shareUrl = generateShareUrl(shareCode);
      const url = new URL(shareUrl, 'https://mephistoshares.online');

      // Query param must ONLY contain public room ID
      expect(url.searchParams.get('room')).toBe('abc-xyz');
      // Hash fragment contains the secret key
      expect(url.hash).toBe('#9876');
      expect(shareUrl).not.toContain('room=abc-xyz%239876');

      // Parse room code roundtrip
      const parsed = parseRoomCode(shareUrl);
      expect(parsed).toBe('abc-xyz#9876');
    });
  });

  describe('Cryptographic Integrity & SHA-256 Verification (SUCCESS = verified)', () => {
    it('encrypts, decrypts and computes SHA-256 verification hash accurately', async () => {
      const secret = 'sec-ret#5555';
      const key = await deriveKey(secret);
      const data = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]).buffer;

      const encrypted = await encryptChunk(data, key);
      const decrypted = await decryptChunk(encrypted, key);

      expect(new Uint8Array(decrypted)).toEqual(new Uint8Array(data));

      const hashOriginal = await calculateSHA256(data);
      const hashDecrypted = await calculateSHA256(decrypted);
      expect(hashOriginal).toBe(hashDecrypted);
    });

    it('detects tampered payload and fails SHA-256 verification check', async () => {
      const originalData = new TextEncoder().encode('Original authentic payload').buffer;
      const tamperedData = new TextEncoder().encode('Malicious modified payload').buffer;

      const hashOriginal = await calculateSHA256(originalData);
      const hashTampered = await calculateSHA256(tamperedData);

      expect(hashOriginal).not.toBe(hashTampered);
      const isVerified = hashOriginal.toLowerCase() === hashTampered.toLowerCase();
      expect(isVerified).toBe(false);
    });
  });

  describe('Folder & Virtual Package Stream Boundary Limits', () => {
    it('resolves duplicate paths deterministically and enforces bounds on readSlice', async () => {
      const file1 = new File(['alpha'], 'sub/doc.txt', { type: 'text/plain' });
      const file2 = new File(['beta'], 'sub/doc.txt', { type: 'text/plain' });

      const pkg = new VirtualPackage([file1, file2]);
      expect(pkg.entries.length).toBe(2);
      expect(pkg.entries[0].relativePath).toBe('sub/doc.txt');
      expect(pkg.entries[1].relativePath).toBe('sub/doc (2).txt');

      // Invalid or out of bounds offsets return empty buffer
      const negSlice = await pkg.readSlice(-10, 100);
      expect(negSlice.byteLength).toBe(0);

      const oobSlice = await pkg.readSlice(pkg.totalSize + 500, 100);
      expect(oobSlice.byteLength).toBe(0);

      const zeroLenSlice = await pkg.readSlice(0, 0);
      expect(zeroLenSlice.byteLength).toBe(0);
    });
  });

  describe('Stream Compression & Decompression Pipeline', () => {
    it('compresses on sender, decrypts and decompresses to exact original byte length on receiver', async () => {
      const originalText = 'SELECT * FROM users WHERE id IN (1,2,3,4,5,6,7,8,9,10) AND active = 1; '.repeat(50);
      const originalBuffer = new TextEncoder().encode(originalText).buffer;
      const expectedSize = originalBuffer.byteLength;

      // 1. Sender: Compress & Encrypt
      const secret = 'room-sync#1234';
      const key = await deriveKey(secret);
      const compRes = await compressData(originalBuffer, 'deflate');
      expect(compRes.compressed).toBe(true);
      expect(compRes.buffer.byteLength).toBeLessThan(expectedSize);

      const encrypted = await encryptChunk(compRes.buffer, key);

      // 2. Receiver: Decrypt & Decompress
      const decrypted = await decryptChunk(encrypted, key);
      const decompressed = await decompressData(decrypted, 'deflate');

      // The receiver must store the decompressed rawBuffer, reaching exact original byte length!
      expect(decompressed.byteLength).toBe(expectedSize);
      const reconstructedText = new TextDecoder().decode(decompressed);
      expect(reconstructedText).toBe(originalText);

      // SHA-256 integrity seal must match original
      const hashOriginal = await calculateSHA256(originalBuffer);
      const hashReconstructed = await calculateSHA256(decompressed);
      expect(hashReconstructed).toBe(hashOriginal);
    });
  });
});
