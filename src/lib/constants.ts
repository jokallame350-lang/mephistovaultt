// ── Transfer ──
export const CHUNK_SIZE = 64 * 1024;
export const SELF_DESTRUCT_SEC = 300;

// ── Error Messages ──
export const ERRORS = {
  CONN_LOST: 'Connection lost.',
  CONN_CLOSED: 'Connection closed unexpectedly.',
  PARSE_ERR: 'Data parsing error: ',
  SEND_CHUNK_ERR: 'Failed to send file chunk: ',
  PEER_NOT_FOUND: 'Error: Could not find or connect to that peer. Check the code.',
  CONN_ERR: 'Connection error',
} as const;

// ── PeerJS ICE Config ──
export const PEER_CONFIG = {
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'stun:global.stun.twilio.com:3478' },
      { urls: 'stun:stun.nextcloud.com:443' },
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
      {
        urls: 'turn:openrelay.metered.ca:80?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
      {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
      {
        urls: 'turns:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
    ],
  },
} as const;

// ── Chat Emojis ──
export const EMOJIS = ['👍', '❤️', '😂', '🔥', '👏', '😮', '🎉', '💯'] as const;

// ── Code Generation Charset ──
export const CODE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
export const CODE_LENGTH = 6;
export const PIN_MIN = 1000;
export const PIN_MAX = 9999;

// ── Discovery ──
export const DISCOVERY_CHANNEL = 'mephisto-share-discovery';
export const DEVICE_STALE_MS = 15_000;
export const LOBBY_BROADCAST_MS = 3_000;
export const LOBBY_PREFIX = 'ms-lobby-';

// ── Encryption ──
export const PBKDF2_ITERATIONS = 100_000;
export const AES_KEY_LENGTH = 256;
export const IV_LENGTH = 12;

// ── Handshake ──
export const HANDSHAKE_INTERVAL_MS = 500;

// ── Peer ID Prefix ──
export const PEER_ID_PREFIX = 'mephisto-';
