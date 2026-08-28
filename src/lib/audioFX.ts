/**
 * MephistoVault Web Audio API Sound Effects Synthesizer
 * Zero external audio files — 100% synthesized in-memory via pure Web Audio API.
 */

const SOUND_STORAGE_KEY = 'mv_sound_enabled';

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (typeof window === 'undefined') return null;
    const AudioCtxClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!AudioCtxClass) return null;

    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioCtxClass();
    }

    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }

    return sharedAudioCtx;
  } catch {
    return null;
  }
}

// Auto-resume AudioContext on first user interaction to comply with browser autoplay policies
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
  };
  window.addEventListener('pointerdown', unlockAudio, { once: true });
  window.addEventListener('keydown', unlockAudio, { once: true });
}

/**
 * Check if sound effects are enabled in localStorage.
 * Defaults to true if not set.
 */
export function isSoundEnabled(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(SOUND_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

/**
 * Set sound effects enabled/disabled state in localStorage.
 */
export function setSoundEnabled(enabled: boolean): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(SOUND_STORAGE_KEY, enabled ? 'true' : 'false');
    }
  } catch {
    // ignore
  }
}

/**
 * Toggle sound effects state and return new state.
 */
export function toggleSoundEnabled(): boolean {
  const nextState = !isSoundEnabled();
  setSoundEnabled(nextState);
  return nextState;
}

/**
 * Synthesize Peer Connection Chime:
 * Short, upbeat positive frequency sweep (440Hz -> 880Hz / 1320Hz harmonic sweep).
 */
export function playPeerConnectedChime(): void {
  if (!isSoundEnabled()) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Primary Sweep Oscillator (Sine)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(440, now);
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.18);

    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(0.2, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.3);

    // Secondary Harmonizer (Triangle - sparkle layer)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(660, now + 0.04);
    osc2.frequency.exponentialRampToValueAtTime(1320, now + 0.22);

    gain2.gain.setValueAtTime(0.001, now + 0.04);
    gain2.gain.linearRampToValueAtTime(0.12, now + 0.07);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.start(now + 0.04);
    osc2.stop(now + 0.34);
  } catch {
    // AudioContext failure gracefully ignored
  }
}

/**
 * Synthesize File Drop / Selection Chime:
 * Futuristic cybernetic sound sweep (320Hz -> 640Hz with smooth resonance decay).
 */
export function playFileDropChime(): void {
  if (!isSoundEnabled()) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.12);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.24);
  } catch {
    // AudioContext failure gracefully ignored
  }
}

/**
 * Synthesize Button / Toggle Micro-Click Sound:
 * Ultra-crisp high frequency acoustic micro-pop.
 */
export function playToggleSound(): void {
  if (!isSoundEnabled()) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(1800, now + 0.04);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.1, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.07);
  } catch {
    // AudioContext failure gracefully ignored
  }
}

/**
 * Synthesize Error / Warning Buzzer:
 * Low-frequency warning tone with subtle dissonant undertone.
 */
export function playErrorSound(): void {
  if (!isSoundEnabled()) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(160, now + 0.18);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.24);
  } catch {
    // AudioContext failure gracefully ignored
  }
}

/**
 * Synthesize Transfer Complete Chime:
 * Pleasant celebratory chord (C5 -> E5 -> G5 -> C6 arpeggiated major chord with warm decay).
 */
export function playTransferCompleteChime(): void {
  if (!isSoundEnabled()) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Celebratory Major 9th chord frequencies: C5, E5, G5, C6, E6
    const chordNotes = [
      { freq: 523.25, timeOffset: 0.0, gain: 0.18, dur: 0.65 },  // C5
      { freq: 659.25, timeOffset: 0.05, gain: 0.18, dur: 0.65 }, // E5
      { freq: 783.99, timeOffset: 0.10, gain: 0.18, dur: 0.70 }, // G5
      { freq: 1046.50, timeOffset: 0.15, gain: 0.22, dur: 0.85 }, // C6
      { freq: 1318.51, timeOffset: 0.20, gain: 0.14, dur: 0.90 }, // E6 (sparkle top)
    ];

    chordNotes.forEach(({ freq, timeOffset, gain, dur }) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + timeOffset);

      gainNode.gain.setValueAtTime(0.001, now + timeOffset);
      gainNode.gain.linearRampToValueAtTime(gain, now + timeOffset + 0.025);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + timeOffset + dur);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(now + timeOffset);
      osc.stop(now + timeOffset + dur + 0.05);
    });
  } catch {
    // AudioContext failure gracefully ignored
  }
}

/**
 * Backward compatibility alias for playTransferSound
 */
export const playTransferSound = playTransferCompleteChime;
