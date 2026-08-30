/**
 * Stream Compression Module for MephistoVault
 * High-performance, zero-trace P2P compression using browser-native CompressionStream & DecompressionStream APIs.
 */

export type CompressionFormat = 'gzip' | 'deflate';

export interface CompressionResult {
  buffer: ArrayBuffer;
  ratio: number; // compressedSize / originalSize (e.g., 0.05 = compressed is 5% of original size)
  compressed: boolean; // true if compression actually reduced the payload size
  originalSize: number;
  compressedSize: number;
  savingsPercent: number; // percentage saved, e.g., 95.0 for 95% reduction
}

// ── File Type Classifications ──

/** File extensions that are already compressed and should NOT be re-compressed */
const NON_COMPRESSIBLE_EXTENSIONS = new Set([
  // Images
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'heic', 'heif', 'ico', 'cur', 'tif', 'tiff', 'psd', 'raw', 'cr2', 'nef',
  // Audio
  'mp3', 'm4a', 'aac', 'flac', 'ogg', 'oga', 'opus', 'wav', 'wma', 'alac', 'mid', 'midi',
  // Video (excluding .ts/.mts to avoid collision with TypeScript source files)
  'mp4', 'mkv', 'webm', 'avi', 'mov', 'wmv', 'flv', 'm4v', '3gp', '3g2', 'm2ts', 'vob', 'ogv',
  // Compressed archives & packages
  'zip', 'gz', 'gzip', 'tgz', 'bz2', 'tbz2', 'xz', 'txz', '7z', 'rar', 'zst', 'zstd', 'br', 'apk', 'ipa', 'jar', 'war', 'ear', 'dmg', 'iso', 'img', 'deb', 'rpm', 'pkg', 'cab', 'z',
  // Compressed documents / containers
  'pdf', 'docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp', 'epub', 'cbz', 'cbr',
]);

/** File extensions that are plain text, code, structured data, or uncompressed archives */
const COMPRESSIBLE_EXTENSIONS = new Set([
  // Text & Docs
  'txt', 'md', 'markdown', 'mdown', 'mkdn', 'rst', 'adoc', 'asciidoc', 'rtf', 'csv', 'tsv', 'tab', 'log', 'sql', 'dump', 'db', 'conf', 'cfg', 'config', 'ini', 'env', 'properties', 'yaml', 'yml', 'toml', 'tex', 'bib', 'nfo', 'srt', 'vtt',
  // Web & Markup
  'html', 'htm', 'xhtml', 'xml', 'xsl', 'xslt', 'svg', 'css', 'scss', 'sass', 'less', 'styl', 'json', 'json5', 'jsonc', 'geojson', 'proto', 'graphql', 'gql',
  // Code & Scripts
  'js', 'mjs', 'cjs', 'jsx', 'ts', 'mts', 'cts', 'tsx', 'py', 'pyw', 'pyi', 'rb', 'rs', 'go', 'c', 'h', 'cpp', 'hpp', 'cc', 'cxx', 'hxx', 'cs', 'java', 'kt', 'kts', 'swift', 'dart', 'php', 'sh', 'bash', 'zsh', 'fish', 'ps1', 'psm1', 'bat', 'cmd', 'lua', 'pl', 'pm', 'r', 'scala', 'erl', 'ex', 'exs', 'clj', 'cljs', 'cljc', 'zig', 'nim', 'v', 'asm', 's', 'hs', 'lhs', 'sol', 'dockerfile', 'dockerignore', 'gitignore', 'gitattributes', 'editorconfig', 'diff', 'patch', 'cmake', 'makefile', 'mk', 'gradle',
  // Uncompressed archives
  'tar',
]);

/** Special exact filenames that are compressible */
const COMPRESSIBLE_SPECIAL_FILES = new Set([
  'dockerfile', 'dockerignore', 'gitignore', 'gitattributes', 'editorconfig', 'makefile', 'gemfile', 'procfile', 'license', 'licence', 'readme', 'changelog',
]);

/**
 * Determine if a file is compressible based on its MIME type and/or filename.
 * Accurately detects text, code, JSON, SQL, CSV, logs, XML, TAR, etc., while skipping
 * media (JPEG, PNG, MP4, MP3) and compressed archives (ZIP, GZ, 7Z, RAR).
 *
 * @param mimeType - Optional MIME type (e.g. "application/json", "image/png", "text/plain; charset=utf-8")
 * @param fileName - Optional filename (e.g. "dump.sql", "archive.tar.gz")
 * @returns boolean indicating whether stream compression is beneficial
 */
export function isCompressibleFileType(mimeType?: string, fileName?: string): boolean {
  const rawMime = mimeType?.trim().toLowerCase() || '';
  const cleanMime = rawMime.split(';')[0].trim();
  const cleanFileName = fileName?.trim().toLowerCase() || '';

  // 1. Check MIME type if provided
  if (cleanMime) {
    // SVG is image/svg+xml and is compressible XML text
    if (cleanMime === 'image/svg+xml' || cleanMime.includes('svg')) {
      return true;
    }

    // Media & compressed MIME types to skip
    if (
      cleanMime.startsWith('image/') ||
      cleanMime.startsWith('video/') ||
      cleanMime.startsWith('audio/') ||
      cleanMime === 'application/zip' ||
      cleanMime === 'application/x-zip-compressed' ||
      cleanMime === 'application/gzip' ||
      cleanMime === 'application/x-gzip' ||
      cleanMime === 'application/x-bzip2' ||
      cleanMime === 'application/x-xz' ||
      cleanMime === 'application/x-7z-compressed' ||
      cleanMime === 'application/x-rar-compressed' ||
      cleanMime === 'application/vnd.rar' ||
      cleanMime === 'application/pdf' ||
      cleanMime === 'application/epub+zip' ||
      cleanMime.startsWith('application/vnd.openxmlformats-officedocument.')
    ) {
      return false;
    }

    // Explicitly compressible MIME types
    if (
      cleanMime.startsWith('text/') ||
      cleanMime.endsWith('+json') ||
      cleanMime.endsWith('+xml') ||
      cleanMime.endsWith('+yaml') ||
      cleanMime.endsWith('+text') ||
      cleanMime === 'application/json' ||
      cleanMime === 'application/xml' ||
      cleanMime === 'application/javascript' ||
      cleanMime === 'application/x-javascript' ||
      cleanMime === 'application/typescript' ||
      cleanMime === 'application/x-typescript' ||
      cleanMime === 'application/sql' ||
      cleanMime === 'application/x-sql' ||
      cleanMime === 'application/yaml' ||
      cleanMime === 'application/x-yaml' ||
      cleanMime === 'application/csv' ||
      cleanMime === 'application/x-csv' ||
      cleanMime === 'application/x-tar' ||
      cleanMime === 'application/rtf' ||
      cleanMime === 'application/graphql' ||
      cleanMime === 'application/x-sh' ||
      cleanMime === 'application/x-bash'
    ) {
      return true;
    }
  }

  // 2. Check filename / extension if provided
  if (cleanFileName) {
    // Strip query strings or hash if passed from URL
    const baseName = cleanFileName.split('?')[0].split('#')[0].replace(/^.*[\\/]/, '');

    // Check special filenames (e.g. "Dockerfile", ".gitignore", "Makefile")
    const lowerBase = baseName.startsWith('.') ? baseName.substring(1) : baseName;
    if (COMPRESSIBLE_SPECIAL_FILES.has(lowerBase) || COMPRESSIBLE_EXTENSIONS.has(lowerBase)) {
      return true;
    }

    // Compound extension check (e.g., "tar.gz", "tar.bz2")
    const parts = baseName.split('.');
    if (parts.length > 1) {
      const ext = parts[parts.length - 1];
      if (NON_COMPRESSIBLE_EXTENSIONS.has(ext)) {
        return false;
      }
      if (COMPRESSIBLE_EXTENSIONS.has(ext)) {
        return true;
      }
    }
  }

  // If MIME type was text/* or known compressible, it already returned true above.
  // Unknown generic types (e.g. application/octet-stream with no filename match) return false.
  return false;
}

/**
 * Helper to consume a ReadableStream<Uint8Array> into a single ArrayBuffer.
 * Handles environments with or without Response API, preventing stream deadlocks.
 */
async function streamToArrayBuffer(stream: ReadableStream<Uint8Array>): Promise<ArrayBuffer> {
  if (typeof Response !== 'undefined') {
    try {
      const response = new Response(stream);
      return await response.arrayBuffer();
    } catch {
      // Fallback to manual stream reader if Response stream constructor fails
    }
  }

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        totalLength += value.byteLength;
      }
    }
  } finally {
    reader.releaseLock();
  }

  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result.buffer as ArrayBuffer;
}

/**
 * Compress an ArrayBuffer or Uint8Array using browser-native CompressionStream ('gzip' | 'deflate').
 * Includes Node.js fallback and full stream deadlock protection.
 *
 * @param data - Raw binary data or TypedArray to compress
 * @param format - Compression algorithm: 'gzip' (default) or 'deflate'
 * @returns CompressionResult with compressed buffer, ratio, reduction percentage, and compressed flag
 */
export async function compressData(
  data: ArrayBuffer | Uint8Array,
  format: CompressionFormat = 'gzip',
): Promise<CompressionResult> {
  const inputBytes =
    data instanceof Uint8Array
      ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      : new Uint8Array(data);

  const originalSize = inputBytes.byteLength;

  if (originalSize === 0) {
    return {
      buffer: new ArrayBuffer(0),
      ratio: 1,
      compressed: false,
      originalSize: 0,
      compressedSize: 0,
      savingsPercent: 0,
    };
  }

  // 1. Native Web Streams CompressionStream (Browser & Modern Node.js)
  if (typeof CompressionStream !== 'undefined') {
    try {
      const cs = new CompressionStream(format);
      const writer = cs.writable.getWriter() as WritableStreamDefaultWriter<unknown>;

      const writePromise = (async () => {
        try {
          await writer.write(inputBytes);
          await writer.close();
        } catch (err) {
          try {
            await writer.abort(err);
          } catch {
            // Ignore secondary abort errors
          }
          throw err;
        }
      })();

      const [compressedBuffer] = await Promise.all([
        streamToArrayBuffer(cs.readable),
        writePromise,
      ]);

      const compressedSize = compressedBuffer.byteLength;
      const ratio = originalSize > 0 ? compressedSize / originalSize : 1;
      const savingsPercent = originalSize > 0 ? Math.max(0, ((originalSize - compressedSize) / originalSize) * 100) : 0;
      const isSmaller = compressedSize < originalSize;

      return {
        buffer: compressedBuffer,
        ratio: Number(ratio.toFixed(4)),
        compressed: isSmaller,
        originalSize,
        compressedSize,
        savingsPercent: Number(savingsPercent.toFixed(2)),
      };
    } catch {
      // Fall through to Node.js / fallback
    }
  }

  // 2. Node.js environment fallback if CompressionStream is absent
  try {
    if (typeof process !== 'undefined' && process.versions?.node) {
      const zlibPkg = 'node:zlib';
      const zlib = await import(/* @vite-ignore */ zlibPkg);
      const buf = Buffer.from(inputBytes.buffer, inputBytes.byteOffset, inputBytes.byteLength);
      const compressedBuffer = await new Promise<Buffer>((resolve, reject) => {
        if (format === 'deflate') {
          zlib.deflate(buf, (err, res) => (err ? reject(err) : resolve(res)));
        } else {
          zlib.gzip(buf, (err, res) => (err ? reject(err) : resolve(res)));
        }
      });

      const ab = compressedBuffer.buffer.slice(
        compressedBuffer.byteOffset,
        compressedBuffer.byteOffset + compressedBuffer.byteLength,
      ) as ArrayBuffer;
      const compressedSize = ab.byteLength;
      const ratio = originalSize > 0 ? compressedSize / originalSize : 1;
      const savingsPercent = originalSize > 0 ? Math.max(0, ((originalSize - compressedSize) / originalSize) * 100) : 0;

      return {
        buffer: ab,
        ratio: Number(ratio.toFixed(4)),
        compressed: compressedSize < originalSize,
        originalSize,
        compressedSize,
        savingsPercent: Number(savingsPercent.toFixed(2)),
      };
    }
  } catch {
    // Ignore and fallback
  }

  // 3. Fallback: uncompressed clone
  const uncompressedCopy = inputBytes.slice().buffer as ArrayBuffer;
  return {
    buffer: uncompressedCopy,
    ratio: 1,
    compressed: false,
    originalSize,
    compressedSize: originalSize,
    savingsPercent: 0,
  };
}

/**
 * Decompress an ArrayBuffer or Uint8Array using browser-native DecompressionStream ('gzip' | 'deflate').
 *
 * @param data - Compressed binary data
 * @param format - Decompression algorithm: 'gzip' (default) or 'deflate'
 * @returns Reconstructed original ArrayBuffer
 */
export async function decompressData(
  data: ArrayBuffer | Uint8Array,
  format: CompressionFormat = 'gzip',
): Promise<ArrayBuffer> {
  const inputBytes =
    data instanceof Uint8Array
      ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      : new Uint8Array(data);

  if (inputBytes.byteLength === 0) {
    return new ArrayBuffer(0);
  }

  // 1. Native Web Streams DecompressionStream (Browser & Modern Node.js)
  if (typeof DecompressionStream !== 'undefined') {
    try {
      const ds = new DecompressionStream(format);
      const writer = ds.writable.getWriter() as WritableStreamDefaultWriter<unknown>;

      const writePromise = (async () => {
        try {
          await writer.write(inputBytes);
          await writer.close();
        } catch (err) {
          try {
            await writer.abort(err);
          } catch {
            // Ignore secondary abort errors
          }
          throw err;
        }
      })();

      const [decompressedBuffer] = await Promise.all([
        streamToArrayBuffer(ds.readable),
        writePromise,
      ]);

      return decompressedBuffer;
    } catch {
      // Fall through to Node.js / raw fallback
    }
  }

  // 2. Node.js environment fallback
  try {
    if (typeof process !== 'undefined' && process.versions?.node) {
      const zlibPkg = 'node:zlib';
      const zlib = await import(/* @vite-ignore */ zlibPkg);
      const buf = Buffer.from(inputBytes.buffer, inputBytes.byteOffset, inputBytes.byteLength);
      const decompressedBuffer = await new Promise<Buffer>((resolve, reject) => {
        if (format === 'deflate') {
          zlib.inflate(buf, (err, res) => (err ? reject(err) : resolve(res)));
        } else {
          zlib.gunzip(buf, (err, res) => (err ? reject(err) : resolve(res)));
        }
      });

      return decompressedBuffer.buffer.slice(
        decompressedBuffer.byteOffset,
        decompressedBuffer.byteOffset + decompressedBuffer.byteLength,
      ) as ArrayBuffer;
    }
  } catch {
    // Ignore and fallback
  }

  throw new Error('DecompressionStream is not supported in this environment.');
}
