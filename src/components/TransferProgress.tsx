import React from 'react';
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
  const textClass = isCyan ? 'text-cyan-500' : 'text-emerald-500';
  const gradientClass = isCyan ? 'from-cyan-600 to-cyan-400' : 'from-emerald-600 to-emerald-400';

  const roundedProgress = Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <div className="w-full">
      <div className="flex justify-between text-sm mb-2 font-mono">
        <span className={`${textClass} font-bold animate-pulse`}>{label}</span>
        <span className="text-slate-300">
          <AnimatedCounter value={roundedProgress} />
        </span>
      </div>
      <div
        className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/5"
        role="progressbar"
        aria-valuenow={roundedProgress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={`h-full bg-gradient-to-r ${gradientClass} rounded-full transition-[width] duration-150 ease-out`}
          style={{ width: `${roundedProgress}%`, transform: 'translateZ(0)' }}
        />
      </div>
      {(speed || eta) && (
        <div className="flex justify-between items-center text-xs text-slate-400 mt-2 font-mono">
          <span>{speed}</span>
          <span>{eta && `ETA: ${eta}`}</span>
        </div>
      )}
    </div>
  );
});

export default TransferProgress;
