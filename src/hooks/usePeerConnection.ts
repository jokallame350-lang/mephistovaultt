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
import { deriveKey, encryptChunk, decryptChunk, clearKeyCache } from '../lib/encryption';
import { formatETA, formatSpeed, parseRoomCode } from '../lib/utils';
import { playPeerConnectedChime } from '../lib/audioFX';
import type { FileMeta, CompletedFile, PeerMessage, PeerDataConnectionExt, PeerCustomError } from '../types';

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

  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const multiConnsRef = useRef<DataConnection[]>([]);
  const fileMetaRef = useRef<FileMeta | null>(null);
  const receivedChunksRef = useRef<ArrayBuffer[]>([]);
  const receivedBytesRef = useRef(0);
  const requestedOffsetRef = useRef(0);
  const lastSpeedCalcRef = useRef({ time: 0, bytes: 0 });
  const connTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const handshakeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cryptoKeyRef = useRef<CryptoKey | null>(null);
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
    transferCompletedRef.current = false;

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

  const handleBurnOnDownload = useCallback(() => {
    if (expirationSec === 0) {
      setTimeout(() => {
        resetConnection();
        alert(t ? t('burnNotice') : '🔥 File downloaded! Room and volatile memory purged as per zero-trace protocol.');
      }, 1500);
    }
  }, [expirationSec, resetConnection, t]);

  const finalizeDownload = useCallback((name: string, type: string) => {
    const blob = new Blob(receivedChunksRef.current, { type: type || 'application/octet-stream' });
    receivedChunksRef.current = []; // Free ArrayBuffers memory
    setCompletedFile({ blob, name, type });
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

        // AES-256-GCM Key derivation (memoized)
        if (!cryptoKeyRef.current && shareCode) {
          cryptoKeyRef.current = await deriveKey(shareCode);
        }
        if (!cryptoKeyRef.current) return;

        const encrypted = await encryptChunk(buffer, cryptoKeyRef.current);

        // WebRTC DataChannel backpressure throttling with drain loop
        const dataChannel = (conn as PeerDataConnectionExt)._dc || (conn as PeerDataConnectionExt).dataChannel;
        while (conn.open && dataChannel && dataChannel.bufferedAmount > BUFFERED_AMOUNT_THRESHOLD) {
          await new Promise((resolve) => setTimeout(resolve, 20));
          if (dataChannel.bufferedAmount <= DRAIN_BUFFER_THRESHOLD) break;
        }

        if (!conn.open) return;

        conn.send({
          type: 'chunk',
          buffer: encrypted,
          offset: offset,
        });

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

  const initSender = useCallback(() => {
    if (!shareCode) return;

    resetConnection();
    setErrorStatus(null);

    const cleanCode = shareCode.split('#')[0].replace(/[^a-z0-9]/g, '').toLowerCase();
    const peerId = `${PEER_ID_PREFIX}${cleanCode}`;
    const peer = new Peer(peerId, PEER_CONFIG);

    peer.on('open', () => {});

    peer.on('connection', (conn) => {
      connRef.current = conn;
      multiConnsRef.current.push(conn);
      setPeerCount(multiConnsRef.current.length);

      conn.on('open', () => {
        setIsConnected(true);
        playPeerConnectedChime();
      });

      conn.on('data', (data: unknown) => {
        const typedData = data as PeerMessage;
        if (typedData.type === 'request-metadata') {
          if (fileToShareRef.current) {
            conn.send({
              type: 'metadata',
              name: fileToShareRef.current.name,
              size: fileToShareRef.current.size,
              mime: fileToShareRef.current.type,
            });
          }
        } else if (typedData.type === 'request-chunk') {
          if (typedData.offset === 0) lastSpeedCalcRef.current = { time: Date.now(), bytes: 0 };
          sendChunk(typedData.offset, conn);
        } else if (typedData.type === 'chat') {
          onChatMessage(typedData.text);
        }
      });

      conn.on('close', () => {
        multiConnsRef.current = multiConnsRef.current.filter((c) => c !== conn);
        setPeerCount(multiConnsRef.current.length);

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
  }, [shareCode, resetConnection, sendChunk, fileToShareRef, onChatMessage, mode, t]);

  // Auto-init sender room when in send mode and shareCode is ready
  useEffect(() => {
    if (mode === 'send' && shareCode && !peerRef.current) {
      initSender();
    }
  }, [mode, shareCode, initSender]);

  const connectAsReceiver = useCallback(
    (code: string) => {
      resetConnection();
      setMode('receive');
      setErrorStatus(null);
      setTransferProgress(0); // Show connection loader

      // Sanitize room code cleanly with parseRoomCode
      const parsedCode = parseRoomCode(code);
      const sanitizedCode = (parsedCode || code).trim().toLowerCase();
      setReceiveCode(sanitizedCode);

      const parts = sanitizedCode.split('#');
      const cleanCode = parts[0].replace(/[^a-z0-9]/g, '');
      const targetId = `${PEER_ID_PREFIX}${cleanCode}`;

      const peer = new Peer(PEER_CONFIG);

      peer.on('open', () => {
        let attempts = 0;
        let connected = false;
        let activeConnAttempt: DataConnection | null = null;

        const tryConnect = () => {
          if (connected) return;
          if (attempts >= MAX_CONNECT_ATTEMPTS) {
            if (!connected) {
              setErrorStatus(t ? t('errSenderNotResponding') : ERRORS.SENDER_NOT_RESPONDING);
              setTransferProgress(-1);
              setIsConnected(false);
            }
            return;
          }
          attempts++;

          if (activeConnAttempt) {
            try {
              activeConnAttempt.close();
            } catch {
              // ignore
            }
          }

          const conn = peer.connect(targetId, { reliable: true });
          activeConnAttempt = conn;
          connRef.current = conn;

          conn.on('open', () => {
            connected = true;
            setIsConnected(true);
            setErrorStatus(null);
            playPeerConnectedChime();

            if (connectTimeoutRef.current) {
              clearTimeout(connectTimeoutRef.current);
              connectTimeoutRef.current = null;
            }

            // Derive key once on connection initialization
            deriveKey(sanitizedCode).then((key) => {
              cryptoKeyRef.current = key;
            });

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
              const typedData = data as PeerMessage;
              if (typedData.type === 'metadata') {
                if (!fileMetaRef.current) {
                  const meta = {
                    name: typedData.name,
                    size: typedData.size,
                    type: typedData.mime,
                  };
                  setFileMeta(meta);
                  fileMetaRef.current = meta;
                  receivedChunksRef.current = [];
                  receivedBytesRef.current = 0;
                  requestedOffsetRef.current = 0;
                  transferCompletedRef.current = false;
                  setTransferProgress(0);
                  lastSpeedCalcRef.current = { time: Date.now(), bytes: 0 };

                  if (!cryptoKeyRef.current) {
                    cryptoKeyRef.current = await deriveKey(sanitizedCode);
                  }

                  // Handle 0-byte (empty) files immediately
                  if (meta.size === 0) {
                    transferCompletedRef.current = true;
                    setTransferProgress(100);
                    finalizeDownload(meta.name, meta.type);
                    return;
                  }

                  // Pipeline: Request initial window of parallel chunks
                  for (let i = 0; i < PIPELINE_WINDOW_SIZE; i++) {
                    if (requestedOffsetRef.current < meta.size) {
                      conn.send({ type: 'request-chunk', offset: requestedOffsetRef.current });
                      requestedOffsetRef.current += CHUNK_SIZE;
                    }
                  }
                }
              } else if (typedData.type === 'chunk') {
                const buffer = typedData.buffer;
                if (!buffer) throw new Error('Empty buffer received.');

                if (!cryptoKeyRef.current) {
                  cryptoKeyRef.current = await deriveKey(sanitizedCode);
                }

                const decrypted = await decryptChunk(buffer, cryptoKeyRef.current);
                const byteLength = (decrypted as ArrayBuffer).byteLength ?? 0;

                if (byteLength === 0) throw new Error('Received chunk has zero length.');

                const chunkIndex = Math.floor(typedData.offset / CHUNK_SIZE);

                // Check duplicate chunk receipt to prevent byte miscounting
                if (!receivedChunksRef.current[chunkIndex]) {
                  receivedChunksRef.current[chunkIndex] = decrypted as ArrayBuffer;
                  receivedBytesRef.current += byteLength;
                }

                const meta = fileMetaRef.current;
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
              } else if (typedData.type === 'chat') {
                onChatMessage(typedData.text);
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
            setIsConnected(false);
          });

          conn.on('error', (err) => {
            if (err.message && err.message.includes('Negotiation of connection')) return;
            if (!connected && attempts < MAX_CONNECT_ATTEMPTS) {
              connectTimeoutRef.current = setTimeout(tryConnect, 1500);
            } else if (!connected) {
              setErrorStatus((t ? t('errConn') : ERRORS.CONN_ERR) + ': ' + err.message);
              setTransferProgress(-1);
            }
          });

          // Single fallback timer for retry if connection fails to open within 3.5 seconds
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
          }, 3500);
        };

        tryConnect();
      });

      peer.on('error', (perr: PeerCustomError) => {
        if (perr.type === 'peer-unavailable') {
          setErrorStatus(t ? t('errPeerUnavailable') : ERRORS.PEER_UNAVAILABLE);
        } else {
          setErrorStatus(t ? t('errPeerNotFound') : ERRORS.PEER_NOT_FOUND);
        }
        setTransferProgress(-1);
      });

      peerRef.current = peer;
    },
    [resetConnection, finalizeDownload, calculateSpeedAndETA, onChatMessage, t],
  );

  const broadcastToAll = useCallback(
    (msg: PeerMessage) => {
      if (mode === 'send') {
        multiConnsRef.current.forEach((c) => {
          try {
            if (c.open) c.send(msg);
          } catch {
            // ignore
          }
        });
      } else if (connRef.current?.open) {
        connRef.current.send(msg);
      }
    },
    [mode],
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

  // Clean up PeerJS instances on unmount
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
    handleBurnOnDownload,
    initSender,
    connectAsReceiver,
    resetConnection,
    broadcastToAll,
  };
}

export default usePeerConnection;
