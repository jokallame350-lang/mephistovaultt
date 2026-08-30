import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Radio,
  Maximize2,
  Minimize2,
  Music,
  Video,
  Image as ImageIcon,
  Zap,
} from 'lucide-react';
import type { CompletedFile, FileMeta } from '../types';
import { isMediaMimeOrFilename, getStandardMediaMime } from '../lib/swarm';
import { formatBytes } from '../lib/utils';

interface MediaPreviewProps {
  completedFile?: CompletedFile | null;
  liveMediaUrl?: string | null;
  fileMeta?: FileMeta | null;
  transferProgress?: number;
  isLive?: boolean;
  onClose?: () => void;
  t?: (key: string, params?: Record<string, string | number>) => string;
}

export const MediaPreview = React.memo(function MediaPreview({
  completedFile,
  liveMediaUrl,
  fileMeta,
  transferProgress = -1,
  isLive = false,
  t: _t,
}: MediaPreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Determine media metadata
  const effectiveName = completedFile?.name || fileMeta?.name || '';
  const effectiveType = completedFile?.type || fileMeta?.type || '';
  const effectiveSize = completedFile?.blob.size || fileMeta?.size || 0;

  const mediaInfo = useMemo(() => {
    return isMediaMimeOrFilename(effectiveType, effectiveName);
  }, [effectiveType, effectiveName]);

  // Determine active media URL
  const completedUrl = useMemo(() => {
    if (!completedFile) return null;
    return URL.createObjectURL(completedFile.blob);
  }, [completedFile]);

  useEffect(() => {
    return () => {
      if (completedUrl) URL.revokeObjectURL(completedUrl);
    };
  }, [completedUrl]);

  const activeUrl = completedUrl || liveMediaUrl || null;
  const isCurrentlyLive = Boolean(!completedFile && liveMediaUrl && isLive);
  const standardMime = useMemo(() => {
    return getStandardMediaMime(effectiveType, effectiveName);
  }, [effectiveType, effectiveName]);

  // Format time in mm:ss
  const formatTime = (secs: number) => {
    if (isNaN(secs) || !isFinite(secs)) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    const el = videoRef.current || audioRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => {});
      setIsPlaying(true);
    } else {
      el.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = parseFloat(e.target.value);
    const el = videoRef.current || audioRef.current;
    if (el) {
      el.currentTime = targetTime;
      setCurrentTime(targetTime);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    const el = videoRef.current || audioRef.current;
    if (el) {
      el.volume = newVol;
      setIsMuted(newVol === 0);
    }
  };

  const handleToggleMute = () => {
    const el = videoRef.current || audioRef.current;
    if (!el) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    el.muted = nextMuted;
  };

  const handleRateChange = () => {
    const rates = [1, 1.25, 1.5, 2, 0.75];
    const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    setPlaybackRate(nextRate);
    const el = videoRef.current || audioRef.current;
    if (el) el.playbackRate = nextRate;
  };

  const handleToggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      try {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } catch {
        // ignore
      }
    } else {
      try {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } catch {
        // ignore
      }
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 2500);
  };

  if (!mediaInfo.isMedia && !mediaInfo.isImage) {
    return null;
  }

  if (!activeUrl) {
    // If live streaming is available but not yet active
    if (isLive && (mediaInfo.isAudio || mediaInfo.isVideo)) {
      return (
        <div className="w-full max-w-sm mx-auto p-3 bg-cyan-950/30 border border-cyan-500/20 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono">
            <Radio className="w-4 h-4 animate-pulse" />
            <span>Buffering Live Stream...</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            {transferProgress > 0 ? `${transferProgress}%` : '0%'}
          </span>
        </div>
      );
    }
    return null;
  }

  // ── Image Preview ──
  if (mediaInfo.isImage && completedFile) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm mx-auto p-2.5 bg-black/60 border border-white/10 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md"
      >
        <div className="flex items-center justify-between px-2 py-1 text-xs text-slate-400 font-mono border-b border-white/5 mb-2">
          <div className="flex items-center gap-1.5 text-pink-400 font-bold">
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Image Preview</span>
          </div>
          <span className="text-[10px] bg-pink-500/10 text-pink-300 border border-pink-500/20 px-2 py-0.5 rounded-md">
            {standardMime.split('/')[1]?.toUpperCase() || 'IMAGE'}
          </span>
        </div>
        <div className="relative rounded-xl overflow-hidden bg-black/40 flex items-center justify-center min-h-[140px] max-h-64">
          <img
            src={activeUrl}
            alt={effectiveName ? `Encrypted preview of ${effectiveName}` : 'Received image preview'}
            loading="lazy"
            decoding="async"
            className="w-full h-full max-h-64 object-contain rounded-xl select-none"
          />
        </div>
      </motion.div>
    );
  }

  // ── Audio Player (Live or Completed) ──
  if (mediaInfo.isAudio) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm mx-auto bg-black/70 border border-cyan-500/30 rounded-2xl p-4 shadow-xl backdrop-blur-md space-y-3"
      >
        {/* Audio Header & Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isCurrentlyLive ? 'bg-amber-500/20 text-amber-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
              {isCurrentlyLive ? <Zap className="w-4 h-4 animate-bounce" /> : <Music className="w-4 h-4" />}
            </div>
            <div className="min-w-0 text-left">
              <p className="text-xs font-bold text-white truncate max-w-[170px]" title={effectiveName}>
                {effectiveName || 'Audio Track'}
              </p>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                {isCurrentlyLive ? (
                  <span className="text-amber-400 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                    LIVE STREAM (Chunk 0+)
                  </span>
                ) : (
                  <span>{formatBytes(effectiveSize)}</span>
                )}
              </div>
            </div>
          </div>

          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-cyan-300">
            {standardMime.split('/')[1]?.toUpperCase() || 'AUDIO'}
          </span>
        </div>

        {/* Hidden Native Audio Element */}
        <audio
          ref={audioRef}
          src={activeUrl}
          onTimeUpdate={() => {
            if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
          }}
          onLoadedMetadata={() => {
            if (audioRef.current) setDuration(audioRef.current.duration || 0);
          }}
          onEnded={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />

        {/* Visualizer Waves Simulation */}
        <div className="flex items-center justify-center gap-1 h-8 bg-black/40 rounded-xl px-3 overflow-hidden">
          {Array.from({ length: 24 }).map((_, i) => (
            <motion.div
              key={i}
              className={`w-1 rounded-full ${isPlaying ? (isCurrentlyLive ? 'bg-amber-400' : 'bg-cyan-400') : 'bg-slate-600'}`}
              animate={
                isPlaying
                  ? {
                      height: [
                        `${Math.max(4, ((i * 7) % 24) + 4)}px`,
                        `${Math.max(4, ((i * 13) % 28) + 4)}px`,
                        `${Math.max(4, ((i * 5) % 20) + 4)}px`,
                      ],
                    }
                  : { height: '6px' }
              }
              transition={
                isPlaying
                  ? {
                      repeat: Infinity,
                      repeatType: 'reverse',
                      duration: 0.4 + (i % 5) * 0.1,
                      ease: 'easeInOut',
                    }
                  : { duration: 0.2 }
              }
            />
          ))}
        </div>

        {/* Seek Bar & Timestamps */}
        <div className="space-y-1">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400 hover:accent-cyan-300 transition-all"
            aria-label="Seek audio"
          />
          <div className="flex justify-between text-[10px] font-mono text-slate-400">
            <span>{formatTime(currentTime)}</span>
            <span>{duration ? formatTime(duration) : isCurrentlyLive ? 'Live Buffer' : '--:--'}</span>
          </div>
        </div>

        {/* Audio Controls */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleToggleMute}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-16 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-slate-300"
              aria-label="Audio Volume"
            />
          </div>

          {/* Central Play/Pause */}
          <button
            type="button"
            onClick={handlePlayPause}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-black font-bold shadow-lg transition-transform active:scale-95 cursor-pointer ${
              isCurrentlyLive
                ? 'bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 shadow-amber-500/30'
                : 'bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 shadow-cyan-500/30'
            }`}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
          </button>

          {/* Playback Speed */}
          <button
            type="button"
            onClick={handleRateChange}
            className="text-[11px] font-mono font-bold text-slate-300 hover:text-cyan-300 bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-lg border border-white/10 transition-colors cursor-pointer"
            title="Playback Speed"
          >
            {playbackRate}x
          </button>
        </div>
      </motion.div>
    );
  }

  // ── Video Player (Live Streaming or Completed) ──
  if (mediaInfo.isVideo) {
    return (
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && setShowControls(false)}
        className={`w-full max-w-sm mx-auto relative rounded-2xl overflow-hidden bg-black border shadow-2xl backdrop-blur-md group ${
          isCurrentlyLive ? 'border-purple-500/40 shadow-purple-500/20' : 'border-white/10'
        }`}
      >
        {/* Top Header Badge */}
        <div className="absolute top-2 left-2 right-2 z-20 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-xs font-mono">
            {isCurrentlyLive ? (
              <>
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                <span className="text-purple-300 font-bold flex items-center gap-1">
                  <Radio className="w-3 h-3" /> LIVE STREAM (Instant Play)
                </span>
              </>
            ) : (
              <>
                <Video className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-white font-bold truncate max-w-[140px]">{effectiveName}</span>
              </>
            )}
          </div>

          <span className="px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-white/10 text-[10px] font-mono text-purple-300 font-bold uppercase">
            {standardMime.split('/')[1] || 'VIDEO'}
          </span>
        </div>

        {/* Video Element */}
        <video
          ref={videoRef}
          src={activeUrl}
          playsInline
          className="w-full max-h-72 object-contain bg-black cursor-pointer"
          onClick={handlePlayPause}
          onTimeUpdate={() => {
            if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) setDuration(videoRef.current.duration || 0);
          }}
          onEnded={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />

        {/* Play/Pause Overlay Indicator on click */}
        <AnimatePresence>
          {!isPlaying && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={handlePlayPause}
              className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 cursor-pointer"
            >
              <div className="w-14 h-14 rounded-full bg-purple-600/90 text-white flex items-center justify-center shadow-[0_0_30px_rgba(168,85,247,0.6)] hover:scale-105 transition-transform">
                <Play className="w-7 h-7 fill-current ml-1" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Video Controls Bar */}
        <div
          className={`absolute bottom-0 inset-x-0 z-20 p-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent transition-opacity duration-300 ${
            showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Progress Seek Bar */}
          <div className="space-y-1 mb-2">
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-400 hover:accent-purple-300 transition-all"
              aria-label="Seek video"
            />
          </div>

          <div className="flex items-center justify-between text-white text-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePlayPause}
                className="p-1 hover:text-purple-400 transition-colors cursor-pointer"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
              </button>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleToggleMute}
                  className="p-1 hover:text-purple-400 transition-colors cursor-pointer"
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-14 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-400 hidden sm:block"
                  aria-label="Video Volume"
                />
              </div>

              <span className="text-[10px] font-mono text-slate-300 ml-1">
                {formatTime(currentTime)} / {duration ? formatTime(duration) : isCurrentlyLive ? 'Live' : '--:--'}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleRateChange}
                className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
              >
                {playbackRate}x
              </button>

              <button
                type="button"
                onClick={handleToggleFullscreen}
                className="p-1 hover:text-purple-400 transition-colors cursor-pointer"
                aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return null;
});

export default MediaPreview;
