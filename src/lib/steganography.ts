/**
 * MephistoVault Lossless Canvas-based Steganography Engine
 *
 * Implements 2-bit LSB (Least Significant Bit) encoding across RGBA channels.
 * Header format:
 *   [0..3] : Magic bytes 'M' 'V' 'S' 'T' (0x4D, 0x56, 0x53, 0x54)
 *   [4..7] : 32-bit big-endian unsigned payload length in bytes
 *   [8..N] : Binary payload / encrypted ciphertext
 *
 * Storage capacity: 1 byte per RGBA pixel (2 bits * 4 channels = 8 bits).
 */

import { deriveKey, encryptChunk, decryptChunk } from './encryption';

export const STEGO_MAGIC = new Uint8Array([0x4d, 0x56, 0x53, 0x54]); // 'MVST'
export const STEGO_HEADER_SIZE = 8; // 4 bytes magic + 4 bytes length

/**
 * Calculates the maximum payload capacity in bytes for given image dimensions.
 */
export function calculateStegoCapacity(width: number, height: number): number {
  const totalPixels = width * height;
  return Math.max(0, totalPixels - STEGO_HEADER_SIZE);
}

/**
 * Embeds binary payload directly into an ImageData instance and returns a new ImageData.
 */
export function embedDataInImageData(
  carrierImageData: ImageData,
  payload: ArrayBuffer
): ImageData {
  const width = carrierImageData.width;
  const height = carrierImageData.height;
  const totalPixels = width * height;
  const payloadBytes = new Uint8Array(payload);
  const totalDataBytes = STEGO_HEADER_SIZE + payloadBytes.byteLength;

  if (totalDataBytes > totalPixels) {
    throw new Error(
      `Carrier image is too small to embed payload. Capacity: ${Math.max(
        0,
        totalPixels - STEGO_HEADER_SIZE
      )} bytes, Required: ${payloadBytes.byteLength} bytes.`
    );
  }

  // Clone carrier image data to maintain purity
  const clampedData = new Uint8ClampedArray(carrierImageData.data);
  const resultImageData =
    typeof ImageData !== 'undefined' && typeof ImageData.prototype === 'object'
      ? new ImageData(clampedData, width, height)
      : ({
          width,
          height,
          data: clampedData,
          colorSpace: 'srgb',
        } as ImageData);

  // Construct [Magic (4B)][Length (4B Big-Endian)][Payload (NB)]
  const fullData = new Uint8Array(totalDataBytes);
  fullData.set(STEGO_MAGIC, 0);

  const headerView = new DataView(
    fullData.buffer,
    fullData.byteOffset,
    fullData.byteLength
  );
  headerView.setUint32(4, payloadBytes.byteLength, false); // Big-endian

  fullData.set(payloadBytes, STEGO_HEADER_SIZE);

  // 2 bits per RGBA channel (8 bits = 1 byte per pixel)
  // R: bits 7-6, G: bits 5-4, B: bits 3-2, A: bits 1-0
  const raw = resultImageData.data;
  for (let i = 0; i < totalDataBytes; i++) {
    const byte = fullData[i];
    const offset = i * 4;

    raw[offset] = (raw[offset] & 0xfc) | ((byte >> 6) & 0x03);
    raw[offset + 1] = (raw[offset + 1] & 0xfc) | ((byte >> 4) & 0x03);
    raw[offset + 2] = (raw[offset + 2] & 0xfc) | ((byte >> 2) & 0x03);
    raw[offset + 3] = (raw[offset + 3] & 0xfc) | (byte & 0x03);
  }

  return resultImageData;
}

/**
 * Embeds binary payload into carrier image (ImageData or HTMLCanvasElement)
 * and returns a lossless PNG Blob.
 */
export async function embedDataInImage(
  carrierImageData: ImageData | HTMLCanvasElement,
  payload: ArrayBuffer
): Promise<Blob> {
  let sourceImageData: ImageData;
  let inputCanvas: HTMLCanvasElement | null = null;

  if (
    (typeof HTMLCanvasElement !== 'undefined' &&
      carrierImageData instanceof HTMLCanvasElement) ||
    (carrierImageData &&
      'getContext' in carrierImageData &&
      typeof (carrierImageData as HTMLCanvasElement).getContext === 'function')
  ) {
    inputCanvas = carrierImageData as HTMLCanvasElement;
    const ctx = inputCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to obtain 2D rendering context from carrier canvas.');
    }
    sourceImageData = ctx.getImageData(
      0,
      0,
      inputCanvas.width,
      inputCanvas.height
    );
  } else if (
    carrierImageData &&
    'data' in carrierImageData &&
    'width' in carrierImageData
  ) {
    sourceImageData = carrierImageData as ImageData;
  } else {
    throw new Error('Invalid carrier image provided to embedDataInImage.');
  }

  const encodedImageData = embedDataInImageData(sourceImageData, payload);

  // Update input canvas if provided
  if (inputCanvas) {
    const ctx = inputCanvas.getContext('2d');
    if (ctx) {
      ctx.putImageData(encodedImageData, 0, 0);
    }
  }

  if (typeof document === 'undefined' || !document.createElement) {
    throw new Error('DOM document is required to render canvas to PNG Blob.');
  }

  const canvas = inputCanvas || document.createElement('canvas');
  canvas.width = encodedImageData.width;
  canvas.height = encodedImageData.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to obtain 2D rendering context for export canvas.');
  }

  ctx.putImageData(encodedImageData, 0, 0);

  return new Promise<Blob>((resolve, reject) => {
    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to encode steganographic image as lossless PNG blob.'));
        }
      }, 'image/png');
    } else {
      reject(new Error('canvas.toBlob is not supported in this environment.'));
    }
  });
}

/**
 * Extracts embedded payload from steganographic ImageData.
 * Returns { payload: ArrayBuffer } or null if invalid/corrupt.
 */
export function extractDataFromImage(
  stegoImageData: ImageData
): { payload: ArrayBuffer } | null {
  if (!stegoImageData || !stegoImageData.data) {
    return null;
  }

  const width = stegoImageData.width;
  const height = stegoImageData.height;
  const totalPixels = width * height;
  const raw = stegoImageData.data;

  // Need at least 8 pixels for the header
  if (totalPixels < STEGO_HEADER_SIZE || raw.length < STEGO_HEADER_SIZE * 4) {
    return null;
  }

  // Extract header (8 bytes)
  const headerBytes = new Uint8Array(STEGO_HEADER_SIZE);
  for (let i = 0; i < STEGO_HEADER_SIZE; i++) {
    const offset = i * 4;
    const r = raw[offset];
    const g = raw[offset + 1];
    const b = raw[offset + 2];
    const a = raw[offset + 3];

    headerBytes[i] =
      ((r & 0x03) << 6) | ((g & 0x03) << 4) | ((b & 0x03) << 2) | (a & 0x03);
  }

  // Verify Magic 'MVST'
  if (
    headerBytes[0] !== STEGO_MAGIC[0] ||
    headerBytes[1] !== STEGO_MAGIC[1] ||
    headerBytes[2] !== STEGO_MAGIC[2] ||
    headerBytes[3] !== STEGO_MAGIC[3]
  ) {
    return null;
  }

  // Extract 32-bit payload length
  const headerView = new DataView(
    headerBytes.buffer,
    headerBytes.byteOffset,
    headerBytes.byteLength
  );
  const payloadLength = headerView.getUint32(4, false); // Big-endian

  // Sanity check length bounds against pixel capacity
  const maxPayloadCapacity = totalPixels - STEGO_HEADER_SIZE;
  if (payloadLength > maxPayloadCapacity) {
    return null;
  }

  // Extract payload bytes
  const payloadBytes = new Uint8Array(payloadLength);
  for (let i = 0; i < payloadLength; i++) {
    const offset = (STEGO_HEADER_SIZE + i) * 4;
    const r = raw[offset];
    const g = raw[offset + 1];
    const b = raw[offset + 2];
    const a = raw[offset + 3];

    payloadBytes[i] =
      ((r & 0x03) << 6) | ((g & 0x03) << 4) | ((b & 0x03) << 2) | (a & 0x03);
  }

  return { payload: payloadBytes.buffer };
}

/**
 * Extracts payload from an HTMLCanvasElement directly.
 */
export function extractDataFromCanvas(
  canvas: HTMLCanvasElement
): { payload: ArrayBuffer } | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return extractDataFromImage(imgData);
}

/**
 * Loads a Blob into an ImageData instance via Image decoding.
 */
export async function blobToImageData(blob: Blob): Promise<ImageData> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    throw new Error('DOM Image API required to convert Blob to ImageData');
  }

  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image blob for steganography extraction'));
      img.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context for image extraction');
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Packages and embeds a File/Blob/Buffer into a carrier image (File/Blob/Canvas/ImageData).
 * Optionally encrypts the payload with AES-256-GCM using the provided passcode.
 */
export async function hideFileInCarrierImage(
  carrier: File | Blob | HTMLCanvasElement | ImageData | null | undefined,
  secret: File | Blob | ArrayBuffer,
  passcode?: string
): Promise<Blob> {
  // 1. Extract raw binary data and metadata for the secret
  let rawData: ArrayBuffer;
  let fileName = 'secret.bin';
  let mimeType = 'application/octet-stream';

  if (secret instanceof File) {
    fileName = secret.name;
    mimeType = secret.type || 'application/octet-stream';
    rawData = await secret.arrayBuffer();
  } else if (secret instanceof Blob) {
    mimeType = secret.type || 'application/octet-stream';
    rawData = await secret.arrayBuffer();
  } else {
    rawData = secret;
  }

  // 2. Package file container: [Metadata JSON (4B len + JSON)][Raw payload]
  const metaHeader = JSON.stringify({
    name: fileName,
    type: mimeType,
    size: rawData.byteLength,
    encrypted: Boolean(passcode && passcode.trim()),
    timestamp: Date.now(),
  });
  const metaBytes = new TextEncoder().encode(metaHeader);
  const containerBuffer = new ArrayBuffer(4 + metaBytes.byteLength + rawData.byteLength);
  const containerView = new DataView(containerBuffer);
  containerView.setUint32(0, metaBytes.byteLength, false); // Big-endian
  const containerArray = new Uint8Array(containerBuffer);
  containerArray.set(metaBytes, 4);
  containerArray.set(new Uint8Array(rawData), 4 + metaBytes.byteLength);

  // 3. Encrypt if passcode is provided
  let payloadToEmbed: ArrayBuffer;
  if (passcode && passcode.trim()) {
    const key = await deriveKey(passcode.trim());
    payloadToEmbed = await encryptChunk(containerBuffer, key);
  } else {
    payloadToEmbed = containerBuffer;
  }

  // 4. Resolve carrier to ImageData or HTMLCanvasElement
  let carrierTarget: ImageData | HTMLCanvasElement;
  if (
    carrier &&
    ((typeof HTMLCanvasElement !== 'undefined' && carrier instanceof HTMLCanvasElement) ||
      ('getContext' in carrier && typeof (carrier as HTMLCanvasElement).getContext === 'function') ||
      ('data' in carrier && 'width' in carrier))
  ) {
    carrierTarget = carrier as ImageData | HTMLCanvasElement;
  } else if (carrier instanceof Blob) {
    carrierTarget = await blobToImageData(carrier);
  } else {
    // If carrier is missing or invalid, generate cybernetic canvas
    const requiredPixels = payloadToEmbed.byteLength + STEGO_HEADER_SIZE;
    const side = Math.max(800, Math.ceil(Math.sqrt(requiredPixels)) + 50);
    carrierTarget = generateCarrierImage(side, side);
  }

  // Check capacity
  const totalPixels = carrierTarget.width * carrierTarget.height;
  if (payloadToEmbed.byteLength + STEGO_HEADER_SIZE > totalPixels) {
    throw new Error(
      `Carrier image is too small (${totalPixels} px). Requires at least ${
        payloadToEmbed.byteLength + STEGO_HEADER_SIZE
      } px capacity.`
    );
  }

  return embedDataInImage(carrierTarget, payloadToEmbed);
}

/**
 * Extracts and optionally decrypts a concealed file from a steganographic carrier.
 */
export async function extractFileFromCarrierImage(
  carrier: File | Blob | HTMLCanvasElement | ImageData,
  passcode?: string
): Promise<{ name: string; type: string; data: ArrayBuffer } | null> {
  let imgData: ImageData;
  if (carrier && 'data' in carrier && 'width' in carrier) {
    imgData = carrier as ImageData;
  } else if (
    (typeof HTMLCanvasElement !== 'undefined' && carrier instanceof HTMLCanvasElement) ||
    (carrier && 'getContext' in carrier && typeof (carrier as HTMLCanvasElement).getContext === 'function')
  ) {
    const ctx = (carrier as HTMLCanvasElement).getContext('2d');
    if (!ctx) return null;
    imgData = ctx.getImageData(0, 0, (carrier as HTMLCanvasElement).width, (carrier as HTMLCanvasElement).height);
  } else if (carrier instanceof Blob) {
    imgData = await blobToImageData(carrier);
  } else {
    return null;
  }

  const extracted = extractDataFromImage(imgData);
  if (!extracted) return null;

  let containerBuffer = extracted.payload;

  // If passcode provided, attempt decrypting
  if (passcode && passcode.trim()) {
    try {
      const key = await deriveKey(passcode.trim());
      containerBuffer = await decryptChunk(containerBuffer, key);
    } catch {
      throw new Error('Invalid passcode: decryption authentication failed.');
    }
  }

  // Parse container: [4-byte JSON len][JSON][data]
  if (containerBuffer.byteLength >= 4) {
    try {
      const view = new DataView(containerBuffer);
      const metaLen = view.getUint32(0, false);
      if (metaLen > 0 && metaLen < containerBuffer.byteLength - 4) {
        const metaBytes = new Uint8Array(containerBuffer, 4, metaLen);
        const metaStr = new TextDecoder().decode(metaBytes);
        const meta = JSON.parse(metaStr);
        const data = containerBuffer.slice(4 + metaLen);
        return {
          name: meta.name || 'extracted.bin',
          type: meta.type || 'application/octet-stream',
          data,
        };
      }
    } catch {
      // Return raw payload if JSON container parse fails
    }
  }

  return { name: 'extracted.bin', type: 'application/octet-stream', data: containerBuffer };
}

/**
 * Generates a high-resolution cybernetic holographic canvas carrier image.
 * Aesthetic: Neon Cyberpunk Mephisto Phantom Grid / Holographic Visor Cat.
 */
export function generateCarrierImage(
  width: number = 800,
  height: number = 800
): HTMLCanvasElement {
  if (typeof document === 'undefined' || !document.createElement) {
    throw new Error('DOM document is required to generate cybernetic canvas image.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D context for carrier generator.');
  }

  const cx = width / 2;
  const cy = height / 2;

  // 1. Deep Cyber Void Background Gradient
  const bgGrad = ctx.createRadialGradient(cx, cy, 50, cx, cy, Math.max(width, height) * 0.75);
  bgGrad.addColorStop(0, '#0c0a1e');
  bgGrad.addColorStop(0.5, '#070614');
  bgGrad.addColorStop(1, '#020208');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Cybernetic Perspective Floor & Grid
  ctx.save();
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
  ctx.lineWidth = 1;

  const gridSize = 40;
  for (let x = 0; x <= width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();

  // 3. Holographic Reticle & Concentric Tech Rings
  ctx.save();
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = 12;

  // Outer Ring
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, Math.min(width, height) * 0.38, 0, Math.PI * 2);
  ctx.stroke();

  // Segmented Tech Ring
  ctx.strokeStyle = '#a855f7';
  ctx.shadowColor = '#a855f7';
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 18, 4, 18]);
  ctx.beginPath();
  ctx.arc(cx, cy, Math.min(width, height) * 0.32, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]); // Reset dash

  // Inner Glow Ring
  ctx.strokeStyle = '#00ffcc';
  ctx.shadowColor = '#00ffcc';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, Math.min(width, height) * 0.24, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // 4. Cybernetic Neon Cat / Mephisto Phantom Visor Sigil
  ctx.save();
  ctx.translate(cx, cy);
  const scale = Math.min(width, height) / 800;
  ctx.scale(scale, scale);

  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = 18;
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 3.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Cybernetic Geometric Ears & Head Polygon
  ctx.beginPath();
  // Left Ear Tip
  ctx.moveTo(-110, -140);
  ctx.lineTo(-60, -70);
  ctx.lineTo(0, -90);
  ctx.lineTo(60, -70);
  // Right Ear Tip
  ctx.lineTo(110, -140);
  ctx.lineTo(85, -20);
  ctx.lineTo(100, 40);
  ctx.lineTo(0, 130);
  ctx.lineTo(-100, 40);
  ctx.lineTo(-85, -20);
  ctx.closePath();
  ctx.stroke();

  // Inner holographic ear facets
  ctx.strokeStyle = 'rgba(244, 63, 94, 0.7)';
  ctx.shadowColor = '#f43f5e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-110, -140);
  ctx.lineTo(-45, -40);
  ctx.lineTo(-60, -70);
  ctx.moveTo(110, -140);
  ctx.lineTo(45, -40);
  ctx.lineTo(60, -70);
  ctx.stroke();

  // Futuristic Visor Slits (Eyes)
  ctx.fillStyle = '#00ffcc';
  ctx.shadowColor = '#00ffcc';
  ctx.shadowBlur = 20;
  ctx.beginPath();
  // Left Visor
  ctx.moveTo(-65, -15);
  ctx.lineTo(-20, -10);
  ctx.lineTo(-30, 5);
  ctx.lineTo(-70, 0);
  ctx.closePath();
  ctx.fill();

  // Right Visor
  ctx.beginPath();
  ctx.moveTo(65, -15);
  ctx.lineTo(20, -10);
  ctx.lineTo(30, 5);
  ctx.lineTo(70, 0);
  ctx.closePath();
  ctx.fill();

  // Circuit Core (Nose/Mouth tech node)
  ctx.strokeStyle = '#00ffcc';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 20);
  ctx.lineTo(0, 50);
  ctx.lineTo(-25, 75);
  ctx.moveTo(0, 50);
  ctx.lineTo(25, 75);
  ctx.stroke();

  // Circuit Nodes / Junction Points
  const nodes = [
    { x: -25, y: 75, col: '#10b981' },
    { x: 25, y: 75, col: '#10b981' },
    { x: 0, y: -90, col: '#f43f5e' },
    { x: -110, y: -140, col: '#00f0ff' },
    { x: 110, y: -140, col: '#00f0ff' },
    { x: 0, y: 130, col: '#a855f7' },
  ];
  for (const n of nodes) {
    ctx.fillStyle = n.col;
    ctx.shadowColor = n.col;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(n.x, n.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // 5. Digital Telemetry Text & Cyber HUD Elements
  ctx.save();
  ctx.font = 'bold 12px monospace';
  ctx.fillStyle = 'rgba(0, 240, 255, 0.8)';
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = 8;
  ctx.fillText('MEPHISTO // VAULT v2.0', 30, 45);
  ctx.fillText('STEGANO-QUANTUM PROTOCOL [LOSSLESS LSB]', 30, 65);

  ctx.fillStyle = 'rgba(168, 85, 247, 0.8)';
  ctx.shadowColor = '#a855f7';
  ctx.fillText(`CARRIER DIMS: ${width}x${height}px`, width - 230, 45);
  ctx.fillText(`CAPACITY: ${(width * height - STEGO_HEADER_SIZE).toLocaleString()} BYTES`, width - 230, 65);

  // Bottom Telemetry Bar
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(30, height - 40);
  ctx.lineTo(width - 30, height - 40);
  ctx.stroke();

  ctx.font = '10px monospace';
  ctx.fillStyle = 'rgba(0, 255, 204, 0.7)';
  ctx.fillText('SECURE ZERO-TRACE ENCRYPTED CARRIER // 2-BIT RGBA LSB EMBEDDED', 30, height - 22);
  ctx.fillText('SHA-256 VERIFIED MATRIX', width - 200, height - 22);
  ctx.restore();

  // 6. Subtle Micro-dot Cryptographic Texture
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  // Apply a deterministic subtle pseudo-random matrix seed to make it visually richer
  let seed = 1337;
  for (let i = 0; i < data.length; i += 16) {
    seed = (seed * 9301 + 49297) % 233280;
    const noise = (seed / 233280 - 0.5) * 6;
    data[i] = Math.min(255, Math.max(0, data[i] + noise));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
  }
  ctx.putImageData(imgData, 0, 0);

  return canvas;
}
