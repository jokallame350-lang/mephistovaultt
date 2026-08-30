import JSZip from 'jszip';
import type { DataConnection } from 'peerjs';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { CHUNK_SIZE } from './constants';
import { isCompressibleFileType, compressData, decompressData } from './compression';

/**
 * SyncItemStatus: Lifecycle states of a shared live workspace asset
 */
export type SyncItemStatus = 'pending' | 'transferring' | 'completed' | 'error' | 'removed';

/**
 * SyncItem: Represents a synchronized bidirectional workspace item
 */
export interface SyncItem {
  id: string;
  senderId: string;
  isMine?: boolean;
  name: string;
  size: number;
  type: string;
  status: SyncItemStatus;
  progress: number; // 0 to 100
  blob?: Blob;
  timestamp: number;
  sha256?: string;
  error?: string;
  totalChunks?: number;
  receivedChunks?: number;
  transferSpeed?: number; // bytes/sec
  compressed?: boolean;
  compressionRatio?: number;
  originalSize?: number;
}

/**
 * Discriminated union for LiveSync WebRTC wire protocol messages
 */
export type LiveSyncMessage =
  | {
      type: 'live-item-add';
      item: {
        id: string;
        senderId: string;
        name: string;
        size: number;
        type: string;
        timestamp: number;
        totalChunks: number;
        sha256?: string;
        compressed?: boolean;
        compressionRatio?: number;
        originalSize?: number;
      };
    }
  | {
      type: 'live-item-remove';
      itemId: string;
      senderId: string;
    }
  | {
      type: 'live-item-chunk';
      itemId: string;
      chunkIndex: number;
      totalChunks: number;
      buffer: ArrayBuffer;
      offset: number;
      compressed?: boolean;
    }
  | {
      type: 'live-item-request';
      itemId: string;
      senderId: string;
    }
  | {
      type: 'live-item-status';
      itemId: string;
      status: SyncItemStatus;
      progress: number;
    }
  | {
      type: 'live-sync-manifest';
      items: Array<Omit<SyncItem, 'blob'>>;
    };

/**
 * Type guard for LiveSync messages
 */
export function isLiveSyncMessage(msg: unknown): msg is LiveSyncMessage {
  if (!msg || typeof msg !== 'object') return false;
  const m = msg as Record<string, unknown>;
  return (
    typeof m.type === 'string' &&
    [
      'live-item-add',
      'live-item-remove',
      'live-item-chunk',
      'live-item-request',
      'live-item-status',
      'live-sync-manifest',
    ].includes(m.type)
  );
}

/**
 * Generates a unique, URL-safe item identifier
 */
export function generateSyncItemId(): string {
  const timePart = Date.now().toString(36);
  const randPart = Math.random().toString(36).substring(2, 9);
  return `sync-${timePart}-${randPart}`;
}

export interface LiveSyncManagerOptions {
  localPeerId?: string;
  chunkSize?: number;
  broadcastFn?: (msg: LiveSyncMessage) => void;
  onItemAdded?: (item: SyncItem) => void;
  onItemUpdated?: (item: SyncItem) => void;
  onItemRemoved?: (itemId: string) => void;
  onItemCompleted?: (item: SyncItem) => void;
  onError?: (itemId: string, error: string) => void;
}

/**
 * LiveSyncManager
 * Manages bidirectional shared workspace state, chunking, streaming,
 * peer status synchronization, and event notifications over WebRTC.
 */
export class LiveSyncManager {
  private localPeerId: string;
  private chunkSize: number;
  private items: Map<string, SyncItem>;
  private incomingChunks: Map<string, Map<number, ArrayBuffer>>;
  private activeUploads: Map<string, boolean>;
  private connections: Map<string, DataConnection>;
  private broadcastFn?: (msg: LiveSyncMessage) => void;
  private subscribers: Set<(items: SyncItem[]) => void>;

  // Callbacks
  public onItemAdded?: (item: SyncItem) => void;
  public onItemUpdated?: (item: SyncItem) => void;
  public onItemRemoved?: (itemId: string) => void;
  public onItemCompleted?: (item: SyncItem) => void;
  public onError?: (itemId: string, error: string) => void;

  constructor(optionsOrPeerId?: string | LiveSyncManagerOptions) {
    if (typeof optionsOrPeerId === 'string') {
      this.localPeerId = optionsOrPeerId;
      this.chunkSize = CHUNK_SIZE;
    } else {
      const options = optionsOrPeerId || {};
      this.localPeerId = options.localPeerId || `node-${Math.random().toString(36).substring(2, 7)}`;
      this.chunkSize = options.chunkSize || CHUNK_SIZE;
      this.broadcastFn = options.broadcastFn;
      this.onItemAdded = options.onItemAdded;
      this.onItemUpdated = options.onItemUpdated;
      this.onItemRemoved = options.onItemRemoved;
      this.onItemCompleted = options.onItemCompleted;
      this.onError = options.onError;
    }

    this.items = new Map();
    this.incomingChunks = new Map();
    this.activeUploads = new Map();
    this.connections = new Map();
    this.subscribers = new Set();
  }

  /**
   * Set local node's peer ID
   */
  public setLocalPeerId(peerId: string): void {
    this.localPeerId = peerId;
  }

  /**
   * Get local node's peer ID
   */
  public getLocalPeerId(): string {
    return this.localPeerId;
  }

  /**
   * Attach / update broadcast dispatcher
   */
  public setBroadcastFn(fn?: (msg: LiveSyncMessage) => void): void {
    this.broadcastFn = fn;
  }

  /**
   * Add a PeerJS DataConnection to the manager
   */
  public addConnection(conn: DataConnection): void {
    if (!conn || !conn.peer) return;
    this.connections.set(conn.peer, conn);
    // Send existing workspace manifest to new peer
    this.sendManifestToConnection(conn);
  }

  /**
   * Remove a PeerJS DataConnection
   */
  public removeConnection(peerOrConn: string | DataConnection): void {
    const id = typeof peerOrConn === 'string' ? peerOrConn : peerOrConn.peer;
    this.connections.delete(id);
  }

  /**
   * Get all active connections
   */
  public getConnections(): DataConnection[] {
    return Array.from(this.connections.values()).filter((c) => c.open);
  }

  /**
   * Subscribe to workspace state changes
   */
  public subscribe(listener: (items: SyncItem[]) => void): () => void {
    this.subscribers.add(listener);
    // Trigger immediately with current state
    listener(this.getItems());
    return () => {
      this.subscribers.delete(listener);
    };
  }

  private notifySubscribers(): void {
    const list = this.getItems();
    for (const listener of this.subscribers) {
      try {
        listener(list);
      } catch (err) {
        console.error('[LiveSyncManager] Subscriber error:', err);
      }
    }
  }

  /**
   * Get all items sorted by newest timestamp first
   */
  public getItems(): SyncItem[] {
    return Array.from(this.items.values())
      .filter((i) => i.status !== 'removed')
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Alias for getItems()
   */
  public getAllItems(): SyncItem[] {
    return this.getItems();
  }

  /**
   * Set item completed callback
   */
  public setOnItemCompleted(fn?: (item: SyncItem) => void): void {
    this.onItemCompleted = fn;
  }

  /**
   * Get item by ID
   */
  public getItem(id: string): SyncItem | undefined {
    return this.items.get(id);
  }

  /**
   * Broadcast a message to all connected peers and via the broadcast callback
   */
  public broadcast(msg: LiveSyncMessage): number {
    let count = 0;
    if (this.broadcastFn) {
      try {
        this.broadcastFn(msg);
        count++;
      } catch {
        // ignore
      }
    }

    for (const conn of this.connections.values()) {
      if (conn.open) {
        try {
          conn.send(msg);
          count++;
        } catch {
          // ignore individual send errors
        }
      }
    }

    return count;
  }

  /**
   * Synchronously or asynchronously register a local file to the sync table
   */
  public addLocalFile(
    fileOrBlob: File | Blob,
    customName?: string,
    customType?: string,
    sha256?: string
  ): SyncItem {
    const id = generateSyncItemId();
    const name =
      customName ||
      (fileOrBlob instanceof File ? fileOrBlob.name : `shared-file-${Date.now()}`);
    const size = fileOrBlob.size;
    const type =
      customType ||
      fileOrBlob.type ||
      (name.includes('.') ? `application/${name.split('.').pop()}` : 'application/octet-stream');

    const totalChunks = size === 0 ? 1 : Math.ceil(size / this.chunkSize);
    const isCompressible = isCompressibleFileType(type, name);

    const item: SyncItem = {
      id,
      senderId: this.localPeerId,
      isMine: true,
      name,
      size,
      type,
      status: 'completed',
      progress: 100,
      blob: fileOrBlob,
      timestamp: Date.now(),
      sha256,
      totalChunks,
      receivedChunks: totalChunks,
      compressed: isCompressible,
      originalSize: size,
    };

    this.items.set(id, item);
    this.notifySubscribers();
    this.onItemAdded?.(item);

    // Broadcast metadata to peers
    this.broadcast({
      type: 'live-item-add',
      item: {
        id,
        senderId: this.localPeerId,
        name,
        size,
        type,
        timestamp: item.timestamp,
        totalChunks,
        sha256,
        compressed: isCompressible,
        originalSize: size,
      },
    });

    // Stream chunks to connected peers in background
    if (size > 0) {
      this.streamFileChunks(item).catch((err) => {
        console.error(`[LiveSyncManager] Error streaming file ${name}:`, err);
      });
    }

    return item;
  }

  /**
   * Add a remote item metadata entry received from a peer
   */
  public addRemoteItem(meta: {
    id: string;
    senderId: string;
    name: string;
    size: number;
    type: string;
    timestamp?: number;
    totalChunks?: number;
    sha256?: string;
    compressed?: boolean;
    compressionRatio?: number;
    originalSize?: number;
  }): SyncItem {
    const isZeroByte = meta.size === 0;
    const item: SyncItem = {
      id: meta.id,
      senderId: meta.senderId,
      isMine: meta.senderId === this.localPeerId,
      name: meta.name,
      size: meta.size,
      type: meta.type,
      status: isZeroByte ? 'completed' : 'transferring',
      progress: isZeroByte ? 100 : 0,
      blob: isZeroByte ? new Blob([], { type: meta.type }) : undefined,
      timestamp: meta.timestamp || Date.now(),
      totalChunks: meta.totalChunks || (isZeroByte ? 1 : Math.ceil(meta.size / this.chunkSize)),
      receivedChunks: isZeroByte ? 1 : 0,
      sha256: meta.sha256,
      compressed: meta.compressed,
      compressionRatio: meta.compressionRatio,
      originalSize: meta.originalSize,
    };

    this.items.set(meta.id, item);
    this.incomingChunks.set(meta.id, new Map());
    this.notifySubscribers();
    this.onItemAdded?.(item);

    if (isZeroByte) {
      this.onItemCompleted?.(item);
    }
    return item;
  }

  /**
   * Add a local file/blob to the shared workspace and broadcast it to peers (Promise-based)
   */
  public async addFile(
    fileOrBlob: File | Blob,
    customName?: string,
    customType?: string,
    sha256?: string
  ): Promise<SyncItem> {
    return this.addLocalFile(fileOrBlob, customName, customType, sha256);
  }

  /**
   * Add multiple files to the workspace
   */
  public async addFiles(files: (File | Blob)[]): Promise<SyncItem[]> {
    const results: SyncItem[] = [];
    for (const f of files) {
      const item = await this.addFile(f);
      results.push(item);
    }
    return results;
  }

  /**
   * Remove an item from the shared workspace
   */
  public removeFile(itemId: string): boolean {
    const item = this.items.get(itemId);
    if (!item) return false;

    // Stop any active upload/download
    this.activeUploads.set(itemId, false);
    this.incomingChunks.delete(itemId);

    // Update status or remove
    item.status = 'removed';
    this.items.delete(itemId);

    // Broadcast removal to peers
    this.broadcast({
      type: 'live-item-remove',
      itemId,
      senderId: this.localPeerId,
    });

    this.notifySubscribers();
    this.onItemRemoved?.(itemId);
    return true;
  }

  /**
   * Alias for removeFile(itemId)
   */
  public removeItem(itemId: string): boolean {
    return this.removeFile(itemId);
  }

  /**
   * Clear all items in the workspace
   */
  public clearWorkspace(): void {
    const ids = Array.from(this.items.keys());
    for (const id of ids) {
      this.removeFile(id);
    }
  }

  /**
   * Stream chunks of an item to all connected peers with backpressure management
   */
  private async streamFileChunks(item: SyncItem, targetConn?: DataConnection): Promise<void> {
    if (!item.blob || item.size === 0) return;

    this.activeUploads.set(item.id, true);
    const totalChunks = item.totalChunks || Math.ceil(item.size / this.chunkSize);
    const isCompressible = item.compressed || isCompressibleFileType(item.type, item.name);

    try {
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        if (this.activeUploads.get(item.id) === false) {
          break; // Cancelled
        }

        const offset = chunkIndex * this.chunkSize;
        const end = Math.min(offset + this.chunkSize, item.size);
        const slice = item.blob.slice(offset, end);
        const buffer = await slice.arrayBuffer();

        let dataBuffer = buffer;
        let chunkCompressed = false;

        if (isCompressible) {
          try {
            const comp = await compressData(buffer, 'deflate');
            if (comp.compressed) {
              dataBuffer = comp.buffer;
              chunkCompressed = true;
            }
          } catch {
            // fallback to uncompressed chunk
          }
        }

        const chunkMsg: LiveSyncMessage = {
          type: 'live-item-chunk',
          itemId: item.id,
          chunkIndex,
          totalChunks,
          buffer: dataBuffer,
          offset,
          compressed: chunkCompressed,
        };

        if (targetConn && targetConn.open) {
          try {
            targetConn.send(chunkMsg);
          } catch {
            // ignore
          }
        } else {
          this.broadcast(chunkMsg);
        }

        // Micro-yield to allow browser rendering and prevent data channel queue congestion
        if (chunkIndex % 8 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
    } finally {
      this.activeUploads.delete(item.id);
    }
  }

  /**
   * Send the current workspace manifest to a specific connection
   */
  public sendManifestToConnection(conn: DataConnection): void {
    if (!conn || !conn.open) return;
    const nonRemoved = this.getItems().map(({ blob: _, ...rest }) => rest);
    if (nonRemoved.length === 0) return;

    try {
      conn.send({
        type: 'live-sync-manifest',
        items: nonRemoved,
      });
    } catch {
      // ignore
    }
  }

  /**
   * Request re-download / sync of an item from its original sender
   */
  public requestItem(itemId: string): void {
    const item = this.items.get(itemId);
    if (!item) return;

    this.broadcast({
      type: 'live-item-request',
      itemId,
      senderId: this.localPeerId,
    });
  }

  /**
   * Handle incoming WebRTC messages from peers synchronously
   */
  public handlePeerMessage(msg: unknown, fromConn?: DataConnection): boolean {
    if (!isLiveSyncMessage(msg)) return false;

    switch (msg.type) {
      case 'live-item-add': {
        const { id, senderId, name, size, type, timestamp, totalChunks, sha256, compressed, compressionRatio, originalSize } = msg.item;

        // If this node is the sender, skip duplicate handling
        if (senderId === this.localPeerId && this.items.has(id)) {
          return true;
        }

        const existing = this.items.get(id);
        if (existing && existing.blob) {
          return true;
        }

        this.addRemoteItem({
          id,
          senderId,
          name,
          size,
          type,
          timestamp,
          totalChunks,
          sha256,
          compressed,
          compressionRatio,
          originalSize,
        });
        return true;
      }

      case 'live-item-chunk': {
        const { itemId, chunkIndex, totalChunks, buffer, compressed } = msg;
        let item = this.items.get(itemId);

        if (!item) {
          item = {
            id: itemId,
            senderId: 'peer',
            isMine: false,
            name: `incoming-asset-${itemId.substring(0, 8)}`,
            size: totalChunks * this.chunkSize,
            type: 'application/octet-stream',
            status: 'transferring',
            progress: 0,
            timestamp: Date.now(),
            totalChunks,
            receivedChunks: 0,
          };
          this.items.set(itemId, item);
        }

        // If item is already completed, ignore redundant chunk
        if (item.status === 'completed' && item.blob) {
          return true;
        }

        let chunkMap = this.incomingChunks.get(itemId);
        if (!chunkMap) {
          chunkMap = new Map();
          this.incomingChunks.set(itemId, chunkMap);
        }

        const processChunk = (rawBuf: ArrayBuffer) => {
          chunkMap?.set(chunkIndex, rawBuf);
          if (!item) return;
          item.receivedChunks = chunkMap?.size || 0;
          item.totalChunks = totalChunks;
          item.status = 'transferring';

          const calcProgress = Math.min(
            99,
            Math.round(((chunkMap?.size || 0) / totalChunks) * 100)
          );
          item.progress = calcProgress;

          // Check if all chunks have arrived
          if ((chunkMap?.size || 0) >= totalChunks) {
            const orderedBuffers: ArrayBuffer[] = [];
            for (let i = 0; i < totalChunks; i++) {
              const buf = chunkMap?.get(i);
              if (buf) {
                orderedBuffers.push(buf);
              }
            }

            const completeBlob = new Blob(orderedBuffers, { type: item.type });
            item.blob = completeBlob;
            item.size = completeBlob.size;
            item.progress = 100;
            item.status = 'completed';

            this.incomingChunks.delete(itemId);
            this.notifySubscribers();
            this.onItemUpdated?.(item);
            this.onItemCompleted?.(item);
            return;
          }

          this.notifySubscribers();
          this.onItemUpdated?.(item);
        };

        if (compressed) {
          decompressData(buffer, 'deflate')
            .then(processChunk)
            .catch(() => processChunk(buffer));
        } else {
          processChunk(buffer);
        }

        return true;
      }

      case 'live-item-remove': {
        const { itemId } = msg;
        this.incomingChunks.delete(itemId);
        this.activeUploads.set(itemId, false);
        this.items.delete(itemId);

        this.notifySubscribers();
        this.onItemRemoved?.(itemId);
        return true;
      }

      case 'live-item-request': {
        const { itemId } = msg;
        const item = this.items.get(itemId);
        if (item && item.blob) {
          this.streamFileChunks(item, fromConn).catch((err) => {
            console.error(`[LiveSyncManager] Re-stream failed for ${itemId}:`, err);
          });
        }
        return true;
      }

      case 'live-item-status': {
        const { itemId, status, progress } = msg;
        const item = this.items.get(itemId);
        if (item) {
          item.status = status;
          item.progress = progress;
          this.notifySubscribers();
          this.onItemUpdated?.(item);
        }
        return true;
      }

      case 'live-sync-manifest': {
        const { items } = msg;
        let changed = false;

        for (const meta of items) {
          if (!this.items.has(meta.id)) {
            const placeholder: SyncItem = {
              ...meta,
              isMine: meta.senderId === this.localPeerId,
              status: meta.size === 0 ? 'completed' : 'pending',
              progress: meta.size === 0 ? 100 : 0,
              blob: meta.size === 0 ? new Blob([], { type: meta.type }) : undefined,
            };
            this.items.set(meta.id, placeholder);
            this.incomingChunks.set(meta.id, new Map());
            changed = true;

            if (meta.size > 0) {
              this.requestItem(meta.id);
            }
          }
        }

        if (changed) {
          this.notifySubscribers();
        }
        return true;
      }

      default:
        return false;
    }
  }

  /**
   * Reset manager state
   */
  public destroy(): void {
    this.items.clear();
    this.incomingChunks.clear();
    this.activeUploads.clear();
    this.connections.clear();
    this.subscribers.clear();
  }
}

/**
 * Triggers native browser download for a SyncItem blob
 */
export function downloadSyncItem(item: SyncItem): boolean {
  if (!item.blob) {
    return false;
  }

  if (typeof document === 'undefined') {
    return true;
  }

  try {
    const url = URL.createObjectURL(item.blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = item.name || 'download';
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
    return true;
  } catch (err) {
    console.error('[downloadSyncItem] Download failed:', err);
    return false;
  }
}

/**
 * Bundles all completed items into a single ZIP archive and triggers download
 */
export async function downloadAllAsZip(
  items: SyncItem[],
  zipFilename = 'mephisto-live-workspace.zip',
  onProgress?: (percent: number) => void
): Promise<Blob | null> {
  const completedItems = items.filter((i) => i.blob && i.status === 'completed');
  if (completedItems.length === 0) return null;

  const zip = new JSZip();
  const nameCounts = new Map<string, number>();

  for (const item of completedItems) {
    if (!item.blob) continue;
    let filename = item.name || 'unnamed-file';

    if (nameCounts.has(filename)) {
      const count = (nameCounts.get(filename) || 0) + 1;
      nameCounts.set(filename, count);
      const dotIndex = filename.lastIndexOf('.');
      if (dotIndex > 0) {
        filename = `${filename.substring(0, dotIndex)} (${count})${filename.substring(dotIndex)}`;
      } else {
        filename = `${filename} (${count})`;
      }
    } else {
      nameCounts.set(filename, 1);
    }

    try {
      if (typeof item.blob.arrayBuffer === 'function') {
        const ab = await item.blob.arrayBuffer();
        zip.file(filename, ab);
      } else {
        zip.file(filename, item.blob);
      }
    } catch {
      zip.file(filename, item.blob);
    }
  }

  const zipBlob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    },
    (metadata) => {
      onProgress?.(Math.round(metadata.percent));
    }
  );

  const dummyItem: SyncItem = {
    id: 'zip-download',
    senderId: 'local',
    isMine: true,
    name: zipFilename,
    size: zipBlob.size,
    type: 'application/zip',
    status: 'completed',
    progress: 100,
    blob: zipBlob,
    timestamp: Date.now(),
  };

  downloadSyncItem(dummyItem);
  return zipBlob;
}

/**
 * React Hook for seamless Two-Way Live Sync Table integration
 */
export function useLiveSync(options?: {
  localPeerId?: string;
  connections?: DataConnection[];
  broadcastFn?: (msg: LiveSyncMessage) => void;
  onItemCompleted?: (item: SyncItem) => void;
}) {
  const [manager] = useState(
    () =>
      new LiveSyncManager({
        localPeerId: options?.localPeerId,
        broadcastFn: options?.broadcastFn,
        onItemCompleted: options?.onItemCompleted,
      })
  );
  const [items, setItems] = useState<SyncItem[]>([]);

  // Sync options to manager
  useEffect(() => {
    if (options?.localPeerId) {
      manager.setLocalPeerId(options.localPeerId);
    }
    if (options?.broadcastFn) {
      manager.setBroadcastFn(options.broadcastFn);
    }
    if (options?.onItemCompleted) {
      manager.setOnItemCompleted(options.onItemCompleted);
    }
  }, [manager, options?.localPeerId, options?.broadcastFn, options?.onItemCompleted]);

  // Sync connections
  useEffect(() => {
    if (options?.connections) {
      for (const conn of options.connections) {
        manager.addConnection(conn);
      }
    }
  }, [manager, options?.connections]);

  // Subscribe to changes
  useEffect(() => {
    const unsubscribe = manager.subscribe((newItems) => {
      setItems([...newItems]);
    });
    return () => {
      unsubscribe();
    };
  }, [manager]);

  const addFile = useCallback(
    async (file: File | Blob, customName?: string, customType?: string, sha256?: string) => {
      return manager.addFile(file, customName, customType, sha256);
    },
    [manager]
  );

  const addFiles = useCallback(
    async (files: (File | Blob)[]) => {
      return manager.addFiles(files);
    },
    [manager]
  );

  const removeFile = useCallback(
    (itemId: string) => {
      return manager.removeFile(itemId);
    },
    [manager]
  );

  const clearWorkspace = useCallback(() => {
    manager.clearWorkspace();
  }, [manager]);

  const handlePeerMessage = useCallback(
    (msg: unknown, fromConn?: DataConnection) => {
      return manager.handlePeerMessage(msg, fromConn);
    },
    [manager]
  );

  const activeItems = useMemo(
    () => items.filter((i) => i.status === 'transferring' || i.status === 'pending'),
    [items]
  );

  const completedItems = useMemo(
    () => items.filter((i) => i.status === 'completed'),
    [items]
  );

  const totalWorkspaceSize = useMemo(
    () => items.reduce((acc, curr) => acc + (curr.size || 0), 0),
    [items]
  );

  return {
    manager,
    items,
    activeItems,
    completedItems,
    totalWorkspaceSize,
    addFile,
    addFiles,
    removeFile,
    clearWorkspace,
    handlePeerMessage,
    downloadSyncItem,
    downloadAllAsZip: (filename?: string, onProgress?: (p: number) => void) =>
      downloadAllAsZip(items, filename, onProgress),
  };
}
