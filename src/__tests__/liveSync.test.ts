import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DataConnection } from 'peerjs';
import {
  LiveSyncManager,
  generateSyncItemId,
  isLiveSyncMessage,
  downloadSyncItem,
  downloadAllAsZip,
  type SyncItem,
  type LiveSyncMessage,
} from '../lib/liveSync';

describe('LiveSync — Two-Way Shared Workspace Suite', () => {
  let broadcastMock: ReturnType<typeof vi.fn<(msg: LiveSyncMessage) => void>>;
  let manager: LiveSyncManager;

  beforeEach(() => {
    broadcastMock = vi.fn<(msg: LiveSyncMessage) => void>();
    manager = new LiveSyncManager({
      localPeerId: 'node-alpha',
      chunkSize: 1024, // 1KB for fast test slicing
      broadcastFn: (msg) => {
        broadcastMock(msg);
      },
    });
  });

  describe('Utility & Type Guards', () => {
    it('generates unique sync item IDs with sync- prefix', () => {
      const id1 = generateSyncItemId();
      const id2 = generateSyncItemId();
      expect(id1).toMatch(/^sync-[0-9a-z]+-[0-9a-z]+$/);
      expect(id2).toMatch(/^sync-[0-9a-z]+-[0-9a-z]+$/);
      expect(id1).not.toBe(id2);
    });

    it('validates LiveSyncMessage wire protocol discriminator', () => {
      expect(
        isLiveSyncMessage({
          type: 'live-item-add',
          item: { id: '1', senderId: 'node-1', name: 'test.txt', size: 10, type: 'text/plain', timestamp: 0, totalChunks: 1 },
        })
      ).toBe(true);

      expect(isLiveSyncMessage({ type: 'live-item-remove', itemId: '1', senderId: 'node-1' })).toBe(true);
      expect(
        isLiveSyncMessage({
          type: 'live-item-chunk',
          itemId: '1',
          chunkIndex: 0,
          totalChunks: 1,
          buffer: new ArrayBuffer(4),
          offset: 0,
        })
      ).toBe(true);
      expect(isLiveSyncMessage({ type: 'live-item-request', itemId: '1', senderId: 'node-1' })).toBe(true);
      expect(isLiveSyncMessage({ type: 'live-item-status', itemId: '1', status: 'completed', progress: 100 })).toBe(true);
      expect(isLiveSyncMessage({ type: 'live-sync-manifest', items: [] })).toBe(true);

      // Invalid messages
      expect(isLiveSyncMessage(null)).toBe(false);
      expect(isLiveSyncMessage(undefined)).toBe(false);
      expect(isLiveSyncMessage('hello')).toBe(false);
      expect(isLiveSyncMessage({ type: 'unknown-type' })).toBe(false);
      expect(isLiveSyncMessage({})).toBe(false);
    });
  });

  describe('LiveSyncManager Initialization & State', () => {
    it('initializes with default or custom options', () => {
      expect(manager.getLocalPeerId()).toBe('node-alpha');
      expect(manager.getItems()).toEqual([]);

      manager.setLocalPeerId('node-beta');
      expect(manager.getLocalPeerId()).toBe('node-beta');
    });

    it('subscribes and receives immediate initial state and updates', () => {
      const subscriber = vi.fn();
      const unsubscribe = manager.subscribe(subscriber);

      expect(subscriber).toHaveBeenCalledWith([]);

      unsubscribe();
    });
  });

  describe('Local File Adding and Transmission', () => {
    it('adds a local file, updates state to completed, and broadcasts live-item-add metadata', async () => {
      const onItemAdded = vi.fn();
      manager.onItemAdded = onItemAdded;

      const dummyContent = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const blob = new Blob([dummyContent], { type: 'application/octet-stream' });
      const item = await manager.addFile(blob, 'sample.bin');

      expect(item.id).toBeDefined();
      expect(item.name).toBe('sample.bin');
      expect(item.size).toBe(8);
      expect(item.status).toBe('completed');
      expect(item.progress).toBe(100);
      expect(item.senderId).toBe('node-alpha');
      expect(item.blob).toBe(blob);

      expect(onItemAdded).toHaveBeenCalledWith(item);
      expect(manager.getItems()).toHaveLength(1);
      expect(manager.getItem(item.id)).toEqual(item);

      // Verify broadcast called with live-item-add
      expect(broadcastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'live-item-add',
          item: expect.objectContaining({
            id: item.id,
            name: 'sample.bin',
            size: 8,
            senderId: 'node-alpha',
          }),
        })
      );
    });

    it('chunks file and broadcasts live-item-chunk messages for multi-chunk payloads', async () => {
      // Create a 2.5KB payload with 1KB chunkSize -> 3 chunks
      const payload = new Uint8Array(2500).fill(42);
      const blob = new Blob([payload], { type: 'application/octet-stream' });

      const item = await manager.addFile(blob, 'multichunk.dat');
      expect(item.totalChunks).toBe(3);

      // Give event loop time for async streaming
      await new Promise((resolve) => setTimeout(resolve, 50));

      const chunkCalls = broadcastMock.mock.calls
        .map((call) => call[0])
        .filter((msg): msg is Extract<LiveSyncMessage, { type: 'live-item-chunk' }> => msg?.type === 'live-item-chunk');
      expect(chunkCalls.length).toBe(3);
      expect(chunkCalls[0].chunkIndex).toBe(0);
      expect(chunkCalls[1].chunkIndex).toBe(1);
      expect(chunkCalls[2].chunkIndex).toBe(2);
    });

    it('adds multiple files sequentially via addFiles', async () => {
      const f1 = new Blob(['File 1'], { type: 'text/plain' });
      const f2 = new Blob(['File 2'], { type: 'text/plain' });

      const items = await manager.addFiles([f1, f2]);
      expect(items).toHaveLength(2);
      expect(manager.getItems()).toHaveLength(2);
    });
  });

  describe('Item Removal and Workspace Clearing', () => {
    it('removes local item, emits callback, and broadcasts live-item-remove', async () => {
      const onItemRemoved = vi.fn();
      manager.onItemRemoved = onItemRemoved;

      const blob = new Blob(['hello'], { type: 'text/plain' });
      const item = await manager.addFile(blob, 'removable.txt');
      expect(manager.getItems()).toHaveLength(1);

      const removed = manager.removeFile(item.id);
      expect(removed).toBe(true);
      expect(manager.getItems()).toHaveLength(0);
      expect(onItemRemoved).toHaveBeenCalledWith(item.id);

      expect(broadcastMock).toHaveBeenCalledWith({
        type: 'live-item-remove',
        itemId: item.id,
        senderId: 'node-alpha',
      });
    });

    it('clears entire workspace and removes all tracked assets', async () => {
      await manager.addFile(new Blob(['a']), 'a.txt');
      await manager.addFile(new Blob(['b']), 'b.txt');
      expect(manager.getItems()).toHaveLength(2);

      manager.clearWorkspace();
      expect(manager.getItems()).toHaveLength(0);
    });
  });

  describe('Receiving Remote Peer Messages (Peer Protocol)', () => {
    it('handles live-item-add from remote peer and sets transferring state', async () => {
      const onItemAdded = vi.fn();
      manager.onItemAdded = onItemAdded;

      const addMsg: LiveSyncMessage = {
        type: 'live-item-add',
        item: {
          id: 'peer-item-1',
          senderId: 'node-remote',
          name: 'remote-doc.pdf',
          size: 2048,
          type: 'application/pdf',
          timestamp: Date.now(),
          totalChunks: 2,
        },
      };

      const handled = await manager.handlePeerMessage(addMsg);
      expect(handled).toBe(true);

      const items = manager.getItems();
      expect(items).toHaveLength(1);
      const item = items[0];
      expect(item.id).toBe('peer-item-1');
      expect(item.senderId).toBe('node-remote');
      expect(item.status).toBe('transferring');
      expect(item.progress).toBe(0);
      expect(item.blob).toBeUndefined();
      expect(onItemAdded).toHaveBeenCalledWith(item);
    });

    it('handles live-item-chunk and reassembles complete Blob upon receiving all chunks', async () => {
      const onItemCompleted = vi.fn();
      manager.onItemCompleted = onItemCompleted;

      // 1. Peer sends live-item-add
      await manager.handlePeerMessage({
        type: 'live-item-add',
        item: {
          id: 'peer-item-2',
          senderId: 'node-remote',
          name: 'greetings.txt',
          size: 11,
          type: 'text/plain',
          timestamp: Date.now(),
          totalChunks: 2,
        },
      });

      // 2. Peer sends chunk 0: "Hello "
      const chunk0Buffer = new TextEncoder().encode('Hello ').buffer;
      await manager.handlePeerMessage({
        type: 'live-item-chunk',
        itemId: 'peer-item-2',
        chunkIndex: 0,
        totalChunks: 2,
        buffer: chunk0Buffer,
        offset: 0,
      });

      let item = manager.getItem('peer-item-2');
      expect(item?.progress).toBe(50);
      expect(item?.status).toBe('transferring');

      // 3. Peer sends chunk 1: "World"
      const chunk1Buffer = new TextEncoder().encode('World').buffer;
      await manager.handlePeerMessage({
        type: 'live-item-chunk',
        itemId: 'peer-item-2',
        chunkIndex: 1,
        totalChunks: 2,
        buffer: chunk1Buffer,
        offset: 6,
      });

      item = manager.getItem('peer-item-2');
      expect(item?.progress).toBe(100);
      expect(item?.status).toBe('completed');
      expect(item?.blob).toBeDefined();

      // Verify reassembled content
      const assembledText = await item!.blob!.text();
      expect(assembledText).toBe('Hello World');
      expect(onItemCompleted).toHaveBeenCalledWith(item);
    });

    it('handles live-item-remove from peer and removes item from local view', async () => {
      const onItemRemoved = vi.fn();
      manager.onItemRemoved = onItemRemoved;

      // Add item
      await manager.handlePeerMessage({
        type: 'live-item-add',
        item: {
          id: 'peer-del-1',
          senderId: 'node-remote',
          name: 'temp.txt',
          size: 100,
          type: 'text/plain',
          timestamp: Date.now(),
          totalChunks: 1,
        },
      });
      expect(manager.getItems()).toHaveLength(1);

      // Receive remove message
      await manager.handlePeerMessage({
        type: 'live-item-remove',
        itemId: 'peer-del-1',
        senderId: 'node-remote',
      });

      expect(manager.getItems()).toHaveLength(0);
      expect(onItemRemoved).toHaveBeenCalledWith('peer-del-1');
    });

    it('handles live-sync-manifest from peer and requests missing assets', async () => {
      const manifestMsg: LiveSyncMessage = {
        type: 'live-sync-manifest',
        items: [
          {
            id: 'manifest-1',
            senderId: 'node-remote',
            name: 'synced.png',
            size: 5000,
            type: 'image/png',
            status: 'completed',
            progress: 100,
            timestamp: 1000,
          },
        ],
      };

      await manager.handlePeerMessage(manifestMsg);
      const items = manager.getItems();
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe('manifest-1');
      expect(items[0].status).toBe('pending');

      // Should automatically broadcast live-item-request
      expect(broadcastMock).toHaveBeenCalledWith({
        type: 'live-item-request',
        itemId: 'manifest-1',
        senderId: 'node-alpha',
      });
    });

    it('handles live-item-request from peer by re-streaming chunks of local file', async () => {
      const content = new TextEncoder().encode('Payload to re-stream');
      const blob = new Blob([content], { type: 'text/plain' });
      const item = await manager.addFile(blob, 're-stream.txt');

      broadcastMock.mockClear();

      const mockConn = {
        open: true,
        send: vi.fn(),
      } as unknown as DataConnection;

      await manager.handlePeerMessage(
        {
          type: 'live-item-request',
          itemId: item.id,
          senderId: 'node-remote',
        },
        mockConn
      );

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(mockConn.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'live-item-chunk',
          itemId: item.id,
        })
      );
    });

    it('handles live-item-status updates from peer', async () => {
      await manager.handlePeerMessage({
        type: 'live-item-add',
        item: {
          id: 'status-item-1',
          senderId: 'node-remote',
          name: 'status.txt',
          size: 100,
          type: 'text/plain',
          timestamp: Date.now(),
          totalChunks: 1,
        },
      });

      await manager.handlePeerMessage({
        type: 'live-item-status',
        itemId: 'status-item-1',
        status: 'error',
        progress: 45,
      });

      const item = manager.getItem('status-item-1');
      expect(item?.status).toBe('error');
      expect(item?.progress).toBe(45);
    });
  });

  describe('Connection & Manifest Synchronization', () => {
    it('registers connections and sends manifest when connection is added', () => {
      const mockConn = {
        peer: 'peer-99',
        open: true,
        send: vi.fn(),
      } as unknown as DataConnection;

      // Add a local item first
      const blob = new Blob(['data'], { type: 'text/plain' });
      manager.addFile(blob, 'manifest-item.txt');

      manager.addConnection(mockConn);
      expect(manager.getConnections()).toHaveLength(1);
      expect(mockConn.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'live-sync-manifest',
          items: expect.any(Array),
        })
      );

      manager.removeConnection(mockConn);
      expect(manager.getConnections()).toHaveLength(0);
    });
  });

  describe('Batch ZIP Export & Single Downloads', () => {
    it('bundles multiple completed sync items into a single ZIP archive', async () => {
      const f1 = new Blob(['Alpha content'], { type: 'text/plain' });
      const f2 = new Blob(['Beta content'], { type: 'text/plain' });

      const item1: SyncItem = {
        id: 'zip-1',
        senderId: 'node-1',
        name: 'alpha.txt',
        size: f1.size,
        type: 'text/plain',
        status: 'completed',
        progress: 100,
        blob: f1,
        timestamp: Date.now(),
      };

      const item2: SyncItem = {
        id: 'zip-2',
        senderId: 'node-2',
        name: 'beta.txt',
        size: f2.size,
        type: 'text/plain',
        status: 'completed',
        progress: 100,
        blob: f2,
        timestamp: Date.now(),
      };

      const onProgress = vi.fn();
      const zipBlob = await downloadAllAsZip([item1, item2], 'workspace.zip', onProgress);

      expect(zipBlob).toBeDefined();
      expect(zipBlob?.size).toBeGreaterThan(0);
      expect(zipBlob?.type).toBe('application/zip');
      expect(onProgress).toHaveBeenCalled();
    });

    it('returns null when attempting to ZIP an empty item list', async () => {
      const result = await downloadAllAsZip([]);
      expect(result).toBeNull();
    });

    it('safely handles downloadSyncItem when blob is missing', () => {
      const itemWithoutBlob: SyncItem = {
        id: 'noblob-1',
        senderId: 'node-1',
        name: 'missing.dat',
        size: 100,
        type: 'application/octet-stream',
        status: 'transferring',
        progress: 20,
        timestamp: Date.now(),
      };

      const result = downloadSyncItem(itemWithoutBlob);
      expect(result).toBe(false);
    });
  });
});
