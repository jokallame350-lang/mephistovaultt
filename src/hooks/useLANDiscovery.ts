import { useState, useEffect, useRef } from 'react';
import { Peer } from 'peerjs';
import type { DataConnection } from 'peerjs';
import { PEER_CONFIG } from '../lib/constants';
import type { DeviceInfo, LobbyEnv, BroadcastMessage, LobbyMessage } from '../types';

export function useLANDiscovery(
  shareCode: string,
  mode: 'idle' | 'send' | 'receive',
  connectAsReceiver: (code: string) => void,
) {
  const [nearbyDevices, setNearbyDevices] = useState<DeviceInfo[]>([]);
  const [showNearby, setShowNearby] = useState(false);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const lobbyEnvRef = useRef<LobbyEnv | null>(null);
  const deviceId = useRef(Math.random().toString(36).substring(2, 6));
  const myDeviceRef = useRef<DeviceInfo>({
    id: deviceId.current,
    name: `DEV-${deviceId.current.toUpperCase()}`,
    time: Date.now(),
    code: undefined,
    mode: 'idle',
  });

  // Sync my device details
  useEffect(() => {
    myDeviceRef.current = {
      id: deviceId.current,
      name: `DEV-${deviceId.current.toUpperCase()}`,
      time: Date.now(),
      code: shareCode || undefined,
      mode,
    };
  }, [shareCode, mode]);

  // Keep a mutable ref of connectAsReceiver for BroadcastChannel callback to avoid stale closure
  const connectAsReceiverRef = useRef(connectAsReceiver);
  useEffect(() => {
    connectAsReceiverRef.current = connectAsReceiver;
  }, [connectAsReceiver]);

  // LAN + WAN Discovery (IP-based Lobby + BroadcastChannel fallback)
  useEffect(() => {
    let isMounted = true;
    let lobbyPeer: Peer | null = null;
    let lobbyConn: DataConnection | null = null;
    let isHost = false;
    let clients: DataConnection[] = [];
    const knownDevices: Record<string, DeviceInfo> = {};

    const bc = new BroadcastChannel('mephisto-share-discovery');
    bcRef.current = bc;

    bc.onmessage = (e) => {
      const data = e.data as BroadcastMessage;
      if (data.type === 'announce' && data.id !== myDeviceRef.current.id) {
        setNearbyDevices((prev) => {
          const exists = prev.find((d) => d.id === data.id);
          if (exists) {
            return prev.map((d) =>
              d.id === data.id
                ? { ...d, time: data.time, code: data.code || d.code }
                : d,
            );
          }
          return [
            ...prev,
            { id: data.id, name: data.name, time: data.time, code: data.code },
          ];
        });
      }
      if (
        data.type === 'invite' &&
        data.targetId === myDeviceRef.current.id &&
        myDeviceRef.current.mode === 'idle'
      ) {
        connectAsReceiverRef.current(data.code);
      }
      if (data.type === 'lobby-sync' && data.devices) {
        setNearbyDevices(
          Object.values(data.devices).filter(
            (d) => d.id !== myDeviceRef.current.id && Date.now() - d.time < 15000,
          ),
        );
      }
    };

    const announceLocal = () => {
      myDeviceRef.current.time = Date.now();
      bc.postMessage({ type: 'announce', ...myDeviceRef.current });
    };

    const broadcastToClients = (payload: LobbyMessage | BroadcastMessage) => {
      clients.forEach((c) => {
        if (c.open) c.send(payload);
      });
    };

    const initLobby = async () => {
      try {
        let ipString = '';
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

        if (!ipString) {
          try {
            const res = await fetch('https://api.ipify.org?format=json');
            const data = await res.json();
            ipString = data.ip;
          } catch {
            // ignore
          }
        }

        if (!ipString) {
          // If completely blocked, fallback to a daily rotating global lobby for discovery
          ipString = new Date().toISOString().split('T')[0];
        }

        let hash = 0;
        for (let i = 0; i < ipString.length; i++) {
          hash = (hash << 5) - hash + ipString.charCodeAt(i);
          hash |= 0;
        }
        const lobbyId = `ms-lobby-${Math.abs(hash)}`;

        let failedToFindHost = false;

        const tryBecomeHost = () => {
          if (!isMounted) return;
          const hostPeer = new Peer(lobbyId, PEER_CONFIG);

          hostPeer.on('open', () => {
            isHost = true;
            lobbyPeer = hostPeer;
            knownDevices[myDeviceRef.current.id] = {
              ...myDeviceRef.current,
              time: Date.now(),
            };

            hostPeer.on('connection', (conn) => {
              clients.push(conn);
              conn.on('data', (data: any) => {
                const typedData = data as LobbyMessage;
                if (typedData.type === 'announce') {
                  knownDevices[typedData.device.id] = {
                    ...typedData.device,
                    time: Date.now(),
                  };
                }
                if (typedData.type === 'invite') {
                  broadcastToClients(typedData);
                  bc.postMessage(typedData);
                }
              });
              conn.on('close', () => {
                clients = clients.filter((c) => c !== conn);
              });
            });
          });

          hostPeer.on('error', () => {
            isHost = false;

            const clientPeer = new Peer(PEER_CONFIG);
            lobbyPeer = clientPeer;

            clientPeer.on('open', () => {
              lobbyConn = clientPeer.connect(lobbyId, { reliable: true });

              lobbyConn.on('open', () => {
                failedToFindHost = false;
                lobbyConn!.send({ type: 'announce', device: myDeviceRef.current });
                const p = setInterval(() => {
                  if (lobbyConn?.open) {
                    lobbyConn.send({
                      type: 'announce',
                      device: { ...myDeviceRef.current, time: Date.now() },
                    });
                  }
                }, 4000);
                lobbyConn!.on('close', () => {
                  clearInterval(p);
                  setTimeout(tryBecomeHost, 500 + Math.random() * 2000);
                });
              });

              lobbyConn.on('data', (data: any) => {
                const typedData = data as LobbyMessage | BroadcastMessage;
                if (typedData.type === 'lobby-sync') {
                  setNearbyDevices(
                    Object.values(typedData.devices).filter(
                      (d) =>
                        d.id !== myDeviceRef.current.id && Date.now() - d.time < 15000,
                    ),
                  );
                  bc.postMessage({ type: 'lobby-sync', devices: typedData.devices });
                }
                if (
                  typedData.type === 'invite' &&
                  typedData.targetId === myDeviceRef.current.id &&
                  myDeviceRef.current.mode === 'idle'
                ) {
                  connectAsReceiverRef.current(typedData.code);
                }
              });
            });

            clientPeer.on('error', (cerr: any) => {
              if (
                (cerr.type === 'peer-unavailable' || cerr.type === 'server-error') &&
                !failedToFindHost
              ) {
                failedToFindHost = true;
                setTimeout(tryBecomeHost, 2500);
              }
            });
          });
        };

        const broadcastLobby = () => {
          if (!isHost) return;
          const now = Date.now();
          Object.keys(knownDevices).forEach((k) => {
            if (now - knownDevices[k].time > 15000) delete knownDevices[k];
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
        }, 3000);

        lobbyEnvRef.current = {
          get isHost() {
            return isHost;
          },
          get lobbyConn() {
            return lobbyConn;
          },
          broadcastToClients,
        };

        return () => clearInterval(hostInterval);
      } catch {
        // limited to same-browser
      }
    };

    initLobby();
    announceLocal();

    const localInterval = setInterval(announceLocal, 3000);
    const cleanup = setInterval(() => {
      setNearbyDevices((prev) => prev.filter((d) => Date.now() - d.time < 15000));
    }, 15000);

    return () => {
      isMounted = false;
      clearInterval(localInterval);
      clearInterval(cleanup);
      bc.close();
      if (lobbyConn) lobbyConn.close();
      if (lobbyPeer) lobbyPeer.destroy();
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
      bcRef.current.postMessage(invitePayload);
    }
  };

  return {
    nearbyDevices,
    showNearby,
    setShowNearby,
    inviteDevice,
  };
}
