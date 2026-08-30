/**
 * MephistoVault High-Performance Virtual Package Streamer
 * Eliminates in-memory ZIP bloat (0 MB RAM, 0% CPU lockup) for multi-gigabyte, multi-thousand file folders.
 * Streams files on-demand using zero-copy File.slice() with POSIX UStar TAR encapsulation.
 */

import type { FileWithCustomPath } from '../types';
import { sanitizePath } from './folderManifest';

export interface VirtualFileEntry {
  file: File;
  relativePath: string;
  size: number;
  headerOffset: number;
  dataOffset: number;
  padSize: number;
  entryTotalSize: number;
  headerBuffer: Uint8Array;
}

export interface VirtualPackageInfo {
  totalSize: number;
  fileCount: number;
  entries: VirtualFileEntry[];
  packageName: string;
}

/**
 * Encodes an ASCII/UTF-8 string into a fixed-size byte buffer.
 */
function encodeStringToBuffer(str: string, length: number): Uint8Array {
  const buf = new Uint8Array(length);
  const encoded = new TextEncoder().encode(str);
  buf.set(encoded.subarray(0, length));
  return buf;
}

/**
 * Formats a number as an octal string padded with leading zeros and terminated with a null byte.
 */
function toOctalString(value: number, length: number): string {
  const octal = value.toString(8);
  const padded = octal.padStart(length - 1, '0');
  return padded + '\0';
}

/**
 * Creates a standard 512-byte POSIX UStar TAR header for a file entry.
 */
function createTarHeader(relativePath: string, size: number, mtime: number): Uint8Array {
  const header = new Uint8Array(512);

  // Split long path if > 100 bytes (using UStar prefix if <= 255 chars)
  let name = relativePath;
  let prefix = '';

  if (name.length > 100) {
    const slashIdx = name.lastIndexOf('/', 154);
    if (slashIdx > 0 && slashIdx < 155) {
      prefix = name.substring(0, slashIdx);
      name = name.substring(slashIdx + 1);
    }
  }

  // 1. File name (0..99)
  header.set(encodeStringToBuffer(name.substring(0, 100), 100), 0);

  // 2. File mode (100..107) -> 0644
  header.set(encodeStringToBuffer('0000644\0', 8), 100);

  // 3. UID (108..115) -> 0
  header.set(encodeStringToBuffer('0000000\0', 8), 108);

  // 4. GID (116..123) -> 0
  header.set(encodeStringToBuffer('0000000\0', 8), 116);

  // 5. Size (124..135) -> 11 octal digits + null
  header.set(encodeStringToBuffer(toOctalString(size, 12), 12), 124);

  // 6. MTime (136..147) -> Unix epoch seconds in octal
  const mtimeSec = Math.floor(mtime / 1000);
  header.set(encodeStringToBuffer(toOctalString(mtimeSec, 12), 12), 136);

  // 7. Checksum placeholder (148..155) -> 8 spaces for initial checksum calculation
  header.fill(32, 148, 156);

  // 8. Typeflag (156) -> '0' (Regular file)
  header[156] = 48; // '0'

  // 9. UStar Magic (257..264) -> "ustar\0" + "00"
  header.set(encodeStringToBuffer('ustar\0', 6), 257);
  header.set(encodeStringToBuffer('00', 2), 263);

  // 10. Prefix (345..499)
  if (prefix) {
    header.set(encodeStringToBuffer(prefix.substring(0, 155), 155), 345);
  }

  // Calculate Checksum (sum of all 512 bytes with checksum field treated as spaces)
  let chksum = 0;
  for (let i = 0; i < 512; i++) {
    chksum += header[i];
  }

  // Write checksum into header (148..155) -> 6 octal digits + null + space
  const chksumStr = chksum.toString(8).padStart(6, '0') + '\0 ';
  header.set(encodeStringToBuffer(chksumStr, 8), 148);

  return header;
}

export const MAX_VIRTUAL_FILES = 100_000;
export const MAX_VIRTUAL_ENTRY_PATH_LEN = 255;

/**
 * Virtual Package Class
 * Simulates a continuous multi-gigabyte file without pre-allocating RAM or compressing upfront.
 */
export class VirtualPackage {
  public readonly totalSize: number;
  public readonly fileCount: number;
  public readonly name: string;
  public readonly entries: VirtualFileEntry[] = [];
  private readonly endPaddingSize = 1024; // 2 x 512-byte zero blocks at TAR end

  constructor(files: File[], customPackageName?: string) {
    if (files.length > MAX_VIRTUAL_FILES) {
      throw new Error(`File count exceeds maximum allowed virtual package limit (${MAX_VIRTUAL_FILES})`);
    }

    this.fileCount = files.length;
    this.name =
      customPackageName ||
      `mephisto-vault-package-${files.length}-files-${Math.floor(Date.now() / 1000)}.tar`;

    let currentOffset = 0;
    const usedPaths = new Set<string>();

    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      const rawPath =
        (file as FileWithCustomPath).customPath ||
        (file.webkitRelativePath && file.webkitRelativePath.includes('/')
          ? file.webkitRelativePath
          : file.name);

      let relativePath = sanitizePath(rawPath);
      if (relativePath.length > MAX_VIRTUAL_ENTRY_PATH_LEN) {
        relativePath = relativePath.substring(relativePath.length - MAX_VIRTUAL_ENTRY_PATH_LEN);
      }

      // Resolve duplicate paths deterministically
      if (usedPaths.has(relativePath)) {
        const dotIdx = relativePath.lastIndexOf('.');
        if (dotIdx !== -1) {
          relativePath = `${relativePath.slice(0, dotIdx)} (${index + 1})${relativePath.slice(dotIdx)}`;
        } else {
          relativePath = `${relativePath} (${index + 1})`;
        }
      }
      usedPaths.add(relativePath);

      const rawSize = file.size;
      const size = typeof rawSize === 'number' && isFinite(rawSize) && rawSize >= 0 ? rawSize : 0;
      const mtime = file.lastModified || Date.now();

      const headerBuffer = createTarHeader(relativePath, size, mtime);
      const padSize = (512 - (size % 512)) % 512;
      const entryTotalSize = 512 + size + padSize;

      this.entries.push({
        file,
        relativePath,
        size,
        headerOffset: currentOffset,
        dataOffset: currentOffset + 512,
        padSize,
        entryTotalSize,
        headerBuffer,
      });

      currentOffset += entryTotalSize;
    }

    this.totalSize = currentOffset + this.endPaddingSize;
  }

  /**
   * Reads a slice from the virtual tar archive on-demand.
   * Only the requested chunk (e.g. 64KB - 256KB) is loaded from disk into memory.
   */
  public async readSlice(offset: number, length: number): Promise<ArrayBuffer> {
    if (
      typeof offset !== 'number' ||
      isNaN(offset) ||
      offset < 0 ||
      offset >= this.totalSize ||
      typeof length !== 'number' ||
      isNaN(length) ||
      length <= 0
    ) {
      return new ArrayBuffer(0);
    }

    const actualLength = Math.min(length, this.totalSize - offset);
    const result = new Uint8Array(actualLength);
    const endOffset = offset + actualLength;

    // Find overlapping entries using binary search
    let low = 0;
    let high = this.entries.length - 1;
    let startIdx = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const entry = this.entries[mid];
      if (entry.headerOffset + entry.entryTotalSize > offset) {
        startIdx = mid;
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    for (let i = startIdx; i < this.entries.length; i++) {
      const entry = this.entries[i];
      if (entry.headerOffset >= endOffset) {
        break; // Past requested slice range
      }

      // 1. Copy Header bytes if in range
      const headerStart = entry.headerOffset;
      const headerEnd = headerStart + 512;
      if (offset < headerEnd && endOffset > headerStart) {
        const sliceStart = Math.max(0, offset - headerStart);
        const sliceEnd = Math.min(512, endOffset - headerStart);
        const targetStart = Math.max(0, headerStart - offset);
        result.set(entry.headerBuffer.subarray(sliceStart, sliceEnd), targetStart);
      }

      // 2. Copy File Data bytes if in range
      const dataStart = entry.dataOffset;
      const dataEnd = dataStart + entry.size;
      if (offset < dataEnd && endOffset > dataStart && entry.size > 0) {
        const fileSliceStart = Math.max(0, offset - dataStart);
        const fileSliceEnd = Math.min(entry.size, endOffset - dataStart);
        const targetStart = Math.max(0, dataStart - offset);

        const fileBlobSlice = entry.file.slice(fileSliceStart, fileSliceEnd);
        const fileBuffer = await fileBlobSlice.arrayBuffer();
        result.set(new Uint8Array(fileBuffer), targetStart);
      }

      // 3. Copy Tar Alignment Padding if in range
      const padStart = dataEnd;
      const padEnd = padStart + entry.padSize;
      if (offset < padEnd && endOffset > padStart && entry.padSize > 0) {
        // Zero-padding is already zero in new Uint8Array
      }
    }

    // End-of-archive 1024 zero bytes (already initialized to 0 in Uint8Array)
    return result.buffer;
  }

  /**
   * Generates a lightweight synthetic File object wrapping the virtual package
   * with custom slice() implementation for zero-copy transmission.
   */
  public toSyntheticFile(): File {
    const totalPkgSize = this.totalSize;
    const readSliceFn = (offset: number, len: number) => this.readSlice(offset, len);

    // Create a zero-byte File with custom slice and size
    const dummyBlob = new Blob([], { type: 'application/x-tar' });
    const dummyFile = new File([dummyBlob], this.name, {
      type: 'application/x-tar',
      lastModified: Date.now(),
    });

    // Override size and slice methods on the File instance
    Object.defineProperty(dummyFile, 'size', {
      value: totalPkgSize,
      writable: false,
      configurable: true,
    });

    const originalSlice = dummyFile.slice.bind(dummyFile);

    // Custom slice that forwards to readSliceFn()
    dummyFile.slice = function (start?: number, end?: number, contentType?: string): Blob {
      const actualStart = start ? Math.max(0, start) : 0;
      const actualEnd = end !== undefined ? Math.min(totalPkgSize, end) : totalPkgSize;
      const length = Math.max(0, actualEnd - actualStart);

      if (length === 0) {
        return originalSlice(0, 0, contentType || 'application/x-tar');
      }

      const customBlob = new Blob([], { type: contentType || 'application/x-tar' });

      Object.defineProperty(customBlob, 'size', {
        value: length,
        writable: false,
        configurable: true,
      });

      customBlob.arrayBuffer = async function (): Promise<ArrayBuffer> {
        return readSliceFn(actualStart, length);
      };

      return customBlob;
    };

    // Override arrayBuffer on synthetic File instance for full-package checksumming
    dummyFile.arrayBuffer = async function (): Promise<ArrayBuffer> {
      return readSliceFn(0, totalPkgSize);
    };

    return dummyFile;
  }
}

export interface TarEntryInfo {
  name: string;
  path: string;
  size: number;
  dir: boolean;
  dataOffset?: number;
}

/**
 * Parses and extracts file entries from a TAR blob with zero in-memory buffer bloat.
 */
export async function readTarEntries(blob: Blob): Promise<TarEntryInfo[]> {
  const entries: TarEntryInfo[] = [];
  let offset = 0;
  const totalSize = blob.size;

  while (offset + 512 <= totalSize) {
    const headerSlice = blob.slice(offset, offset + 512);
    const headerBuf = await headerSlice.arrayBuffer();
    const bytes = new Uint8Array(headerBuf);

    // Check if end of archive (two consecutive zero blocks)
    if (bytes[0] === 0 && bytes[1] === 0) break;

    // Check ustar magic at 257..262
    const magic = String.fromCharCode(...bytes.subarray(257, 262));
    if (magic !== 'ustar' && offset === 0) {
      // Not a valid tar file
      break;
    }

    // Read name (0..99)
    let name = '';
    for (let i = 0; i < 100 && bytes[i] !== 0; i++) {
      name += String.fromCharCode(bytes[i]);
    }

    // Read prefix (345..499)
    let prefix = '';
    for (let i = 345; i < 500 && bytes[i] !== 0; i++) {
      prefix += String.fromCharCode(bytes[i]);
    }

    const fullPath = prefix ? `${prefix}/${name}` : name;
    if (!fullPath) {
      offset += 512;
      continue;
    }

    // Read size (124..135) in octal
    let sizeStr = '';
    for (let i = 124; i < 136 && bytes[i] !== 0; i++) {
      if (bytes[i] >= 48 && bytes[i] <= 55) {
        sizeStr += String.fromCharCode(bytes[i]);
      }
    }
    const size = sizeStr ? parseInt(sizeStr, 8) : 0;
    const isDir = bytes[156] === 53 || fullPath.endsWith('/');

    entries.push({
      name: fullPath.split('/').filter(Boolean).pop() || fullPath,
      path: fullPath,
      size,
      dir: isDir,
      dataOffset: offset + 512,
    });

    const pad = (512 - (size % 512)) % 512;
    offset += 512 + size + pad;
  }

  return entries;
}

/**
 * Extracts a single file blob from a TAR blob using zero-copy slicing.
 */
export function extractTarFile(tarBlob: Blob, entry: TarEntryInfo): Blob {
  if (entry.dataOffset === undefined || entry.size === 0) {
    return new Blob([]);
  }
  return tarBlob.slice(entry.dataOffset, entry.dataOffset + entry.size);
}
