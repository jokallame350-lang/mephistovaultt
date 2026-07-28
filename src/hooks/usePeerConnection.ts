import { useState, useEffect, useRef, useCallback } from 'react';
import { Peer } from 'peerjs';
import type { DataConnection } from 'peerjs';
import { CHUNK_SIZE, ERRORS, PEER_CONFIG } from '../lib/constants';
import { deriveKey, encryptChunk, decryptChunk, clearKeyCache } from '../lib/encryption';
import { formatETA, formatSpeed } from '../lib/utils';
import type { FileMeta, CompletedFile, PeerMessage } from '../types';

interface UsePeerConnectionProps {
  fileToShareRef: React.MutableRefObject<File | null>;
  onTransferComplete: () => void;
  onChatMessage: (text: string) => void;
  clearChatMessages: () => void;
}

export function usePeerConnection({
  fileToShareRef,
  onTransferComplete,
  onChatMessage,
  clearChatMessages,
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

  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const multiConnsRef = useRef<DataConnection[]>([]);
  const fileMetaRef = useRef<FileMeta | null>(null);
  const receivedChunksRef = useRef<ArrayBuffer[]>([]);
  const receivedBytesRef = useRef(0);
  const requestedOffsetRef = useRef(0);
  const lastSpeedCalcRef = useRef({ time: 0, bytes: 0 });
  const connTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const calculateSpeedAndETA = useCallback((bytesCurrent: number, bytesTotal: number) => {
    const now = Date.now();
    const elapsed = now - lastSpeedCalcRef.current.time;

    if (elapsed >= 1000 || bytesCurrent === bytesTotal) {
      const bytesDiff = bytesCurrent - lastSpeedCalcRef.current.bytes;
      if (elapsed > 0 && lastSpeedCalcRef.current.time !== 0) {
        const bps = (bytesDiff / elapsed) * 1000;
        setTransferSpeed(formatSpeed(bps));
        if (bps > 0) setTransferETA(formatETA((bytesTotal - bytesCurrent) / bps));
        else setTransferETA('--:--');
      }
      if (bytesCurrent === bytesTotal) {
        setTransferSpeed(null);
        setTransferETA(null);
      }
      lastSpeedCalcRef.current = { time: now, bytes: bytesCurrent };
    }
  }, []);

  const resetConnection = useCallback(() => {
    clearKeyCache();
    if (connRef.current) {
      connRef.current.close();
      connRef.current = null;
    }
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    setIsConnected(false);
    setTransferProgress(-1);
    setFileMeta(null);
    fileMetaRef.current = null;
    receivedChunksRef.current = [];
    receivedBytesRef.current = 0;
    setCompletedFile(null);
    clearChatMessages();
    setErrorStatus(null);
    setConnTime(0);
    setPeerCount(0);
    setTransferSpeed(null);
    setTransferETA(null);
    lastSpeedCalcRef.current = { time: 0, bytes: 0 };
    multiConnsRef.current.forEach((c) => {
      try {
        c.close();
      } catch {
        // ignore
      }
    });
    multiConnsRef.current = [];
    if (connTimerRef.current) {
      clearInterval(connTimerRef.current);
      connTimerRef.current = null;
    }
  }, [clearChatMessages]);

  const finalizeDownload = useCallback((name: string, type: string) => {
    const blob = new Blob(receivedChunksRef.current, { type: type || 'application/octet-stream' });
    setCompletedFile({ blob, name, type });
    setTransferProgress(100);
    onTransferComplete();
  }, [onTransferComplete]);

  const sendChunk = useCallback(
    async (offset: number, targetConn?: DataConnection) => {
      try {
        const file = fileToShareRef.current;
        const conn = targetConn || connRef.current;
        if (!file || !conn) return;

        const end = Math.min(offset + CHUNK_SIZE, file.size);
        const slice = file.slice(offset, end);
        const buffer = await slice.arrayBuffer();

        // AES-256-GCM Encryption
        const key = await deriveKey(shareCode);
        const encrypted = await encryptChunk(buffer, key);

        // WebRTC DataChannel backpressure throttling to prevent packet drop
        const dataChannel = (conn as any)._dc || (conn as any).dataChannel;
        if (dataChannel && dataChannel.bufferedAmount > 256 * 1024) {
          await new Promise((resolve) => setTimeout(resolve, 20));
        }

        conn.send({
          type: 'chunk',
          buffer: encrypted,
          offset: offset,
        });

        const progress = Math.round((end / file.size) * 100);
        setTransferProgress(end === file.size ? 100 : Math.min(99, progress));
        calculateSpeedAndETA(end, file.size);
      } catch (err: any) {
        setErrorStatus(ERRORS.SEND_CHUNK_ERR + err.message);
      }
    },
    [shareCode, fileToShareRef, calculateSpeedAndETA],
  );

  const initSender = useCallback(() => {
    if (!shareCode) return;

    resetConnection();
    setErrorStatus(null);

    const cleanCode = shareCode.split('#')[0].replace(/-/g, '').toLowerCase();
    const peer = new Peer(`mephisto-${cleanCode}`, PEER_CONFIG);

    peer.on('open', () => {});

    peer.on('connection', (conn) => {
      connRef.current = conn;
      multiConnsRef.current.push(conn);
      setPeerCount(multiConnsRef.current.length);

      conn.on('open', () => {
        setIsConnected(true);
      });

      conn.on('data', (data: any) => {
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
        if (multiConnsRef.current.length === 0) {
          setIsConnected(false);
          setErrorStatus(ERRORS.CONN_LOST);
        }
      });

      conn.on('error', (err) => {
        if (err.message && err.message.includes('Negotiation of connection')) return;
        setErrorStatus(err.message);
      });
    });

    peer.on('error', () => {
      // Handle peer creation error silently
    });

    peerRef.current = peer;
  }, [shareCode, resetConnection, sendChunk, fileToShareRef, onChatMessage]);

  const connectAsReceiver = useCallback(
    (code: string) => {
      resetConnection();
      setErrorStatus(null);
      setTransferProgress(0); // Show connection loader

      const parts = code.trim().toLowerCase().split('#');
      const cleanCode = parts[0].replace(/-/g, '');
      const targetId = `mephisto-${cleanCode}`;

      const peer = new Peer(PEER_CONFIG);

      peer.on('open', () => {
        const conn = peer.connect(targetId, { reliable: true });
        connRef.current = conn;

        conn.on('open', () => {
          setIsConnected(true);

          const handshakeInterval = setInterval(() => {
            if (fileMetaRef.current || !conn.open) {
              clearInterval(handshakeInterval);
              return;
            }
            conn.send({ type: 'request-metadata' });
          }, 500);
        });

        conn.on('data', async (data: any) => {
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
                setTransferProgress(0);
                lastSpeedCalcRef.current = { time: Date.now(), bytes: 0 };

                // Pipeline: Request initial window of 8 parallel chunks
                const WINDOW_SIZE = 8;
                for (let i = 0; i < WINDOW_SIZE; i++) {
                  if (requestedOffsetRef.current < meta.size) {
                    conn.send({ type: 'request-chunk', offset: requestedOffsetRef.current });
                    requestedOffsetRef.current += CHUNK_SIZE;
                  }
                }
              }
            } else if (typedData.type === 'chunk') {
              const buffer = typedData.buffer;
              if (!buffer) throw new Error('Empty buffer received.');

              // Decrypt using AES-256-GCM
              const key = await deriveKey(code);
              const decrypted = await decryptChunk(buffer, key);

              const byteLength =
                decrypted.byteLength !== undefined
                  ? decrypted.byteLength
                  : (decrypted as any).length !== undefined
                  ? (decrypted as any).length
                  : 0;

              if (byteLength === 0) throw new Error('Received chunk has zero length.');

              receivedChunksRef.current.push(decrypted);
              receivedBytesRef.current += byteLength;

              const meta = fileMetaRef.current;
              if (meta) {
                calculateSpeedAndETA(receivedBytesRef.current, meta.size);
                const progress = Math.round((receivedBytesRef.current / meta.size) * 100);

                if (requestedOffsetRef.current < meta.size) {
                  conn.send({ type: 'request-chunk', offset: requestedOffsetRef.current });
                  requestedOffsetRef.current += CHUNK_SIZE;
                }

                if (receivedBytesRef.current < meta.size) {
                  setTransferProgress(Math.min(99, progress));
                } else {
                  setTransferProgress(100);
                  finalizeDownload(meta.name, meta.type);
                }
              }
            } else if (typedData.type === 'chat') {
              onChatMessage(typedData.text);
            }
          } catch (err: any) {
            setErrorStatus(ERRORS.PARSE_ERR + err.message);
          }
        });

        conn.on('close', () => {
          setIsConnected(false);
        });

        conn.on('error', (err) => {
          if (err.message && err.message.includes('Negotiation of connection')) return;
          setErrorStatus(ERRORS.CONN_ERR + ': ' + err.message);
        });
      });

      peer.on('error', () => {
        setErrorStatus(ERRORS.PEER_NOT_FOUND);
        setTransferProgress(-1);
      });

      peerRef.current = peer;
    },
    [resetConnection, finalizeDownload, calculateSpeedAndETA, onChatMessage],
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
      if (connRef.current) connRef.current.close();
      if (peerRef.current) peerRef.current.destroy();
      multiConnsRef.current.forEach((c) => {
        try {
          c.close();
        } catch {
          // ignore
        }
      });
      if (connTimerRef.current) clearInterval(connTimerRef.current);
    };
  }, []);

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
    initSender,
    connectAsReceiver,
    resetConnection,
    broadcastToAll,
  };
}
