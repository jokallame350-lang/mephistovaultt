import type { DataConnection } from 'peerjs';
import type { PeerMessage, SwarmStats, SwarmPeerInfo } from '../types';
import { CHUNK_SIZE } from './constants';

/**
 * SwarmBitfield
 * High-performance bitfield tracker for chunk availability in P2P Swarm transfers.
 */
export class SwarmBitfield {
  private chunks: Set<number>;

  constructor(initialChunks?: number[]) {
    this.chunks = new Set<number>(initialChunks || []);
  }

  set(chunkIndex: number): void {
    if (chunkIndex >= 0) {
      this.chunks.add(chunkIndex);
    }
  }

  has(chunkIndex: number): boolean {
    return this.chunks.has(chunkIndex);
  }

  delete(chunkIndex: number): void {
    this.chunks.delete(chunkIndex);
  }

  clear(): void {
    this.chunks.clear();
  }

  toArray(): number[] {
    return Array.from(this.chunks).sort((a, b) => a - b);
  }

  fromArray(chunks: number[]): void {
    this.chunks = new Set<number>(chunks.filter((c) => c >= 0));
  }

  cardinality(): number {
    return this.chunks.size;
  }

  isComplete(totalChunks: number): boolean {
    if (totalChunks <= 0) return true;
    if (this.chunks.size < totalChunks) return false;
    for (let i = 0; i < totalChunks; i++) {
      if (!this.chunks.has(i)) return false;
    }
    return true;
  }

  getMissingChunks(totalChunks: number): number[] {
    const missing: number[] = [];
    for (let i = 0; i < totalChunks; i++) {
      if (!this.chunks.has(i)) {
        missing.push(i);
      }
    }
    return missing;
  }

  getAvailableChunks(totalChunks: number): number[] {
    const available: number[] = [];
    for (let i = 0; i < totalChunks; i++) {
      if (this.chunks.has(i)) {
        available.push(i);
      }
    }
    return available;
  }

  /**
   * Returns contiguous chunks starting from 0 (crucial for progressive media playback)
   */
  getContiguousPrefixCount(): number {
    let count = 0;
    while (this.chunks.has(count)) {
      count++;
    }
    return count;
  }
}

/**
 * SwarmPeer
 * Represents a connected peer node in the Mephisto Swarm mesh.
 */
export class SwarmPeer {
  id: string;
  conn: DataConnection | null;
  bitfield: SwarmBitfield;
  isSeed: boolean;
  bytesDownloaded: number;
  bytesUploaded: number;
  lastSeen: number;
  latencyMs: number;

  constructor(id: string, conn: DataConnection | null = null, isSeed = false) {
    this.id = id;
    this.conn = conn;
    this.bitfield = new SwarmBitfield();
    this.isSeed = isSeed;
    this.bytesDownloaded = 0;
    this.bytesUploaded = 0;
    this.lastSeen = Date.now();
    this.latencyMs = 0;
  }

  getInfo(totalChunks: number): SwarmPeerInfo {
    return {
      id: this.id,
      isSeed: this.isSeed || (totalChunks > 0 && this.bitfield.isComplete(totalChunks)),
      downloadedChunks: this.bitfield.cardinality(),
      totalChunks,
      bytesDownloaded: this.bytesDownloaded,
      bytesUploaded: this.bytesUploaded,
      lastSeen: this.lastSeen,
    };
  }
}

/**
 * SwarmCoordinator
 * Coordinates multi-peer mesh connections, chunk availability distribution,
 * rarest-first scheduling for swarm downloads, sequential scheduling for media streaming,
 * and broadcast message dispatch.
 */
export class SwarmCoordinator {
  private peers: Map<string, SwarmPeer>;
  private localBitfield: SwarmBitfield;
  private totalChunks: number;
  private chunkSize: number;
  private totalBytes: number;

  constructor(totalChunksOrBytes = 0) {
    this.peers = new Map();
    this.localBitfield = new SwarmBitfield();
    this.totalChunks = totalChunksOrBytes;
    this.chunkSize = CHUNK_SIZE;
    this.totalBytes = totalChunksOrBytes * CHUNK_SIZE;
  }

  registerPeer(peerId: string, conn: DataConnection | null = null, isSeed = false): SwarmPeer {
    return this.addPeer(peerId, conn, isSeed);
  }

  updatePeerChunk(peerId: string, chunkIndex: number): void {
    this.updatePeerHave(peerId, chunkIndex);
  }

  getPeersWithChunk(chunkIndex: number): string[] {
    const list: string[] = [];
    for (const [peerId, peer] of this.peers.entries()) {
      if (peer.bitfield.has(chunkIndex)) {
        list.push(peerId);
      }
    }
    return list;
  }

  findRarestMissingChunk(localBitfield?: Set<number> | SwarmBitfield): number | null {
    const missing: number[] = [];
    for (let i = 0; i < this.totalChunks; i++) {
      if (localBitfield instanceof Set) {
        if (!localBitfield.has(i)) missing.push(i);
      } else if (localBitfield) {
        if (!localBitfield.has(i)) missing.push(i);
      } else {
        if (!this.localBitfield.has(i)) missing.push(i);
      }
    }

    if (missing.length === 0) return null;

    const availability = this.getChunkAvailabilityMap();
    const availableMissing = missing.filter((c) => (availability.get(c) || 0) > 0);
    if (availableMissing.length === 0) return null;

    availableMissing.sort((a, b) => (availability.get(a) || 0) - (availability.get(b) || 0));
    return availableMissing[0];
  }

  setFileInfo(totalBytes: number, chunkSize: number = CHUNK_SIZE): void {
    this.totalBytes = totalBytes;
    this.chunkSize = chunkSize || CHUNK_SIZE;
    this.totalChunks = totalBytes === 0 ? 0 : Math.ceil(totalBytes / this.chunkSize);
  }

  getTotalChunks(): number {
    return this.totalChunks;
  }

  getChunkSize(): number {
    return this.chunkSize;
  }

  getTotalBytes(): number {
    return this.totalBytes;
  }

  addPeer(peerId: string, conn: DataConnection | null = null, isSeed = false): SwarmPeer {
    let peer = this.peers.get(peerId);
    if (!peer) {
      peer = new SwarmPeer(peerId, conn, isSeed);
      this.peers.set(peerId, peer);
    } else {
      if (conn) peer.conn = conn;
      if (isSeed) peer.isSeed = true;
      peer.lastSeen = Date.now();
    }
    return peer;
  }

  removePeer(peerId: string): boolean {
    return this.peers.delete(peerId);
  }

  getPeer(peerId: string): SwarmPeer | undefined {
    return this.peers.get(peerId);
  }

  getAllPeers(): SwarmPeer[] {
    return Array.from(this.peers.values());
  }

  getPeerCount(): number {
    return this.peers.size;
  }

  getActiveConnectionCount(): number {
    let count = 0;
    for (const peer of this.peers.values()) {
      if (peer.conn && peer.conn.open) {
        count++;
      }
    }
    return count;
  }

  markLocalHave(chunkIndex: number): void {
    this.localBitfield.set(chunkIndex);
  }

  markAllLocalHave(totalChunks?: number): void {
    const total = totalChunks ?? this.totalChunks;
    for (let i = 0; i < total; i++) {
      this.localBitfield.set(i);
    }
  }

  isLocallyComplete(): boolean {
    return this.localBitfield.isComplete(this.totalChunks);
  }

  getLocalBitfield(): SwarmBitfield {
    return this.localBitfield;
  }

  getLocalMissingChunks(): number[] {
    return this.localBitfield.getMissingChunks(this.totalChunks);
  }

  updatePeerBitfield(peerId: string, bitfieldArray: number[]): void {
    let peer = this.peers.get(peerId);
    if (!peer) {
      peer = this.addPeer(peerId);
    }
    peer.bitfield.fromArray(bitfieldArray);
    peer.lastSeen = Date.now();
    if (this.totalChunks > 0 && peer.bitfield.isComplete(this.totalChunks)) {
      peer.isSeed = true;
    }
  }

  updatePeerHave(peerId: string, chunkIndex: number): void {
    let peer = this.peers.get(peerId);
    if (!peer) {
      peer = this.addPeer(peerId);
    }
    peer.bitfield.set(chunkIndex);
    peer.lastSeen = Date.now();
    if (this.totalChunks > 0 && peer.bitfield.isComplete(this.totalChunks)) {
      peer.isSeed = true;
    }
  }

  /**
   * Calculates chunk availability across all connected peers in the swarm.
   */
  getChunkAvailabilityMap(): Map<number, number> {
    const counts = new Map<number, number>();
    for (let i = 0; i < this.totalChunks; i++) {
      counts.set(i, 0);
    }

    for (const peer of this.peers.values()) {
      const peerChunks = peer.bitfield.toArray();
      for (const chunk of peerChunks) {
        if (chunk < this.totalChunks) {
          counts.set(chunk, (counts.get(chunk) || 0) + 1);
        }
      }
    }
    return counts;
  }

  /**
   * Rarest-First Chunk Selection:
   * Returns missing chunks sorted by rarest availability across the swarm to maximize swarm throughput.
   */
  getRarestMissingChunks(limit = 100): number[] {
    const missing = this.getLocalMissingChunks();
    if (missing.length === 0) return [];

    const availability = this.getChunkAvailabilityMap();

    // Sort missing chunks by least frequent availability in swarm, but >= 1 available
    const sorted = missing
      .filter((chunk) => (availability.get(chunk) || 0) > 0)
      .sort((a, b) => {
        const countA = availability.get(a) || 0;
        const countB = availability.get(b) || 0;
        return countA - countB;
      });

    return sorted.slice(0, limit);
  }

  /**
   * Sequential Chunk Selection:
   * Returns missing chunks in strict sequential order (0, 1, 2, ...), optimized for instant live media streaming.
   */
  getSequentialMissingChunks(limit = 32): number[] {
    const missing = this.getLocalMissingChunks();
    return missing.slice(0, limit);
  }

  /**
   * Selects the optimal peer from which to request a specific chunk.
   * Prefers peers with open connections, least uploaded load, and recent activity.
   */
  selectBestPeerForChunk(chunkIndex: number): SwarmPeer | null {
    const candidatePeers: SwarmPeer[] = [];

    for (const peer of this.peers.values()) {
      if (peer.bitfield.has(chunkIndex) && peer.conn && peer.conn.open) {
        candidatePeers.push(peer);
      }
    }

    if (candidatePeers.length === 0) {
      // Fallback to any peer that might have it
      for (const peer of this.peers.values()) {
        if (peer.bitfield.has(chunkIndex)) {
          candidatePeers.push(peer);
        }
      }
    }

    if (candidatePeers.length === 0) return null;

    // Pick peer with lowest bytesUploaded load (round-robin / load balance)
    candidatePeers.sort((a, b) => a.bytesUploaded - b.bytesUploaded);
    return candidatePeers[0];
  }

  recordUpload(peerId: string, bytes: number): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.bytesUploaded += bytes;
      peer.lastSeen = Date.now();
    }
  }

  recordDownload(peerId: string, bytes: number): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.bytesDownloaded += bytes;
      peer.lastSeen = Date.now();
    }
  }

  /**
   * Broadcasts a message to all open peer connections.
   */
  broadcast(msg: PeerMessage, filter?: (peer: SwarmPeer) => boolean): number {
    let sentCount = 0;
    for (const peer of this.peers.values()) {
      if (peer.conn && peer.conn.open) {
        if (!filter || filter(peer)) {
          try {
            peer.conn.send(msg);
            sentCount++;
          } catch {
            // ignore failure on single peer
          }
        }
      }
    }
    return sentCount;
  }

  /**
   * Generates swarm metrics and status summary
   */
  getSwarmStats(): SwarmStats {
    let seeds = 0;
    let leechers = 0;
    let totalUploaded = 0;
    let totalDownloaded = 0;

    for (const peer of this.peers.values()) {
      if (peer.isSeed || (this.totalChunks > 0 && peer.bitfield.isComplete(this.totalChunks))) {
        seeds++;
      } else {
        leechers++;
      }
      totalUploaded += peer.bytesUploaded;
      totalDownloaded += peer.bytesDownloaded;
    }

    const localCardinality = this.localBitfield.cardinality();
    const completionRatio =
      this.totalChunks === 0 ? 1 : Math.min(1, localCardinality / this.totalChunks);

    return {
      totalPeers: this.peers.size,
      seeds,
      leechers,
      totalUploaded,
      totalDownloaded,
      completionRatio,
    };
  }

  createBitfieldMessage(): PeerMessage {
    return {
      type: 'swarm-bitfield',
      bitfield: this.localBitfield.toArray(),
    };
  }

  createHaveMessage(chunkIndex: number): PeerMessage {
    return {
      type: 'swarm-have',
      chunkIndex,
    };
  }

  createPeersMessage(): PeerMessage {
    return {
      type: 'swarm-peers',
      peers: Array.from(this.peers.keys()),
    };
  }

  reset(): void {
    this.peers.clear();
    this.localBitfield.clear();
    this.totalChunks = 0;
    this.chunkSize = CHUNK_SIZE;
    this.totalBytes = 0;
  }
}

/**
 * Media detection utility functions for instant progressive streaming.
 */
export function isMediaMimeOrFilename(mime: string = '', filename: string = ''): {
  isMedia: boolean;
  isAudio: boolean;
  isVideo: boolean;
  isImage: boolean;
} {
  const m = mime.toLowerCase();
  const f = filename.toLowerCase();

  const isAudio =
    m.startsWith('audio/') ||
    /\.(mp3|wav|ogg|oga|aac|m4a|flac|opus|weba|wma|aiff)$/i.test(f);

  const isVideo =
    m.startsWith('video/') ||
    /\.(mp4|webm|ogv|mkv|mov|m4v|avi|wmv|flv|3gp)$/i.test(f);

  const isImage =
    m.startsWith('image/') ||
    /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|heic|avif)$/i.test(f);

  return {
    isMedia: isAudio || isVideo,
    isAudio,
    isVideo,
    isImage,
  };
}

/**
 * Returns clean standard MIME type for progressive browser media streaming.
 */
export function getStandardMediaMime(mime: string = '', filename: string = ''): string {
  if (mime && mime !== 'application/octet-stream') {
    return mime;
  }
  const f = filename.toLowerCase();
  if (f.endsWith('.mp4')) return 'video/mp4';
  if (f.endsWith('.webm')) return 'video/webm';
  if (f.endsWith('.ogv') || f.endsWith('.ogg')) return 'video/ogg';
  if (f.endsWith('.mov')) return 'video/quicktime';
  if (f.endsWith('.mp3')) return 'audio/mpeg';
  if (f.endsWith('.wav')) return 'audio/wav';
  if (f.endsWith('.aac')) return 'audio/aac';
  if (f.endsWith('.flac')) return 'audio/flac';
  if (f.endsWith('.m4a')) return 'audio/mp4';
  if (f.endsWith('.opus')) return 'audio/opus';
  return mime || 'application/octet-stream';
}
