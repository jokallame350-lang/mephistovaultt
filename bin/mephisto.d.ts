export function generateRoomCode(): string;
export function deriveCryptoKey(code: string): Buffer;
export function encryptBuffer(data: Buffer, key: Buffer): Buffer;
export function decryptBuffer(data: Buffer, key: Buffer): Buffer;
export function formatBytes(bytes: number): string;
export function formatSpeed(bytesPerSec: number): string;
