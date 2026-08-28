import React from 'react';
import { Zap, Clock } from 'lucide-react';
import AnimatedCounter from './AnimatedCounter';

interface TransferProgressProps {
  progress: number;
  speed: string | null;
  eta: string | null;
  label: string;
  colorClass?: 'emerald' | 'cyan';
}

export const TransferProgress = React.memo(function TransferProgress({
  progress,
  speed,
  eta,
  label,
  colorClass = 'emerald',
}: TransferProgressProps) {
  const isCyan = colorClass === 'cyan';
  const textClass = isCyan ? 'text-cyan-400' : 'text-emerald-400';
  const badgeClass = isCyan
    ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
  const iconColorClass = isCyan ? 'text-cyan-400' : 'text-emerald-400';
  const gradientClass = isCyan
    ? 'from-cyan-600 via-sky-500 to-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)]'
    : 'from-emerald-600 via-teal-500 to-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.4)]';

  const roundedProgress = Math.max(0, Math.min(100, Math.round(progress)));
  const isTransferring = roundedProgress > 0 && roundedProgress < 100;

  // Format ETA dynamically: ensure 'ETA: ...' or fallback
  const displayEta = React.useMemo(() => {
    if (!eta) return 'ETA: Calculating...';
    if (eta.startsWith('ETA:')) return eta;
    if (eta === '--:--') return 'ETA: --:--';
    return `ETA: ${eta}`;
  }, [eta]);

  const displaySpeed = speed || '0 B/s';

  return (
    <div className="w-full space-y-3">
      {/* Top Header: Label and Progress Percentage Badge */}
      <div className="flex items-center justify-between font-mono text-xs">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${isCyan ? 'bg-cyan-400' : 'bg-emerald-400'} ${
              isTransferring ? 'animate-ping' : ''
            }`}
          />
          <span className={`${textClass} font-bold tracking-wide flex items-center gap-1.5`}>
            {label}
          </span>
        </div>
        <div className={`px-2.5 py-0.5 rounded-lg border font-black font-mono tracking-wider ${badgeClass}`}>
          <AnimatedCounter value={roundedProgress} />%
        </div>
      </div>

      {/* Progress Bar Container with Active Shimmer */}
      <div
        className="relative w-full h-3.5 bg-black/60 rounded-full overflow-hidden border border-white/10 p-[2px] shadow-inner"
        role="progressbar"
        aria-valuenow={roundedProgress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={`h-full bg-gradient-to-r ${gradientClass} rounded-full transition-[width] duration-200 ease-out relative overflow-hidden`}
          style={{ width: `${roundedProgress}%`, transform: 'translateZ(0)' }}
        >
          {isTransferring && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
          )}
        </div>
      </div>

      {/* Real-time HUD Status: Speed Meter & Dynamic ETA Countdown */}
      <div className="grid grid-cols-2 gap-2 pt-0.5">
        {/* Real-time Speed Meter */}
        <div className="flex items-center gap-2 px-3 py-2 bg-black/40 border border-white/5 rounded-xl font-mono text-xs text-slate-300">
          <Zap className={`w-3.5 h-3.5 ${iconColorClass} ${isTransferring ? 'animate-pulse' : ''} shrink-0`} />
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Speed</span>
            <span className="font-bold text-white truncate">{displaySpeed}</span>
          </div>
        </div>

        {/* Dynamic ETA Countdown Timer */}
        <div className="flex items-center gap-2 px-3 py-2 bg-black/40 border border-white/5 rounded-xl font-mono text-xs text-slate-300">
          <Clock className={`w-3.5 h-3.5 ${iconColorClass} shrink-0`} />
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Countdown</span>
            <span className="font-bold text-white truncate">{displayEta}</span>
          </div>
        </div>
      </div>
    </div>
  );
});

export default TransferProgress;
