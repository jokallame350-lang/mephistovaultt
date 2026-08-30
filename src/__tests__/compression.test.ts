import { describe, it, expect } from 'vitest';
import {
  isCompressibleFileType,
  compressData,
  decompressData,
} from '../lib/compression';

describe('Stream Compression Suite (MephistoVault)', () => {
  describe('isCompressibleFileType', () => {
    it('accurately detects compressible structured data & text by MIME type', () => {
      expect(isCompressibleFileType('text/plain')).toBe(true);
      expect(isCompressibleFileType('text/plain; charset=utf-8')).toBe(true);
      expect(isCompressibleFileType('text/html')).toBe(true);
      expect(isCompressibleFileType('text/css')).toBe(true);
      expect(isCompressibleFileType('text/csv')).toBe(true);
      expect(isCompressibleFileType('text/markdown')).toBe(true);
      expect(isCompressibleFileType('application/json')).toBe(true);
      expect(isCompressibleFileType('application/json; charset=utf-8')).toBe(true);
      expect(isCompressibleFileType('application/ld+json')).toBe(true);
      expect(isCompressibleFileType('application/xml')).toBe(true);
      expect(isCompressibleFileType('image/svg+xml')).toBe(true);
      expect(isCompressibleFileType('application/javascript')).toBe(true);
      expect(isCompressibleFileType('application/typescript')).toBe(true);
      expect(isCompressibleFileType('application/sql')).toBe(true);
      expect(isCompressibleFileType('application/x-sql')).toBe(true);
      expect(isCompressibleFileType('application/x-tar')).toBe(true);
      expect(isCompressibleFileType('application/yaml')).toBe(true);
      expect(isCompressibleFileType('application/x-yaml')).toBe(true);
      expect(isCompressibleFileType('application/x-sh')).toBe(true);
    });

    it('accurately detects compressible files by filename extension', () => {
      // Data & text files
      expect(isCompressibleFileType(undefined, 'database_dump.sql')).toBe(true);
      expect(isCompressibleFileType(undefined, 'users_export.json')).toBe(true);
      expect(isCompressibleFileType(undefined, 'metrics.log')).toBe(true);
      expect(isCompressibleFileType(undefined, 'transactions.csv')).toBe(true);
      expect(isCompressibleFileType(undefined, 'server_config.yaml')).toBe(true);
      expect(isCompressibleFileType(undefined, 'app_settings.toml')).toBe(true);
      expect(isCompressibleFileType(undefined, 'system.env')).toBe(true);
      expect(isCompressibleFileType(undefined, 'archive.tar')).toBe(false);

      // Code & scripts
      expect(isCompressibleFileType(undefined, 'App.tsx')).toBe(true);
      expect(isCompressibleFileType(undefined, 'utils.ts')).toBe(true);
      expect(isCompressibleFileType(undefined, 'main.py')).toBe(true);
      expect(isCompressibleFileType(undefined, 'lib.rs')).toBe(true);
      expect(isCompressibleFileType(undefined, 'server.go')).toBe(true);
      expect(isCompressibleFileType(undefined, 'program.c')).toBe(true);
      expect(isCompressibleFileType(undefined, 'deploy.sh')).toBe(true);
      expect(isCompressibleFileType(undefined, 'style.css')).toBe(true);
      expect(isCompressibleFileType(undefined, 'vector_graphic.svg')).toBe(true);

      // Special filenames
      expect(isCompressibleFileType(undefined, 'Dockerfile')).toBe(true);
      expect(isCompressibleFileType(undefined, '.gitignore')).toBe(true);
      expect(isCompressibleFileType(undefined, 'Makefile')).toBe(true);
    });

    it('correctly skips already compressed image, audio, video, and archive files', () => {
      // Images
      expect(isCompressibleFileType('image/jpeg', 'photo.jpg')).toBe(false);
      expect(isCompressibleFileType('image/jpeg', 'landscape.jpeg')).toBe(false);
      expect(isCompressibleFileType('image/png', 'icon.png')).toBe(false);
      expect(isCompressibleFileType('image/webp', 'preview.webp')).toBe(false);
      expect(isCompressibleFileType('image/gif', 'animation.gif')).toBe(false);
      expect(isCompressibleFileType('image/avif', 'banner.avif')).toBe(false);
      expect(isCompressibleFileType('image/heic', 'camera.heic')).toBe(false);

      // Audio
      expect(isCompressibleFileType('audio/mpeg', 'song.mp3')).toBe(false);
      expect(isCompressibleFileType('audio/aac', 'track.m4a')).toBe(false);
      expect(isCompressibleFileType('audio/flac', 'hifi.flac')).toBe(false);
      expect(isCompressibleFileType('audio/ogg', 'sound.ogg')).toBe(false);
      expect(isCompressibleFileType('audio/opus', 'voice.opus')).toBe(false);

      // Video
      expect(isCompressibleFileType('video/mp4', 'movie.mp4')).toBe(false);
      expect(isCompressibleFileType('video/webm', 'recording.webm')).toBe(false);
      expect(isCompressibleFileType('video/x-matroska', 'film.mkv')).toBe(false);
      expect(isCompressibleFileType('video/quicktime', 'clip.mov')).toBe(false);
      expect(isCompressibleFileType('video/x-msvideo', 'video.avi')).toBe(false);

      // Compressed Archives
      expect(isCompressibleFileType('application/zip', 'files.zip')).toBe(false);
      expect(isCompressibleFileType('application/gzip', 'data.gz')).toBe(false);
      expect(isCompressibleFileType('application/x-tar-gz', 'archive.tar.gz')).toBe(false);
      expect(isCompressibleFileType(undefined, 'backup.tar.gz')).toBe(false);
      expect(isCompressibleFileType(undefined, 'bundle.tgz')).toBe(false);
      expect(isCompressibleFileType('application/x-7z-compressed', 'archive.7z')).toBe(false);
      expect(isCompressibleFileType('application/x-rar-compressed', 'data.rar')).toBe(false);
      expect(isCompressibleFileType(undefined, 'package.apk')).toBe(false);

      // Pre-compressed document containers
      expect(isCompressibleFileType('application/pdf', 'document.pdf')).toBe(false);
      expect(isCompressibleFileType(undefined, 'document.docx')).toBe(false);
      expect(isCompressibleFileType(undefined, 'spreadsheet.xlsx')).toBe(false);
      expect(isCompressibleFileType(undefined, 'presentation.pptx')).toBe(false);
    });

    it('handles edge cases and unspecified types safely', () => {
      expect(isCompressibleFileType(undefined, undefined)).toBe(false);
      expect(isCompressibleFileType('', '')).toBe(false);
      expect(isCompressibleFileType('application/octet-stream', 'unknown_blob')).toBe(false);
      expect(isCompressibleFileType('application/octet-stream', 'data.sql')).toBe(true);
    });
  });

  describe('compressData & decompressData', () => {
    it('achieves >60% compression reduction on realistic SQL dump data', async () => {
      const sqlRows: string[] = [];
      for (let i = 1; i <= 200; i++) {
        sqlRows.push(
          `INSERT INTO "public"."users" ("id", "username", "email", "created_at", "role", "metadata") VALUES (${i}, 'user_${i}', 'developer_${i}@mephisto.vault', '2026-08-30 19:40:00+00', 'authenticated', '{"vault_id":"v-${i * 100}","status":"active","tier":"enterprise"}');`
        );
      }
      const sqlText = sqlRows.join('\n');
      const encoder = new TextEncoder();
      const sqlBytes = encoder.encode(sqlText);

      expect(sqlBytes.byteLength).toBeGreaterThan(15000); // ~35KB

      const result = await compressData(sqlBytes, 'gzip');

      expect(result.compressed).toBe(true);
      expect(result.originalSize).toBe(sqlBytes.byteLength);
      expect(result.compressedSize).toBeLessThan(sqlBytes.byteLength);
      // Verify >60% reduction (compressed size is less than 40% of original, savings > 60%)
      expect(result.savingsPercent).toBeGreaterThan(60);
      expect(result.ratio).toBeLessThan(0.4);

      // Bit-exact roundtrip verification
      const decompressed = await decompressData(result.buffer, 'gzip');
      const decoder = new TextDecoder();
      const reconstructedText = decoder.decode(decompressed);

      expect(reconstructedText).toBe(sqlText);
      expect(new Uint8Array(decompressed)).toEqual(sqlBytes);
    });

    it('achieves >60% compression reduction on realistic JSON telemetry payload', async () => {
      const jsonRecords = Array.from({ length: 150 }, (_, i) => ({
        eventId: `evt-${i.toString().padStart(6, '0')}`,
        timestamp: 1788118800 + i * 10,
        node: `vault-node-${(i % 10) + 1}.p2p.internal`,
        action: 'CHUNK_TRANSFER_VERIFIED',
        metrics: {
          chunkIndex: i,
          byteSize: 262144,
          rttMs: 14.5 + (i % 5),
          verifiedSha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
        },
        flags: ['ZERO_TRACE', 'ENCRYPTED', 'WEBRTC_PIPELINED'],
      }));

      const jsonText = JSON.stringify(jsonRecords, null, 2);
      const encoder = new TextEncoder();
      const jsonBytes = encoder.encode(jsonText);

      const result = await compressData(jsonBytes, 'gzip');

      expect(result.compressed).toBe(true);
      expect(result.savingsPercent).toBeGreaterThan(60);
      expect(result.ratio).toBeLessThan(0.4);

      // Lossless roundtrip reconstruction
      const decompressed = await decompressData(result.buffer, 'gzip');
      const decoder = new TextDecoder();
      const parsed = JSON.parse(decoder.decode(decompressed));

      expect(parsed).toEqual(jsonRecords);
    });

    it('achieves >60% compression reduction on structured application log data', async () => {
      const logLines: string[] = [];
      for (let i = 1; i <= 300; i++) {
        logLines.push(
          `[2026-08-30T19:40:${(i % 60).toString().padStart(2, '0')}.123Z] [INFO] [SwarmCoordinator:Worker-${i % 8}] Peer mephisto-p2p-${i % 16} completed hash verification for chunk ${i} (262144 bytes) via WebRTC DataChannel [STATUS=OK]`
        );
      }
      const logText = logLines.join('\n');
      const encoder = new TextEncoder();
      const logBytes = encoder.encode(logText);

      const result = await compressData(logBytes, 'gzip');

      expect(result.compressed).toBe(true);
      expect(result.savingsPercent).toBeGreaterThan(60);
      expect(result.ratio).toBeLessThan(0.4);

      // Verify exact decompression
      const decompressed = await decompressData(result.buffer, 'gzip');
      const decoder = new TextDecoder();
      expect(decoder.decode(decompressed)).toBe(logText);
    });

    it('supports both gzip and deflate formats losslessly', async () => {
      const payload = new TextEncoder().encode(
        'MephistoVault Zero-Trace Peer-to-Peer Encrypted Data Pipeline '.repeat(100)
      );

      // Gzip test
      const gzipResult = await compressData(payload, 'gzip');
      expect(gzipResult.compressed).toBe(true);
      const gzipDecompressed = await decompressData(gzipResult.buffer, 'gzip');
      expect(new Uint8Array(gzipDecompressed)).toEqual(payload);

      // Deflate test
      const deflateResult = await compressData(payload, 'deflate');
      expect(deflateResult.compressed).toBe(true);
      const deflateDecompressed = await decompressData(deflateResult.buffer, 'deflate');
      expect(new Uint8Array(deflateDecompressed)).toEqual(payload);
    });

    it('handles binary data and Uint8Array views with byteOffset correctly', async () => {
      const parentBuffer = new Uint8Array(2000);
      for (let i = 0; i < parentBuffer.length; i++) {
        parentBuffer[i] = (i % 256);
      }

      const offsetView = new Uint8Array(parentBuffer.buffer, 100, 1500);
      const result = await compressData(offsetView);
      const decompressed = await decompressData(result.buffer);

      expect(new Uint8Array(decompressed)).toEqual(offsetView);
    });

    it('handles empty buffers cleanly without errors', async () => {
      const empty = new Uint8Array(0);
      const result = await compressData(empty);
      expect(result.compressed).toBe(false);
      expect(result.originalSize).toBe(0);

      const decompressed = await decompressData(result.buffer);
      expect(decompressed.byteLength).toBe(0);
    });

    it('preserves multi-byte Unicode strings and emojis across roundtrips', async () => {
      const unicodeContent = '🔐 MephistoVault 🚀 — 零痕迹 端到端加密 ⚡️ 100% 🔒 こんにちは 세계 🌍 '.repeat(50);
      const bytes = new TextEncoder().encode(unicodeContent);

      const compressed = await compressData(bytes);
      const decompressed = await decompressData(compressed.buffer);
      const decoded = new TextDecoder().decode(decompressed);

      expect(decoded).toBe(unicodeContent);
    });
  });
});
