import { useState, useEffect, useRef, useCallback } from 'react';
import { Peer } from 'peerjs';
import type { DataConnection } from 'peerjs';
import {
  CHUNK_SIZE,
  PIPELINE_WINDOW_SIZE,
  BUFFERED_AMOUNT_THRESHOLD,
  DRAIN_BUFFER_THRESHOLD,
  ERRORS,
  PEER_CONFIG,
  HANDSHAKE_INTERVAL_MS,
  MAX_CONNECT_ATTEMPTS,
  PEER_ID_PREFIX,
} from '../lib/constants';
import {
  deriveKey,
  encryptChunk,
  decryptChunk,
  clearKeyCache,
  calculateSHA256,
  encryptChatMessage,
  decryptChatMessage,
} from '../lib/encryption';
import { formatETA, formatSpeed, parseRoomCode } from '../lib/utils';
import { playPeerConnectedChime } from '../lib/audioFX';
import { SwarmCoordinator, isMediaMimeOrFilename } from '../lib/swarm';
import { isCompressibleFileType, compressData, decompressData } from '../lib/compression';
import { LiveSyncManager, isLiveSyncMessage, type SyncItem } from '../lib/liveSync';
import type { FileMeta, CompletedFile, PeerMessage, PeerDataConnectionExt, PeerCustomError, SwarmStats } from '../types';

interface UsePeerConnectionProps {
  fileToShareRef: React.MutableRefObject<File | null>;
  onTransferComplete: () => void;
  onChatMessage: (text: string) => void;
  clearChatMessages: () => void;
  t?: (key: string, params?: Record<string, string | number>) => string;
}

export function usePeerConnection({
  fileToShareRef,
  onTransferComplete,
  onChatMessage,
  clearChatMessages,
  t,
}: UsePeerConnectionProps) {
  const [mode, setMode] = useState<'idle' | 'send' | 'receive'>('idle');
  const [shareCode, setShareCode] = useState('');
  const [receiveCode, setReceiveCode] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [transferProgress, setTransferProgress] = useState(-1);
  const [fileMeta, setFileMeta] = useState<FileMeta | null>(null);
  const [completedFile, setCompletedFile] = useState<CompletedFile | null>(null);
  const [peerCount, setPeerCount] = useState(0);
  const [connTime, setConnTime] = useState(0);
  const [transferSpeed, setTransferSpeed] = useState<string | null>(null);
  const [transferETA, setTransferETA] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [expirationSec, setExpirationSec] = useState(0);

  // Progressive Live Media Streaming State
  const [liveMediaUrl, setLiveMediaUrl] = useState<string | null>(null);
  const [isLiveMediaAvailable, setIsLiveMediaAvailable] = useState(false);

  // Stream Compression Statistics State
  const [compressionStats, setCompressionStats] = useState<{
    isCompressed: boolean;
    originalBytes: number;
    compressedBytes: number;
    savingsRatio: number;
  }>({
    isCompressed: false,
    originalBytes: 0,
    compressedBytes: 0,
    savingsRatio: 0,
  });

  // Swarm Statistics State
  const [swarmStats, setSwarmStats] = useState<SwarmStats>({
    totalPeers: 0,
    seeds: 0,
    leechers: 0,
    totalUploaded: 0,
    totalDownloaded: 0,
    completionRatio: 0,
  });

  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const multiConnsRef = useRef<DataConnection[]>([]);
  const swarmCoordinatorRef = useRef<SwarmCoordinator>(new SwarmCoordinator());
  const activeLiveUrlRef = useRef<string | null>(null);

  // Two-Way Live Sync Manager Ref & State
  const liveSyncManagerRef = useRef<LiveSyncManager>(
    new LiveSyncManager({
      localPeerId: 'mephisto-node',
    })
  );
  const [syncItems, setSyncItems] = useState<SyncItem[]>([]);

  useEffect(() => {
    const unsub = liveSyncManagerRef.current.subscribe((newItems) => {
      setSyncItems([...newItems]);
    });
    return () => unsub();
  }, []);

  const fileMetaRef = useRef<FileMeta | null>(null);
  const receivedChunksRef = useRef<ArrayBuffer[]>([]);
  const receivedBytesRef = useRef(0);
  const requestedOffsetRef = useRef(0);
  const lastSpeedCalcRef = useRef({ time: 0, bytes: 0 });
  const connTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const handshakeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cryptoKeyRef = useRef<CryptoKey | null>(null);
  const keyDerivationPromiseRef = useRef<Promise<CryptoKey> | null>(null);
  const activeShareCodeRef = useRef('');
  const activeReceiveCodeRef = useRef('');
  const fileSha256CacheRef = useRef<string | null>(null);
  const transferCompletedRef = useRef(false);
  const smoothedSpeedRef = useRef(0);

  const calculateSpeedAndETA = useCallback((bytesCurrent: number, bytesTotal: number) => {
    const now = Date.now();
    const elapsed = now - lastSpeedCalcRef.current.time;

    if (elapsed >= 300 || bytesCurrent >= bytesTotal) {
      const bytesDiff = bytesCurrent - lastSpeedCalcRef.current.bytes;
      if (elapsed > 0 && lastSpeedCalcRef.current.time !== 0) {
        const instantBps = (Math.max(0, bytesDiff) / elapsed) * 1000;
        // EMA smoothing: alpha = 0.35 gives responsive yet stable speed reading
        const smoothedBps =
          smoothedSpeedRef.current === 0
            ? instantBps
            : 0.35 * instantBps + 0.65 * smoothedSpeedRef.current;
        smoothedSpeedRef.current = smoothedBps;

        const formattedSpeed = formatSpeed(smoothedBps);
        setTransferSpeed((prev) => (prev === formattedSpeed ? prev : formattedSpeed));

        if (smoothedBps > 0 && bytesCurrent < bytesTotal) {
          const remainingSecs = (bytesTotal - bytesCurrent) / smoothedBps;
          const formattedEta = formatETA(remainingSecs);
          setTransferETA((prev) => (prev === formattedEta ? prev : formattedEta));
        } else if (bytesCurrent >= bytesTotal) {
          setTransferETA('0s remaining');
        } else {
          setTransferETA('--:--');
        }
      }
      if (bytesCurrent >= bytesTotal) {
        setTransferSpeed(null);
        setTransferETA(null);
        smoothedSpeedRef.current = 0;
      }
      lastSpeedCalcRef.current = { time: now, bytes: bytesCurrent };
    }
  }, []);

  const resetConnection = useCallback(() => {
    clearKeyCache();
    cryptoKeyRef.current = null;
    keyDerivationPromiseRef.current = null;
    activeShareCodeRef.current = '';
    activeReceiveCodeRef.current = '';
    fileSha256CacheRef.current = null;
    transferCompletedRef.current = false;

    // Clean up progressive live media stream URL
    if (activeLiveUrlRef.current) {
      URL.revokeObjectURL(activeLiveUrlRef.current);
      activeLiveUrlRef.current = null;
    }
    setLiveMediaUrl(null);
    setIsLiveMediaAvailable(false);

    // Reset Swarm coordinator
    swarmCoordinatorRef.current.reset();
    setSwarmStats(swarmCoordinatorRef.current.getSwarmStats());

    if (connRef.current) {
      try {
        connRef.current.close();
      } catch {
        // ignore
      }
      connRef.current = null;
    }

    multiConnsRef.current.forEach((c) => {
      try {
        c.close();
      } catch {
        // ignore
      }
    });
    multiConnsRef.current = [];

    if (peerRef.current) {
      try {
        peerRef.current.destroy();
      } catch {
        // ignore
      }
      peerRef.current = null;
    }

    if (connTimerRef.current) {
      clearInterval(connTimerRef.current);
      connTimerRef.current = null;
    }
    if (handshakeIntervalRef.current) {
      clearInterval(handshakeIntervalRef.current);
      handshakeIntervalRef.current = null;
    }
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }

    // Reset Stream Compression Stats
    setCompressionStats({
      isCompressed: false,
      originalBytes: 0,
      compressedBytes: 0,
      savingsRatio: 0,
    });
    liveSyncManagerRef.current.clearWorkspace();

    setIsConnected(false);
    setTransferProgress(-1);
    setFileMeta(null);
    fileMetaRef.current = null;
    receivedChunksRef.current = [];
    receivedBytesRef.current = 0;
    requestedOffsetRef.current = 0;
    setCompletedFile(null);
    clearChatMessages();
    setErrorStatus(null);
    setConnTime(0);
    setPeerCount(0);
    setTransferSpeed(null);
    setTransferETA(null);
    smoothedSpeedRef.current = 0;
    lastSpeedCalcRef.current = { time: 0, bytes: 0 };
  }, [clearChatMessages]);

  const broadcastToAll = useCallback(
    async (msg: PeerMessage) => {
      let finalMsg = msg;
      // Automatically encrypt text chat messages if key is available
      if (msg.type === 'chat' && msg.text && cryptoKeyRef.current) {
        try {
          const encryptedBuf = await encryptChatMessage(msg.text, cryptoKeyRef.current);
          finalMsg = { type: 'chat', encrypted: encryptedBuf };
        } catch {
          finalMsg = msg;
        }
      }

      if (mode === 'send') {
        multiConnsRef.current.forEach((c) => {
          try {
            if (c.open) c.send(finalMsg);
          } catch {
            // ignore
          }
        });
      } else if (connRef.current?.open) {
        connRef.current.send(finalMsg);
      }
    },
    [mode],
  );

  const handleBurnOnDownload = useCallback(() => {
    if (expirationSec === 0) {
      // Mutual Burn on Read: send burn signal to sender so both sides destroy memory & session
      broadcastToAll({ type: 'burn' });
      setTimeout(() => {
        resetConnection();
        setMode('idle');
      }, 1500);
    }
  }, [expirationSec, broadcastToAll, resetConnection]);

  const finalizeDownload = useCallback(async (name: string, type: string) => {
    const meta = fileMetaRef.current;
    const blob = new Blob(receivedChunksRef.current, { type: type || 'application/octet-stream' });
    receivedChunksRef.current = []; // Free ArrayBuffers memory

    // Revoke progressive stream URL as full completed file is now ready
    if (activeLiveUrlRef.current) {
      URL.revokeObjectURL(activeLiveUrlRef.current);
      activeLiveUrlRef.current = null;
    }
    setLiveMediaUrl(null);

    // 1. Strict Size Validation
    if (meta && meta.size > 0 && blob.size !== meta.size) {
      setErrorStatus(`Transfer size mismatch: expected ${meta.size} bytes, received ${blob.size} bytes.`);
      return;
    }

    // 2. Strict SHA-256 Checksum Validation (SUCCESS = receiver SHA-256 verified)
    let calculatedHash = '';
    const expectedHash = meta?.sha256;

    try {
      const buffer = await blob.arrayBuffer();
      calculatedHash = await calculateSHA256(buffer);
    } catch {
      // hash calculation failure
    }

    if (expectedHash && (!calculatedHash || calculatedHash.toLowerCase() !== expectedHash.toLowerCase())) {
      setErrorStatus(`Cryptographic integrity failure: SHA-256 seal mismatch. File rejected.`);
      return;
    }

    setCompletedFile({
      blob,
      name,
      type,
      sha256: calculatedHash || expectedHash,
      isShaVerified: true,
    });
    setTransferProgress(100);
    onTransferComplete();
  }, [onTransferComplete]);

  const sendChunk = useCallback(
    async (offset: number, targetConn?: DataConnection) => {
      try {
        const file = fileToShareRef.current;
        const conn = targetConn || connRef.current;
        if (!file || !conn || !conn.open) return;

        const end = Math.min(offset + CHUNK_SIZE, file.size);
        const slice = file.slice(offset, end);
        const buffer = await slice.arrayBuffer();

        // Stream Compression: if file is compressible, compress chunk in real-time
        let bufferToSend = buffer;
        let isChunkCompressed = false;
        let chunkRatio = 0;

        if (isCompressibleFileType(file.type, file.name)) {
          try {
            const comp = await compressData(buffer, 'deflate');
            if (comp.compressed) {
              bufferToSend = comp.buffer;
              isChunkCompressed = true;
              chunkRatio = comp.savingsPercent;
              setCompressionStats((prev) => {
                const orig = prev.originalBytes + buffer.byteLength;
                const compB = prev.compressedBytes + comp.compressedSize;
                const savedRatio = orig > 0 ? Math.round(((orig - compB) / orig) * 100) : 0;
                return {
                  isCompressed: true,
                  originalBytes: orig,
                  compressedBytes: compB,
                  savingsRatio: savedRatio,
                };
              });
            }
          } catch {
            // fallback
          }
        }

        // AES-256-GCM Key derivation (memoized)
        const currentCode = activeShareCodeRef.current || shareCode;
        if (!cryptoKeyRef.current && currentCode) {
          if (!keyDerivationPromiseRef.current) {
            keyDerivationPromiseRef.current = deriveKey(currentCode);
          }
          cryptoKeyRef.current = await keyDerivationPromiseRef.current;
        }
        if (!cryptoKeyRef.current) return;

        const encrypted = await encryptChunk(bufferToSend, cryptoKeyRef.current);

        // WebRTC DataChannel backpressure throttling with drain loop
        const dataChannel = (conn as PeerDataConnectionExt)._dc || ((conn as unknown as Record<string, unknown>).dataChannel as RTCDataChannel | undefined);
        while (conn.open && dataChannel && dataChannel.bufferedAmount > BUFFERED_AMOUNT_THRESHOLD) {
          await new Promise((resolve) => setTimeout(resolve, 2));
          if (dataChannel.bufferedAmount <= DRAIN_BUFFER_THRESHOLD) break;
        }

        if (!conn.open) return;

        const chunkIndex = Math.floor(offset / CHUNK_SIZE);
        conn.send({
          type: 'chunk',
          buffer: encrypted,
          offset: offset,
          chunkIndex,
          compressed: isChunkCompressed,
          rawSize: buffer.byteLength,
          ratio: chunkRatio,
        });

        // Record swarm upload stats
        swarmCoordinatorRef.current.recordUpload(conn.peer, buffer.byteLength);
        setSwarmStats(swarmCoordinatorRef.current.getSwarmStats());

        const progress = file.size === 0 ? 100 : Math.round((end / file.size) * 100);
        const newProg = end === file.size ? 100 : Math.min(99, progress);
        setTransferProgress((prev) => (prev === newProg ? prev : newProg));
        calculateSpeedAndETA(end, file.size);
        if (end === file.size && !transferCompletedRef.current) {
          transferCompletedRef.current = true;
          onTransferComplete();
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setErrorStatus((t ? t('errSendChunk') : ERRORS.SEND_CHUNK_ERR) + message);
      }
    },
    [shareCode, fileToShareRef, calculateSpeedAndETA, onTransferComplete, t],
  );

  const initSender = useCallback((codeToInit?: string) => {
    const code = codeToInit || shareCode;
    if (!code || !code.trim()) return;

    activeShareCodeRef.current = code;
    // Pre-derive key immediately on sender initialization
    keyDerivationPromiseRef.current = deriveKey(code);
    keyDerivationPromiseRef.current.then((key) => {
      cryptoKeyRef.current = key;
    }).catch(() => {});

    // Pre-compute SHA-256 checksum of file for E2E integrity & configure Swarm
    if (fileToShareRef.current) {
      const file = fileToShareRef.current;
      swarmCoordinatorRef.current.setFileInfo(file.size, CHUNK_SIZE);
      swarmCoordinatorRef.current.markAllLocalHave();
      setSwarmStats(swarmCoordinatorRef.current.getSwarmStats());

      if (!fileSha256CacheRef.current) {
        file.arrayBuffer().then((buf) => {
          return calculateSHA256(buf);
        }).then((hash) => {
          fileSha256CacheRef.current = hash;
        }).catch(() => {});
      }
    }

    const rawRoom = code.split('#')[0] || '';
    const cleanCode = rawRoom.replace(/[^a-z0-9]/gi, '').toLowerCase();
    if (!cleanCode || cleanCode.length < 3) {
      return;
    }

    resetConnection();
    activeShareCodeRef.current = code;
    setErrorStatus(null);

    const peerId = `${PEER_ID_PREFIX}${cleanCode}`;
    const peer = new Peer(peerId, PEER_CONFIG);

    peer.on('open', () => {});

    peer.on('connection', (conn) => {
      connRef.current = conn;
      multiConnsRef.current.push(conn);
      swarmCoordinatorRef.current.addPeer(conn.peer, conn, false);
      setPeerCount(multiConnsRef.current.length);
      setSwarmStats(swarmCoordinatorRef.current.getSwarmStats());

      conn.on('open', () => {
        setIsConnected(true);
        playPeerConnectedChime();
        liveSyncManagerRef.current.addConnection(conn);

        // Announce active Swarm peers and local bitfield to new receiver
        try {
          conn.send({
            type: 'swarm-peers',
            peers: multiConnsRef.current.map((c) => c.peer),
          });
          conn.send({
            type: 'swarm-bitfield',
            bitfield: swarmCoordinatorRef.current.getLocalBitfield().toArray(),
          });
        } catch {
          // ignore
        }

        // Broadcast updated peer list to all other connected peers in swarm
        multiConnsRef.current.forEach((c) => {
          if (c !== conn && c.open) {
            try {
              c.send({
                type: 'swarm-peers',
                peers: multiConnsRef.current.map((p) => p.peer),
              });
            } catch {
              // ignore
            }
          }
        });
      });

      conn.on('data', async (data: unknown) => {
        if (isLiveSyncMessage(data)) {
          liveSyncManagerRef.current.handlePeerMessage(data, conn);
          return;
        }

        const typedData = data as PeerMessage;
        if (typedData.type === 'request-metadata') {
          if (fileToShareRef.current) {
            let sha = fileSha256CacheRef.current;
            if (!sha) {
              try {
                const buf = await fileToShareRef.current.arrayBuffer();
                sha = await calculateSHA256(buf);
                fileSha256CacheRef.current = sha;
              } catch {
                // ignore
              }
            }
            conn.send({
              type: 'metadata',
              name: fileToShareRef.current.name,
              size: fileToShareRef.current.size,
              mime: fileToShareRef.current.type,
              sha256: sha || undefined,
              expirationSec,
            });
          }
        } else if (typedData.type === 'request-chunk') {
          if (typedData.offset === 0) lastSpeedCalcRef.current = { time: Date.now(), bytes: 0 };
          sendChunk(typedData.offset, conn);
        } else if (typedData.type === 'swarm-request-chunk') {
          const offset = typedData.chunkIndex * CHUNK_SIZE;
          if (offset === 0) lastSpeedCalcRef.current = { time: Date.now(), bytes: 0 };
          sendChunk(offset, conn);
        } else if (typedData.type === 'swarm-have') {
          // Update peer chunk availability in Swarm
          swarmCoordinatorRef.current.updatePeerHave(conn.peer, typedData.chunkIndex);
          setSwarmStats(swarmCoordinatorRef.current.getSwarmStats());

          // Broadcast chunk availability announcement to other connected receivers in the room
          multiConnsRef.current.forEach((c) => {
            if (c !== conn && c.open) {
              try {
                c.send({ type: 'swarm-have', chunkIndex: typedData.chunkIndex });
              } catch {
                // ignore
              }
            }
          });
        } else if (typedData.type === 'swarm-bitfield') {
          swarmCoordinatorRef.current.updatePeerBitfield(conn.peer, typedData.bitfield);
          setSwarmStats(swarmCoordinatorRef.current.getSwarmStats());
        } else if (typedData.type === 'chat') {
          if (typedData.encrypted && cryptoKeyRef.current) {
            try {
              const text = await decryptChatMessage(typedData.encrypted, cryptoKeyRef.current);
              onChatMessage(text);
            } catch {
              // fallback
            }
          } else if (typedData.text) {
            onChatMessage(typedData.text);
          }
        } else if (typedData.type === 'burn') {
          // Mutual Burn on Read: destroy sender memory and reset to idle
          if (fileToShareRef.current) {
            fileToShareRef.current = null;
          }
          resetConnection();
          setMode('idle');
        }
      });

      conn.on('close', () => {
        multiConnsRef.current = multiConnsRef.current.filter((c) => c !== conn);
        swarmCoordinatorRef.current.removePeer(conn.peer);
        setPeerCount(multiConnsRef.current.length);
        setSwarmStats(swarmCoordinatorRef.current.getSwarmStats());

        if (multiConnsRef.current.length > 0) {
          connRef.current = multiConnsRef.current[multiConnsRef.current.length - 1];
        } else {
          connRef.current = null;
          setIsConnected(false);
          if (mode !== 'send') {
            setErrorStatus(t ? t('errConnLost') : ERRORS.CONN_LOST);
          }
        }
      });

      conn.on('error', (err) => {
        if (err.message && err.message.includes('Negotiation of connection')) return;
        setErrorStatus(err.message);
      });
    });

    peer.on('error', (err: PeerCustomError) => {
      if (err.type === 'unavailable-id') {
        setErrorStatus(t ? t('errRoomTaken') : ERRORS.ROOM_CODE_TAKEN);
      } else {
        setErrorStatus((t ? t('errConn') : ERRORS.CONN_ERR) + ': ' + err.message);
      }
    });

    peerRef.current = peer;
  }, [shareCode, resetConnection, fileToShareRef, sendChunk, onChatMessage, mode, expirationSec, t]);

  const connectAsReceiver = useCallback(
    (codeToConnect?: string) => {
      const code = codeToConnect || receiveCode;
      if (!code || !code.trim()) return;

      const sanitizedCode = parseRoomCode(code) || code.trim();
      const rawRoom = sanitizedCode.split('#')[0] || '';
      const cleanCode = rawRoom.replace(/[^a-z0-9]/gi, '').toLowerCase();
      if (!cleanCode || cleanCode.length < 3) {
        setErrorStatus(t ? t('errPeerNotFound') : ERRORS.PEER_NOT_FOUND);
        return;
      }

      // Preserve existing progress if reconnecting to the same room
      const isReconnecting = activeReceiveCodeRef.current === sanitizedCode && receivedBytesRef.current > 0;
      if (!isReconnecting) {
        resetConnection();
        setTransferProgress(0);
        receivedChunksRef.current = [];
        receivedBytesRef.current = 0;
        requestedOffsetRef.current = 0;
      }

      setMode('receive');
      setReceiveCode(sanitizedCode);
      activeReceiveCodeRef.current = sanitizedCode;
      setErrorStatus(null);

      // Pre-warm key derivation for receiver immediately
      keyDerivationPromiseRef.current = deriveKey(sanitizedCode);
      keyDerivationPromiseRef.current.then((key) => {
        cryptoKeyRef.current = key;
      }).catch(() => {});

      const targetPeerId = `${PEER_ID_PREFIX}${cleanCode}`;
      const peer = new Peer(PEER_CONFIG);

      peer.on('open', () => {
        let attempts = 0;
        let connected = false;

        const tryConnect = () => {
          if (connected || attempts >= MAX_CONNECT_ATTEMPTS) return;
          attempts++;

          const conn = peer.connect(targetPeerId, { reliable: true });
          connRef.current = conn;
          multiConnsRef.current = [conn];
          swarmCoordinatorRef.current.addPeer(targetPeerId, conn, true);
          setPeerCount(1);
          setSwarmStats(swarmCoordinatorRef.current.getSwarmStats());

          conn.on('open', async () => {
            connected = true;
            setIsConnected(true);
            playPeerConnectedChime();
            liveSyncManagerRef.current.addConnection(conn);
            if (connectTimeoutRef.current) {
              clearTimeout(connectTimeoutRef.current);
              connectTimeoutRef.current = null;
            }

            try {
              if (!keyDerivationPromiseRef.current) {
                keyDerivationPromiseRef.current = deriveKey(sanitizedCode);
              }
              cryptoKeyRef.current = await keyDerivationPromiseRef.current;
            } catch {
              // ignore
            }

            handshakeIntervalRef.current = setInterval(() => {
              if (fileMetaRef.current || !conn.open) {
                if (handshakeIntervalRef.current) {
                  clearInterval(handshakeIntervalRef.current);
                  handshakeIntervalRef.current = null;
                }
                return;
              }
              conn.send({ type: 'request-metadata' });
            }, HANDSHAKE_INTERVAL_MS);
          });

          conn.on('data', async (data: unknown) => {
            try {
              if (isLiveSyncMessage(data)) {
                liveSyncManagerRef.current.handlePeerMessage(data, conn);
                return;
              }

              const typedData = data as PeerMessage;
              if (typedData.type === 'metadata') {
                if (!fileMetaRef.current) {
                  const meta: FileMeta = {
                    name: typedData.name,
                    size: typedData.size,
                    type: typedData.mime,
                    sha256: typedData.sha256,
                  };
                  setFileMeta(meta);
                  fileMetaRef.current = meta;
                  if (typedData.expirationSec !== undefined) {
                    setExpirationSec(typedData.expirationSec);
                  }
                  transferCompletedRef.current = false;
                  lastSpeedCalcRef.current = { time: Date.now(), bytes: receivedBytesRef.current };

                  // Configure Swarm Coordinator file metrics
                  swarmCoordinatorRef.current.setFileInfo(meta.size, CHUNK_SIZE);
                  setSwarmStats(swarmCoordinatorRef.current.getSwarmStats());

                  const mediaCheck = isMediaMimeOrFilename(meta.type, meta.name);
                  if (mediaCheck.isMedia) {
                    setIsLiveMediaAvailable(true);
                  }

                  if (!cryptoKeyRef.current) {
                    if (!keyDerivationPromiseRef.current) {
                      keyDerivationPromiseRef.current = deriveKey(sanitizedCode);
                    }
                    cryptoKeyRef.current = await keyDerivationPromiseRef.current;
                  }

                  // Handle 0-byte (empty) files immediately
                  if (meta.size === 0) {
                    transferCompletedRef.current = true;
                    setTransferProgress(100);
                    finalizeDownload(meta.name, meta.type);
                    return;
                  }

                  // Pipeline: Request window of parallel chunks starting from current resume offset
                  const startOffset = requestedOffsetRef.current || 0;
                  for (let i = 0; i < PIPELINE_WINDOW_SIZE; i++) {
                    const reqOffset = startOffset + i * CHUNK_SIZE;
                    if (reqOffset < meta.size) {
                      conn.send({ type: 'request-chunk', offset: reqOffset });
                      requestedOffsetRef.current = reqOffset + CHUNK_SIZE;
                    }
                  }
                }
              } else if (typedData.type === 'chunk') {
                const meta = fileMetaRef.current;
                if (!meta) {
                  throw new Error('Protocol violation: chunk received before file metadata.');
                }

                const buffer = typedData.buffer;
                if (!buffer || !(buffer instanceof ArrayBuffer) || buffer.byteLength === 0) {
                  throw new Error('Malformed or empty chunk buffer received.');
                }

                // Strict buffer size limit (CHUNK_SIZE + auth tag & IV margin)
                if (buffer.byteLength > CHUNK_SIZE + 2048) {
                  throw new Error(`Oversized chunk buffer rejected (${buffer.byteLength} bytes).`);
                }

                if (typeof typedData.offset !== 'number' || isNaN(typedData.offset) || typedData.offset < 0) {
                  throw new Error(`Invalid chunk offset: ${typedData.offset}`);
                }

                if (meta.size > 0 && typedData.offset >= meta.size) {
                  throw new Error(`Out-of-bounds chunk offset: ${typedData.offset} >= ${meta.size}`);
                }

                if (!cryptoKeyRef.current) {
                  if (!keyDerivationPromiseRef.current) {
                    keyDerivationPromiseRef.current = deriveKey(sanitizedCode);
                  }
                  cryptoKeyRef.current = await keyDerivationPromiseRef.current;
                }

                const decrypted = await decryptChunk(buffer, cryptoKeyRef.current);
                let rawBuffer: ArrayBuffer = decrypted as ArrayBuffer;

                if (typedData.compressed) {
                  try {
                    rawBuffer = await decompressData(decrypted, 'deflate');
                    const origSize = typedData.rawSize || rawBuffer.byteLength;
                    const compSize = (decrypted as ArrayBuffer).byteLength;
                    setCompressionStats((prev) => {
                      const orig = prev.originalBytes + origSize;
                      const compB = prev.compressedBytes + compSize;
                      const savedRatio = orig > 0 ? Math.round(((orig - compB) / orig) * 100) : 0;
                      return {
                        isCompressed: true,
                        originalBytes: orig,
                        compressedBytes: compB,
                        savingsRatio: savedRatio,
                      };
                    });
                  } catch {
                    rawBuffer = decrypted as ArrayBuffer;
                  }
                }

                const byteLength = (rawBuffer as ArrayBuffer).byteLength ?? 0;
                if (byteLength === 0) throw new Error('Received chunk has zero length.');

                if (meta.size > 0 && typedData.offset + byteLength > meta.size + 1024) {
                  throw new Error(`Chunk data extends past expected file size (${typedData.offset + byteLength} > ${meta.size})`);
                }

                const chunkIndex = Math.floor(typedData.offset / CHUNK_SIZE);

                // Check duplicate chunk receipt to prevent byte miscounting
                if (!receivedChunksRef.current[chunkIndex]) {
                  receivedChunksRef.current[chunkIndex] = rawBuffer as ArrayBuffer;
                  receivedBytesRef.current += byteLength;

                  // Update Swarm Bitfield & Download metrics
                  swarmCoordinatorRef.current.markLocalHave(chunkIndex);
                  swarmCoordinatorRef.current.recordDownload(conn.peer, byteLength);
                  setSwarmStats(swarmCoordinatorRef.current.getSwarmStats());

                  // Announce chunk availability to sender/swarm
                  try {
                    conn.send({ type: 'swarm-have', chunkIndex });
                  } catch {
                    // ignore
                  }

                  // Instant Progressive Media Playback: Generate / update live progressive blob from chunk 0
                  const meta = fileMetaRef.current;
                  if (meta) {
                    const mediaCheck = isMediaMimeOrFilename(meta.type, meta.name);
                    if (mediaCheck.isMedia) {
                      // Collect all contiguous chunks starting from 0
                      const contiguous: ArrayBuffer[] = [];
                      for (let i = 0; i < receivedChunksRef.current.length; i++) {
                        if (receivedChunksRef.current[i]) {
                          contiguous.push(receivedChunksRef.current[i]);
                        } else {
                          break;
                        }
                      }

                      if (contiguous.length >= 1) {
                        try {
                          const progressiveBlob = new Blob(contiguous, { type: meta.type || 'application/octet-stream' });
                          const newLiveUrl = URL.createObjectURL(progressiveBlob);
                          if (activeLiveUrlRef.current) {
                            URL.revokeObjectURL(activeLiveUrlRef.current);
                          }
                          activeLiveUrlRef.current = newLiveUrl;
                          setLiveMediaUrl(newLiveUrl);
                          setIsLiveMediaAvailable(true);
                        } catch {
                          // ignore blob creation error
                        }
                      }
                    }
                  }
                }

                if (meta) {
                  calculateSpeedAndETA(receivedBytesRef.current, meta.size);
                  const progress = Math.round((receivedBytesRef.current / meta.size) * 100);

                  if (requestedOffsetRef.current < meta.size) {
                    conn.send({ type: 'request-chunk', offset: requestedOffsetRef.current });
                    requestedOffsetRef.current += CHUNK_SIZE;
                  }

                  if (receivedBytesRef.current < meta.size) {
                    const newProg = Math.min(99, progress);
                    setTransferProgress((prev) => (prev === newProg ? prev : newProg));
                  } else if (!transferCompletedRef.current) {
                    transferCompletedRef.current = true;
                    setTransferProgress(100);
                    finalizeDownload(meta.name, meta.type);
                  }
                }
              } else if (typedData.type === 'swarm-have') {
                swarmCoordinatorRef.current.updatePeerHave(conn.peer, typedData.chunkIndex);
                setSwarmStats(swarmCoordinatorRef.current.getSwarmStats());
              } else if (typedData.type === 'swarm-bitfield') {
                swarmCoordinatorRef.current.updatePeerBitfield(conn.peer, typedData.bitfield);
                setSwarmStats(swarmCoordinatorRef.current.getSwarmStats());
              } else if (typedData.type === 'swarm-peers') {
                typedData.peers.forEach((pId) => {
                  if (pId !== peer.id) {
                    swarmCoordinatorRef.current.addPeer(pId);
                  }
                });
                setPeerCount(swarmCoordinatorRef.current.getPeerCount());
                setSwarmStats(swarmCoordinatorRef.current.getSwarmStats());
              } else if (typedData.type === 'chat') {
                if (typedData.encrypted && cryptoKeyRef.current) {
                  try {
                    const text = await decryptChatMessage(typedData.encrypted, cryptoKeyRef.current);
                    onChatMessage(text);
                  } catch {
                    // fallback
                  }
                } else if (typedData.text) {
                  onChatMessage(typedData.text);
                }
              } else if (typedData.type === 'burn') {
                // Mutual Burn on Read: destroy receiver session
                resetConnection();
                setMode('idle');
              }
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : String(err);
              if (
                message.toLowerCase().includes('tag') ||
                message.toLowerCase().includes('decrypt') ||
                message.toLowerCase().includes('operationerror') ||
                message.toLowerCase().includes('ciphertext')
              ) {
                setErrorStatus(t ? t('errDecryption') : ERRORS.DECRYPTION_ERR);
              } else {
                setErrorStatus((t ? t('errParse') : ERRORS.PARSE_ERR) + message);
              }
            }
          });

          conn.on('close', () => {
            liveSyncManagerRef.current.removeConnection(conn);
            setIsConnected(false);
          });

          conn.on('error', (err) => {
            if (err.message && err.message.includes('Negotiation of connection')) return;
            if (!connected && attempts < MAX_CONNECT_ATTEMPTS) {
              if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
              connectTimeoutRef.current = setTimeout(tryConnect, 1500);
            } else if (!connected) {
              setErrorStatus((t ? t('errConn') : ERRORS.CONN_ERR) + ': ' + err.message);
              setTransferProgress(-1);
            }
          });

          // Single fallback timer for retry if connection fails to open within 5.0 seconds
          if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
          connectTimeoutRef.current = setTimeout(() => {
            if (!connected) {
              if (attempts < MAX_CONNECT_ATTEMPTS) {
                tryConnect();
              } else {
                setErrorStatus(t ? t('errSenderNotResponding') : ERRORS.SENDER_NOT_RESPONDING);
                setTransferProgress(-1);
                setIsConnected(false);
              }
            }
          }, 5000);
        };

        tryConnect();
      });

      peer.on('error', (perr: PeerCustomError) => {
        if (connectTimeoutRef.current) {
          clearTimeout(connectTimeoutRef.current);
          connectTimeoutRef.current = null;
        }
        if (perr.type === 'peer-unavailable') {
          setErrorStatus(t ? t('errPeerUnavailable') : ERRORS.PEER_UNAVAILABLE);
        } else {
          setErrorStatus(t ? t('errPeerNotFound') : ERRORS.PEER_NOT_FOUND);
        }
        setTransferProgress(-1);
      });

      peerRef.current = peer;
    },
    [receiveCode, resetConnection, finalizeDownload, calculateSpeedAndETA, onChatMessage, t],
  );

  // Connection timer
  useEffect(() => {
    if (isConnected) {
      setConnTime(0);
      connTimerRef.current = setInterval(() => setConnTime((t) => t + 1), 1000);
    } else {
      setConnTime(0);
      if (connTimerRef.current) {
        clearInterval(connTimerRef.current);
        connTimerRef.current = null;
      }
    }
    return () => {
      if (connTimerRef.current) clearInterval(connTimerRef.current);
    };
  }, [isConnected]);

  // Clean up PeerJS instances and progressive stream URLs on unmount
  useEffect(() => {
    return () => {
      resetConnection();
    };
  }, [resetConnection]);

  return {
    mode,
    setMode,
    shareCode,
    setShareCode,
    receiveCode,
    setReceiveCode,
    isConnected,
    errorStatus,
    setErrorStatus,
    transferProgress,
    setTransferProgress,
    fileMeta,
    completedFile,
    setCompletedFile,
    peerCount,
    connTime,
    transferSpeed,
    transferETA,
    copied,
    setCopied,
    showQR,
    setShowQR,
    expirationSec,
    setExpirationSec,
    liveMediaUrl,
    isLiveMediaAvailable,
    swarmStats,
    compressionStats,
    syncItems,
    liveSyncManager: liveSyncManagerRef.current,
    addSyncFile: (file: File | Blob) => liveSyncManagerRef.current.addFile(file),
    removeSyncFile: (id: string) => liveSyncManagerRef.current.removeFile(id),
    clearSyncWorkspace: () => liveSyncManagerRef.current.clearWorkspace(),
    multiConnsRef,
    handleBurnOnDownload,
    initSender,
    connectAsReceiver,
    resetConnection,
    broadcastToAll,
  };
}

export default usePeerConnection;
