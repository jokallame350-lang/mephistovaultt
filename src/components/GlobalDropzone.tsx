import React from 'react';
import { motion } from 'framer-motion';
import { Upload, Shield, Zap, Lock } from 'lucide-react';

interface GlobalDropzoneProps {
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  t?: (key: string) => string;
}

export const GlobalDropzone = React.memo(function GlobalDropzone({
  onDragLeave,
  onDrop,
}: GlobalDropzoneProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 md:p-10 bg-slate-950/85 backdrop-blur-xl pointer-events-auto select-none"
      role="region"
      aria-label="Global File Dropzone"
    >
      {/* Ambient Holographic Radial Glow & Cyber Grid */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.18)_0,transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.15)_0,transparent_60%)]" />
        <div className="radar-sweep opacity-40" />
      </div>

      {/* Center Holographic Indicator Card */}
      <motion.div
        initial={{ y: 15, scale: 0.95 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 15, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative bg-slate-950/90 border-2 border-dashed border-emerald-400/80 rounded-3xl p-8 sm:p-12 text-center max-w-lg w-full shadow-[0_0_80px_rgba(16,185,129,0.35),inset_0_0_30px_rgba(16,185,129,0.15)] overflow-hidden"
      >
        {/* Holographic Cyberpunk HUD Corner Accents */}
        <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-emerald-400 shadow-[0_0_10px_#10b981]" />
        <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-emerald-400 shadow-[0_0_10px_#10b981]" />
        <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-emerald-400 shadow-[0_0_10px_#10b981]" />
        <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-emerald-400 shadow-[0_0_10px_#10b981]" />

        {/* Pulsing Holographic Icon Orb */}
        <div className="relative w-24 h-24 mx-auto mb-6 flex items-center justify-center">
          {/* Animated Glow Rings */}
          <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping opacity-60" />
          <div className="absolute -inset-2 rounded-full border-2 border-dashed border-emerald-400/40 animate-spin" style={{ animationDuration: '8s' }} />
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-cyan-500/20 border border-emerald-400/60 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.4)] backdrop-blur-md">
            <Upload className="w-10 h-10 text-emerald-300 animate-bounce" />
          </div>
        </div>

        {/* Cyberpunk Protocol Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold mb-4 shadow-inner">
          <Zap className="w-3 h-3 text-emerald-400 animate-pulse" />
          <span>ZERO-TRACE AIRDROP PROTOCOL</span>
        </div>

        {/* Main Required Holographic Headline */}
        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-3 drop-shadow-[0_0_20px_rgba(16,185,129,0.5)]">
          Drop file to start instant secure P2P transfer
        </h2>

        {/* Holographic Security Description */}
        <p className="text-sm text-slate-300 font-medium leading-relaxed max-w-md mx-auto mb-6">
          Direct peer-to-peer WebRTC stream encrypted in-memory. Zero server storage, zero disk footprint, zero traces.
        </p>

        {/* Status Indicators Pill Deck */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] font-mono text-emerald-400/90 bg-black/50 border border-emerald-500/20 rounded-2xl py-2.5 px-4">
          <span className="flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-emerald-400" /> AES-256-GCM
          </span>
          <span className="text-slate-600">•</span>
          <span className="flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-cyan-400" /> Direct WebRTC Tunnel
          </span>
        </div>

        {/* Animated Scanning Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.8)]" />
      </motion.div>
    </motion.div>
  );
});

export default GlobalDropzone;
