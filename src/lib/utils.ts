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
  if (seconds === Infinity || isNaN(seconds) || seconds < 0) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}s`;
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
 * Supports: room=, ?room=, #hash, full URLs, and direct room codes.
 */
export function parseRoomCode(rawInput: string): string {
  if (!rawInput) return '';
  let str = rawInput.trim();

  // Decode URI component first if whole string is encoded
  try {
    if (str.includes('%')) {
      const decoded = decodeURIComponent(str);
      if (decoded.includes('room=')) {
        str = decoded;
      }
    }
  } catch {
    // Ignore decoding error
  }

  // 1. Handle room= param explicitly (whether in query string or URL)
  if (str.includes('room=')) {
    const afterRoom = str.split('room=')[1];
    if (afterRoom) {
      const paramValue = afterRoom.split('&')[0];
      try {
        str = decodeURIComponent(paramValue);
      } catch {
        str = paramValue;
      }
    }
  }
  // 2. Handle URL format (http/https)
  else if (/^https?:\/\//i.test(str)) {
    try {
      const url = new URL(str);
      const roomParam = url.searchParams.get('room') || url.searchParams.get('code') || url.searchParams.get('id');
      if (roomParam) {
        str = roomParam;
      } else if (url.hash) {
        const hashContent = url.hash.replace(/^#\/?/, '');
        if (hashContent.includes('room=')) {
          str = hashContent.split('room=')[1].split('&')[0];
        } else if (hashContent.startsWith('room/')) {
          str = hashContent.replace(/^room\//, '');
        } else {
          str = hashContent;
        }
      } else if (url.pathname && url.pathname !== '/') {
        const cleanPath = url.pathname.replace(/^\/(?:room\/)?/, '');
        if (cleanPath) {
          str = cleanPath;
        }
      }
    } catch {
      // Fallback to raw string
    }
  }
  // 3. Handle raw ?room= or # or ? prefixes
  else {
    if (str.startsWith('?room=')) {
      str = str.substring(6).split('&')[0];
    } else if (str.startsWith('?')) {
      str = str.substring(1).split('&')[0];
    } else if (str.startsWith('#')) {
      str = str.replace(/^#\/?(?:room\/)?/, '');
    }
  }

  // Final decode attempt and trim
  try {
    str = decodeURIComponent(str);
  } catch {
    // preserve as is
  }

  return str.trim();
}

// ── Audio Notification ──

export function playTransferSound(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);

    setTimeout(() => {
      try {
        const o2 = ctx.createOscillator();
        const g2 = ctx.createGain();
        o2.connect(g2);
        g2.connect(ctx.destination);
        o2.frequency.value = 1320;
        o2.type = 'sine';
        g2.gain.setValueAtTime(0.3, ctx.currentTime);
        g2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
        o2.start(ctx.currentTime);
        o2.stop(ctx.currentTime + 0.6);
      } catch {
        // ignore secondary tone error
      }
    }, 200);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 900);
  } catch {
    // AudioContext not available (e.g. server-side or restricted environment)
  }
}

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

