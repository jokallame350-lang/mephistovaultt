import { describe, it, expect, vi } from 'vitest';
import {
  SwarmBitfield,
  SwarmPeer,
  SwarmCoordinator,
  isMediaMimeOrFilename,
  getStandardMediaMime,
} from '../lib/swarm';
import type { DataConnection } from 'peerjs';

describe('Swarm & Progressive Media Streaming Suite', () => {
  describe('SwarmBitfield', () => {
    it('initializes with empty or provided chunk array', () => {
      const empty = new SwarmBitfield();
      expect(empty.cardinality()).toBe(0);
      expect(empty.toArray()).toEqual([]);

      const initialized = new SwarmBitfield([0, 2, 5]);
      expect(initialized.cardinality()).toBe(3);
      expect(initialized.has(0)).toBe(true);
      expect(initialized.has(1)).toBe(false);
      expect(initialized.has(2)).toBe(true);
      expect(initialized.toArray()).toEqual([0, 2, 5]);
    });

    it('sets, checks, deletes, and clears chunks correctly', () => {
      const bitfield = new SwarmBitfield();
      bitfield.set(10);
      bitfield.set(20);
      expect(bitfield.has(10)).toBe(true);
      expect(bitfield.has(20)).toBe(true);
      expect(bitfield.has(30)).toBe(false);

      bitfield.delete(10);
      expect(bitfield.has(10)).toBe(false);
      expect(bitfield.cardinality()).toBe(1);

      bitfield.clear();
      expect(bitfield.cardinality()).toBe(0);
      expect(bitfield.toArray()).toEqual([]);
    });

    it('computes missing and available chunks for a given total', () => {
      const bitfield = new SwarmBitfield([0, 2, 4]);
      const missing = bitfield.getMissingChunks(5);
      const available = bitfield.getAvailableChunks(5);

      expect(missing).toEqual([1, 3]);
      expect(available).toEqual([0, 2, 4]);
    });

    it('verifies completeness', () => {
      const bitfield = new SwarmBitfield([0, 1, 2, 3]);
      expect(bitfield.isComplete(4)).toBe(true);
      expect(bitfield.isComplete(5)).toBe(false);

      const empty = new SwarmBitfield();
      expect(empty.isComplete(0)).toBe(true);
    });

    it('calculates contiguous prefix count for progressive live streaming', () => {
      const bitfield = new SwarmBitfield([0, 1, 2, 4, 5]);
      // Contiguous from 0 is 0, 1, 2 (count = 3)
      expect(bitfield.getContiguousPrefixCount()).toBe(3);

      bitfield.set(3);
      // Now contiguous from 0 is 0, 1, 2, 3, 4, 5 (count = 6)
      expect(bitfield.getContiguousPrefixCount()).toBe(6);

      const bitfieldNoZero = new SwarmBitfield([1, 2, 3]);
      expect(bitfieldNoZero.getContiguousPrefixCount()).toBe(0);
    });
  });

  describe('SwarmPeer', () => {
    it('creates peer representation and tracks metrics', () => {
      const mockConn = {
        open: true,
        send: vi.fn(),
      } as unknown as DataConnection;

      const peer = new SwarmPeer('peer-123', mockConn, false);
      expect(peer.id).toBe('peer-123');
      expect(peer.isSeed).toBe(false);
      expect(peer.bytesDownloaded).toBe(0);
      expect(peer.bytesUploaded).toBe(0);

      peer.bitfield.set(0);
      peer.bitfield.set(1);
      peer.bytesUploaded += 512000;
      peer.bytesDownloaded += 256000;

      const info = peer.getInfo(4);
      expect(info.id).toBe('peer-123');
      expect(info.downloadedChunks).toBe(2);
      expect(info.totalChunks).toBe(4);
      expect(info.bytesUploaded).toBe(512000);
      expect(info.bytesDownloaded).toBe(256000);
      expect(info.isSeed).toBe(false);
    });
  });

  describe('SwarmCoordinator', () => {
    it('computes totalChunks correctly from file size and chunk size', () => {
      const coordinator = new SwarmCoordinator();
      coordinator.setFileInfo(1024 * 1024, 256 * 1024); // 1MB with 256KB chunks = 4 chunks
      expect(coordinator.getTotalChunks()).toBe(4);
      expect(coordinator.getTotalBytes()).toBe(1024 * 1024);
      expect(coordinator.getChunkSize()).toBe(256 * 1024);
    });

    it('manages peers and tracks active connections', () => {
      const coordinator = new SwarmCoordinator();
      const mockConnOpen = { open: true, send: vi.fn() } as unknown as DataConnection;
      const mockConnClosed = { open: false, send: vi.fn() } as unknown as DataConnection;

      coordinator.addPeer('peer-A', mockConnOpen);
      coordinator.addPeer('peer-B', mockConnClosed);

      expect(coordinator.getPeerCount()).toBe(2);
      expect(coordinator.getActiveConnectionCount()).toBe(1);
      expect(coordinator.getPeer('peer-A')).toBeDefined();

      coordinator.removePeer('peer-B');
      expect(coordinator.getPeerCount()).toBe(1);
      expect(coordinator.getPeer('peer-B')).toBeUndefined();
    });

    it('marks local chunks and verifies local completeness', () => {
      const coordinator = new SwarmCoordinator();
      coordinator.setFileInfo(768 * 1024, 256 * 1024); // 3 chunks

      expect(coordinator.isLocallyComplete()).toBe(false);
      coordinator.markLocalHave(0);
      coordinator.markLocalHave(1);
      expect(coordinator.getLocalMissingChunks()).toEqual([2]);

      coordinator.markAllLocalHave();
      expect(coordinator.isLocallyComplete()).toBe(true);
      expect(coordinator.getLocalMissingChunks()).toEqual([]);
    });

    it('updates peer chunk availability announcements', () => {
      const coordinator = new SwarmCoordinator();
      coordinator.setFileInfo(1024 * 1024, 256 * 1024); // 4 chunks
      coordinator.addPeer('peer-1');

      coordinator.updatePeerHave('peer-1', 2);
      expect(coordinator.getPeer('peer-1')?.bitfield.has(2)).toBe(true);

      coordinator.updatePeerBitfield('peer-1', [0, 1, 2, 3]);
      expect(coordinator.getPeer('peer-1')?.isSeed).toBe(true);
    });

    it('implements rarest-first chunk scheduling across swarm peers', () => {
      const coordinator = new SwarmCoordinator();
      coordinator.setFileInfo(1024 * 1024, 256 * 1024); // 4 chunks: 0, 1, 2, 3

      // Peer 1 has chunks 0, 1
      coordinator.addPeer('peer-1');
      coordinator.updatePeerBitfield('peer-1', [0, 1]);

      // Peer 2 has chunks 0, 2
      coordinator.addPeer('peer-2');
      coordinator.updatePeerBitfield('peer-2', [0, 2]);

      // Availability:
      // Chunk 0: count 2 (common)
      // Chunk 1: count 1 (rare)
      // Chunk 2: count 1 (rare)
      // Chunk 3: count 0 (unavailable)

      const rarest = coordinator.getRarestMissingChunks();
      expect(rarest).toBeDefined();
      // Chunks 1 and 2 should precede chunk 0 because they are rarer (count 1 < count 2)
      expect(rarest.slice(0, 2)).toContain(1);
      expect(rarest.slice(0, 2)).toContain(2);
      expect(rarest[2]).toBe(0);
      expect(rarest).not.toContain(3); // count 0 not available from peers
    });

    it('implements sequential chunk scheduling for live media streaming', () => {
      const coordinator = new SwarmCoordinator();
      coordinator.setFileInfo(1024 * 1024, 256 * 1024); // 4 chunks: 0, 1, 2, 3

      coordinator.markLocalHave(0);
      const sequential = coordinator.getSequentialMissingChunks();
      // Should strictly return in order 1, 2, 3
      expect(sequential).toEqual([1, 2, 3]);
    });

    it('selects best peer for chunk balancing load', () => {
      const coordinator = new SwarmCoordinator();
      const mockConn1 = { open: true, send: vi.fn() } as unknown as DataConnection;
      const mockConn2 = { open: true, send: vi.fn() } as unknown as DataConnection;

      const p1 = coordinator.addPeer('peer-1', mockConn1);
      p1.bitfield.set(0);
      p1.bytesUploaded = 5000;

      const p2 = coordinator.addPeer('peer-2', mockConn2);
      p2.bitfield.set(0);
      p2.bytesUploaded = 1000;

      // Both have chunk 0, but peer-2 has lower uploaded load
      const selected = coordinator.selectBestPeerForChunk(0);
      expect(selected?.id).toBe('peer-2');
    });

    it('broadcasts messages to all open connections', () => {
      const coordinator = new SwarmCoordinator();
      const send1 = vi.fn();
      const send2 = vi.fn();
      const mockConn1 = { open: true, send: send1 } as unknown as DataConnection;
      const mockConn2 = { open: false, send: send2 } as unknown as DataConnection;

      coordinator.addPeer('peer-1', mockConn1);
      coordinator.addPeer('peer-2', mockConn2);

      const msg = coordinator.createHaveMessage(5);
      const count = coordinator.broadcast(msg);

      expect(count).toBe(1);
      expect(send1).toHaveBeenCalledWith(msg);
      expect(send2).not.toHaveBeenCalled();
    });

    it('calculates comprehensive swarm statistics', () => {
      const coordinator = new SwarmCoordinator();
      coordinator.setFileInfo(512 * 1024, 256 * 1024); // 2 chunks

      const p1 = coordinator.addPeer('peer-1', null, true); // Seed
      p1.bytesUploaded = 2048;
      const p2 = coordinator.addPeer('peer-2', null, false); // Leecher
      p2.bytesDownloaded = 1024;

      coordinator.markLocalHave(0);

      const stats = coordinator.getSwarmStats();
      expect(stats.totalPeers).toBe(2);
      expect(stats.seeds).toBe(1);
      expect(stats.leechers).toBe(1);
      expect(stats.totalUploaded).toBe(2048);
      expect(stats.totalDownloaded).toBe(1024);
      expect(stats.completionRatio).toBe(0.5); // 1 out of 2 chunks local
    });
  });

  describe('Media Detection & Streaming Helpers', () => {
    it('detects audio formats correctly', () => {
      expect(isMediaMimeOrFilename('audio/mp3', 'song.mp3')).toEqual({
        isMedia: true,
        isAudio: true,
        isVideo: false,
        isImage: false,
      });

      expect(isMediaMimeOrFilename('', 'recording.wav').isAudio).toBe(true);
      expect(isMediaMimeOrFilename('', 'voice.ogg').isAudio).toBe(true);
      expect(isMediaMimeOrFilename('', 'track.flac').isAudio).toBe(true);
      expect(isMediaMimeOrFilename('', 'music.m4a').isAudio).toBe(true);
      expect(isMediaMimeOrFilename('', 'podcast.aac').isAudio).toBe(true);
    });

    it('detects video formats correctly', () => {
      expect(isMediaMimeOrFilename('video/mp4', 'movie.mp4')).toEqual({
        isMedia: true,
        isAudio: false,
        isVideo: true,
        isImage: false,
      });

      expect(isMediaMimeOrFilename('', 'clip.webm').isVideo).toBe(true);
      expect(isMediaMimeOrFilename('', 'film.mkv').isVideo).toBe(true);
      expect(isMediaMimeOrFilename('', 'video.mov').isVideo).toBe(true);
      expect(isMediaMimeOrFilename('', 'sample.ogv').isVideo).toBe(true);
    });

    it('detects image and non-media formats correctly', () => {
      expect(isMediaMimeOrFilename('image/png', 'photo.png')).toEqual({
        isMedia: false,
        isAudio: false,
        isVideo: false,
        isImage: true,
      });

      expect(isMediaMimeOrFilename('application/zip', 'archive.zip')).toEqual({
        isMedia: false,
        isAudio: false,
        isVideo: false,
        isImage: false,
      });

      expect(isMediaMimeOrFilename('application/pdf', 'document.pdf')).toEqual({
        isMedia: false,
        isAudio: false,
        isVideo: false,
        isImage: false,
      });
    });

    it('normalizes standard media MIME types', () => {
      expect(getStandardMediaMime('', 'video.mp4')).toBe('video/mp4');
      expect(getStandardMediaMime('', 'movie.webm')).toBe('video/webm');
      expect(getStandardMediaMime('', 'track.mp3')).toBe('audio/mpeg');
      expect(getStandardMediaMime('', 'audio.wav')).toBe('audio/wav');
      expect(getStandardMediaMime('audio/flac', 'song.flac')).toBe('audio/flac');
    });
  });
});
