import React from 'react';
import { motion } from 'framer-motion';
import { Upload, Download, Zap, Flame, EyeOff, Shield, Activity, FileText, Folder, Lock } from 'lucide-react';

interface IdleViewProps {
  setMode: (m: 'idle' | 'send' | 'receive') => void;
  sessionTransfers: number;
  t: (key: string) => string;
}

export const IdleView = React.memo(function IdleView({
  setMode,
  sessionTransfers,
  t,
}: IdleViewProps) {
  return (
    <motion.div
      key="idle"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="space-y-6"
    >
      {/* Send / Receive Main Action Cards */}
      <section aria-label="Transfer Actions" className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <button
          onClick={() => setMode('send')}
          className="relative overflow-hidden group p-8 rounded-3xl bg-gradient-to-br from-emerald-500/10 via-black/60 to-black/80 border border-emerald-500/30 hover:border-emerald-400 transition-all duration-300 shadow-2xl hover:shadow-[0_0_30px_rgba(16,185,129,0.25)] text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          aria-label="Send files securely"
        >
          <div className="absolute top-0 right-0 p-6 text-emerald-500/10 group-hover:text-emerald-500/20 group-hover:scale-125 transition-all">
            <Upload className="w-24 h-24 -mr-4 -mt-4" />
          </div>
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-emerald-500 transition-all">
            <Upload className="w-7 h-7 text-emerald-400 group-hover:text-black transition-colors" />
          </div>
          <h2 className="text-xl font-black text-white tracking-tight mb-1 flex items-center gap-2">
            {t('sendFiles')}
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono font-bold">P2P</span>
          </h2>
          <p className="text-xs text-slate-400 font-medium leading-relaxed max-w-xs">{t('sendDesc')}</p>
        </button>

        <button
          onClick={() => setMode('receive')}
          className="relative overflow-hidden group p-8 rounded-3xl bg-gradient-to-br from-cyan-500/10 via-black/60 to-black/80 border border-cyan-500/30 hover:border-cyan-400 transition-all duration-300 shadow-2xl hover:shadow-[0_0_30px_rgba(6,182,212,0.25)] text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          aria-label="Receive files securely"
        >
          <div className="absolute top-0 right-0 p-6 text-cyan-500/10 group-hover:text-cyan-500/20 group-hover:scale-125 transition-all">
            <Download className="w-24 h-24 -mr-4 -mt-4" />
          </div>
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-cyan-500 transition-all">
            <Download className="w-7 h-7 text-cyan-400 group-hover:text-black transition-colors" />
          </div>
          <h2 className="text-xl font-black text-white tracking-tight mb-1 flex items-center gap-2">
            {t('receiveFiles')}
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-mono font-bold">AES-256</span>
          </h2>
          <p className="text-xs text-slate-400 font-medium leading-relaxed max-w-xs">{t('receiveDesc')}</p>
        </button>
      </section>

      {/* Quick Action Tools Bar */}
      <section aria-label="Quick Action Tools" className="flex flex-wrap items-center justify-center gap-2.5 p-3 rounded-2xl bg-white/[0.02] border border-white/5">
        <button
          onClick={() => setMode('send')}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 transition-all text-xs font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          aria-label="Share quick text note"
        >
          <FileText className="w-4 h-4" />
          <span>⚡ Hızlı Metin Paylaş</span>
        </button>
        <button
          onClick={() => setMode('send')}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500/20 transition-all text-xs font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500/50"
          aria-label="Package and send folder"
        >
          <Folder className="w-4 h-4" />
          <span>📦 Klasör Paketle</span>
        </button>
        <button
          onClick={() => setMode('receive')}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all text-xs font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          aria-label="Connect using room code"
        >
          <Lock className="w-4 h-4" />
          <span>🔑 Koda Bağlan</span>
        </button>
      </section>

      {/* Hero Feature Cards */}
      <section aria-label="Core Security Features" className="grid grid-cols-3 gap-3">
        <article className="glass-panel p-4 text-center group hover:border-emerald-500/30 transition-all">
          <Zap className="w-6 h-6 text-emerald-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
          <h3 className="text-xs font-bold text-white mb-1">{t('heroFeature1')}</h3>
          <p className="text-[10px] text-slate-500 leading-tight">{t('heroDesc1')}</p>
        </article>
        <article className="glass-panel p-4 text-center group hover:border-red-500/30 transition-all">
          <Flame className="w-6 h-6 text-red-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
          <h3 className="text-xs font-bold text-white mb-1">{t('heroFeature2')}</h3>
          <p className="text-[10px] text-slate-500 leading-tight">{t('heroDesc2')}</p>
        </article>
        <article className="glass-panel p-4 text-center group hover:border-purple-500/30 transition-all">
          <EyeOff className="w-6 h-6 text-purple-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
          <h3 className="text-xs font-bold text-white mb-1">{t('heroFeature3')}</h3>
          <p className="text-[10px] text-slate-500 leading-tight">{t('heroDesc3')}</p>
        </article>
      </section>

      {/* File Size Note */}
      <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 bg-white/[0.02] border border-white/5 px-4 py-2.5 rounded-2xl font-mono">
        <Shield className="w-3.5 h-3.5 text-emerald-400" />
        {t('maxFileNote')}
      </div>

      {/* Session Stats */}
      {sessionTransfers > 0 && (
        <div className="flex items-center justify-center gap-2 text-[11px] text-emerald-400/80 font-mono font-bold bg-emerald-500/10 py-1.5 px-3 rounded-full w-fit mx-auto border border-emerald-500/20 animate-pulse">
          <Activity className="w-3.5 h-3.5" /> {sessionTransfers} {t('stats')}
        </div>
      )}
    </motion.div>
  );
});

export default IdleView;
