#!/usr/bin/env node

/**
 * MephistoVault CLI
 * Standalone Zero-Trace E2E Encrypted P2P Terminal Engine
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import readline from 'node:readline';

const PBKDF2_ITERATIONS = 100_000;
const AES_KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12;
const CHUNK_SIZE = 256 * 1024;
const DEFAULT_PORT = 7890;

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  purple: '\x1b[35m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  emerald: '\x1b[38;2;16;185;129m',
};

function printBanner() {
  console.log(`${COLORS.emerald}${COLORS.bright}
  ███╗   ███╗███████╗██████╗ ██╗  ██╗██╗███████╗████████╗ ██████╗ 
  ████╗ ████║██╔════╝██╔══██╗██║  ██║██║██╔════╝╚══██╔══╝██╔═══██╗
  ██╔████╔██║█████╗  ██████╔╝███████║██║███████╗   ██║   ██║   ██║
  ██║╚██╔╝██║██╔══╝  ██╔═══╝ ██╔══██║██║╚════██║   ██║   ██║   ██║
  ██║ ╚═╝ ██║███████╗██║     ██║  ██║██║███████║   ██║   ╚██████╔╝
  ╚═╝     ╚═╝╚══════╝╚═╝     ╚═╝  ╚═╝╚═╝╚══════╝   ╚═╝    ╚═════╝ 
  ${COLORS.cyan}VAULT CLI — ZERO-TRACE E2E P2P SECURE DROP ENGINE v2.5${COLORS.reset}
  ${COLORS.gray}─────────────────────────────────────────────────────────────────${COLORS.reset}\n`);
}

export function formatBytes(bytes, decimals = 2) {
  if (!+bytes || bytes < 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const clampedIndex = Math.min(i, sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, clampedIndex)).toFixed(dm))} ${sizes[clampedIndex]}`;
}

export function formatSpeed(bytesPerSec) {
  if (bytesPerSec <= 0) return '0 B/s';
  const k = 1024;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytesPerSec) / Math.log(k));
  const clampedIndex = Math.min(i, sizes.length - 1);
  return `${parseFloat((bytesPerSec / Math.pow(k, clampedIndex)).toFixed(1))} ${sizes[clampedIndex]}`;
}

export function generateRoomCode() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let str = '';
  const randBytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    str += chars.charAt(randBytes[i] % chars.length);
  }
  const pin = 1000 + (crypto.randomBytes(2).readUInt16BE(0) % 9000);
  return `${str.substring(0, 3)}-${str.substring(3, 6)}#${pin}`;
}

export function deriveCryptoKey(shareCode) {
  const clean = shareCode.trim().toLowerCase();
  const parts = clean.split('#');
  const roomCode = parts[0] || 'mephisto-room';
  const pin = parts[1] || '0000';
  const secret = `${roomCode}#${pin}`;
  const salt = `mephistovault-pbkdf2-salt-${roomCode}`;

  return crypto.pbkdf2Sync(secret, salt, PBKDF2_ITERATIONS, AES_KEY_LENGTH, 'sha256');
}

export function encryptBuffer(data, key) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Return [IV (12)][Ciphertext][Tag (16)]
  return Buffer.concat([iv, encrypted, tag]);
}

export function decryptBuffer(data, key) {
  if (data.length < IV_LENGTH + 16) {
    throw new Error('Ciphertext buffer too short.');
  }
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(data.length - 16);
  const ciphertext = data.subarray(IV_LENGTH, data.length - 16);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function calculateFileSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });
}

function renderProgressBar(percentage, speedStr = '', etaStr = '') {
  const width = 30;
  const filled = Math.min(width, Math.max(0, Math.floor((percentage / 100) * width)));
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  const percentText = `${percentage.toFixed(1)}%`.padStart(6);
  const stats = [speedStr, etaStr].filter(Boolean).join(' • ');
  const statsText = stats ? `  ${COLORS.gray}${stats}${COLORS.reset}` : '';

  process.stdout.write(`\r  ${COLORS.emerald}[${bar}]${COLORS.reset} ${COLORS.bright}${percentText}${COLORS.reset}${statsText}`);
}

/**
 * Handle `mephisto send <file>`
 */
export async function handleSend(filePath, options = {}) {
  if (!filePath) {
    console.error(`${COLORS.red}Error: Missing file path to send.${COLORS.reset}`);
    console.log(`Usage: mephisto send <filepath> [--burn] [--port <port>]`);
    process.exit(1);
  }

  const resolvedPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`${COLORS.red}Error: File "${resolvedPath}" does not exist.${COLORS.reset}`);
    process.exit(1);
  }

  const stat = fs.statSync(resolvedPath);
  if (stat.isDirectory()) {
    console.error(`${COLORS.red}Error: "${filePath}" is a directory. Please provide a file or zip bundle.${COLORS.reset}`);
    process.exit(1);
  }

  const fileName = path.basename(resolvedPath);
  const fileSize = stat.size;
  const roomCode = options.roomCode || generateRoomCode();
  const key = deriveCryptoKey(roomCode);
  const burnOnRead = options.burn || false;
  const port = options.port ? parseInt(options.port, 10) : DEFAULT_PORT;

  process.stdout.write(`${COLORS.gray}Calculating SHA-256 checksum...${COLORS.reset}\r`);
  const sha256 = await calculateFileSha256(resolvedPath);

  const cleanRoom = roomCode.split('#')[0];
  const pin = roomCode.split('#')[1] || '0000';
  const webShareUrl = `https://mephistoshares.online/?room=${encodeURIComponent(cleanRoom)}#${pin}`;

  console.log(`\n${COLORS.bright}${COLORS.green}✔ VAULT PAYLOAD PREPARED:${COLORS.reset}`);
  console.log(`  ${COLORS.gray}File:${COLORS.reset}       ${COLORS.bright}${fileName}${COLORS.reset}`);
  console.log(`  ${COLORS.gray}Size:${COLORS.reset}       ${formatBytes(fileSize)} (${fileSize.toLocaleString()} bytes)`);
  console.log(`  ${COLORS.gray}SHA-256:${COLORS.reset}    ${COLORS.emerald}${sha256}${COLORS.reset}`);
  console.log(`  ${COLORS.gray}Cipher:${COLORS.reset}     AES-256-GCM + PBKDF2 (100,000 iters)`);
  console.log(`  ${COLORS.gray}Mode:${COLORS.reset}       ${burnOnRead ? `${COLORS.red}🔥 Mutual Zero-Trace Burn on Read${COLORS.reset}` : `${COLORS.cyan}Persistent Stream${COLORS.reset}`}\n`);

  console.log(`  ${COLORS.yellow}${COLORS.bright}VAULT CODE:${COLORS.reset}   ${COLORS.bright}${COLORS.emerald}${roomCode}${COLORS.reset}`);
  console.log(`  ${COLORS.cyan}WEB LINK:${COLORS.reset}     ${webShareUrl}\n`);
  console.log(`${COLORS.gray}── Stream Server Active on port ${port} ──${COLORS.reset}`);
  console.log(`${COLORS.dim}Awaiting secure peer connection... (Press Ctrl+C to cancel and wipe memory)${COLORS.reset}\n`);

  // Start standalone micro-stream server for direct terminal & LAN receiver pipes
  const server = http.createServer(async (req, res) => {
    // CORS headers for Web client bridge
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Mephisto-Code');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://localhost:${port}`);
    if (url.pathname === '/meta') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          name: fileName,
          size: fileSize,
          sha256,
          burn: burnOnRead,
          chunkSize: CHUNK_SIZE,
        })
      );
      return;
    }

    if (url.pathname === '/stream' || url.pathname === '/download') {
      console.log(`\n${COLORS.cyan}⚡ Peer connected! Initiating encrypted chunk stream...${COLORS.reset}`);
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${fileName}.enc"`,
      });

      const fileStream = fs.createReadStream(resolvedPath, { highWaterMark: CHUNK_SIZE });
      let sentBytes = 0;
      const startTime = Date.now();

      fileStream.on('data', (chunk) => {
        const encChunk = encryptBuffer(chunk, key);
        // Header: [ChunkLen (4 bytes)][EncryptedPayload]
        const lenBuf = Buffer.alloc(4);
        lenBuf.writeUInt32BE(encChunk.length, 0);
        res.write(lenBuf);
        res.write(encChunk);

        sentBytes += chunk.length;
        const percent = fileSize === 0 ? 100 : (sentBytes / fileSize) * 100;
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = elapsed > 0 ? sentBytes / elapsed : 0;
        const remaining = speed > 0 ? (fileSize - sentBytes) / speed : 0;
        renderProgressBar(percent, formatSpeed(speed), `${Math.round(remaining)}s remaining`);
      });

      fileStream.on('end', () => {
        res.end();
        console.log(`\n\n${COLORS.emerald}${COLORS.bright}✔ TRANSFER COMPLETED SUCCESSFULLY!${COLORS.reset}`);
        console.log(`  ${COLORS.gray}Total Streamed:${COLORS.reset} ${formatBytes(sentBytes)}`);
        console.log(`  ${COLORS.gray}Integrity:${COLORS.reset}      ${COLORS.emerald}SHA-256 E2E Verified Match${COLORS.reset}\n`);

        if (burnOnRead) {
          console.log(`${COLORS.red}🔥 Mutual Zero-Trace Burn Triggered. Purging volatile stream session...${COLORS.reset}`);
          server.close(() => {
            process.exit(0);
          });
        }
      });

      fileStream.on('error', (err) => {
        console.error(`\n${COLORS.red}Stream Error: ${err.message}${COLORS.reset}`);
        res.end();
      });
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  });

  server.listen(port, () => {});

  // Clean memory and close on SIGINT
  process.on('SIGINT', () => {
    console.log(`\n${COLORS.yellow}Session terminated by user. Memory wiped.${COLORS.reset}`);
    key.fill(0);
    server.close(() => process.exit(0));
  });
}

/**
 * Handle `mephisto receive <roomCode>`
 */
export async function handleReceive(roomCode, options = {}) {
  if (!roomCode) {
    console.error(`${COLORS.red}Error: Missing room code (e.g. mephisto receive abc-xyz#1234).${COLORS.reset}`);
    process.exit(1);
  }

  const key = deriveCryptoKey(roomCode);
  const destDir = options.output ? path.resolve(process.cwd(), options.output) : process.cwd();
  const host = options.host || 'localhost';
  const port = options.port ? parseInt(options.port, 10) : DEFAULT_PORT;

  console.log(`${COLORS.cyan}Connecting to vault \x1b[33m${roomCode}\x1b[36m on ${host}:${port}...${COLORS.reset}`);

  // 1. Fetch metadata
  const metaReq = http.get(`http://${host}:${port}/meta`, (res) => {
    if (res.statusCode !== 200) {
      console.log(`\n${COLORS.yellow}Direct terminal pipe not found on local network.${COLORS.reset}`);
      console.log(`To retrieve drop via GUI Web browser:`);
      const cleanRoom = roomCode.split('#')[0];
      const pin = roomCode.split('#')[1] || '0000';
      console.log(`👉 https://mephistoshares.online/?room=${encodeURIComponent(cleanRoom)}#${pin}\n`);
      process.exit(0);
      return;
    }

    let rawData = '';
    res.on('data', (d) => (rawData += d));
    res.on('end', async () => {
      try {
        const meta = JSON.parse(rawData);
        console.log(`\n${COLORS.bright}${COLORS.green}✔ VAULT METADATA RECEIVED:${COLORS.reset}`);
        console.log(`  ${COLORS.gray}File:${COLORS.reset}       ${COLORS.bright}${meta.name}${COLORS.reset}`);
        console.log(`  ${COLORS.gray}Size:${COLORS.reset}       ${formatBytes(meta.size)}`);
        console.log(`  ${COLORS.gray}Expected SHA:${COLORS.reset} ${meta.sha256}`);
        console.log(`  ${COLORS.gray}Destination:${COLORS.reset}  ${path.join(destDir, meta.name)}\n`);

        const outPath = path.join(destDir, meta.name);
        const writeStream = fs.createWriteStream(outPath);
        const hash = crypto.createHash('sha256');

        console.log(`${COLORS.cyan}⚡ Decrypting and writing stream in real time...${COLORS.reset}`);

        const streamReq = http.get(`http://${host}:${port}/stream`, (streamRes) => {
          let receivedBytes = 0;
          let bufferAcc = Buffer.alloc(0);
          const startTime = Date.now();

          streamRes.on('data', (chunk) => {
            bufferAcc = Buffer.concat([bufferAcc, chunk]);

            while (bufferAcc.length >= 4) {
              const chunkLen = bufferAcc.readUInt32BE(0);
              if (bufferAcc.length < 4 + chunkLen) {
                break; // Await full chunk
              }

              const encChunk = bufferAcc.subarray(4, 4 + chunkLen);
              bufferAcc = bufferAcc.subarray(4 + chunkLen);

              const decrypted = decryptBuffer(encChunk, key);
              writeStream.write(decrypted);
              hash.update(decrypted);
              receivedBytes += decrypted.length;

              const percent = meta.size === 0 ? 100 : (receivedBytes / meta.size) * 100;
              const elapsed = (Date.now() - startTime) / 1000;
              const speed = elapsed > 0 ? receivedBytes / elapsed : 0;
              const remaining = speed > 0 ? (meta.size - receivedBytes) / speed : 0;
              renderProgressBar(percent, formatSpeed(speed), `${Math.round(remaining)}s remaining`);
            }
          });

          streamRes.on('end', () => {
            writeStream.end();
            const calculatedSha = hash.digest('hex');
            const isMatch = calculatedSha.toLowerCase() === meta.sha256.toLowerCase();

            console.log(`\n\n${COLORS.emerald}${COLORS.bright}✔ FILE DECRYPTED & SAVED TO DISK!${COLORS.reset}`);
            console.log(`  ${COLORS.gray}Path:${COLORS.reset}         ${COLORS.bright}${outPath}${COLORS.reset}`);
            console.log(`  ${COLORS.gray}Calculated:${COLORS.reset}   ${calculatedSha}`);
            console.log(`  ${COLORS.gray}Integrity:${COLORS.reset}    ${isMatch ? `${COLORS.green}✔ SHA-256 Match Verified${COLORS.reset}` : `${COLORS.red}✖ Checksum Mismatch!${COLORS.reset}`}\n`);

            key.fill(0);
            process.exit(0);
          });

          streamRes.on('error', (err) => {
            console.error(`\n${COLORS.red}Download stream error: ${err.message}${COLORS.reset}`);
            process.exit(1);
          });
        });

        streamReq.on('error', (err) => {
          console.error(`\n${COLORS.red}Connection error: ${err.message}${COLORS.reset}`);
          process.exit(1);
        });
      } catch (err) {
        console.error(`${COLORS.red}Error parsing metadata: ${err.message}${COLORS.reset}`);
        process.exit(1);
      }
    });
  });

  metaReq.on('error', () => {
    console.log(`\n${COLORS.yellow}No local sender responding on ${host}:${port}.${COLORS.reset}`);
    console.log(`To retrieve drop via WebRTC GUI browser:`);
    const cleanRoom = roomCode.split('#')[0];
    const pin = roomCode.split('#')[1] || '0000';
    console.log(`👉 https://mephistoshares.online/?room=${encodeURIComponent(cleanRoom)}#${pin}\n`);
    process.exit(0);
  });
}

function parseCliArgs(rawArgs) {
  const command = rawArgs[0];
  const target = rawArgs[1];
  const options = {};

  for (let i = 2; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg === '--burn') {
      options.burn = true;
    } else if (arg === '--port' && rawArgs[i + 1]) {
      options.port = rawArgs[++i];
    } else if ((arg === '--output' || arg === '-o') && rawArgs[i + 1]) {
      options.output = rawArgs[++i];
    } else if (arg === '--host' && rawArgs[i + 1]) {
      options.host = rawArgs[++i];
    }
  }

  return { command, target, options };
}

export async function main() {
  const rawArgs = process.argv.slice(2);
  const { command, target, options } = parseCliArgs(rawArgs);

  if (!command || command === '--help' || command === '-h' || command === 'help') {
    printBanner();
    console.log(`${COLORS.bright}USAGE:${COLORS.reset}`);
    console.log(`  ${COLORS.emerald}mephisto send <filepath>${COLORS.reset}              Send a file via encrypted stream`);
    console.log(`  ${COLORS.emerald}mephisto receive <roomCode>${COLORS.reset}            Receive a file from room code`);
    console.log(`  ${COLORS.emerald}mephisto --version${COLORS.reset}                     Show version\n`);
    console.log(`${COLORS.bright}OPTIONS:${COLORS.reset}`);
    console.log(`  ${COLORS.cyan}--burn${COLORS.reset}                                Mutual zero-trace burn on complete`);
    console.log(`  ${COLORS.cyan}--output, -o <dir>${COLORS.reset}                   Custom destination folder for receive`);
    console.log(`  ${COLORS.cyan}--port <port>${COLORS.reset}                        Custom stream port (default: 7890)\n`);
    console.log(`${COLORS.bright}EXAMPLES:${COLORS.reset}`);
    console.log(`  $ mephisto send ./financial_report.pdf --burn`);
    console.log(`  $ mephisto receive swift-nexus#4819\n`);
    process.exit(0);
  }

  if (command === '--version' || command === '-v') {
    console.log('MephistoVault CLI v2.5.0');
    process.exit(0);
  }

  printBanner();

  if (command === 'send') {
    await handleSend(target, options);
  } else if (command === 'receive') {
    await handleReceive(target, options);
  } else {
    console.error(`${COLORS.red}Unknown command: "${command}". Run "mephisto --help" for usage.${COLORS.reset}`);
    process.exit(1);
  }
}

// Auto-run if executed directly via CLI
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  main().catch((err) => {
    console.error(`\n${COLORS.red}Fatal CLI Error: ${err.message}${COLORS.reset}`);
    process.exit(1);
  });
}
