import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  startScreenRecording,
  startVoiceRecording,
  isMediaRecorderSupported,
  isScreenRecordingSupported,
  isVoiceRecordingSupported,
  getSupportedVideoMimeType,
  getSupportedAudioMimeType,
  getFileExtensionForMime,
  formatTimestampForFilename,
  formatRecordingTime,
  VIDEO_MIME_FALLBACKS,
  AUDIO_MIME_FALLBACKS,
} from '../lib/mediaRecorder';

// Mock Track
class MockMediaStreamTrack {
  kind: string;
  enabled: boolean = true;
  readyState: 'live' | 'ended' = 'live';
  onended: (() => void) | null = null;

  constructor(kind: string = 'video') {
    this.kind = kind;
  }

  stop() {
    this.readyState = 'ended';
    if (this.onended) this.onended();
  }
}

// Mock MediaStream
class MockMediaStream {
  private tracks: MockMediaStreamTrack[] = [];

  constructor(tracks?: MockMediaStreamTrack[]) {
    this.tracks = tracks || [new MockMediaStreamTrack('video')];
  }

  getTracks() {
    return this.tracks;
  }

  getVideoTracks() {
    return this.tracks.filter((t) => t.kind === 'video');
  }

  getAudioTracks() {
    return this.tracks.filter((t) => t.kind === 'audio');
  }

  addTrack(track: MockMediaStreamTrack) {
    this.tracks.push(track);
  }
}

// Mock MediaRecorder
class MockMediaRecorder {
  static supportedTypes: Set<string> = new Set([
    'video/webm;codecs=vp9,opus',
    'audio/webm;codecs=opus',
  ]);

  static isTypeSupported(mimeType: string): boolean {
    return MockMediaRecorder.supportedTypes.has(mimeType);
  }

  stream: MockMediaStream;
  mimeType: string;
  state: RecordingState = 'inactive';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(stream: MockMediaStream, options?: { mimeType?: string }) {
    this.stream = stream;
    this.mimeType = options?.mimeType || 'video/webm';
  }

  start(_timeslice?: number) {
    this.state = 'recording';
  }

  pause() {
    this.state = 'paused';
  }

  resume() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    if (this.ondataavailable) {
      const dummyBlob = new Blob(['mock-media-binary-data'], { type: this.mimeType });
      this.ondataavailable({ data: dummyBlob });
    }
    if (this.onstop) {
      this.onstop(new Event('stop'));
    }
  }
}

describe('MediaRecorder Specialist Suite', () => {
  const originalMediaRecorder = (globalThis as unknown as { MediaRecorder?: unknown }).MediaRecorder;
  const originalMediaStream = (globalThis as unknown as { MediaStream?: unknown }).MediaStream;
  const originalNavigator = globalThis.navigator;

  beforeEach(() => {
    MockMediaRecorder.supportedTypes = new Set([
      'video/webm;codecs=vp9,opus',
      'audio/webm;codecs=opus',
    ]);

    (globalThis as unknown as { MediaRecorder: typeof MockMediaRecorder }).MediaRecorder =
      MockMediaRecorder;
    (globalThis as unknown as { MediaStream: typeof MockMediaStream }).MediaStream =
      MockMediaStream;

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        mediaDevices: {
          getDisplayMedia: vi.fn().mockImplementation(async (opts?: { audio?: boolean }) => {
            const tracks = [new MockMediaStreamTrack('video')];
            if (opts?.audio) {
              tracks.push(new MockMediaStreamTrack('audio'));
            }
            return new MockMediaStream(tracks);
          }),
          getUserMedia: vi.fn().mockImplementation(async () => {
            return new MockMediaStream([new MockMediaStreamTrack('audio')]);
          }),
        },
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    (globalThis as unknown as { MediaRecorder?: unknown }).MediaRecorder = originalMediaRecorder;
    (globalThis as unknown as { MediaStream?: unknown }).MediaStream = originalMediaStream;
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  describe('Feature & Support Detection', () => {
    it('accurately identifies MediaRecorder, screen, and voice recording capabilities', () => {
      expect(isMediaRecorderSupported()).toBe(true);
      expect(isScreenRecordingSupported()).toBe(true);
      expect(isVoiceRecordingSupported()).toBe(true);
      expect(VIDEO_MIME_FALLBACKS.length).toBeGreaterThan(0);
      expect(AUDIO_MIME_FALLBACKS.length).toBeGreaterThan(0);
    });

    it('returns false when navigator.mediaDevices is absent', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {},
        writable: true,
        configurable: true,
      });

      expect(isScreenRecordingSupported()).toBe(false);
      expect(isVoiceRecordingSupported()).toBe(false);
    });
  });

  describe('MIME Type Fallback Negotiation', () => {
    it('negotiates first supported video mimeType (VP9/Opus)', () => {
      const mime = getSupportedVideoMimeType();
      expect(mime).toBe('video/webm;codecs=vp9,opus');
    });

    it('falls back to video/mp4 when webm is unsupported', () => {
      MockMediaRecorder.supportedTypes = new Set(['video/mp4']);
      const mime = getSupportedVideoMimeType();
      expect(mime).toBe('video/mp4');
    });

    it('honors preferred video mimeType if supported', () => {
      MockMediaRecorder.supportedTypes = new Set([
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
      ]);
      const mime = getSupportedVideoMimeType('video/webm;codecs=vp8,opus');
      expect(mime).toBe('video/webm;codecs=vp8,opus');
    });

    it('negotiates first supported audio mimeType (Opus/WebM)', () => {
      const mime = getSupportedAudioMimeType();
      expect(mime).toBe('audio/webm;codecs=opus');
    });

    it('falls back to audio/ogg when webm is unsupported', () => {
      MockMediaRecorder.supportedTypes = new Set(['audio/ogg;codecs=opus']);
      const mime = getSupportedAudioMimeType();
      expect(mime).toBe('audio/ogg;codecs=opus');
    });

    it('falls back to audio/mp4 for Apple Safari environments', () => {
      MockMediaRecorder.supportedTypes = new Set(['audio/mp4']);
      const mime = getSupportedAudioMimeType();
      expect(mime).toBe('audio/mp4');
    });
  });

  describe('File Extension & Timestamp Formatting', () => {
    it('maps MIME types to appropriate extensions', () => {
      expect(getFileExtensionForMime('video/webm;codecs=vp9,opus', '.webm')).toBe('.webm');
      expect(getFileExtensionForMime('video/mp4', '.mp4')).toBe('.mp4');
      expect(getFileExtensionForMime('audio/mp4', '.mp4')).toBe('.m4a');
      expect(getFileExtensionForMime('audio/ogg;codecs=opus', '.ogg')).toBe('.ogg');
      expect(getFileExtensionForMime('audio/wav', '.wav')).toBe('.wav');
      expect(getFileExtensionForMime('unknown/custom', '.bin')).toBe('.bin');
    });

    it('formats timestamp cleanly without invalid filesystem characters', () => {
      const fixedDate = new Date(2026, 7, 30, 19, 45, 12);
      const ts = formatTimestampForFilename(fixedDate);
      expect(ts).toBe('2026-08-30-194512');
      expect(ts).not.toContain(':');
      expect(ts).not.toContain('/');
    });

    it('formats digital recording clock cleanly (MM:SS and HH:MM:SS)', () => {
      expect(formatRecordingTime(0)).toBe('00:00');
      expect(formatRecordingTime(5)).toBe('00:05');
      expect(formatRecordingTime(65)).toBe('01:05');
      expect(formatRecordingTime(3665)).toBe('01:01:05');
    });
  });

  describe('Screen Recording Session Lifecycle', () => {
    it('initiates screen capture and returns stop function & active stream', async () => {
      const session = await startScreenRecording({ audio: true });

      expect(session.stream).toBeDefined();
      expect(session.stream.getVideoTracks().length).toBeGreaterThan(0);
      expect(session.stream.getAudioTracks().length).toBeGreaterThan(0);
      expect(session.getState()).toBe('recording');
      expect(session.isPaused()).toBe(false);

      // Pause and Resume
      session.pause();
      expect(session.isPaused()).toBe(true);
      expect(session.getState()).toBe('paused');

      session.resume();
      expect(session.isPaused()).toBe(false);
      expect(session.getState()).toBe('recording');

      // Stop recording and finalize File
      const file = await session.stop();

      expect(file).toBeInstanceOf(File);
      expect(file.name).toMatch(/^screen-recording-.*\.webm$/);
      expect(file.size).toBeGreaterThan(0);
      expect(file.type).toContain('video/webm');

      // Verify hardware tracks stopped
      session.stream.getTracks().forEach((trk) => {
        expect(trk.readyState).toBe('ended');
      });
    });

    it('throws descriptive error if getDisplayMedia fails or user cancels', async () => {
      vi.spyOn(navigator.mediaDevices, 'getDisplayMedia').mockRejectedValueOnce(
        new Error('Permission denied by user')
      );

      await expect(startScreenRecording()).rejects.toThrow('Permission denied by user');
    });
  });

  describe('Voice Recording Session Lifecycle', () => {
    it('initiates microphone capture and returns stop function & active stream', async () => {
      const session = await startVoiceRecording({
        echoCancellation: true,
        noiseSuppression: true,
      });

      expect(session.stream).toBeDefined();
      expect(session.stream.getAudioTracks().length).toBeGreaterThan(0);
      expect(session.getState()).toBe('recording');

      // Pause and Resume
      session.pause();
      expect(session.isPaused()).toBe(true);
      session.resume();
      expect(session.isPaused()).toBe(false);

      // Stop recording and finalize File
      const file = await session.stop();

      expect(file).toBeInstanceOf(File);
      expect(file.name).toMatch(/^voice-note-.*\.webm$/);
      expect(file.size).toBeGreaterThan(0);
      expect(file.type).toContain('audio/webm');

      // Verify audio tracks stopped
      session.stream.getTracks().forEach((trk) => {
        expect(trk.readyState).toBe('ended');
      });
    });

    it('throws descriptive error if getUserMedia fails or microphone is blocked', async () => {
      vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValueOnce(
        new Error('Requested device not found')
      );

      await expect(startVoiceRecording()).rejects.toThrow('Requested device not found');
    });
  });
});
