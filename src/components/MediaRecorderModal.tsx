import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Monitor,
  Mic,
  Volume2,
  VolumeX,
  Pause,
  Play,
  Trash2,
  Check,
  X,
  ShieldCheck,
  Radio,
  Activity,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  Zap,
} from 'lucide-react';
import {
  startScreenRecording,
  startVoiceRecording,
  formatRecordingTime,
  isScreenRecordingSupported,
  isVoiceRecordingSupported,
  type MediaCaptureSession,
} from '../lib/mediaRecorder';
import { playFileDropChime, playToggleSound, playErrorSound } from '../lib/audioFX';

export interface MediaRecorderModalProps {
  isOpen?: boolean;
  initialMode?: 'screen' | 'voice';
  onClose: () => void;
  onRecordedFile?: (file: File) => void;
  onMediaCaptured?: (file: File) => void;
  onMediaRecorded?: (file: File) => void;
  t?: (key: string, params?: Record<string, string | number>) => string;
  allowModeSwitch?: boolean;
}

export const MediaRecorderModal: React.FC<MediaRecorderModalProps> = ({
  isOpen = true,
  initialMode = 'screen',
  onClose,
  onRecordedFile,
  onMediaCaptured,
  onMediaRecorded,
  t,
  allowModeSwitch = true,
}) => {
  const [mode, setMode] = useState<'screen' | 'voice'>(initialMode);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [includeAudio, setIncludeAudio] = useState(true);
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [echoCancellation, setEchoCancellation] = useState(true);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [recordedFilePreview, setRecordedFilePreview] = useState<{ file: File; url: string } | null>(null);
  const [micVolumeLevel, setMicVolumeLevel] = useState<number>(0);

  // References
  const sessionRef = useRef<MediaCaptureSession | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Deliver captured file to any handler passed in props
  const deliverFile = useCallback(
    (file: File) => {
      if (onRecordedFile) onRecordedFile(file);
      if (onMediaCaptured) onMediaCaptured(file);
      if (onMediaRecorded) onMediaRecorded(file);
    },
    [onRecordedFile, onMediaCaptured, onMediaRecorded],
  );

  // Synchronize initial mode when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setErrorStatus(null);
      setRecordedFilePreview(null);
      setElapsedSeconds(0);
      setIsRecording(false);
      setIsPaused(false);
    }
  }, [isOpen, initialMode]);

  // Clean up all active streams, audio contexts, and timers
  const cleanupHardware = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (sessionRef.current) {
      try {
        sessionRef.current.stream.getTracks().forEach((track: MediaStreamTrack) => {
          try {
            track.stop();
          } catch {
            // ignore
          }
        });
      } catch {
        // ignore
      }
      sessionRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close().catch(() => {});
      } catch {
        // ignore
      }
      audioContextRef.current = null;
      analyserRef.current = null;
    }
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
    setMicVolumeLevel(0);
  }, []);

  // Full reset and close
  const handleModalClose = useCallback(() => {
    cleanupHardware();
    if (recordedFilePreview) {
      URL.revokeObjectURL(recordedFilePreview.url);
      setRecordedFilePreview(null);
    }
    setIsRecording(false);
    setIsPaused(false);
    setElapsedSeconds(0);
    setErrorStatus(null);
    onClose();
  }, [cleanupHardware, onClose, recordedFilePreview]);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleModalClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleModalClose]);

  // Setup Web Audio API Analyser for live visualizer
  const setupAudioVisualizer = useCallback((stream: MediaStream) => {
    try {
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) return;

      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (!AudioCtxClass) return;

      const audioCtx = new AudioCtxClass();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const renderWaveform = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const normalizedVol = Math.min(100, Math.round((avg / 255) * 150));
        setMicVolumeLevel(normalizedVol);

        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const width = canvas.width;
            const height = canvas.height;
            ctx.clearRect(0, 0, width, height);

            const barWidth = (width / bufferLength) * 2;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
              const barHeight = (dataArray[i] / 255) * height;

              const gradient = ctx.createLinearGradient(0, height, 0, 0);
              gradient.addColorStop(0, 'rgba(6, 182, 212, 0.2)');
              gradient.addColorStop(0.5, 'rgba(6, 182, 212, 0.8)');
              gradient.addColorStop(1, 'rgba(236, 72, 153, 1)');

              ctx.fillStyle = gradient;
              ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight);

              if (barHeight > 4) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.fillRect(x, height - barHeight - 1, barWidth - 1, 2);
              }

              x += barWidth;
            }
          }
        }

        animFrameRef.current = requestAnimationFrame(renderWaveform);
      };

      renderWaveform();
    } catch {
      // Audio visualizer failure handled
    }
  }, []);

  // Finish recording and capture File
  const handleFinishRecording = useCallback(async () => {
    if (!sessionRef.current) return;
    const session = sessionRef.current;

    try {
      const file = await session.stop();
      playFileDropChime();
      cleanupHardware();
      setIsRecording(false);
      setIsPaused(false);

      const url = URL.createObjectURL(file);
      setRecordedFilePreview({ file, url });
    } catch (err: unknown) {
      playErrorSound();
      cleanupHardware();
      const message = err instanceof Error ? err.message : String(err);
      setErrorStatus(message);
    }
  }, [cleanupHardware]);

  // Start recording action
  const handleStartRecording = async () => {
    setErrorStatus(null);
    playToggleSound();

    try {
      if (mode === 'screen') {
        if (!isScreenRecordingSupported()) {
          throw new Error(t?.('screenRecordNotSupported') || 'Screen recording is not supported in this browser.');
        }

        const session = await startScreenRecording({
          audio: includeAudio,
        });

        sessionRef.current = session;

        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = session.stream;
          videoPreviewRef.current.play().catch(() => {});
        }

        setupAudioVisualizer(session.stream);

        session.stream.getVideoTracks().forEach((track: MediaStreamTrack) => {
          track.onended = () => {
            if (sessionRef.current) {
              handleFinishRecording();
            }
          };
        });
      } else {
        if (!isVoiceRecordingSupported()) {
          throw new Error(t?.('voiceRecordNotSupported') || 'Microphone recording is not supported in this browser.');
        }

        const session = await startVoiceRecording({
          echoCancellation,
          noiseSuppression,
        });

        sessionRef.current = session;
        setupAudioVisualizer(session.stream);
      }

      setIsRecording(true);
      setIsPaused(false);
      setElapsedSeconds(0);

      timerIntervalRef.current = window.setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      playErrorSound();
      cleanupHardware();
      const message = err instanceof Error ? err.message : String(err);
      setErrorStatus(message);
    }
  };

  // Toggle Pause/Resume
  const handleTogglePause = () => {
    if (!sessionRef.current) return;
    playToggleSound();

    if (isPaused) {
      sessionRef.current.resume();
      setIsPaused(false);
      if (!timerIntervalRef.current) {
        timerIntervalRef.current = window.setInterval(() => {
          setElapsedSeconds((prev) => prev + 1);
        }, 1000);
      }
    } else {
      sessionRef.current.pause();
      setIsPaused(true);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  };

  // Abort / Discard recording
  const handleAbortRecording = () => {
    playErrorSound();
    cleanupHardware();
    setIsRecording(false);
    setIsPaused(false);
    setElapsedSeconds(0);
    if (recordedFilePreview) {
      URL.revokeObjectURL(recordedFilePreview.url);
      setRecordedFilePreview(null);
    }
  };

  // Drop recorded file directly into MephistoVault
  const handleDropToVault = () => {
    if (!recordedFilePreview) return;
    playFileDropChime();
    deliverFile(recordedFilePreview.file);
    handleModalClose();
  };

  // Re-record action
  const handleReRecord = () => {
    if (recordedFilePreview) {
      URL.revokeObjectURL(recordedFilePreview.url);
      setRecordedFilePreview(null);
    }
    setElapsedSeconds(0);
    setErrorStatus(null);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupHardware();
    };
  }, [cleanupHardware]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-2xl animate-fade-in">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.1)_0%,transparent_70%)] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 10 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative w-full max-w-2xl bg-slate-950/90 border border-cyan-500/30 rounded-3xl shadow-[0_0_60px_rgba(6,182,212,0.2)] overflow-hidden flex flex-col backdrop-blur-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Instant Media Recording HUD"
      >
        {/* Top Header HUD Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-500/20 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-black/60 border border-white/10">
              {isRecording ? (
                <span className="relative flex h-3 w-3">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                      isPaused ? 'bg-amber-400' : 'bg-red-500'
                    } opacity-75`}
                  />
                  <span
                    className={`relative inline-flex rounded-full h-3 w-3 ${
                      isPaused ? 'bg-amber-400' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'
                    }`}
                  />
                </span>
              ) : (
                <span className="inline-flex rounded-full h-2.5 w-2.5 bg-slate-500" />
              )}
              <span className="text-[10px] font-mono font-black tracking-widest uppercase text-slate-300">
                {isRecording
                  ? isPaused
                    ? 'PAUSED [HOLD]'
                    : 'LIVE [RAM-REC]'
                  : recordedFilePreview
                  ? 'CAPTURED'
                  : 'STANDBY'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-wide text-cyan-300 flex items-center gap-2">
                {mode === 'screen' ? (
                  <>
                    <Monitor className="w-4 h-4 text-cyan-400" />
                    <span>{t?.('screenRecorderTitle') || 'Screen Recorder HUD'}</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 text-pink-400" />
                    <span>{t?.('voiceRecorderTitle') || 'Neural Voice Capture'}</span>
                  </>
                )}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/40 border border-cyan-500/30 text-[10px] font-mono text-cyan-400">
              <ShieldCheck className="w-3 h-3 text-cyan-400" />
              <span>RAM ONLY // ZERO-DISK</span>
            </div>

            <button
              type="button"
              onClick={handleModalClose}
              className="p-1.5 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        {allowModeSwitch && !isRecording && !recordedFilePreview && (
          <div className="grid grid-cols-2 p-2 bg-black/40 border-b border-white/5 gap-2">
            <button
              type="button"
              onClick={() => {
                playToggleSound();
                setMode('screen');
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mode === 'screen'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
              }`}
            >
              <Monitor className="w-4 h-4" />
              <span>{t?.('modeScreen') || 'Instant Screen Capture'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playToggleSound();
                setMode('voice');
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mode === 'voice'
                  ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40 shadow-[0_0_15px_rgba(236,72,153,0.2)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
              }`}
            >
              <Mic className="w-4 h-4" />
              <span>{t?.('modeVoice') || 'Instant Voice Note'}</span>
            </button>
          </div>
        )}

        {/* Main Viewport & Interactive HUD */}
        <div className="p-6 flex flex-col items-center justify-center space-y-6 min-h-[300px]">
          {errorStatus && (
            <div className="w-full flex items-start gap-3 p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl text-xs text-red-300">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold">{t?.('captureError') || 'Capture Initialization Error'}</p>
                <p className="text-red-300/80 font-mono mt-0.5">{errorStatus}</p>
              </div>
            </div>
          )}

          {/* STATE 1: POST-RECORDING PREVIEW */}
          {recordedFilePreview ? (
            <div className="w-full flex flex-col items-center space-y-4">
              <div className="w-full relative rounded-2xl overflow-hidden bg-black/70 border border-cyan-500/30 shadow-lg">
                {mode === 'screen' ? (
                  <video
                    src={recordedFilePreview.url}
                    controls
                    autoPlay
                    playsInline
                    className="w-full max-h-[320px] object-contain rounded-2xl"
                  />
                ) : (
                  <div className="p-8 flex flex-col items-center justify-center space-y-4">
                    <div className="p-4 rounded-full bg-pink-500/20 border border-pink-500/40 text-pink-400 shadow-[0_0_30px_rgba(236,72,153,0.3)]">
                      <Mic className="w-8 h-8 animate-pulse" />
                    </div>
                    <audio src={recordedFilePreview.url} controls className="w-full max-w-md mt-2" />
                  </div>
                )}
              </div>

              <div className="w-full flex items-center justify-between px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-mono text-slate-300">
                <span className="truncate max-w-[280px] text-cyan-300">{recordedFilePreview.file.name}</span>
                <span className="text-slate-400">
                  {(recordedFilePreview.file.size / 1024).toFixed(1)} KB • {recordedFilePreview.file.type || 'media'}
                </span>
              </div>
            </div>
          ) : isRecording ? (
            /* STATE 2: ACTIVE RECORDING VIEWPORT */
            <div className="w-full flex flex-col items-center space-y-5">
              <div className="flex flex-col items-center">
                <div className="text-5xl sm:text-6xl font-mono font-black tracking-widest text-cyan-300 drop-shadow-[0_0_20px_rgba(6,182,212,0.6)]">
                  {formatRecordingTime(elapsedSeconds)}
                </div>
                <div className="flex items-center gap-3 mt-2 text-[10px] font-mono text-slate-400">
                  <span className="flex items-center gap-1">
                    <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
                    RAM STREAMING
                  </span>
                  <span>•</span>
                  <span>{mode === 'screen' ? 'VP9/WEBM' : 'OPUS/AUDIO'}</span>
                  <span>•</span>
                  <span>{isPaused ? 'BUFFER FROZEN' : 'ACTIVE CHUNKS'}</span>
                </div>
              </div>

              {mode === 'screen' ? (
                <div className="relative w-full rounded-2xl overflow-hidden bg-black/80 border border-cyan-500/40 shadow-[0_0_30px_rgba(6,182,212,0.15)]">
                  <video
                    ref={videoPreviewRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full max-h-[260px] object-contain rounded-2xl"
                  />
                  <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-cyan-400" />
                  <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-cyan-400" />
                  <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-cyan-400" />
                  <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-cyan-400" />
                </div>
              ) : (
                <div className="w-full flex flex-col items-center space-y-4">
                  <div className="relative flex items-center justify-center p-8">
                    <div
                      className="absolute rounded-full border border-pink-500/30 transition-transform duration-75"
                      style={{
                        width: `${100 + micVolumeLevel * 1.5}px`,
                        height: `${100 + micVolumeLevel * 1.5}px`,
                        boxShadow: `0 0 ${micVolumeLevel}px rgba(236,72,153,0.4)`,
                      }}
                    />
                    <div
                      className="absolute rounded-full border border-cyan-500/20 transition-transform duration-100"
                      style={{
                        width: `${130 + micVolumeLevel * 2.2}px`,
                        height: `${130 + micVolumeLevel * 2.2}px`,
                      }}
                    />
                    <div className="relative z-10 p-5 rounded-full bg-gradient-to-br from-pink-500/20 to-purple-600/30 border border-pink-500/50 shadow-[0_0_30px_rgba(236,72,153,0.5)]">
                      <Mic className="w-8 h-8 text-pink-300" />
                    </div>
                  </div>

                  <div className="w-full h-16 relative bg-black/40 rounded-xl border border-white/10 overflow-hidden flex items-center justify-center">
                    <canvas ref={canvasRef} width={400} height={64} className="w-full h-full" />
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* STATE 3: PRE-RECORDING CONFIGURATION & STANDBY */
            <div className="w-full flex flex-col items-center space-y-6 py-4">
              <div className="p-6 rounded-3xl bg-white/5 border border-white/10 flex flex-col items-center text-center max-w-md shadow-inner">
                {mode === 'screen' ? (
                  <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 mb-3 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
                    <Monitor className="w-10 h-10" />
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-pink-500/10 border border-pink-500/30 text-pink-400 mb-3 shadow-[0_0_20px_rgba(236,72,153,0.2)]">
                    <Mic className="w-10 h-10" />
                  </div>
                )}

                <h3 className="text-base font-bold text-white mb-1">
                  {mode === 'screen'
                    ? t?.('readyScreenTitle') || 'Ready to Capture Screen'
                    : t?.('readyVoiceTitle') || 'Ready for Neural Voice Capture'}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {mode === 'screen'
                    ? t?.('screenDesc') ||
                      'Record any display, window, or browser tab directly into zero-trace RAM memory.'
                    : t?.('voiceDesc') ||
                      'Record crystal-clear voice notes with hardware-accelerated noise suppression.'}
                </p>

                <div className="w-full mt-5 pt-4 border-t border-white/10 flex flex-col gap-2.5 text-xs text-slate-300">
                  {mode === 'screen' ? (
                    <label className="flex items-center justify-between p-2 rounded-xl bg-black/40 border border-white/5 cursor-pointer hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-2 font-medium">
                        {includeAudio ? (
                          <Volume2 className="w-4 h-4 text-cyan-400" />
                        ) : (
                          <VolumeX className="w-4 h-4 text-slate-500" />
                        )}
                        <span>{t?.('captureSystemAudio') || 'Include System / Mic Audio'}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={includeAudio}
                        onChange={(e) => setIncludeAudio(e.target.checked)}
                        className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                      />
                    </label>
                  ) : (
                    <>
                      <label className="flex items-center justify-between p-2 rounded-xl bg-black/40 border border-white/5 cursor-pointer hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-2 font-medium">
                          <Activity className="w-4 h-4 text-pink-400" />
                          <span>{t?.('noiseSuppression') || 'Background Noise Suppression'}</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={noiseSuppression}
                          onChange={(e) => setNoiseSuppression(e.target.checked)}
                          className="w-4 h-4 accent-pink-500 rounded cursor-pointer"
                        />
                      </label>
                      <label className="flex items-center justify-between p-2 rounded-xl bg-black/40 border border-white/5 cursor-pointer hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-2 font-medium">
                          <Sparkles className="w-4 h-4 text-pink-400" />
                          <span>{t?.('echoCancellation') || 'Acoustic Echo Cancellation'}</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={echoCancellation}
                          onChange={(e) => setEchoCancellation(e.target.checked)}
                          className="w-4 h-4 accent-pink-500 rounded cursor-pointer"
                        />
                      </label>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Actions Bar */}
        <div className="px-6 py-4 border-t border-cyan-500/20 bg-slate-900/80 flex items-center justify-between gap-3">
          {recordedFilePreview ? (
            <>
              <button
                type="button"
                onClick={handleReRecord}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{t?.('reRecord') || 'Discard & Retake'}</span>
              </button>

              <button
                type="button"
                onClick={handleDropToVault}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-black font-black text-xs tracking-wider uppercase transition-all shadow-[0_0_25px_rgba(6,182,212,0.4)] cursor-pointer"
              >
                <Zap className="w-4 h-4 fill-black" />
                <span>{t?.('dropToVault') || 'Finish & Drop to Vault'}</span>
              </button>
            </>
          ) : isRecording ? (
            <>
              <button
                type="button"
                onClick={handleAbortRecording}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-xs font-bold text-red-300 hover:text-red-200 transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{t?.('abort') || 'Abort & Discard'}</span>
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleTogglePause}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold text-white transition-all cursor-pointer"
                >
                  {isPaused ? <Play className="w-4 h-4 text-emerald-400" /> : <Pause className="w-4 h-4 text-amber-400" />}
                  <span>{isPaused ? t?.('resume') || 'Resume' : t?.('pause') || 'Pause'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleFinishRecording}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-black font-black text-xs tracking-wider uppercase transition-all shadow-[0_0_25px_rgba(6,182,212,0.4)] cursor-pointer animate-pulse"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>{t?.('finishRecording') || 'Finish & Drop to Vault'}</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleModalClose}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                {t?.('cancel') || 'Cancel'}
              </button>

              <button
                type="button"
                onClick={handleStartRecording}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-xs tracking-wider uppercase transition-all cursor-pointer shadow-lg ${
                  mode === 'screen'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-black shadow-[0_0_25px_rgba(6,182,212,0.4)]'
                    : 'bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-400 hover:to-purple-400 text-white shadow-[0_0_25px_rgba(236,72,153,0.4)]'
                }`}
              >
                {mode === 'screen' ? <Monitor className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span>
                  {mode === 'screen'
                    ? t?.('initiateScreen') || 'Initiate Screen Capture'
                    : t?.('initiateVoice') || 'Initiate Voice Recording'}
                </span>
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default MediaRecorderModal;
