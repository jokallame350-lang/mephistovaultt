import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  Download,
  Zap,
  Flame,
  EyeOff,
  Shield,
  Activity,
  FileText,
  Folder,
  Lock,
  Video,
  Mic,
  ShieldCheck,
} from 'lucide-react';
import MediaRecorderModal from './MediaRecorderModal';
import FolderTreeModal from './FolderTreeModal';
import CertificateModal from './CertificateModal';
import { generateDeliveryCertificate, type DeliveryCertificate } from '../lib/certificate';

interface IdleViewProps {
  setMode: (m: 'idle' | 'send' | 'receive') => void;
  sessionTransfers: number;
  onMediaCaptured?: (file: File) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export const IdleView = React.memo(function IdleView({
  setMode,
  sessionTransfers,
  onMediaCaptured,
  t,
}: IdleViewProps) {
  const [showRecorder, setShowRecorder] = useState(false);
  const [showFolderTree, setShowFolderTree] = useState(false);
  const [showCertModal, setShowCertModal] = useState(false);
  const [sampleCert, setSampleCert] = useState<DeliveryCertificate | null>(null);

  const handleCapture = (file: File) => {
    if (onMediaCaptured) {
      onMediaCaptured(file);
    }
    setMode('send');
  };

  const handleOpenCertificate = () => {
    const cert = generateDeliveryCertificate({
      fileName: 'zero-trace-sample-payload.enc',
      fileSize: 1048576,
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      transferDurationMs: 420,
      cipher: 'AES-256-GCM / WebRTC DTLS',
      senderId: 'MEPHISTO-CLIENT-ALPHA',
      receiverId: 'MEPHISTO-CLIENT-OMEGA',
    });
    setSampleCert(cert);
    setShowCertModal(true);
  };

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
          className="relative overflow-hidden group p-8 rounded-3xl bg-gradient-to-br from-emerald-500/10 via-black/60 to-black/80 border border-emerald-500/30 hover:border-emerald-400 transition-all duration-300 shadow-2xl hover:shadow-[0_0_30px_rgba(16,185,129,0.25)] text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transform-gpu contain-layout"
          aria-label="Send files securely"
        >
          <div className="absolute top-0 right-0 p-6 text-emerald-500/10 group-hover:text-emerald-500/20 group-hover:scale-125 transition-all transform-gpu">
            <Upload className="w-24 h-24 -mr-4 -mt-4" />
          </div>
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-emerald-500 transition-all transform-gpu">
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
          className="relative overflow-hidden group p-8 rounded-3xl bg-gradient-to-br from-cyan-500/10 via-black/60 to-black/80 border border-cyan-500/30 hover:border-cyan-400 transition-all duration-300 shadow-2xl hover:shadow-[0_0_30px_rgba(6,182,212,0.25)] text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transform-gpu contain-layout"
          aria-label="Receive files securely"
        >
          <div className="absolute top-0 right-0 p-6 text-cyan-500/10 group-hover:text-cyan-500/20 group-hover:scale-125 transition-all transform-gpu">
            <Download className="w-24 h-24 -mr-4 -mt-4" />
          </div>
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-cyan-500 transition-all transform-gpu">
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
          aria-label={t('quickText')}
        >
          <FileText className="w-4 h-4" />
          <span>{t('quickText')}</span>
        </button>
        <button
          onClick={() => setMode('send')}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500/20 transition-all text-xs font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500/50"
          aria-label={t('bundleFolder')}
        >
          <Folder className="w-4 h-4" />
          <span>{t('bundleFolder')}</span>
        </button>
        <button
          onClick={() => setShowRecorder(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all text-xs font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500/50"
          aria-label={t('recordScreen') || 'Screen Video'}
        >
          <Video className="w-4 h-4" />
          <span>{t('recordScreen') || 'Screen Video'}</span>
        </button>
        <button
          onClick={() => setShowRecorder(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 hover:bg-pink-500/20 transition-all text-xs font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-pink-500/50"
          aria-label={t('recordVoice') || 'Voice Memo'}
        >
          <Mic className="w-4 h-4" />
          <span>{t('recordVoice') || 'Voice Memo'}</span>
        </button>
        <button
          onClick={handleOpenCertificate}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all text-xs font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          aria-label={t('certModalBtn') || 'Certificate'}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>{t('certModalBtn') || 'Certificate'}</span>
        </button>
        <button
          onClick={() => setMode('receive')}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition-all text-xs font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          aria-label={t('connectCode')}
        >
          <Lock className="w-4 h-4" />
          <span>{t('connectCode')}</span>
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

      {/* Media Recorder Modal */}
      <AnimatePresence>
        {showRecorder && (
          <MediaRecorderModal
            isOpen={showRecorder}
            onMediaRecorded={handleCapture}
            onClose={() => setShowRecorder(false)}
            t={t}
          />
        )}
      </AnimatePresence>

      {/* Folder Tree Modal */}
      <AnimatePresence>
        {showFolderTree && (
          <FolderTreeModal
            isOpen={showFolderTree}
            files={[]}
            onClose={() => setShowFolderTree(false)}
            t={t}
          />
        )}
      </AnimatePresence>

      {/* Certificate Modal */}
      <AnimatePresence>
        {showCertModal && (
          <CertificateModal
            isOpen={showCertModal}
            certificate={sampleCert}
            onClose={() => setShowCertModal(false)}
            t={t}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
});

export default IdleView;
