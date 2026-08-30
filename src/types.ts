import type { DataConnection } from 'peerjs';

// ── App Mode ──
export type AppMode = 'idle' | 'send' | 'receive';

// ── PeerJS Messages (discriminated union) ──
export type PeerMessage =
  | { type: 'metadata'; name: string; size: number; mime: string; sha256?: string; expirationSec?: number }
  | { type: 'chunk'; buffer: ArrayBuffer; offset: number; chunkIndex?: number }
  | { type: 'request-metadata' }
  | { type: 'request-chunk'; offset: number; chunkIndex?: number }
  | { type: 'chat'; text?: string; encrypted?: ArrayBuffer }
  | { type: 'burn' }
  | { type: 'swarm-have'; chunkIndex: number }
  | { type: 'swarm-bitfield'; bitfield: number[] }
  | { type: 'swarm-peers'; peers: string[] }
  | { type: 'swarm-request-chunk'; chunkIndex: number };

// ── Swarm Coordination Types ──
export interface SwarmPeerInfo {
  id: string;
  isSeed: boolean;
  downloadedChunks: number;
  totalChunks: number;
  bytesDownloaded: number;
  bytesUploaded: number;
  lastSeen: number;
}

export interface SwarmStats {
  totalPeers: number;
  seeds: number;
  leechers: number;
  totalUploaded: number;
  totalDownloaded: number;
  completionRatio: number;
}

export interface LiveMediaState {
  isMedia: boolean;
  isAudio: boolean;
  isVideo: boolean;
  liveMediaUrl: string | null;
  streamableBytes: number;
  streamableProgress: number;
  bufferedChunks: number;
}

// ── Lobby / Discovery Messages ──
export type LobbyMessage =
  | { type: 'announce'; device: DeviceInfo }
  | { type: 'invite'; targetId: string; code: string; fromName?: string }
  | { type: 'lobby-sync'; devices: Record<string, DeviceInfo> };

export type BroadcastMessage =
  | { type: 'announce'; id: string; name: string; time: number; code?: string; mode?: AppMode }
  | { type: 'invite'; targetId: string; code: string; fromName?: string }
  | { type: 'lobby-sync'; devices: Record<string, DeviceInfo> }
  | { type: 'leave'; id: string };

// ── Device Info ──
export interface DeviceInfo {
  id: string;
  name: string;
  time: number;
  code?: string;
  mode?: AppMode;
}

// ── File-related ──
export interface FileMeta {
  name: string;
  size: number;
  type: string;
  sha256?: string;
}

export interface CompletedFile {
  blob: Blob;
  name: string;
  type: string;
  sha256?: string;
  isShaVerified?: boolean;
}

export interface ZipEntry {
  name: string;
  path: string;
  dir: boolean;
  size: number;
}

// ── Chat ──
export interface ChatMessage {
  id: number;
  text: string;
  sender: 'me' | 'peer';
  emoji?: string;
}

// ── Lobby Environment ──
export interface LobbyEnv {
  readonly isHost: boolean;
  readonly lobbyConn: DataConnection | null;
  broadcastToClients: (payload: LobbyMessage | BroadcastMessage) => void;
}

// ── File System & Drag-Drop Extended Types ──
export interface FileWithCustomPath extends File {
  customPath?: string;
}

export interface WebKitEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
}

export interface WebKitFileEntry extends WebKitEntry {
  file: (successCallback: (file: File) => void, errorCallback?: (error: Error) => void) => void;
}

export interface WebKitDirectoryReader {
  readEntries: (successCallback: (entries: WebKitEntry[]) => void, errorCallback?: (error: Error) => void) => void;
}

export interface WebKitDirectoryEntry extends WebKitEntry {
  createReader: () => WebKitDirectoryReader;
}

// ── PeerJS Extended Interfaces ──
export interface PeerDataConnectionExt extends DataConnection {
  _dc?: RTCDataChannel;
}

export interface PeerCustomError extends Error {
  type?: string;
}
