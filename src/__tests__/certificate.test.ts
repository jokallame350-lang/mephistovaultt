import { describe, it, expect } from 'vitest';
import {
  generateDeliveryCertificate,
  exportCertificateAsHTML,
  sha256Sync,
  formatDuration,
  generateCertificateId,
  type DeliveryCertificate,
} from '../lib/certificate';

describe('Cryptographic Proof of Delivery & Certificate Engine', () => {
  describe('sha256Sync', () => {
    it('produces standard SHA-256 digest for empty string', () => {
      const hash = sha256Sync('');
      expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    it('produces standard SHA-256 digest for "hello world"', () => {
      const hash = sha256Sync('hello world');
      expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
    });

    it('produces standard SHA-256 digest for UTF-8 inputs', () => {
      const hash = sha256Sync('MephistoVault-2026-🚀');
      expect(hash).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
    });
  });

  describe('formatDuration', () => {
    it('formats millisecond durations correctly', () => {
      expect(formatDuration(450)).toBe('450 ms');
      expect(formatDuration(0)).toBe('1 ms');
    });

    it('formats second durations correctly', () => {
      expect(formatDuration(1500)).toBe('1.50 s');
      expect(formatDuration(10240)).toBe('10.24 s');
    });
  });

  describe('generateCertificateId', () => {
    it('generates a structured MV-CERT ID', () => {
      const id = generateCertificateId('abcdef1234567890', 1700000000000);
      expect(id).toMatch(/^MV-CERT-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
    });
  });

  describe('generateDeliveryCertificate', () => {
    it('generates a complete, valid DeliveryCertificate object', () => {
      const transferData = {
        fileName: 'classified-blueprint.pdf',
        fileSize: 4194304, // 4 MB
        sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
        transferDurationMs: 850,
        cipher: 'AES-256-GCM / WebRTC DTLS',
        senderId: 'PEER-SENDER-001',
        receiverId: 'PEER-RECEIVER-999',
      };

      const cert = generateDeliveryCertificate(transferData);

      expect(cert).toBeDefined();
      expect(cert.certificateId).toMatch(/^MV-CERT-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
      expect(cert.fileName).toBe('classified-blueprint.pdf');
      expect(cert.fileSize).toBe(4194304);
      expect(cert.fileSizeFormatted).toBe('4 MB');
      expect(cert.sha256).toBe(transferData.sha256);
      expect(cert.transferDurationMs).toBe(850);
      expect(cert.transferDurationFormatted).toBe('850 ms');
      expect(cert.cipher).toBe('AES-256-GCM / WebRTC DTLS');
      expect(cert.senderId).toBe('PEER-SENDER-001');
      expect(cert.receiverId).toBe('PEER-RECEIVER-999');
      expect(cert.protocol).toBe('WebRTC E2E Direct Memory Pipe');
      expect(cert.status).toBe('DELIVERED_AND_VERIFIED');
      expect(cert.verificationSeal).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(cert.verificationSeal)).toBe(true);
      expect(cert.timestamp).toBeDefined();
      expect(cert.timestampUnix).toBeGreaterThan(0);
    });

    it('generates a valid QR payload JSON string', () => {
      const cert = generateDeliveryCertificate({
        fileName: 'secret.txt',
        fileSize: 128,
        sha256: 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e',
        transferDurationMs: 120,
        cipher: 'AES-256-GCM',
      });

      expect(cert.qrPayload).toBeDefined();
      const parsed = JSON.parse(cert.qrPayload);
      expect(parsed.app).toBe('MephistoVault');
      expect(parsed.name).toBe('secret.txt');
      expect(parsed.size).toBe(128);
      expect(parsed.sha256).toBe(cert.sha256);
      expect(parsed.seal).toBe(cert.verificationSeal);
    });

    it('handles missing optional senderId, receiverId, and defaults cipher', () => {
      const cert = generateDeliveryCertificate({
        fileName: 'data.bin',
        fileSize: 1024,
        sha256: '1234567890abcdef',
        transferDurationMs: 200,
        cipher: '',
      });

      expect(cert.senderId).toBeUndefined();
      expect(cert.receiverId).toBeUndefined();
      expect(cert.cipher).toBe('AES-256-GCM / WebRTC DTLS');
    });

    it('produces tamper-evident seals (different parameters yield different seals)', () => {
      const cert1 = generateDeliveryCertificate({
        fileName: 'contract_v1.pdf',
        fileSize: 1000,
        sha256: 'aaaa1111',
        transferDurationMs: 500,
        cipher: 'AES-256-GCM',
      });

      const cert2 = generateDeliveryCertificate({
        fileName: 'contract_v1.pdf',
        fileSize: 1001, // 1 byte modified
        sha256: 'aaaa1111',
        transferDurationMs: 500,
        cipher: 'AES-256-GCM',
      });

      expect(cert1.verificationSeal).not.toBe(cert2.verificationSeal);
    });
  });

  describe('exportCertificateAsHTML', () => {
    it('exports a valid standalone HTML document containing all transfer metadata', () => {
      const cert: DeliveryCertificate = {
        certificateId: 'MV-CERT-A1B2-C3D4-E5F6',
        timestamp: '2026-08-30T16:30:00.000Z',
        timestampUnix: 1788107400000,
        fileName: 'project-mephisto-schematic.zip',
        fileSize: 10485760,
        fileSizeFormatted: '10 MB',
        sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
        transferDurationMs: 1250,
        transferDurationFormatted: '1.25 s',
        cipher: 'AES-256-GCM / WebRTC DTLS-SRTP',
        senderId: 'ORIGIN-TERMINAL-01',
        receiverId: 'DEST-TERMINAL-09',
        protocol: 'WebRTC E2E Direct Memory Pipe',
        status: 'DELIVERED_AND_VERIFIED',
        verificationSeal: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        qrPayload: '{"test":true}',
      };

      const html = exportCertificateAsHTML(cert);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('MV-CERT-A1B2-C3D4-E5F6');
      expect(html).toContain('project-mephisto-schematic.zip');
      expect(html).toContain('10 MB');
      expect(html).toContain('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
      expect(html).toContain('AES-256-GCM / WebRTC DTLS-SRTP');
      expect(html).toContain('ORIGIN-TERMINAL-01');
      expect(html).toContain('DEST-TERMINAL-09');
      expect(html).toContain('Cryptographic Certificate of Delivery');
      expect(html).toContain('window.print()');
      expect(html).toContain('@media print');
    });

    it('escapes malicious XSS vectors in fileName and IDs', () => {
      const maliciousCert: DeliveryCertificate = {
        certificateId: '<script>alert("hack")</script>',
        timestamp: '2026-08-30T16:30:00.000Z',
        timestampUnix: 1788107400000,
        fileName: '"><img src=x onerror=alert(1)>safe.pdf',
        fileSize: 500,
        fileSizeFormatted: '500 B',
        sha256: '12345',
        transferDurationMs: 100,
        transferDurationFormatted: '100 ms',
        cipher: 'AES-256-GCM',
        senderId: '<b>evil-sender</b>',
        receiverId: '<i>evil-receiver</i>',
        protocol: 'WebRTC E2E Direct Memory Pipe',
        status: 'DELIVERED_AND_VERIFIED',
        verificationSeal: '67890',
        qrPayload: '{}',
      };

      const html = exportCertificateAsHTML(maliciousCert);

      expect(html).not.toContain('<script>alert("hack")</script>');
      expect(html).toContain('&lt;script&gt;alert(&quot;hack&quot;)&lt;/script&gt;');
      expect(html).not.toContain('<img src=x onerror=alert(1)>');
      expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
      expect(html).not.toContain('<b>evil-sender</b>');
      expect(html).toContain('&lt;b&gt;evil-sender&lt;/b&gt;');
    });
  });
});
