import React, { useState } from 'react';
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
  Clock,
  Radio,
  Mic,
  Camera,
  Monitor,
  Share2,
  Send,
  Mail,
  Maximize2,
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { formatBytes } from '../lib/utils';
import { EXPIRATION_OPTIONS } from '../lib/constants';
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
  expirationSec?: number;
  setExpirationSec?: (sec: number) => void;
  isVoiceActive?: boolean;
  toggleVoiceTalkie?: () => void;
  onCopy: () => void;
  onDownloadQR: () => void;
  onClose: () => void;
  t: (key: string) => string;
}

export const SendView = React.memo(function SendView({
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
  expirationSec = 0,
  setExpirationSec,
  isVoiceActive = false,
  toggleVoiceTalkie,
  onCopy,
  onDownloadQR,
  onClose,
  t,
}: SendViewProps) {
  const [showQuickTextModal, setShowQuickTextModal] = useState(false);
  const [quickTextContent, setQuickTextContent] = useState('');
  const [isQRLightboxOpen, setIsQRLightboxOpen] = useState(false);

  const handleQuickTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTextContent.trim()) return;
    const blob = new Blob([quickTextContent], { type: 'text/plain;charset=utf-8' });
    const noteFile = new File(
      [blob],
      `secret-note-${Date.now().toString().slice(-4)}.txt`,
      { type: 'text/plain' },
    );
    setFileToShare(noteFile);
    setQuickTextContent('');
    setShowQuickTextModal(false);
  };

  const handleInstantCamera = async () => {
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const snapFile = new File(
              [blob],
              `ram-camera-snap-${Date.now().toString().slice(-4)}.jpg`,
              { type: 'image/jpeg' },
            );
            setFileToShare(snapFile);
          }
        },
        'image/jpeg',
        0.9,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert('Kamera başlatılamadı veya erişim reddedildi: ' + message);
    } finally {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    }
  };

  const handleInstantScreen = async () => {
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1920;
      canvas.height = video.videoHeight || 1080;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);

      canvas.toBlob((blob) => {
        if (blob) {
          const screenFile = new File(
            [blob],
            `ram-screen-cap-${Date.now().toString().slice(-4)}.png`,
            { type: 'image/png' },
          );
          setFileToShare(screenFile);
        }
      }, 'image/png');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert('Ekran yakalanamadı veya iptal edildi: ' + message);
    } finally {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    }
  };

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
          className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
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
            <div className="flex flex-col gap-4 w-full">
              {/* Hidden File and Folder Inputs */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={onFileChange}
              />
              <input
                ref={folderInputRef}
                type="file"
                {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
                multiple
                className="hidden"
                onChange={onFileChange}
              />

              {/* Main Drop Area (Clickable Card) */}
              <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                className={`relative w-full border-2 border-dashed rounded-2xl p-8 transition-all group flex flex-col items-center text-center overflow-hidden cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-500/10 scale-105 shadow-[0_0_30px_rgba(16,185,129,0.2)]'
                    : 'border-white/10 hover:border-emerald-500/30 hover:bg-emerald-500/5'
                }`}
                aria-label="Drag and drop files here or click to browse"
              >
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

                <p className="text-slate-500 text-sm">{t('dropSub')}</p>
              </div>

              {/* Quick Action Selector Toolbar (Separated from Dropzone) */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-3.5 py-2 bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/30 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  aria-label="Select files to send"
                >
                  <FileIcon className="w-4 h-4 text-emerald-400" /> {t('selectFiles')}
                </button>

                <button
                  type="button"
                  onClick={() => folderInputRef.current?.click()}
                  className="flex items-center gap-2 px-3.5 py-2 bg-white/5 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-500/30 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  aria-label="Select folder to send"
                >
                  <Folder className="w-4 h-4 text-cyan-400" /> {t('selectFolder')}
                </button>

                <button
                  type="button"
                  onClick={() => setShowQuickTextModal(true)}
                  className="flex items-center gap-2 px-3.5 py-2 bg-white/5 hover:bg-purple-500/20 border border-white/10 hover:border-purple-500/30 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  aria-label="Quick text share"
                >
                  ⚡ Hızlı Metin
                </button>

                <button
                  type="button"
                  onClick={handleInstantCamera}
                  className="flex items-center gap-2 px-3.5 py-2 bg-white/5 hover:bg-pink-500/20 border border-white/10 hover:border-pink-500/30 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                  title="Cihaza kaydetmeden anlık fotoğraf çekip gönder"
                  aria-label="Take instant photo to share"
                >
                  <Camera className="w-4 h-4 text-pink-400" /> 📸 Anlık Foto
                </button>

                <button
                  type="button"
                  onClick={handleInstantScreen}
                  className="flex items-center gap-2 px-3.5 py-2 bg-white/5 hover:bg-blue-500/20 border border-white/10 hover:border-blue-500/30 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  title="Cihaza kaydetmeden ekran görüntüsü alıp gönder"
                  aria-label="Capture screen to share"
                >
                  <Monitor className="w-4 h-4 text-blue-400" /> 🖥️ Ekran Yakala
                </button>
              </div>

              {/* Quick Text Input Modal */}
              <AnimatePresence>
                {showQuickTextModal && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="mt-4 p-4 bg-black/60 border border-purple-500/30 rounded-2xl space-y-3"
                    role="dialog"
                    aria-label="Quick Text Share Dialog"
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-purple-300">
                      <span>⚡ Hızlı Metin Paylaşımı (RAM Üzerinden)</span>
                      <button
                        type="button"
                        onClick={() => setShowQuickTextModal(false)}
                        className="text-slate-400 hover:text-white p-1"
                        aria-label="Close Text Dialog"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <form onSubmit={handleQuickTextSubmit} className="space-y-3">
                      <textarea
                        value={quickTextContent}
                        onChange={(e) => setQuickTextContent(e.target.value)}
                        placeholder="Paylaşmak istediğiniz metin veya şifreyi yazın..."
                        className="w-full h-28 bg-black/50 border border-white/10 rounded-xl p-3 text-xs font-mono text-white focus:outline-none focus:border-purple-500/50 resize-none"
                        autoFocus
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowQuickTextModal(false)}
                          className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 cursor-pointer"
                        >
                          İptal
                        </button>
                        <button
                          type="submit"
                          disabled={!quickTextContent.trim()}
                          className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-xs font-bold text-white cursor-pointer"
                        >
                          Paylaş
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center">
            {/* File Info */}
            <div className="w-full flex items-center gap-4 bg-black/40 border border-white/5 rounded-xl p-4 mb-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                <FileIcon className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-white font-bold text-sm truncate">{fileToShare.name}</p>
                <p className="text-slate-400 text-xs">{formatBytes(fileToShare.size)}</p>
              </div>
              {transferProgress <= 0 && !isConnected && (
                <button
                  onClick={() => setFileToShare(null)}
                  className="text-slate-500 hover:text-white p-2 rounded-lg transition-colors cursor-pointer"
                  aria-label="Deselect file"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Expiration Timer Selector */}
            <div className="w-full mb-6 bg-white/[0.02] border border-white/5 p-3 rounded-2xl flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" /> Otomatik İmha Süresi:
              </span>
              <select
                value={expirationSec}
                onChange={(e) => setExpirationSec && setExpirationSec(Number(e.target.value))}
                className="bg-black/60 border border-white/10 text-emerald-400 text-xs font-bold font-mono px-3 py-1.5 rounded-xl focus:outline-none focus:border-emerald-500 cursor-pointer"
                aria-label="Select Auto Destruct Time"
              >
                {EXPIRATION_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.sec} className="bg-slate-900 text-white">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Phantom Voice P2P Walkie Talkie Bar */}
            {isConnected && (
              <div className="w-full mb-6 p-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2 text-purple-300 text-xs font-bold font-mono">
                  <Radio className="w-4 h-4 text-purple-400 animate-pulse" />
                  <span>Phantom Voice (P2P Telsiz)</span>
                </div>
                <button
                  type="button"
                  onClick={toggleVoiceTalkie}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer ${
                    isVoiceActive
                      ? 'bg-red-500 hover:bg-red-400 text-white animate-pulse'
                      : 'bg-purple-500 hover:bg-purple-400 text-white'
                  }`}
                  aria-label={isVoiceActive ? 'Disable Microphone' : 'Enable Microphone'}
                  aria-pressed={isVoiceActive}
                >
                  <Mic className="w-3.5 h-3.5" /> {isVoiceActive ? '🎙️ Mik Kapat' : '🎙️ Konuş / Dinle'}
                </button>
              </div>
            )}

            {errorStatus && (
              <div
                role="alert"
                className="w-full bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-lg mb-6 text-center font-medium"
              >
                {errorStatus}
              </div>
            )}

            {!isConnected && !errorStatus && (
              <div className="text-center mb-6 w-full">
                <p className="text-sm text-slate-400 mb-4">{t('shareCode')}</p>
                <div className="flex items-center gap-2 justify-center">
                  <div className="bg-black/60 border border-white/10 px-6 py-4 rounded-xl font-mono text-3xl font-black tracking-widest text-emerald-500 shadow-inner">
                    {shareCode}
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={onCopy}
                      className="bg-white/5 hover:bg-white/10 border border-white/5 p-3 rounded-xl transition-colors group cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
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
                      className={`border p-3 rounded-xl transition-colors group cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${
                        showQR
                          ? 'bg-emerald-500/20 border-emerald-500/50 hover:bg-emerald-500/30'
                          : 'bg-white/5 hover:bg-white/10 border-white/5'
                      }`}
                      title="Show QR Code"
                      aria-label="Show QR Code representation of share link"
                      aria-expanded={showQR}
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
                      <>
                        <button
                          onClick={onDownloadQR}
                          className="bg-white/5 hover:bg-white/10 border border-white/5 p-3 rounded-xl transition-colors group cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                          title="Download HD QR (1024x1024 PNG)"
                          aria-label="Download QR code image as HD PNG"
                        >
                          <Download className="w-5 h-5 text-slate-400 group-hover:text-white" />
                        </button>
                        <button
                          onClick={() => setIsQRLightboxOpen(true)}
                          className="bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 p-3 rounded-xl transition-colors group cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                          title="Büyüt (Lightbox)"
                          aria-label="QR Kodu Büyüt"
                        >
                          <Maximize2 className="w-5 h-5 text-emerald-400 group-hover:text-emerald-300" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {showQR && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 flex flex-col items-center gap-3"
                    >
                      {/* Cyberpunk Dark Theme QR Card with Click-to-Zoom Lightbox */}
                      <div
                        onClick={() => setIsQRLightboxOpen(true)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setIsQRLightboxOpen(true);
                          }
                        }}
                        className="bg-slate-950/90 border border-emerald-500/30 p-5 rounded-2xl shadow-[0_0_30px_rgba(16,185,129,0.25)] hover:border-emerald-400/70 hover:shadow-[0_0_40px_rgba(16,185,129,0.4)] transition-all relative group cursor-pointer overflow-hidden"
                        title="Büyütmek için tıklayın (Lightbox)"
                        aria-label="QR Kodu Büyüt (Lightbox)"
                      >
                        {/* Cyberpunk HUD Corner Accents */}
                        <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-emerald-500/80 group-hover:border-emerald-400 transition-colors" />
                        <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-emerald-500/80 group-hover:border-emerald-400 transition-colors" />
                        <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-emerald-500/80 group-hover:border-emerald-400 transition-colors" />
                        <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-emerald-500/80 group-hover:border-emerald-400 transition-colors" />

                        {/* Hover Overlay Hint */}
                        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-2 text-emerald-400 font-mono text-xs font-bold z-10">
                          <Maximize2 className="w-6 h-6 animate-bounce" />
                          <span>🔍 Büyüt (Lightbox)</span>
                        </div>

                        {/* High Error Tolerance Cyberpunk QR Code */}
                        <QRCodeCanvas
                          id="mephistovault-qr-canvas"
                          value={`${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(shareCode)}`}
                          size={240}
                          bgColor="#050811"
                          fgColor="#10b981"
                          level="H"
                          marginSize={2}
                        />
                      </div>

                      {/* Cyberpunk HUD Subtext */}
                      <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-400/90">
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>Büyütmek için tıklayın • Yüksek Hata Toleransı (H)</span>
                      </div>

                      {/* Direct Share Buttons */}
                      <div className="flex flex-wrap items-center justify-center gap-2 max-w-xs w-full pt-1">
                        {typeof navigator !== 'undefined' && 'share' in navigator && (
                          <button
                            type="button"
                            onClick={async () => {
                              const shareUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(shareCode)}`;
                              try {
                                await navigator.share({
                                  title: 'MephistoVault',
                                  text: '🔐 MephistoVault ile şifreli dosya aktarımı bağlantısı:',
                                  url: shareUrl,
                                });
                              } catch (err: unknown) {
                                if ((err as Error).name !== 'AbortError') {
                                  console.error('Share error:', err);
                                }
                              }
                            }}
                            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 rounded-xl text-xs font-bold text-emerald-300 transition-colors cursor-pointer"
                            title="Web Share API ile Paylaş"
                            aria-label="Web Share API ile Paylaş"
                          >
                            <Share2 className="w-3.5 h-3.5" /> Direct Paylaş
                          </button>
                        )}

                        <a
                          href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                            `🔐 MephistoVault ile şifreli dosya aktarımı bağlantısı:\n${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(shareCode)}`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-2 bg-green-600/20 hover:bg-green-600/30 border border-green-500/40 rounded-xl text-xs font-bold text-green-400 transition-colors cursor-pointer"
                          title="WhatsApp ile Paylaş"
                          aria-label="WhatsApp ile Paylaş"
                        >
                          <Send className="w-3.5 h-3.5 text-green-400" /> WhatsApp
                        </a>

                        <a
                          href={`https://t.me/share/url?url=${encodeURIComponent(
                            `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(shareCode)}`
                          )}&text=${encodeURIComponent('🔐 MephistoVault ile şifreli dosya aktarımı bağlantısı:')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-2 bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 rounded-xl text-xs font-bold text-sky-300 transition-colors cursor-pointer"
                          title="Telegram ile Paylaş"
                          aria-label="Telegram ile Paylaş"
                        >
                          <Send className="w-3.5 h-3.5 text-sky-300" /> Telegram
                        </a>

                        <a
                          href={`mailto:?subject=${encodeURIComponent('MephistoVault Şifreli Dosya Bağlantısı')}&body=${encodeURIComponent(
                            `🔐 MephistoVault ile şifreli dosya aktarımı bağlantısı:\n\n${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(shareCode)}`
                          )}`}
                          className="flex items-center gap-1.5 px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 rounded-xl text-xs font-bold text-purple-300 transition-colors cursor-pointer"
                          title="E-posta ile Paylaş"
                          aria-label="E-posta ile Paylaş"
                        >
                          <Mail className="w-3.5 h-3.5 text-purple-300" /> E-posta
                        </a>
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
                  <Users className="w-3.5 h-3.5" /> {peerCount} {t('peers')}
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
                        <Bomb className="w-3.5 h-3.5" /> {t('selfDestruct')} {selfDestructSec}s
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

      {/* QR Code Lightbox / Zoom Modal */}
      <AnimatePresence>
        {isQRLightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsQRLightboxOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            role="dialog"
            aria-modal="true"
            aria-label="QR Code Lightbox Modal"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-slate-950/95 border border-emerald-500/40 p-6 md:p-8 rounded-3xl shadow-[0_0_50px_rgba(16,185,129,0.35)] max-w-md w-full text-center overflow-hidden"
            >
              {/* Cyberpunk Decorative Corners */}
              <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-emerald-500" />
              <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-emerald-500" />
              <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-emerald-500" />
              <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-emerald-500" />

              {/* Modal Header */}
              <div className="flex items-center justify-between mb-5 border-b border-emerald-500/20 pb-3">
                <div className="flex items-center gap-2 text-emerald-400 font-mono font-bold text-sm">
                  <Maximize2 className="w-4 h-4" />
                  <span>CYBERPUNK QR LIGHTBOX</span>
                </div>
                <button
                  onClick={() => setIsQRLightboxOpen(false)}
                  className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Large High-Res QR Display */}
              <div className="bg-[#050811] border border-emerald-500/40 p-6 rounded-2xl flex justify-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.2)] relative group">
                <QRCodeCanvas
                  id="mephistovault-qr-lightbox-canvas"
                  value={`${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(shareCode)}`}
                  size={280}
                  bgColor="#050811"
                  fgColor="#10b981"
                  level="H"
                  marginSize={2}
                />
              </div>

              {/* Room Code Bar */}
              <div className="mb-6 bg-black/60 border border-emerald-500/30 p-3.5 rounded-2xl flex items-center justify-between gap-3">
                <span className="font-mono text-xl md:text-2xl font-black text-emerald-400 tracking-wider">
                  {shareCode}
                </span>
                <button
                  onClick={onCopy}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 rounded-xl text-xs font-bold text-emerald-300 cursor-pointer transition-all"
                >
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Kopyalandı' : 'Kopyala'}</span>
                </button>
              </div>

              {/* Modal Action Buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    onDownloadQR();
                  }}
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  <Download className="w-4 h-4" /> HD PNG (1024x1024)
                </button>
                <button
                  onClick={() => setIsQRLightboxOpen(false)}
                  className="px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white font-bold rounded-xl text-sm transition-colors cursor-pointer"
                >
                  Kapat
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

export default SendView;
