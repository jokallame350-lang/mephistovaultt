import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  X,
  File as FileIcon,
  Folder,
  Check,
  Copy,
  QrCode,
  Download,
  Users,
  Bomb,
  Loader2,
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { formatBytes } from '../lib/utils';
import TransferProgress from './TransferProgress';

interface SendViewProps {
  fileToShare: File | null;
  setFileToShare: (f: File | null) => void;
  isZipping: boolean;
  zipProgress: number;
  isDragging: boolean;
  previewUrl: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  folderInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  shareCode: string;
  isConnected: boolean;
  errorStatus: string | null;
  transferProgress: number;
  transferSpeed: string | null;
  transferETA: string | null;
  peerCount: number;
  selfDestructSec: number;
  copied: boolean;
  showQR: boolean;
  setShowQR: (v: boolean) => void;
  onCopy: () => void;
  onDownloadQR: () => void;
  onClose: () => void;
  t: (key: string) => string;
}

export function SendView({
  fileToShare,
  setFileToShare,
  isZipping,
  zipProgress,
  isDragging,
  previewUrl,
  fileInputRef,
  folderInputRef,
  onFileChange,
  onDragOver,
  onDragLeave,
  onDrop,
  shareCode,
  isConnected,
  errorStatus,
  transferProgress,
  transferSpeed,
  transferETA,
  peerCount,
  selfDestructSec,
  copied,
  showQR,
  setShowQR,
  onCopy,
  onDownloadQR,
  onClose,
  t,
}: SendViewProps) {
  return (
    <motion.div
      key="send"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, y: 10 }}
      className="glass-panel overflow-hidden"
    >
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <h2 className="text-white font-bold flex items-center gap-2">
          <Upload className="w-4 h-4 text-emerald-500" /> {t('sendTitle')}
        </h2>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors"
          aria-label="Close Send View"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-6 md:p-8">
        {!fileToShare ? (
          isZipping ? (
            <div className="flex flex-col items-center justify-center p-12 text-center bg-black/40 border-2 border-dashed border-emerald-500/50 rounded-2xl">
              <div className="relative w-20 h-20 mb-6">
                <div className="absolute inset-0 border-4 border-emerald-500/30 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center font-bold text-emerald-500">
                  {Math.round(zipProgress)}%
                </div>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{t('compressing')}</h3>
              <p className="text-sm text-slate-400">{t('compressSub')}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 w-full">
              <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative w-full border-2 border-dashed rounded-2xl p-8 transition-all group flex flex-col items-center text-center overflow-hidden cursor-pointer ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-500/10 scale-105 shadow-[0_0_30px_rgba(16,185,129,0.2)]'
                    : 'border-white/10 hover:border-emerald-500/30 hover:bg-emerald-500/5'
                }`}
              >
                <input
                  ref={fileInputRef as any}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={onFileChange}
                />
                <input
                  ref={folderInputRef as any}
                  type="file"
                  {...({ webkitdirectory: '', directory: '' } as any)}
                  multiple
                  className="hidden"
                  onChange={onFileChange}
                />
                <motion.div
                  animate={{ y: isDragging ? -10 : 0 }}
                  className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors ${
                    isDragging ? 'bg-emerald-500/40' : 'bg-white/5 group-hover:bg-emerald-500/20'
                  }`}
                >
                  <Upload
                    className={`w-8 h-8 transition-colors ${
                      isDragging ? 'text-white' : 'text-slate-400 group-hover:text-emerald-500'
                    }`}
                  />
                </motion.div>

                <div className="mb-2">
                  <span
                    className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-base font-bold transition-all duration-300 ${
                      isDragging
                        ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)] animate-pulse'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 group-hover:bg-emerald-500 group-hover:text-white group-hover:border-emerald-500 shadow-lg shadow-emerald-500/5 group-hover:shadow-emerald-500/25 group-hover:scale-105'
                    }`}
                  >
                    {isDragging ? t('dropHot') : t('dropHere')}
                  </span>
                </div>
                
                <p className="text-slate-500 text-sm mb-4">{t('dropSub')}</p>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/30 rounded-xl text-sm text-slate-300 hover:text-white transition-all"
                    aria-label="Select files to send"
                  >
                    <FileIcon className="w-4 h-4 text-emerald-400" /> {t('selectFiles')}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      folderInputRef.current?.click();
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-500/30 rounded-xl text-sm text-slate-300 hover:text-white transition-all"
                    aria-label="Select folder to send"
                  >
                    <Folder className="w-4 h-4 text-cyan-400" /> {t('selectFolder')}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const text = prompt('Paylaşmak istediğiniz metin veya şifreyi girin / Paste text or password to share:');
                      if (text) {
                        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
                        const noteFile = new File([blob], `secret-note-${Date.now().toString().slice(-4)}.txt`, { type: 'text/plain' });
                        setFileToShare(noteFile);
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-purple-500/20 border border-white/10 hover:border-purple-500/30 rounded-xl text-sm text-slate-300 hover:text-white transition-all"
                    aria-label="Quick text share"
                  >
                    ⚡ Hızlı Metin
                  </button>
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center">
            {/* File Info */}
            <div className="w-full flex items-center gap-4 bg-black/40 border border-white/5 rounded-xl p-4 mb-6">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                <FileIcon className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm truncate">{fileToShare.name}</p>
                <p className="text-slate-400 text-xs">{formatBytes(fileToShare.size)}</p>
              </div>
              {transferProgress <= 0 && !isConnected && (
                <button
                  onClick={() => setFileToShare(null)}
                  className="text-slate-500 hover:text-white p-2"
                  aria-label="Deselect file"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {errorStatus && (
              <div className="w-full bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-lg mb-6 text-center">
                {errorStatus}
              </div>
            )}

            {!isConnected && !errorStatus && (
              <div className="text-center mb-6">
                <p className="text-sm text-slate-400 mb-4">{t('shareCode')}</p>
                <div className="flex items-center gap-2 justify-center">
                  <div className="bg-black/60 border border-white/10 px-6 py-4 rounded-xl font-mono text-3xl font-black tracking-widest text-emerald-500 shadow-inner">
                    {shareCode}
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={onCopy}
                      className="bg-white/5 hover:bg-white/10 border border-white/5 p-3 rounded-xl transition-colors group"
                      title="Copy Invite Link"
                      aria-label="Copy invitation link to clipboard"
                    >
                      {copied ? (
                        <Check className="w-5 h-5 text-green-500" />
                      ) : (
                        <Copy className="w-5 h-5 text-slate-400 group-hover:text-white" />
                      )}
                    </button>
                    <button
                      onClick={() => setShowQR(!showQR)}
                      className={`border p-3 rounded-xl transition-colors group ${
                        showQR
                          ? 'bg-emerald-500/20 border-emerald-500/50 hover:bg-emerald-500/30'
                          : 'bg-white/5 hover:bg-white/10 border-white/5'
                      }`}
                      title="Show QR Code"
                      aria-label="Show QR Code representation of share link"
                    >
                      <QrCode
                        className={`w-5 h-5 ${
                          showQR
                            ? 'text-emerald-400 group-hover:text-emerald-300'
                            : 'text-slate-400 group-hover:text-white'
                        }`}
                      />
                    </button>
                    {showQR && (
                      <button
                        onClick={onDownloadQR}
                        className="bg-white/5 hover:bg-white/10 border border-white/5 p-3 rounded-xl transition-colors group"
                        title="Download QR as PNG"
                        aria-label="Download QR code image as PNG"
                      >
                        <Download className="w-5 h-5 text-slate-400 group-hover:text-white" />
                      </button>
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {showQR && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 flex justify-center"
                    >
                      <div className="bg-white p-4 rounded-2xl shadow-lg">
                        <QRCodeCanvas
                          value={`${window.location.origin}${
                            window.location.pathname
                          }?room=${encodeURIComponent(shareCode)}`}
                          size={240}
                          bgColor="#ffffff"
                          fgColor="#0f172a"
                          level="M"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {previewUrl && (
              <div className="w-full mb-4 rounded-xl overflow-hidden border border-white/10 max-h-40">
                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
              </div>
            )}

            <div className="w-full flex flex-col items-center justify-center py-4">
              {peerCount > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mb-4 flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-mono px-3 py-1.5 rounded-full"
                >
                  <Users className="w-3 h-3" /> {peerCount} {t('peers')}
                </motion.div>
              )}
              {isConnected ? (
                transferProgress >= 100 ? (
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
                      <Check className="w-8 h-8 text-green-500" />
                    </div>
                    <p className="text-green-500 font-bold">{t('complete')}</p>
                    {selfDestructSec > 0 && (
                      <div className="mt-2 flex items-center justify-center gap-2 text-red-400 text-xs font-mono animate-pulse">
                        <Bomb className="w-3 h-3" /> {t('selfDestruct')} {selfDestructSec}s
                      </div>
                    )}
                  </div>
                ) : (
                  <TransferProgress
                    progress={transferProgress}
                    speed={transferSpeed}
                    eta={transferETA}
                    label={`${t('sending')} 🔐`}
                    colorClass="emerald"
                  />
                )
              ) : (
                <div className="flex items-center gap-2 text-emerald-500/80 mt-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm font-mono animate-pulse">{t('waiting')}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
export default SendView;
