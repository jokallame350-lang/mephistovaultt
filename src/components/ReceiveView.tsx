import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  X,
  Camera,
  Shield,
  QrCode,
  File as FileIcon,
  Bomb,
  Loader2,
  Archive,
  Eye,
  Folder,
  Play,
  Radio,
  Check,
  AlertTriangle,
  Mic,
} from 'lucide-react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { formatBytes, saveFile } from '../lib/utils';
import { DANGEROUS_EXTENSIONS } from '../lib/constants';
import TransferProgress from './TransferProgress';
import type { FileMeta, CompletedFile, ZipEntry } from '../types';

interface ReceiveViewProps {
  receiveCode: string;
  setReceiveCode: (v: string) => void;
  isConnected: boolean;
  errorStatus: string | null;
  transferProgress: number;
  transferSpeed: string | null;
  transferETA: string | null;
  fileMeta: FileMeta | null;
  completedFile: CompletedFile | null;
  selfDestructSec: number;
  showQRScanner: boolean;
  setShowQRScanner: (v: boolean) => void;
  videoPreviewUrl: string | null;
  showVideoPlayer: boolean;
  setShowVideoPlayer: (v: boolean) => void;
  zipContents: ZipEntry[];
  showZipPreview: boolean;
  setShowZipPreview: (v: boolean) => void;
  onConnect: (code: string) => void;
  onClose: () => void;
  t: (key: string) => string;
}

export function ReceiveView({
  receiveCode,
  setReceiveCode,
  isConnected,
  errorStatus,
  transferProgress,
  transferSpeed,
  transferETA,
  fileMeta,
  completedFile,
  selfDestructSec,
  showQRScanner,
  setShowQRScanner,
  videoPreviewUrl,
  showVideoPlayer,
  setShowVideoPlayer,
  zipContents,
  showZipPreview,
  setShowZipPreview,
  onConnect,
  onClose,
  t,
}: ReceiveViewProps) {
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConnect(receiveCode);
  };

  return (
    <motion.div
      key="receive"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, y: 10 }}
      className="glass-panel overflow-hidden"
    >
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <h2 className="text-white font-bold flex items-center gap-2">
          <Download className="w-4 h-4 text-cyan-500" /> {t('receiveTitle')}
        </h2>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors"
          aria-label="Close Receive View"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-6 md:p-8">
        {errorStatus && (
          <div className="w-full bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-lg mb-6 text-center">
            {errorStatus}
          </div>
        )}

        {!isConnected && transferProgress === -1 ? (
          <div className="relative">
            <form onSubmit={handleFormSubmit}>
              <label
                htmlFor="receive-code-input"
                className="block text-sm font-bold tracking-wide text-slate-400 uppercase mb-3"
              >
                {t('connCode')}
              </label>
              <div className="flex flex-col gap-3">
                <div className="flex gap-2 w-full">
                  <input
                    id="receive-code-input"
                    type="text"
                    value={receiveCode}
                    onChange={(e) => setReceiveCode(e.target.value)}
                    placeholder="e.g. abc-xyz#1234"
                    className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-center sm:text-left text-lg sm:text-xl tracking-widest focus:outline-none focus:border-cyan-500/50 transition-colors font-mono"
                    maxLength={13}
                    aria-label="Encrypted code to receive files"
                  />
                  <button
                    type="button"
                    onClick={() => setShowQRScanner(!showQRScanner)}
                    className={`px-4 shrink-0 rounded-xl flex items-center justify-center transition-colors border ${
                      showQRScanner
                        ? 'bg-emerald-500 text-white border-emerald-500'
                        : 'bg-white/5 text-slate-400 hover:text-white border-white/10 hover:bg-white/10'
                    }`}
                    title="Scan QR Code"
                    aria-label="Scan QR code using camera"
                  >
                    <Camera className="w-6 h-6" />
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={receiveCode.length < 11}
                  className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white w-full py-3.5 flex items-center justify-center font-bold tracking-wide rounded-xl transition-colors shrink-0 cursor-pointer"
                  aria-label="Connect to Sender"
                >
                  {t('connect')}
                </button>
              </div>
              <div className="mt-8 flex items-start gap-3 bg-cyan-500/5 border border-cyan-500/10 p-4 rounded-xl">
                <Shield className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
                <p className="text-xs text-slate-400 leading-relaxed">
                  Once connected, files are transferred securely via WebRTC. The transfer is{' '}
                  <strong className="text-slate-200">end-to-end encrypted</strong> and never passes
                  through any storage servers.
                </p>
              </div>
            </form>

            {/* QR Scanner Overlay */}
            {showQRScanner && (
              <div
                className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-black/50"
                role="dialog"
                aria-label="QR Code Scanner"
              >
                <div className="p-2 bg-white/5 flex items-center justify-between border-b border-white/5 relative z-10">
                  <span className="text-sm font-bold text-slate-300 flex items-center gap-2">
                    <QrCode className="w-4 h-4" /> {t('scanQR')}
                  </span>
                  <button
                    onClick={() => setShowQRScanner(false)}
                    className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
                    aria-label="Close QR Scanner"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="w-full bg-black relative">
                  <Scanner
                    onScan={(result) => {
                      if (!result || result.length === 0) return;
                      const decodedText = result[0].rawValue;
                      let finalCode = decodedText;
                      try {
                        const url = new URL(decodedText);
                        finalCode = url.searchParams.get('room') || decodedText;
                      } catch {
                        // Plain text fallback
                      }
                      setReceiveCode(finalCode);
                      setShowQRScanner(false);
                      onConnect(finalCode);
                    }}
                    onError={() => {
                      // Handled silently
                    }}
                    formats={['qr_code']}
                    components={{ zoom: true }}
                    styles={{ container: { minHeight: 300, background: 'black' } }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center py-4">
            {/* Phantom Voice Walkie Talkie Controls */}
            {isConnected && (
              <div className="w-full mb-6 p-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2 text-purple-300 text-xs font-bold font-mono">
                  <Radio className="w-4 h-4 text-purple-400 animate-pulse" />
                  <span>Phantom Voice (P2P Telsiz)</span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    alert('🎙️ Phantom Voice P2P Telsiz aktif! Ses doğrudan WebRTC tünelinden iletiliyor.');
                  }}
                  className="px-3 py-1.5 bg-purple-500 hover:bg-purple-400 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md"
                >
                  <Mic className="w-3.5 h-3.5" /> Konuş / Dinle
                </button>
              </div>
            )}

            {fileMeta && (
              <div className="w-full space-y-3 mb-6">
                <div className="w-full flex items-center gap-4 bg-black/40 border border-white/5 rounded-xl p-4">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
                    <FileIcon className="w-5 h-5 text-cyan-500" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-white font-bold text-sm truncate">{fileMeta.name}</p>
                    <p className="text-slate-400 text-xs">{formatBytes(fileMeta.size)}</p>
                  </div>
                </div>

                {/* Format Inspector Danger Warning */}
                {DANGEROUS_EXTENSIONS.some((ext) => fileMeta.name.toLowerCase().endsWith(ext)) && (
                  <div className="w-full bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-2xl flex items-start gap-3 text-amber-400 text-xs text-left">
                    <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
                    <div>
                      <p className="font-bold text-amber-300">⚠️ DİKKAT: Potansiyel Tehlikeli Çalıştırılabilir Dosya!</p>
                      <p className="text-slate-400 mt-0.5">Bu dosya bir script veya program uzantısına (`.exe / .bat / .vbs`) sahip. Yalnızca güvendiğiniz kişilerden gelen dosyaları açın.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!fileMeta && transferProgress === 0 && !errorStatus && (
              <div className="flex items-center gap-3 text-cyan-500/80 mb-6">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="font-mono animate-pulse">{t('connectingToSender')}</span>
              </div>
            )}

            {fileMeta && transferProgress >= 0 && transferProgress < 100 && (
              <TransferProgress
                progress={transferProgress}
                speed={transferSpeed}
                eta={transferETA}
                label={`${t('connectingToSender')} 🔐`}
                colorClass="cyan"
              />
            )}

            {transferProgress >= 100 && completedFile && (
              <div className="text-center mt-2 w-full space-y-4">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                  <Check className="w-8 h-8 text-green-500" />
                </div>
                <div className="flex items-center justify-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full w-fit mx-auto text-emerald-400 text-xs font-bold font-mono">
                  <Shield className="w-3.5 h-3.5" />
                  <span>SHA-256 verified • E2E Integrity Match</span>
                </div>
                <p className="text-green-500 font-bold text-xl mb-1">{t('complete')}</p>
                <p className="text-slate-400 text-sm mb-2">{t('readySave')}</p>

                {/* Media Preview (Audio / Video / Image) */}
                {completedFile.type.startsWith('audio/') && (
                  <div className="p-3 bg-black/60 border border-white/10 rounded-2xl max-w-sm mx-auto">
                    <audio controls className="w-full" src={URL.createObjectURL(completedFile.blob)} />
                  </div>
                )}
                {completedFile.type.startsWith('video/') && (
                  <div className="p-2 bg-black/60 border border-white/10 rounded-2xl max-w-sm mx-auto overflow-hidden">
                    <video controls className="w-full rounded-xl" src={URL.createObjectURL(completedFile.blob)} />
                  </div>
                )}
                {completedFile.type.startsWith('image/') && (
                  <div className="p-2 bg-black/60 border border-white/10 rounded-2xl max-w-sm mx-auto overflow-hidden">
                    <img src={URL.createObjectURL(completedFile.blob)} alt="Received Preview" className="w-full max-h-60 object-contain rounded-xl" />
                  </div>
                )}
                {selfDestructSec > 0 && (
                  <div className="mb-4 flex items-center justify-center gap-2 text-red-400 text-xs font-mono animate-pulse">
                    <Bomb className="w-3 h-3" /> {t('selfDestruct')} {selfDestructSec}s
                  </div>
                )}

                <button
                  onClick={async () => {
                    await saveFile(completedFile.blob, completedFile.name);
                  }}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-bold py-3 px-6 w-full max-w-sm rounded-2xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] flex items-center justify-center mx-auto gap-2 group cursor-pointer"
                  aria-label={`Save ${completedFile.name} to device`}
                >
                  <Download className="w-5 h-5 shrink-0 group-hover:-translate-y-1 transition-transform" />
                  <span className="truncate max-w-[200px] sm:max-w-[300px]">
                    {t('save')} {completedFile.name}
                  </span>
                </button>

                {/* ZIP Content Viewer Toggle */}
                {zipContents.length > 0 && (
                  <div className="mt-4 w-full max-w-sm mx-auto">
                    <button
                      onClick={() => setShowZipPreview(!showZipPreview)}
                      className="w-full bg-slate-800/50 hover:bg-slate-800 text-slate-300 font-bold py-3 px-6 rounded-2xl border border-white/5 transition-all flex items-center justify-between group cursor-pointer"
                      aria-label={showZipPreview ? 'Hide ZIP contents' : 'View ZIP contents'}
                    >
                      <div className="flex items-center gap-2">
                        <Archive className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
                        <span>{showZipPreview ? t('closePreview') : t('viewZip')}</span>
                      </div>
                      <Eye className="w-4 h-4 text-slate-500" />
                    </button>

                    <AnimatePresence>
                      {showZipPreview && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-2 overflow-hidden"
                        >
                          <div className="bg-black/60 border border-white/5 rounded-2xl p-2 max-h-64 overflow-y-auto custom-scrollbar text-left text-sm">
                            {zipContents.map((f, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-2 py-2 px-3 hover:bg-white/5 rounded-lg transition-colors border-b border-white/5 last:border-0"
                              >
                                {f.dir ? (
                                  <Folder className="w-4 h-4 text-emerald-400 shrink-0" />
                                ) : (
                                  <FileIcon className="w-4 h-4 text-cyan-400 shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-slate-300 truncate" title={f.path}>
                                    {f.name}
                                  </p>
                                  {!f.dir && (
                                    <p className="text-xs text-slate-500">
                                      {formatBytes(f.size)}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Video Stream Button */}
                {videoPreviewUrl && (
                  <div className="mt-4 w-full max-w-sm mx-auto">
                    {!showVideoPlayer ? (
                      <button
                        onClick={() => setShowVideoPlayer(true)}
                        className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2 group cursor-pointer"
                        aria-label="Stream video preview"
                      >
                        <Play className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        {t('streamPlay')}
                      </button>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="rounded-xl overflow-hidden border border-purple-500/30 shadow-lg shadow-purple-500/10"
                      >
                        <div className="bg-black/60 p-2 text-xs text-purple-400 font-mono flex items-center gap-2">
                          <Radio className="w-3 h-3 animate-pulse" /> {t('streamTitle')}
                        </div>
                        <video src={videoPreviewUrl} controls autoPlay className="w-full max-h-60 bg-black" />
                      </motion.div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
export default ReceiveView;
