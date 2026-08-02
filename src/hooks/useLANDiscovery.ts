import { useState, useEffect, useRef } from 'react';
import { Peer } from 'peerjs';
import type { DataConnection } from 'peerjs';
import {
  PEER_CONFIG,
  DISCOVERY_CHANNEL,
  DEVICE_STALE_MS,
  LOBBY_BROADCAST_MS,
  LOBBY_PREFIX,
} from '../lib/constants';
import type {
  DeviceInfo,
  LobbyEnv,
  BroadcastMessage,
  LobbyMessage,
  PeerCustomError,
  AppMode,
} from '../types';

/**
 * Scans WebRTC ICE candidates to discover the local LAN IP address.
 * Works offline (without WAN/Internet connection) by inspecting local SDP candidates.
 */
const getLocalIPViaWebRTC = (): Promise<string | null> => {
  return new Promise((resolve) => {
    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun.cloudflare.com:3478' },
        ],
      });
      let resolved = false;

      const finish = (ip: string | null) => {
        if (!resolved) {
          resolved = true;
          try {
            pc.close();
          } catch {
            // ignore
          }
          resolve(ip);
        }
      };

      pc.createDataChannel('lan-scan');
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .catch(() => finish(null));

      pc.onicecandidate = (event) => {
        if (!event || !event.candidate) {
          finish(null);
          return;
        }
        const candidateStr = event.candidate.candidate;
        // Match IPv4 address pattern (e.g. 192.168.x.x, 10.x.x.x, 172.16-31.x.x)
        const match = candidateStr.match(/([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/);
        if (match && match[1] && !match[1].startsWith('127.')) {
          finish(match[1]);
        }
      };

      setTimeout(() => finish(null), 1200);
    } catch {
      resolve(null);
    }
  });
};

/**
 * Generates or retrieves a collision-resistant device ID.
 * Uses sessionStorage so the device identity persists across component re-renders
 * within the same tab, preventing duplicate phantom devices.
 */
const getOrCreateDeviceId = (): string => {
  try {
    const existing = sessionStorage.getItem('ms_device_id');
    if (existing && existing.length >= 8) return existing;
    const newId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID().substring(0, 8)
        : Math.random().toString(36).substring(2, 10) + Date.now().toString(36).substring(4, 6);
    sessionStorage.setItem('ms_device_id', newId);
    return newId;
  } catch {
    return Math.random().toString(36).substring(2, 10);
  }
};

export function useLANDiscovery(
  shareCode: string,
  mode: AppMode,
  connectAsReceiver: (code: string) => void,
) {
  const [nearbyDevices, setNearbyDevices] = useState<DeviceInfo[]>([]);
  const [showNearby, setShowNearby] = useState(false);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const lobbyEnvRef = useRef<LobbyEnv | null>(null);
  const deviceId = useRef(getOrCreateDeviceId());

  const myDeviceRef = useRef<DeviceInfo>({
    id: deviceId.current,
    name: `DEV-${deviceId.current.toUpperCase()}`,
    time: Date.now(),
    code: mode === 'send' ? shareCode : undefined,
    mode,
  });

  // Keep myDeviceRef updated with current mode and shareCode
  useEffect(() => {
    myDeviceRef.current = {
      id: deviceId.current,
      name: `DEV-${deviceId.current.toUpperCase()}`,
      time: Date.now(),
      code: mode === 'send' ? shareCode : undefined,
      mode,
    };
  }, [mode, shareCode]);

  // Keep a mutable ref of connectAsReceiver to avoid stale closure in callbacks
  const connectAsReceiverRef = useRef(connectAsReceiver);
  useEffect(() => {
    connectAsReceiverRef.current = connectAsReceiver;
  }, [connectAsReceiver]);

  // LAN + WAN Discovery (IP & WebRTC-based Lobby + BroadcastChannel fallback)
  useEffect(() => {
    let isMounted = true;
    let lobbyPeer: Peer | null = null;
    let lobbyConn: DataConnection | null = null;
    let hostPeer: Peer | null = null;
    let isHost = false;
    let clients: DataConnection[] = [];
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const knownDevices: Record<string, DeviceInfo> = {};

    const bc = new BroadcastChannel(DISCOVERY_CHANNEL);
    bcRef.current = bc;

    const clearRetryTimer = () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    const cleanupLobbyPeers = () => {
      clearRetryTimer();
      clients.forEach((c) => {
        try {
          c.close();
        } catch {
          // ignore
        }
      });
      clients = [];

      if (lobbyConn) {
        try {
          lobbyConn.close();
        } catch {
          // ignore
        }
        lobbyConn = null;
      }
      if (lobbyPeer) {
        try {
          lobbyPeer.destroy();
        } catch {
          // ignore
        }
        lobbyPeer = null;
      }
      if (hostPeer) {
        try {
          hostPeer.destroy();
        } catch {
          // ignore
        }
        hostPeer = null;
      }
      isHost = false;
    };

    const updateOrAddDevice = (device: DeviceInfo) => {
      if (device.id === myDeviceRef.current.id) return;
      setNearbyDevices((prev) => {
        const idx = prev.findIndex((d) => d.id === device.id);
        if (idx !== -1) {
          const existing = prev[idx];
          const updated: DeviceInfo = {
            ...existing,
            ...device,
            time: device.time || Date.now(),
            code: device.code ?? existing.code,
            mode: device.mode ?? existing.mode,
          };
          const copy = [...prev];
          copy[idx] = updated;
          return copy;
        }
        return [...prev, { ...device, time: device.time || Date.now() }];
      });
    };

    const mergeSyncedDevices = (syncedDevices: Record<string, DeviceInfo>) => {
      const now = Date.now();
      setNearbyDevices((prev) => {
        const deviceMap = new Map<string, DeviceInfo>();

        // Keep active existing devices
        prev.forEach((d) => {
          if (d.id !== myDeviceRef.current.id && now - d.time < DEVICE_STALE_MS) {
            deviceMap.set(d.id, d);
          }
        });

        // Merge incoming lobby devices (preserving room code and mode)
        Object.values(syncedDevices).forEach((d) => {
          if (d.id !== myDeviceRef.current.id && now - d.time < DEVICE_STALE_MS) {
            const existing = deviceMap.get(d.id);
            deviceMap.set(d.id, {
              ...existing,
              ...d,
              time: d.time || now,
              code: d.code ?? existing?.code,
              mode: d.mode ?? existing?.mode,
            });
          }
        });

        return Array.from(deviceMap.values());
      });
    };

    bc.onmessage = (e) => {
      const data = e.data as BroadcastMessage;
      if (!data) return;

      if (data.type === 'announce') {
        updateOrAddDevice({
          id: data.id,
          name: data.name,
          time: data.time,
          code: data.code,
          mode: data.mode,
        });
      } else if (data.type === 'leave') {
        setNearbyDevices((prev) => prev.filter((d) => d.id !== data.id));
      } else if (data.type === 'invite') {
        if (
          data.targetId === myDeviceRef.current.id &&
          myDeviceRef.current.mode === 'idle'
        ) {
          connectAsReceiverRef.current(data.code);
        }
      } else if (data.type === 'lobby-sync' && data.devices) {
        mergeSyncedDevices(data.devices);
      }
    };

    const announceLocal = () => {
      myDeviceRef.current.time = Date.now();
      try {
        bc.postMessage({ type: 'announce', ...myDeviceRef.current });
      } catch {
        // ignore
      }
    };

    const broadcastToClients = (payload: LobbyMessage | BroadcastMessage) => {
      clients.forEach((c) => {
        if (c.open) {
          try {
            c.send(payload);
          } catch {
            // ignore
          }
        }
      });
    };

    const initLobby = async () => {
      try {
        // 1. WebRTC ICE candidate local IP discovery
        let ipString = await getLocalIPViaWebRTC();

        // 2. Cloudflare trace fallback
        if (!ipString) {
          try {
            const res = await fetch('https://1.1.1.1/cdn-cgi/trace');
            const text = await res.text();
            ipString =
              text
                .split('\n')
                .find((line) => line.startsWith('ip='))
                ?.split('=')[1] || '';
          } catch {
            // ignore
          }
        }

        // 3. Ipify API fallback
        if (!ipString) {
          try {
            const res = await fetch('https://api.ipify.org?format=json');
            const data = await res.json();
            ipString = data.ip;
          } catch {
            // ignore
          }
        }

        // 4. Offline network fallback key
        if (!ipString) {
          ipString = new Date().toISOString().split('T')[0];
        }

        let hash = 0;
        for (let i = 0; i < ipString.length; i++) {
          hash = (hash << 5) - hash + ipString.charCodeAt(i);
          hash |= 0;
        }
        const lobbyId = `${LOBBY_PREFIX}${Math.abs(hash)}`;

        const scheduleRetry = (delayMs: number) => {
          clearRetryTimer();
          if (!isMounted) return;
          retryTimer = setTimeout(() => {
            if (isMounted) tryBecomeHost();
          }, delayMs);
        };

        const tryBecomeHost = () => {
          if (!isMounted) return;
          cleanupLobbyPeers();

          const candidateHostPeer = new Peer(lobbyId, PEER_CONFIG);
          hostPeer = candidateHostPeer;

          candidateHostPeer.on('open', () => {
            if (!isMounted) {
              candidateHostPeer.destroy();
              return;
            }
            isHost = true;
            lobbyPeer = candidateHostPeer;
            knownDevices[myDeviceRef.current.id] = {
              ...myDeviceRef.current,
              time: Date.now(),
            };

            candidateHostPeer.on('connection', (conn) => {
              clients.push(conn);
              conn.on('data', (data: unknown) => {
                const typedData = data as LobbyMessage;
                if (typedData.type === 'announce') {
                  knownDevices[typedData.device.id] = {
                    ...typedData.device,
                    time: Date.now(),
                  };
                } else if (typedData.type === 'invite') {
                  broadcastToClients(typedData);
                  try {
                    bc.postMessage(typedData);
                  } catch {
                    // ignore
                  }
                }
              });
              conn.on('close', () => {
                clients = clients.filter((c) => c !== conn);
              });
            });
          });

          candidateHostPeer.on('error', () => {
            if (!isMounted) return;
            isHost = false;
            // Clean up failed host peer before falling back to client
            candidateHostPeer.destroy();
            hostPeer = null;

            const clientPeer = new Peer(PEER_CONFIG);
            lobbyPeer = clientPeer;

            let clientConnected = false;

            clientPeer.on('open', () => {
              if (!isMounted) {
                clientPeer.destroy();
                return;
              }
              const conn = clientPeer.connect(lobbyId, { reliable: true });
              lobbyConn = conn;

              conn.on('open', () => {
                if (!isMounted) {
                  conn.close();
                  return;
                }
                clientConnected = true;
                conn.send({ type: 'announce', device: myDeviceRef.current });

                const announceInterval = setInterval(() => {
                  if (conn.open && isMounted) {
                    conn.send({
                      type: 'announce',
                      device: { ...myDeviceRef.current, time: Date.now() },
                    });
                  } else {
                    clearInterval(announceInterval);
                  }
                }, 4000);

                conn.on('close', () => {
                  clearInterval(announceInterval);
                  if (isMounted) {
                    scheduleRetry(500 + Math.random() * 2000);
                  }
                });
              });

              conn.on('data', (data: unknown) => {
                const typedData = data as LobbyMessage | BroadcastMessage;
                if (typedData.type === 'lobby-sync') {
                  mergeSyncedDevices(typedData.devices);
                  try {
                    bc.postMessage({ type: 'lobby-sync', devices: typedData.devices });
                  } catch {
                    // ignore
                  }
                } else if (
                  typedData.type === 'invite' &&
                  typedData.targetId === myDeviceRef.current.id &&
                  myDeviceRef.current.mode === 'idle'
                ) {
                  connectAsReceiverRef.current(typedData.code);
                }
              });
            });

            clientPeer.on('error', (cerr: PeerCustomError) => {
              if (!isMounted) return;
              if (
                !clientConnected &&
                (cerr.type === 'peer-unavailable' ||
                  cerr.type === 'server-error' ||
                  cerr.type === 'network')
              ) {
                scheduleRetry(2500);
              }
            });
          });
        };

        const broadcastLobby = () => {
          if (!isHost || !isMounted) return;
          const now = Date.now();
          Object.keys(knownDevices).forEach((k) => {
            if (now - knownDevices[k].time > DEVICE_STALE_MS) delete knownDevices[k];
          });
          knownDevices[myDeviceRef.current.id] = { ...myDeviceRef.current, time: now };
          setNearbyDevices(
            Object.values(knownDevices).filter((d) => d.id !== myDeviceRef.current.id),
          );
          const payload: LobbyMessage = { type: 'lobby-sync', devices: knownDevices };
          broadcastToClients(payload);
        };

        tryBecomeHost();

        const hostInterval = setInterval(() => {
          if (isHost && isMounted) broadcastLobby();
        }, LOBBY_BROADCAST_MS);

        lobbyEnvRef.current = {
          get isHost() {
            return isHost;
          },
          get lobbyConn() {
            return lobbyConn;
          },
          broadcastToClients,
        };

        return () => {
          clearInterval(hostInterval);
        };
      } catch {
        // Limited to local same-browser / BroadcastChannel
      }
    };

    initLobby();
    announceLocal();

    const localInterval = setInterval(announceLocal, LOBBY_BROADCAST_MS);
    const cleanupInterval = setInterval(() => {
      setNearbyDevices((prev) => prev.filter((d) => Date.now() - d.time < DEVICE_STALE_MS));
    }, DEVICE_STALE_MS);

    return () => {
      isMounted = false;
      clearInterval(localInterval);
      clearInterval(cleanupInterval);

      // Send leave message via BroadcastChannel
      try {
        bc.postMessage({ type: 'leave', id: myDeviceRef.current.id });
      } catch {
        // ignore
      }
      bc.close();

      cleanupLobbyPeers();
    };
  }, []);

  const inviteDevice = (targetId: string) => {
    const invitePayload: LobbyMessage = {
      type: 'invite',
      targetId,
      code: shareCode,
    };
    if (lobbyEnvRef.current) {
      lobbyEnvRef.current.broadcastToClients(invitePayload);
      if (lobbyEnvRef.current.lobbyConn?.open) {
        lobbyEnvRef.current.lobbyConn.send(invitePayload);
      }
    }
    if (bcRef.current) {
      try {
        bcRef.current.postMessage(invitePayload);
      } catch {
        // ignore
      }
    }
  };

  return {
    nearbyDevices,
    showNearby,
    setShowNearby,
    inviteDevice,
  };
}

export default useLANDiscovery;
