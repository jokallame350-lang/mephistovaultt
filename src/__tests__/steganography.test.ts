import { describe, it, expect, beforeEach } from 'vitest';
import {
  embedDataInImageData,
  extractDataFromImage,
  calculateStegoCapacity,
  embedDataInImage,
  generateCarrierImage,
  extractDataFromCanvas,
  hideFileInCarrierImage,
  extractFileFromCarrierImage,
  STEGO_MAGIC,
  STEGO_HEADER_SIZE,
} from '../lib/steganography';
import { deriveKey, encryptChunk, decryptChunk } from '../lib/encryption';

// Helper to create an ImageData instance in Node/Browser environments
function createMockImageData(
  width: number,
  height: number,
  fillRgba: [number, number, number, number] = [128, 128, 128, 255]
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fillRgba[0];
    data[i + 1] = fillRgba[1];
    data[i + 2] = fillRgba[2];
    data[i + 3] = fillRgba[3];
  }
  return {
    width,
    height,
    data,
    colorSpace: 'srgb',
  } as ImageData;
}

// Helper to create a mock HTMLCanvasElement for headless testing
function createMockCanvas(width: number, height: number): HTMLCanvasElement {
  let imgData = createMockImageData(width, height);
  const mockCtx = {
    getImageData: (_sx: number, _sy: number, _sw: number, _sh: number) => imgData,
    putImageData: (newData: ImageData, _dx: number, _dy: number) => {
      imgData = newData;
    },
    createRadialGradient: () => ({
      addColorStop: () => {},
    }),
    fillRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    arc: () => {},
    closePath: () => {},
    fill: () => {},
    fillText: () => {},
    save: () => {},
    restore: () => {},
    translate: () => {},
    scale: () => {},
    setLineDash: () => {},
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    shadowColor: '',
    shadowBlur: 0,
    lineJoin: 'round',
    lineCap: 'round',
    font: '',
  };

  const canvas = {
    width,
    height,
    getContext: (contextId: string) => {
      if (contextId === '2d') return mockCtx;
      return null;
    },
    toBlob: (callback: (blob: Blob | null) => void, _type?: string) => {
      const blob = new Blob([imgData.data.buffer], { type: 'image/png' });
      callback(blob);
    },
  } as unknown as HTMLCanvasElement;

  return canvas;
}

describe('MephistoVault Steganography Engine', () => {
  beforeEach(() => {
    // Setup minimal DOM mocks if running in pure Node environment
    if (typeof globalThis.document === 'undefined') {
      (globalThis as unknown as { document: unknown }).document = {
        createElement: (tag: string) => {
          if (tag === 'canvas') {
            return createMockCanvas(800, 800);
          }
          return {};
        },
      };
    }
  });

  describe('Capacity Calculation', () => {
    it('calculates exact steganographic byte capacity (1 byte per pixel minus 8-byte header)', () => {
      expect(calculateStegoCapacity(100, 100)).toBe(10000 - 8);
      expect(calculateStegoCapacity(800, 800)).toBe(640000 - 8);
      expect(calculateStegoCapacity(2, 2)).toBe(0); // 4 pixels is less than 8
    });
  });

  describe('Direct ImageData Embedding & Lossless Extraction', () => {
    it('embeds and extracts UTF-8 text payload with exact byte equality', () => {
      const carrier = createMockImageData(64, 64); // 4096 bytes capacity
      const text = 'MephistoVault Top-Secret Zero-Trace Encrypted Ciphertext Payload! 🔐🐱⚡';
      const payload = new TextEncoder().encode(text).buffer;

      const stegoImageData = embedDataInImageData(carrier, payload);
      expect(stegoImageData).toBeDefined();
      expect(stegoImageData.data.length).toBe(carrier.data.length);

      const result = extractDataFromImage(stegoImageData);
      expect(result).not.toBeNull();
      expect(result?.payload).toBeDefined();

      const extractedText = new TextDecoder().decode(result!.payload);
      expect(extractedText).toBe(text);
    });

    it('embeds and losslessly extracts high-entropy binary buffers (all byte values 0x00 to 0xFF)', () => {
      const carrier = createMockImageData(128, 128); // 16,384 bytes capacity
      // Generate 1024 bytes of high-entropy pseudorandom data
      const randomBytes = new Uint8Array(1024);
      for (let i = 0; i < randomBytes.length; i++) {
        randomBytes[i] = (i * 37 + 19) % 256;
      }

      const stego = embedDataInImageData(carrier, randomBytes.buffer);
      const extracted = extractDataFromImage(stego);

      expect(extracted).not.toBeNull();
      const extractedArr = new Uint8Array(extracted!.payload);
      expect(extractedArr.length).toBe(randomBytes.length);
      expect(extractedArr).toEqual(randomBytes);
    });

    it('embeds exactly at maximum capacity threshold without throwing', () => {
      const width = 10;
      const height = 10; // 100 pixels
      const carrier = createMockImageData(width, height);
      const maxPayloadSize = 100 - STEGO_HEADER_SIZE; // 92 bytes
      const maxPayload = new Uint8Array(maxPayloadSize).fill(0xaa).buffer;

      const stego = embedDataInImageData(carrier, maxPayload);
      const extracted = extractDataFromImage(stego);

      expect(extracted).not.toBeNull();
      expect(extracted!.payload.byteLength).toBe(maxPayloadSize);
      expect(new Uint8Array(extracted!.payload)).toEqual(new Uint8Array(maxPayload));
    });

    it('handles empty payload (0 bytes) gracefully', () => {
      const carrier = createMockImageData(32, 32);
      const emptyPayload = new ArrayBuffer(0);

      const stego = embedDataInImageData(carrier, emptyPayload);
      const extracted = extractDataFromImage(stego);

      expect(extracted).not.toBeNull();
      expect(extracted!.payload.byteLength).toBe(0);
    });

    it('throws when payload exceeds carrier image capacity', () => {
      const smallCarrier = createMockImageData(4, 4); // 16 pixels -> 8 bytes payload max
      const oversizedPayload = new Uint8Array(9).buffer; // 9 > 8

      expect(() => {
        embedDataInImageData(smallCarrier, oversizedPayload);
      }).toThrow(/Carrier image is too small/);
    });
  });

  describe('AES-256-GCM Encrypted Ciphertext Integration', () => {
    it('embeds AES-256-GCM ciphertext in carrier, extracts it losslessly, and decrypts successfully', async () => {
      const key = await deriveKey('quantum-stego-room#7788');
      const confidentialDocument = JSON.stringify({
        agent: 'Subagent 1',
        protocol: 'MephistoVault Steganography',
        timestamp: Date.now(),
        payload: 'Top secret zero-knowledge visual envelope payload.',
      });

      const rawBuffer = new TextEncoder().encode(confidentialDocument).buffer;
      const ciphertext = await encryptChunk(rawBuffer, key);

      // Embed ciphertext into carrier
      const carrier = createMockImageData(100, 100);
      const stegoImageData = embedDataInImageData(carrier, ciphertext);

      // Extract ciphertext from stego carrier
      const extractionResult = extractDataFromImage(stegoImageData);
      expect(extractionResult).not.toBeNull();

      // Decrypt extracted ciphertext
      const decryptedBuffer = await decryptChunk(extractionResult!.payload, key);
      const decryptedDocument = new TextDecoder().decode(decryptedBuffer);

      expect(decryptedDocument).toBe(confidentialDocument);
    });
  });

  describe('Canvas Carrier Image Generation & Async Embed', () => {
    it('generates a cybernetic carrier canvas with default and custom dimensions', () => {
      const canvasDefault = generateCarrierImage();
      expect(canvasDefault).toBeDefined();
      expect(canvasDefault.width).toBe(800);
      expect(canvasDefault.height).toBe(800);

      const canvasCustom = generateCarrierImage(400, 300);
      expect(canvasCustom.width).toBe(400);
      expect(canvasCustom.height).toBe(300);
    });

    it('embeds binary data into an HTMLCanvasElement and produces a PNG Blob', async () => {
      const canvas = createMockCanvas(200, 200);
      const secret = new TextEncoder().encode('Quantum Phantom Key #9941').buffer;

      const blob = await embedDataInImage(canvas, secret);
      expect(blob).toBeDefined();
      expect(blob.type).toBe('image/png');
      expect(blob.size).toBeGreaterThan(0);
    });

    it('extracts embedded data directly from an HTMLCanvasElement via extractDataFromCanvas', async () => {
      const canvas = createMockCanvas(150, 150);
      const secret = new TextEncoder().encode('Direct Canvas Extraction Test').buffer;

      // Embed into canvas
      const imgData = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
      const stegoData = embedDataInImageData(imgData, secret);
      canvas.getContext('2d')!.putImageData(stegoData, 0, 0);

      const extracted = extractDataFromCanvas(canvas);
      expect(extracted).not.toBeNull();
      expect(new TextDecoder().decode(extracted!.payload)).toBe('Direct Canvas Extraction Test');
    });
  });

  describe('High-Level File Hide & Extract APIs', () => {
    it('hides and extracts a file package with encryption passcode', async () => {
      const carrierCanvas = createMockCanvas(300, 300);
      const secretContent = new TextEncoder().encode('Confidential Mission Directive 007');
      const secretFile = new File([secretContent], 'directive.txt', { type: 'text/plain' });
      const passcode = 'topsecret#9988';

      const stegoBlob = await hideFileInCarrierImage(carrierCanvas, secretFile, passcode);
      expect(stegoBlob).toBeDefined();
      expect(stegoBlob.type).toBe('image/png');

      // Extract from the canvas ImageData
      const extracted = await extractFileFromCarrierImage(carrierCanvas, passcode);
      expect(extracted).not.toBeNull();
      expect(extracted?.name).toBe('directive.txt');
      expect(extracted?.type).toBe('text/plain');
      expect(new TextDecoder().decode(extracted?.data)).toBe('Confidential Mission Directive 007');
    });

    it('throws when extracting encrypted payload with incorrect passcode', async () => {
      const carrierCanvas = createMockCanvas(200, 200);
      const secretFile = new File(['Some Secret'], 'note.txt');
      await hideFileInCarrierImage(carrierCanvas, secretFile, 'correct-passcode#1234');

      await expect(
        extractFileFromCarrierImage(carrierCanvas, 'wrong-passcode#9999')
      ).rejects.toThrow(/Invalid passcode/);
    });
  });

  describe('Corrupt / Invalid Stego Detection & Robustness', () => {
    it('returns null when extracting from a plain non-stego carrier image', () => {
      // Clean carrier without MVST magic header
      const cleanCarrier = createMockImageData(64, 64, [50, 100, 150, 255]);
      const extracted = extractDataFromImage(cleanCarrier);
      expect(extracted).toBeNull();
    });

    it('returns null if magic bytes are corrupted', () => {
      const carrier = createMockImageData(32, 32);
      const payload = new TextEncoder().encode('Secret Data').buffer;
      const stego = embedDataInImageData(carrier, payload);

      // Corrupt magic header in first pixel (R channel)
      stego.data[0] = (stego.data[0] ^ 0x01) as number;

      const extracted = extractDataFromImage(stego);
      expect(extracted).toBeNull();
    });

    it('returns null if carrier image is smaller than the required 8-byte header', () => {
      const tinyCarrier = createMockImageData(2, 2); // 4 pixels < 8
      const extracted = extractDataFromImage(tinyCarrier);
      expect(extracted).toBeNull();
    });

    it('returns null if header length field is corrupted and exceeds image capacity', () => {
      const carrier = createMockImageData(16, 16); // 256 pixels
      const payload = new Uint8Array([1, 2, 3, 4]).buffer;
      const stego = embedDataInImageData(carrier, payload);

      // Corrupt the length field in pixel 4 (offset 16, 17, 18, 19) to a huge number
      stego.data[16] = (stego.data[16] | 0x03) as number;
      stego.data[17] = (stego.data[17] | 0x03) as number;
      stego.data[18] = (stego.data[18] | 0x03) as number;
      stego.data[19] = (stego.data[19] | 0x03) as number;

      const extracted = extractDataFromImage(stego);
      expect(extracted).toBeNull();
    });

    it('returns null for null or malformed image data input', () => {
      expect(extractDataFromImage(null as unknown as ImageData)).toBeNull();
      expect(extractDataFromImage({} as unknown as ImageData)).toBeNull();
    });

    it('validates exported constants', () => {
      expect(STEGO_MAGIC).toEqual(new Uint8Array([0x4d, 0x56, 0x53, 0x54]));
      expect(STEGO_HEADER_SIZE).toBe(8);
    });
  });
});
