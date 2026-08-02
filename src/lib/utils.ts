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

// ── QR Download ──

export function downloadQRCode(shareCode: string): void {
  const canvas = document.querySelector('canvas');
  if (canvas) {
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `mephistovault-qr-${shareCode.split('#')[0]}.png`;
    document.body.appendChild(a);
    try {
      a.click();
    } finally {
      if (a.parentNode) {
        a.parentNode.removeChild(a);
      }
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

