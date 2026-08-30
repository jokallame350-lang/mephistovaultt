/**
 * MephistoVault Instant Screen & Voice MediaRecorder Specialist Module
 * Zero cloud dependency — 100% client-side RAM-buffered media capture.
 */

export interface ScreenRecordingOptions {
  /** Include audio track if true (system audio or mic) */
  audio?: boolean;
  /** Custom DisplayMediaStreamOptions */
  displayMediaOptions?: DisplayMediaStreamOptions;
  /** Explicit preferred mimeType override */
  preferredVideoMimeType?: string;
  /** Timeslice in milliseconds for dataavailable events (default: 1000) */
  timeslice?: number;
}

export interface VoiceRecordingOptions {
  /** Enable browser echo cancellation (default: true) */
  echoCancellation?: boolean;
  /** Enable browser background noise suppression (default: true) */
  noiseSuppression?: boolean;
  /** Enable auto gain control (default: true) */
  autoGainControl?: boolean;
  /** Additional custom MediaTrackConstraints */
  audioConstraints?: MediaTrackConstraints;
  /** Explicit preferred mimeType override */
  preferredAudioMimeType?: string;
  /** Timeslice in milliseconds for dataavailable events (default: 1000) */
  timeslice?: number;
}

export interface ActiveRecordingSession {
  /** Stop the recording, release all hardware tracks, and resolve with the final File */
  stop: () => Promise<File>;
  /** Live MediaStream being captured */
  stream: MediaStream;
  /** Underlying MediaRecorder instance */
  recorder: MediaRecorder;
  /** Pause recording */
  pause: () => void;
  /** Resume recording */
  resume: () => void;
  /** Check if currently paused */
  isPaused: () => boolean;
  /** Current MediaRecorder state */
  getState: () => RecordingState;
  /** Negotiated mimeType */
  mimeType: string;
}

export type MediaCaptureSession = ActiveRecordingSession;

/**
 * Ordered video mimeType fallbacks for maximum browser compatibility (Chrome, Firefox, Safari, Edge)
 */
export const VIDEO_MIME_FALLBACKS: readonly string[] = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4;codecs=avc1,mp4a.40.2',
  'video/mp4',
];

/**
 * Ordered audio mimeType fallbacks for maximum browser compatibility
 */
export const AUDIO_MIME_FALLBACKS: readonly string[] = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/aac',
  'audio/wav',
];

/**
 * Internal helper to safely resolve MediaRecorder constructor across browser/node
 */
export function getMediaRecorderClass(): typeof MediaRecorder | undefined {
  if (typeof MediaRecorder !== 'undefined') return MediaRecorder;
  if (typeof window !== 'undefined' && (window as unknown as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder) {
    return (window as unknown as { MediaRecorder: typeof MediaRecorder }).MediaRecorder;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as unknown as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder) {
    return (globalThis as unknown as { MediaRecorder: typeof MediaRecorder }).MediaRecorder;
  }
  return undefined;
}

/**
 * Internal helper to safely resolve MediaDevices across environments
 */
export function getMediaDevices(): MediaDevices | undefined {
  if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
    return navigator.mediaDevices;
  }
  if (typeof window !== 'undefined' && window.navigator?.mediaDevices) {
    return window.navigator.mediaDevices;
  }
  return undefined;
}

/**
 * Check if MediaRecorder API is supported in the current environment
 */
export function isMediaRecorderSupported(): boolean {
  return typeof getMediaRecorderClass() !== 'undefined';
}

/**
 * Check if getDisplayMedia (screen capture) is supported
 */
export function isScreenRecordingSupported(): boolean {
  const devices = getMediaDevices();
  return isMediaRecorderSupported() && typeof devices?.getDisplayMedia === 'function';
}

/**
 * Check if getUserMedia (voice/mic capture) is supported
 */
export function isVoiceRecordingSupported(): boolean {
  const devices = getMediaDevices();
  return isMediaRecorderSupported() && typeof devices?.getUserMedia === 'function';
}

/**
 * Negotiate the best supported video mimeType from candidate list
 */
export function getSupportedVideoMimeType(preferred?: string): string {
  const MR = getMediaRecorderClass();
  if (!MR) {
    return preferred || VIDEO_MIME_FALLBACKS[0];
  }

  if (preferred && typeof MR.isTypeSupported === 'function' && MR.isTypeSupported(preferred)) {
    return preferred;
  }

  if (typeof MR.isTypeSupported === 'function') {
    for (const candidate of VIDEO_MIME_FALLBACKS) {
      if (MR.isTypeSupported(candidate)) {
        return candidate;
      }
    }
  }

  return 'video/webm';
}

/**
 * Negotiate the best supported audio mimeType from candidate list
 */
export function getSupportedAudioMimeType(preferred?: string): string {
  const MR = getMediaRecorderClass();
  if (!MR) {
    return preferred || AUDIO_MIME_FALLBACKS[0];
  }

  if (preferred && typeof MR.isTypeSupported === 'function' && MR.isTypeSupported(preferred)) {
    return preferred;
  }

  if (typeof MR.isTypeSupported === 'function') {
    for (const candidate of AUDIO_MIME_FALLBACKS) {
      if (MR.isTypeSupported(candidate)) {
        return candidate;
      }
    }
  }

  return 'audio/webm';
}

/**
 * Map MIME type to standard file extension
 */
export function getFileExtensionForMime(mimeType: string, defaultExt: string): string {
  const cleanMime = mimeType.toLowerCase().split(';')[0].trim();
  if (cleanMime.includes('webm')) return '.webm';
  if (cleanMime.includes('mp4') || cleanMime.includes('m4a') || cleanMime.includes('aac')) {
    return cleanMime.startsWith('audio/') ? '.m4a' : '.mp4';
  }
  if (cleanMime.includes('ogg')) return cleanMime.startsWith('video/') ? '.ogv' : '.ogg';
  if (cleanMime.includes('wav')) return '.wav';
  if (cleanMime.includes('x-matroska') || cleanMime.includes('mkv')) return '.mkv';
  return defaultExt;
}

/**
 * Format timestamp string for clean artifact filenames (e.g., 2026-08-30-193045)
 */
export function formatTimestampForFilename(date: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}-${month}-${day}-${hours}${minutes}${seconds}`;
}

/**
 * Format duration in seconds to MM:SS or HH:MM:SS string
 */
export function formatRecordingTime(totalSeconds: number): string {
  const total = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');
  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

/**
 * Start instant screen recording session.
 * Captures display stream with optional audio, buffers in-memory, and resolves with File on stop.
 */
export async function startScreenRecording(
  options?: ScreenRecordingOptions,
): Promise<ActiveRecordingSession> {
  const devices = getMediaDevices();
  if (!devices || typeof devices.getDisplayMedia !== 'function') {
    throw new Error('Screen recording is not supported in this browser environment.');
  }

  const MR = getMediaRecorderClass();
  if (!MR) {
    throw new Error('MediaRecorder API is not available on this device.');
  }

  const captureStream: MediaStream = await devices.getDisplayMedia({
    video: {
      cursor: 'always',
      frameRate: { ideal: 30, max: 60 },
    } as MediaTrackConstraints,
    audio: options?.audio ?? false,
    ...options?.displayMediaOptions,
  });

  const mimeType = getSupportedVideoMimeType(options?.preferredVideoMimeType);
  const recorderOptions: MediaRecorderOptions = mimeType ? { mimeType } : {};

  let recorder: MediaRecorder;
  try {
    recorder = new MR(captureStream, recorderOptions);
  } catch {
    recorder = new MR(captureStream);
  }

  const recordedChunks: Blob[] = [];

  recorder.ondataavailable = (event: BlobEvent) => {
    if (event.data && event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  const timeslice = options?.timeslice ?? 1000;
  recorder.start(timeslice);

  const stop = (): Promise<File> => {
    return new Promise<File>((resolve, reject) => {
      const finalizeFile = () => {
        try {
          // Release all tracks
          captureStream.getTracks().forEach((track) => {
            try {
              track.stop();
            } catch {
              // ignore
            }
          });

          const finalMime = recorder.mimeType || mimeType || 'video/webm';
          const extension = getFileExtensionForMime(finalMime, '.webm');
          const timestamp = formatTimestampForFilename();
          const fileName = `screen-recording-${timestamp}${extension}`;

          const blob = new Blob(recordedChunks, { type: finalMime });
          const file = new File([blob], fileName, {
            type: finalMime,
            lastModified: Date.now(),
          });

          resolve(file);
        } catch (err) {
          reject(err);
        }
      };

      recorder.onerror = (event: Event) => {
        const error =
          (event as unknown as { error?: Error }).error ||
          new Error('MediaRecorder encountered an unexpected recording error.');
        reject(error);
      };

      if (recorder.state === 'inactive') {
        finalizeFile();
      } else {
        recorder.onstop = finalizeFile;
        try {
          recorder.stop();
        } catch {
          finalizeFile();
        }
      }
    });
  };

  return {
    stop,
    stream: captureStream,
    recorder,
    pause: () => {
      if (recorder.state === 'recording') {
        recorder.pause();
      }
    },
    resume: () => {
      if (recorder.state === 'paused') {
        recorder.resume();
      }
    },
    isPaused: () => recorder.state === 'paused',
    getState: () => recorder.state,
    mimeType: recorder.mimeType || mimeType,
  };
}

/**
 * Start instant voice/audio recording session.
 * Captures microphone stream with noise suppression & echo cancellation, buffers in-memory, and resolves with File on stop.
 */
export async function startVoiceRecording(
  options?: VoiceRecordingOptions,
): Promise<ActiveRecordingSession> {
  const devices = getMediaDevices();
  if (!devices || typeof devices.getUserMedia !== 'function') {
    throw new Error('Microphone audio recording is not supported in this browser environment.');
  }

  const MR = getMediaRecorderClass();
  if (!MR) {
    throw new Error('MediaRecorder API is not available on this device.');
  }

  const audioStream: MediaStream = await devices.getUserMedia({
    audio: {
      echoCancellation: options?.echoCancellation ?? true,
      noiseSuppression: options?.noiseSuppression ?? true,
      autoGainControl: options?.autoGainControl ?? true,
      ...options?.audioConstraints,
    },
  });

  const mimeType = getSupportedAudioMimeType(options?.preferredAudioMimeType);
  const recorderOptions: MediaRecorderOptions = mimeType ? { mimeType } : {};

  let recorder: MediaRecorder;
  try {
    recorder = new MR(audioStream, recorderOptions);
  } catch {
    recorder = new MR(audioStream);
  }

  const recordedChunks: Blob[] = [];

  recorder.ondataavailable = (event: BlobEvent) => {
    if (event.data && event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  const timeslice = options?.timeslice ?? 1000;
  recorder.start(timeslice);

  const stop = (): Promise<File> => {
    return new Promise<File>((resolve, reject) => {
      const finalizeFile = () => {
        try {
          // Release all tracks
          audioStream.getTracks().forEach((track) => {
            try {
              track.stop();
            } catch {
              // ignore
            }
          });

          const finalMime = recorder.mimeType || mimeType || 'audio/webm';
          const extension = getFileExtensionForMime(finalMime, '.webm');
          const timestamp = formatTimestampForFilename();
          const fileName = `voice-note-${timestamp}${extension}`;

          const blob = new Blob(recordedChunks, { type: finalMime });
          const file = new File([blob], fileName, {
            type: finalMime,
            lastModified: Date.now(),
          });

          resolve(file);
        } catch (err) {
          reject(err);
        }
      };

      recorder.onerror = (event: Event) => {
        const error =
          (event as unknown as { error?: Error }).error ||
          new Error('MediaRecorder encountered an unexpected recording error.');
        reject(error);
      };

      if (recorder.state === 'inactive') {
        finalizeFile();
      } else {
        recorder.onstop = finalizeFile;
        try {
          recorder.stop();
        } catch {
          finalizeFile();
        }
      }
    });
  };

  return {
    stop,
    stream: audioStream,
    recorder,
    pause: () => {
      if (recorder.state === 'recording') {
        recorder.pause();
      }
    },
    resume: () => {
      if (recorder.state === 'paused') {
        recorder.resume();
      }
    },
    isPaused: () => recorder.state === 'paused',
    getState: () => recorder.state,
    mimeType: recorder.mimeType || mimeType,
  };
}
