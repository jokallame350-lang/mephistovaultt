declare module '*/bin/mephisto.js' {
  export function generateRoomCode(): string;
  export function deriveCryptoKey(code: string): Buffer;
  export function encryptBuffer(buffer: Buffer, key: Buffer): Buffer;
  export function decryptBuffer(buffer: Buffer, key: Buffer): Buffer;
  export function formatBytes(bytes: number): string;
  export function formatSpeed(bytesPerSec: number): string;
}

declare module '../../bin/mephisto.js' {
  export function generateRoomCode(): string;
  export function deriveCryptoKey(code: string): Buffer;
  export function encryptBuffer(buffer: Buffer, key: Buffer): Buffer;
  export function decryptBuffer(buffer: Buffer, key: Buffer): Buffer;
  export function formatBytes(bytes: number): string;
  export function formatSpeed(bytesPerSec: number): string;
}
