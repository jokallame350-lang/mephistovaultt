import { CODE_CHARS, CODE_LENGTH, PIN_MIN, PIN_MAX } from './constants';
import { wipeMemory } from './encryption';

export { wipeMemory };

// ── Formatting ──

export function formatBytes(bytes: number, decimals = 2): string {
  if (!+bytes || bytes < 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const clampedIndex = Math.min(i, sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, clampedIndex)).toFixed(dm))} ${sizes[clampedIndex]}`;
}

export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return '0 B/s';
  const k = 1024;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytesPerSec) / Math.log(k));
  const clampedIndex = Math.min(i, sizes.length - 1);
  return `${parseFloat((bytesPerSec / Math.pow(k, clampedIndex)).toFixed(1))} ${sizes[clampedIndex]}`;
}

export function formatETA(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return '--:--';
  const totalSecs = Math.round(seconds);
  if (totalSecs <= 0) return '0s remaining';
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) {
    return `${h}h ${m}m remaining`;
  }
  if (m > 0) {
    return `${m}m ${s.toString().padStart(2, '0')}s remaining`;
  }
  return `${s}s remaining`;
}

export function formatTime(s: number): string {
  if (isNaN(s) || s < 0) return '00:00';
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// ── Code Generation (CSPRNG Unbiased Sampling) ──

/**
 * Generate a cryptographically secure, modulo-bias-free share code like "abc-xyz#1234".
 */
export function generateCode(): string {
  const charsLen = CODE_CHARS.length; // 31
  // For modulo-bias-free sampling, max valid integer below 2^32 is floor(2^32 / 31) * 31 - 1
  const maxValidCharInt = Math.floor(0x100000000 / charsLen) * charsLen;
  
  let str = '';
  const randomUint32 = new Uint32Array(1);
  try {
    while (str.length < CODE_LENGTH) {
      crypto.getRandomValues(randomUint32);
      const val = randomUint32[0];
      if (val < maxValidCharInt) {
        str += CODE_CHARS.charAt(val % charsLen);
      }
    }

    const pinRange = PIN_MAX - PIN_MIN + 1; // 9000
    const maxValidPinInt = Math.floor(0x100000000 / pinRange) * pinRange;
    let pinVal = 0;
    while (true) {
      crypto.getRandomValues(randomUint32);
      const val = randomUint32[0];
      if (val < maxValidPinInt) {
        pinVal = PIN_MIN + (val % pinRange);
        break;
      }
    }

    return `${str.substring(0, 3)}-${str.substring(3, 6)}#${pinVal}`;
  } finally {
    wipeMemory(randomUint32);
  }
}

/**
 * Cleanly extract room code from raw scanned QR string, URL, query param, or hash fragment.
 * Supports: room=, code=, id=, ?room=, #hash, full URLs, and direct room codes with or without PIN.
 */
export function parseRoomCode(rawInput: string): string {
  if (!rawInput) return '';
  let str = rawInput.trim();

  // Strip wrapping quotes or brackets
  str = str.replace(/^["'<`]+|["'>`]+$/g, '').trim();

  // Try parsing as URL or URL path/query
  try {
    const isFullUrl = /^https?:\/\//i.test(str);
    const dummyBase = 'https://mephisto.vault';
    const parsedUrl = new URL(isFullUrl ? str : `${dummyBase}/${str.replace(/^\/+/, '')}`);

    const roomParam =
      parsedUrl.searchParams.get('room') ||
      parsedUrl.searchParams.get('code') ||
      parsedUrl.searchParams.get('id');

    if (roomParam) {
      let code = decodeURIComponent(roomParam).trim();
      // If code doesn't contain PIN '#' and URL hash exists, append hash as PIN
      if (parsedUrl.hash && !code.includes('#')) {
        const hashClean = decodeURIComponent(parsedUrl.hash.replace(/^#\/?/, '')).trim();
        if (hashClean && !hashClean.includes('=')) {
          code = `${code}#${hashClean}`;
        }
      }
      return code.trim();
    }

    // Check pathname like /room/abc-xyz#1234 or /abc-xyz#1234
    if (isFullUrl && parsedUrl.pathname && parsedUrl.pathname !== '/') {
      const cleanPath = decodeURIComponent(parsedUrl.pathname.replace(/^\/(?:room\/)?/, '')).trim();
      if (cleanPath) {
        let res = cleanPath;
        if (parsedUrl.hash && !res.includes('#')) {
          const hashClean = decodeURIComponent(parsedUrl.hash.replace(/^#\/?/, '')).trim();
          if (hashClean && !hashClean.includes('=')) res = `${res}#${hashClean}`;
        }
        return res;
      }
    }

    // Check hash parameters like #room=CODE or #code=CODE or #/room/CODE or #CODE
    if (parsedUrl.hash) {
      const rawHash = decodeURIComponent(parsedUrl.hash.replace(/^#\/?/, '')).trim();
      if (rawHash.includes('room=')) {
        return rawHash.split('room=')[1].split('&')[0].trim();
      } else if (rawHash.includes('code=')) {
        return rawHash.split('code=')[1].split('&')[0].trim();
      } else if (rawHash.includes('id=')) {
        return rawHash.split('id=')[1].split('&')[0].trim();
      } else if (rawHash.startsWith('room/')) {
        return rawHash.replace(/^room\//, '').trim();
      } else if (isFullUrl && rawHash && !rawHash.includes('=')) {
        return rawHash;
      }
    }
  } catch {
    // Fall back to regex / string manipulation
  }

  // Regex extract room=, code=, id= from query string or snippet
  const paramMatch = str.match(/(?:[?&]|\b)(?:room|code|id)=([^& \n\r\t]+)/i);
  if (paramMatch && paramMatch[1]) {
    try {
      return decodeURIComponent(paramMatch[1]).trim();
    } catch {
      return paramMatch[1].trim();
    }
  }

  // Strip leading ? or #
  if (str.startsWith('?')) {
    str = str.substring(1).split('&')[0];
  } else if (str.startsWith('#')) {
    str = str.replace(/^#\/?(?:room\/)?/, '');
  }

  // If raw input was a full URL and no room parameter/hash was found, do NOT treat the base URL as a room code
  if (/^https?:\/\//i.test(str)) {
    return '';
  }

  // If the string contains a domain or URL scheme, reject it as a room code
  if (str.includes('://') || (str.includes('.') && !str.includes('#'))) {
    return '';
  }

  return str.trim();
}

/**
 * Generate canonical share URL with strict secret privacy in hash fragment:
 * https://domain/pathname?room=ABC-XYZ#SECRET
 */
export function generateShareUrl(code: string): string {
  if (!code) return '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
  const parts = code.split('#');
  if (parts.length > 1) {
    return `${origin}${pathname}?room=${encodeURIComponent(parts[0])}#${encodeURIComponent(parts[1])}`;
  }
  return `${origin}${pathname}?room=${encodeURIComponent(code)}`;
}

// ── Audio Notification ──
export {
  playTransferSound,
  playTransferCompleteChime,
  playPeerConnectedChime,
  playFileDropChime,
  playToggleSound,
  playErrorSound,
} from './audioFX';

// ── Clipboard Copy (cross-browser) ──

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback for non-HTTPS
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    try {
      ta.focus();
      ta.select();
      return document.execCommand('copy');
    } finally {
      document.body.removeChild(ta);
    }
  } catch {
    return false;
  }
}

// ── QR Download (High-Res 1024x1024 PNG with Cyberpunk Theme) ──

export function downloadQRCode(shareCode: string, customCanvas?: HTMLCanvasElement | null): void {
  const sourceCanvas =
    customCanvas ||
    (document.getElementById('mephistovault-qr-lightbox-canvas') as HTMLCanvasElement) ||
    (document.getElementById('mephistovault-qr-canvas') as HTMLCanvasElement) ||
    document.querySelector('canvas');

  if (!sourceCanvas) {
    console.error('QR canvas element not found for download');
    return;
  }

  // Create high-res 1024x1024 canvas
  const size = 1024;
  const offscreen = document.createElement('canvas');
  offscreen.width = size;
  offscreen.height = size;
  const ctx = offscreen.getContext('2d');

  if (!ctx) return;

  // 1. Cyberpunk Dark Background
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#050811');
  gradient.addColorStop(0.5, '#0a0f1d');
  gradient.addColorStop(1, '#03050a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // 2. Cyberpunk Grid Lines
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.04)';
  ctx.lineWidth = 1;
  const step = 32;
  for (let x = 0; x <= size; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }
  for (let y = 0; y <= size; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }

  // 3. Glowing Cyberpunk Outer Frame
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
  ctx.lineWidth = 4;
  ctx.strokeRect(36, 36, size - 72, size - 72);

  // Inner subtle accent frame
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.15)';
  ctx.lineWidth = 2;
  ctx.strokeRect(48, 48, size - 96, size - 96);

  // 4. Futuristic HUD Corner Brackets
  ctx.fillStyle = '#10b981';
  const bracketLen = 48;
  const bracketThick = 8;

  // Top-Left
  ctx.fillRect(28, 28, bracketLen, bracketThick);
  ctx.fillRect(28, 28, bracketThick, bracketLen);
  // Top-Right
  ctx.fillRect(size - 28 - bracketLen, 28, bracketLen, bracketThick);
  ctx.fillRect(size - 28 - bracketThick, 28, bracketThick, bracketLen);
  // Bottom-Left
  ctx.fillRect(28, size - 28 - bracketThick, bracketLen, bracketThick);
  ctx.fillRect(28, size - 28 - bracketLen, bracketThick, bracketLen);
  // Bottom-Right
  ctx.fillRect(size - 28 - bracketLen, size - 28 - bracketThick, bracketLen, bracketThick);
  ctx.fillRect(size - 28 - bracketThick, size - 28 - bracketLen, bracketThick, bracketLen);

  // 5. Header Branding
  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 36px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('MEPHISTOVAULT', size / 2, 105);

  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 18px "Courier New", monospace';
  ctx.fillText('SECURE P2P ENCRYPTED VAULT • HIGH RES QR', size / 2, 138);

  // 6. QR Code Card Container
  const qrBoxSize = 650;
  const qrBoxX = (size - qrBoxSize) / 2;
  const qrBoxY = 175;

  // Dark background for QR code box
  ctx.fillStyle = '#050811';
  ctx.fillRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize);
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 3;
  ctx.strokeRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize);

  // Draw source QR canvas onto high-res canvas (with pixel smoothing disabled for ultra-crisp edges)
  const qrPadding = 25;
  const qrDrawSize = qrBoxSize - qrPadding * 2;
  const qrDrawX = qrBoxX + qrPadding;
  const qrDrawY = qrBoxY + qrPadding;

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sourceCanvas, qrDrawX, qrDrawY, qrDrawSize, qrDrawSize);

  // 7. Room Code Footer Box
  const footerY = 855;
  const footerHeight = 80;
  ctx.fillStyle = 'rgba(5, 8, 17, 0.9)';
  ctx.fillRect(qrBoxX, footerY, qrBoxSize, footerHeight);
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(qrBoxX, footerY, qrBoxSize, footerHeight);

  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 32px "Courier New", monospace';
  ctx.fillText(`ROOM: ${shareCode}`, size / 2, footerY + 50);

  // 8. Trigger PNG Download
  const url = offscreen.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  const cleanCode = shareCode ? shareCode.split('#')[0] : 'code';
  a.download = `mephistovault-qr-${cleanCode}-1024x1024.png`;
  document.body.appendChild(a);
  try {
    a.click();
  } finally {
    if (a.parentNode) {
      a.parentNode.removeChild(a);
    }
  }
}

// ── File Save (with File System Access API fallback & Blob URL leak prevention) ──

export async function saveFile(blob: Blob, name: string): Promise<void> {
  try {
    if ('showSaveFilePicker' in window) {
      const handle = await (window as Window & { showSaveFilePicker: (opts: { suggestedName: string }) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
        suggestedName: name,
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    }
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    // Fall through to legacy download for other errors
  }

  // Legacy fallback with guaranteed Blob URL cleanup
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  try {
    a.click();
  } finally {
    setTimeout(() => {
      if (a.parentNode) {
        a.parentNode.removeChild(a);
      }
      URL.revokeObjectURL(url);
    }, 1000);
  }
}

