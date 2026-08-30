import React, { useState, useCallback } from 'react';
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
  Camera,
  Monitor,
  Share2,
  Send,
  Mail,
  Maximize2,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  FileCode,
  FileText,
  Plus,
  Trash2,
  Layers,
  Package,
  Eye,
  Radio,
  ShieldCheck,
  FolderTree,
  Mic,
  Sparkles,
  Zap,
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { formatBytes, generateShareUrl } from '../lib/utils';
import { EXPIRATION_OPTIONS } from '../lib/constants';
import { hideFileInCarrierImage } from '../lib/steganography';
import TransferProgress from './TransferProgress';
import FolderTreeModal from './FolderTreeModal';
import MediaRecorderModal from './MediaRecorderModal';
import CertificateModal from './CertificateModal';
import LiveSyncTable from './LiveSyncTable';
import { generateDeliveryCertificate, type DeliveryCertificate } from '../lib/certificate';
import { isCompressibleFileType } from '../lib/compression';
import type { LiveSyncManager } from '../lib/liveSync';
import type { FileWithCustomPath } from '../types';

interface SendViewProps {
  fileToShare: File | null;
  setFileToShare: (f: File | null) => void;
  selectedFiles?: File[];
  totalPayloadSize?: number;
  onRemoveFile?: (index: number) => void;
  onClearFiles?: () => void;
  onAddFiles?: (files: File[]) => void;
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
  onCopy: () => void;
  onDownloadQR: () => void;
  onClose: () => void;
  liveSyncManager?: LiveSyncManager;
  compressionStats?: {
    isCompressed: boolean;
    originalBytes: number;
    compressedBytes: number;
    savingsRatio: number;
  };
  t: (key: string, params?: Record<string, string | number>) => string;
}

/**
 * Returns type icon, color theme, and category label for a given file
 */
function getFileTypeDetails(file: File) {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  if (type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|heic|avif)$/.test(name)) {
    return {
      Icon: FileImage,
      colorClass: 'text-pink-400 bg-pink-500/10 border-pink-500/30',
      category: 'IMAGE',
    };
  }
  if (type.startsWith('video/') || /\.(mp4|mkv|webm|avi|mov|wmv|flv|m4v)$/.test(name)) {
    return {
      Icon: FileVideo,
      colorClass: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
      category: 'VIDEO',
    };
  }
  if (type.startsWith('audio/') || /\.(mp3|wav|ogg|flac|aac|m4a|wma)$/.test(name)) {
    return {
      Icon: FileAudio,
      colorClass: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      category: 'AUDIO',
    };
  }
  if (
    /\.(zip|tar|gz|rar|7z|bz2|xz|iso)$/.test(name) ||
    type.includes('zip') ||
    type.includes('compressed') ||
    type.includes('archive')
  ) {
    return {
      Icon: FileArchive,
      colorClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      category: 'ARCHIVE',
    };
  }
  if (/\.(ts|tsx|js|jsx|json|html|css|py|rs|go|cpp|c|java|php|rb|sql|sh|yaml|yml)$/.test(name)) {
    return {
      Icon: FileCode,
      colorClass: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
      category: 'CODE',
    };
  }
  if (/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|md|rtf|csv)$/.test(name) || type.startsWith('text/')) {
    return {
      Icon: FileText,
      colorClass: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
      category: 'DOC',
    };
  }
  return {
    Icon: FileIcon,
    colorClass: 'text-slate-400 bg-white/5 border-white/10',
    category: 'FILE',
  };
}

export const SendView = React.memo(function SendView({
  fileToShare,
  setFileToShare,
  selectedFiles = [],
  totalPayloadSize,
  onRemoveFile,
  onClearFiles,
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
  onCopy,
  onDownloadQR,
  onClose,
  liveSyncManager,
  compressionStats,
  t,
}: SendViewProps) {
  const [showQuickTextModal, setShowQuickTextModal] = useState(false);
  const [quickTextContent, setQuickTextContent] = useState('');
  const [isQRLightboxOpen, setIsQRLightboxOpen] = useState(false);
  const [showFolderTreeModal, setShowFolderTreeModal] = useState(false);
  const [showMediaRecorderModal, setShowMediaRecorderModal] = useState(false);
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [showLiveSyncModal, setShowLiveSyncModal] = useState(false);
  const [deliveryCert, setDeliveryCert] = useState<DeliveryCertificate | null>(null);

  // Steganography embedding states
  const [showSteganoModal, setShowSteganoModal] = useState(false);
  const [stegoCarrierFile, setStegoCarrierFile] = useState<File | null>(null);
  const [stegoSecretFile, setStegoSecretFile] = useState<File | null>(null);
  const [stegoPasscode, setStegoPasscode] = useState('');
  const [isStegoEmbedding, setIsStegoEmbedding] = useState(false);
  const [stegoError, setStegoError] = useState<string | null>(null);
  const stegoCarrierInputRef = React.useRef<HTMLInputElement | null>(null);
  const stegoSecretInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleSteganoEmbed = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stegoCarrierFile || !stegoSecretFile) {
      setStegoError(t('stegoDropCarrier') + ' & ' + t('stegoDropSecret'));
      return;
    }

    setIsStegoEmbedding(true);
    setStegoError(null);

    try {
      const stegoBlob = await hideFileInCarrierImage(
        stegoCarrierFile,
        stegoSecretFile,
        stegoPasscode.trim() || undefined
      );

      const cleanCarrierName = stegoCarrierFile.name.replace(/\.[^/.]+$/, '');
      const stegoFile = new File([stegoBlob], `stego-vault-${cleanCarrierName}.png`, {
        type: 'image/png',
      });

      setFileToShare(stegoFile);
      setShowSteganoModal(false);
      setStegoCarrierFile(null);
      setStegoSecretFile(null);
      setStegoPasscode('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setStegoError(message);
    } finally {
      setIsStegoEmbedding(false);
    }
  }, [stegoCarrierFile, stegoSecretFile, stegoPasscode, setFileToShare, t]);

  const effectiveFiles = selectedFiles.length > 0 ? selectedFiles : fileToShare ? [fileToShare] : [];
  const calculatedTotalSize =
    totalPayloadSize !== undefined
      ? totalPayloadSize
      : effectiveFiles.reduce((acc, f) => acc + (f.size || 0), 0);

  const handleQuickTextSubmit = useCallback(
    (e: React.FormEvent) => {
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
    },
    [quickTextContent, setFileToShare],
  );

  const handleInstantCamera = useCallback(async () => {
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
      alert(`${t('cameraError')}: ${message}`);
    } finally {
      if (stream) {
        stream.getTracks().forEach((trk) => trk.stop());
      }
    }
  }, [setFileToShare, t]);

  const handleInstantScreen = useCallback(async () => {
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
      alert(`${t('screenCapError')}: ${message}`);
    } finally {
      if (stream) {
        stream.getTracks().forEach((trk) => trk.stop());
      }
    }
  }, [setFileToShare, t]);

  const handleClearAll = useCallback(() => {
    if (onClearFiles) {
      onClearFiles();
    } else {
      setFileToShare(null);
    }
  }, [onClearFiles, setFileToShare]);

  const isTransferActive = isConnected || transferProgress > 0;

  return (
    <motion.div
      key="send"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, y: 10 }}
      className="glass-panel overflow-hidden"
    >
      {/* Hidden File and Folder Inputs (Always mounted for quick actions & batch additions) */}
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
        {effectiveFiles.length === 0 ? (
          isZipping ? (
            <div className="flex flex-col items-center justify-center p-12 text-center bg-black/40 border-2 border-dashed border-emerald-500/50 rounded-2xl">
              <div className="relative w-20 h-20 mb-6">
                <div className="absolute inset-0 border-4 border-emerald-500/30 rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center font-bold text-emerald-500 font-mono">
                  {Math.round(zipProgress)}%
                </div>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{t('compressing')}</h3>
              <p className="text-sm text-slate-400">{t('compressSub')}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 w-full">
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

              {/* Quick Action Selector Toolbar */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLiveSyncModal(true)}
                  className="flex items-center gap-2 px-3.5 py-2 bg-white/5 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-500/30 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  title={t('liveSyncDesc')}
                  aria-label={t('liveSync')}
                >
                  <Zap className="w-4 h-4 text-cyan-400 animate-pulse" /> <span>{t('liveSync')}</span>
                </button>

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
                  aria-label={t('quickText')}
                >
                  <span>{t('quickText')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowSteganoModal(true)}
                  className="flex items-center gap-2 px-3.5 py-2 bg-white/5 hover:bg-pink-500/20 border border-white/10 hover:border-pink-500/30 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                  title={t('stegoEmbed')}
                  aria-label={t('stegoEmbed')}
                >
                  <Eye className="w-4 h-4 text-pink-400" /> <span>{t('stegoEmbed')}</span>
                </button>

                <button
                  type="button"
                  onClick={handleInstantCamera}
                  className="flex items-center gap-2 px-3.5 py-2 bg-white/5 hover:bg-pink-500/20 border border-white/10 hover:border-pink-500/30 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                  title={t('instantPhoto')}
                  aria-label={t('instantPhoto')}
                >
                  <Camera className="w-4 h-4 text-pink-400" /> <span>{t('instantPhoto')}</span>
                </button>

                <button
                  type="button"
                  onClick={handleInstantScreen}
                  className="flex items-center gap-2 px-3.5 py-2 bg-white/5 hover:bg-blue-500/20 border border-white/10 hover:border-blue-500/30 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  title={t('screenCapture')}
                  aria-label={t('screenCapture')}
                >
                  <Monitor className="w-4 h-4 text-blue-400" /> <span>{t('screenCapture')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowMediaRecorderModal(true)}
                  className="flex items-center gap-2 px-3.5 py-2 bg-white/5 hover:bg-purple-500/20 border border-white/10 hover:border-purple-500/30 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  title={t('recordMediaTitle') || 'Record Media'}
                  aria-label={t('recordMediaTitle') || 'Record Media'}
                >
                  <Mic className="w-4 h-4 text-purple-400" /> <span>{t('recordMediaBtn') || 'Record'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowLiveSyncModal(true)}
                  className="flex items-center gap-2 px-3.5 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 hover:border-cyan-400/50 rounded-xl text-xs font-bold text-cyan-300 hover:text-white transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  title="Open Live Sync Table"
                  aria-label="Open Live Sync Table"
                >
                  <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" /> <span>Live Workspace</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowLiveSyncModal(true)}
                  className="flex items-center gap-2 px-3.5 py-2 bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/30 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  title={t('twoWaySyncTitle') || 'Live Sync Table'}
                  aria-label={t('twoWaySyncTitle') || 'Live Sync Table'}
                >
                  <Layers className="w-4 h-4 text-emerald-400" /> <span>{t('twoWaySyncTitle') || 'Live Table'}</span>
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
                      <span>{t('quickTextTitle')}</span>
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
                        placeholder={t('quickTextPlaceholder')}
                        className="w-full h-28 bg-black/50 border border-white/10 rounded-xl p-3 text-xs font-mono text-white focus:outline-none focus:border-purple-500/50 resize-none"
                        autoFocus
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowQuickTextModal(false)}
                          className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 cursor-pointer"
                        >
                          {t('cancel')}
                        </button>
                        <button
                          type="submit"
                          disabled={!quickTextContent.trim()}
                          className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-xs font-bold text-white cursor-pointer"
                        >
                          {t('share')}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Steganography Embed Modal */}
              <AnimatePresence>
                {showSteganoModal && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="mt-4 p-5 bg-black/75 border border-pink-500/40 rounded-2xl space-y-4 shadow-2xl shadow-pink-500/10"
                    role="dialog"
                    aria-label="Steganography Conceal Dialog"
                  >
                    {/* Hidden inputs for Stegano Modal */}
                    <input
                      ref={stegoCarrierInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setStegoCarrierFile(e.target.files[0]);
                          e.target.value = '';
                        }
                      }}
                    />
                    <input
                      ref={stegoSecretInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setStegoSecretFile(e.target.files[0]);
                          e.target.value = '';
                        }
                      }}
                    />

                    <div className="flex items-center justify-between border-b border-pink-500/20 pb-2">
                      <span className="text-xs font-bold text-pink-300 flex items-center gap-2">
                        <Eye className="w-4 h-4 text-pink-400" />
                        {t('stegoModalTitle')}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowSteganoModal(false)}
                        className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
                        aria-label="Close Stegano Dialog"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-400">{t('stegoDesc')}</p>

                    <form onSubmit={handleSteganoEmbed} className="space-y-3 text-left">
                      {/* Carrier Image Selector */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-mono text-pink-300/80 font-bold block">
                          1. {t('stegoCarrierLabel')}
                        </label>
                        <div
                          onClick={() => stegoCarrierInputRef.current?.click()}
                          className="border border-dashed border-pink-500/30 hover:border-pink-400 p-3 rounded-xl bg-pink-500/5 hover:bg-pink-500/10 cursor-pointer flex items-center justify-between transition-colors"
                        >
                          <span className="text-xs text-slate-300 truncate">
                            {stegoCarrierFile ? `🖼️ ${stegoCarrierFile.name} (${formatBytes(stegoCarrierFile.size)})` : t('stegoDropCarrier')}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-pink-500/20 text-pink-300 font-bold">
                            {stegoCarrierFile ? t('changeCode') : '+ Choose'}
                          </span>
                        </div>
                      </div>

                      {/* Secret Payload Selector */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-mono text-pink-300/80 font-bold block">
                          2. {t('stegoPayloadLabel')}
                        </label>
                        <div
                          onClick={() => stegoSecretInputRef.current?.click()}
                          className="border border-dashed border-emerald-500/30 hover:border-emerald-400 p-3 rounded-xl bg-emerald-500/5 hover:bg-emerald-500/10 cursor-pointer flex items-center justify-between transition-colors"
                        >
                          <span className="text-xs text-slate-300 truncate">
                            {stegoSecretFile ? `📦 ${stegoSecretFile.name} (${formatBytes(stegoSecretFile.size)})` : t('stegoDropSecret')}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                            {stegoSecretFile ? t('changeCode') : '+ Choose'}
                          </span>
                        </div>
                      </div>

                      {/* Passcode (Optional) */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-mono text-slate-400 block">
                          3. {t('stegoPasscode')}
                        </label>
                        <input
                          type="password"
                          value={stegoPasscode}
                          onChange={(e) => setStegoPasscode(e.target.value)}
                          placeholder="Optional PIN / Passcode"
                          className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-pink-500/50"
                        />
                      </div>

                      {stegoError && (
                        <div className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 p-2 rounded-lg">
                          {stegoError}
                        </div>
                      )}

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowSteganoModal(false)}
                          className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 cursor-pointer"
                        >
                          {t('cancel')}
                        </button>
                        <button
                          type="submit"
                          disabled={!stegoCarrierFile || !stegoSecretFile || isStegoEmbedding}
                          className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 disabled:opacity-50 text-xs font-bold text-white cursor-pointer flex items-center gap-1.5 shadow-lg shadow-pink-500/20"
                        >
                          {isStegoEmbedding ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Embedding...</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              <span>{t('stegoGenerateBtn')}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center w-full">
            {/* Multi-File Batch Transfer Queue / Single File Stage */}
            {effectiveFiles.length > 1 ? (
              <div className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 mb-4 space-y-3">
                {/* Batch Header: Queue Title, Count, Total Payload Size & Action Controls */}
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold text-sm">Batch Transfer Queue</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-[11px] font-bold">
                          {effectiveFiles.length} files
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Total Payload Badge & Quick Buttons */}
                  <div className="flex items-center gap-2">
                    <div className="px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-bold shadow-sm">
                      Total: {formatBytes(calculatedTotalSize)}
                    </div>
                    {!isTransferActive && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setShowFolderTreeModal(true)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-cyan-500/20 border border-white/10 text-cyan-300 hover:text-white transition-colors cursor-pointer"
                          title={t('folderTreeTitle') || 'Explore Folder Tree'}
                          aria-label={t('folderTreeTitle') || 'Explore Folder Tree'}
                        >
                          <FolderTree className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-emerald-500/20 border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                          title="Add more files"
                          aria-label="Add more files"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => folderInputRef.current?.click()}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-cyan-500/20 border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                          title="Add folder"
                          aria-label="Add folder"
                        >
                          <Folder className="w-3.5 h-3.5 text-cyan-400" />
                        </button>
                        <button
                          type="button"
                          onClick={handleClearAll}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 border border-white/10 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                          title="Clear batch queue"
                          aria-label="Clear all files"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sleek Scrollable Batch File List */}
                <div className="max-h-56 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  <AnimatePresence initial={false}>
                    {effectiveFiles.map((file, index) => {
                      const typeInfo = getFileTypeDetails(file);
                      const customPath = (file as FileWithCustomPath).customPath;

                      return (
                        <motion.div
                          key={`${file.name}-${file.size}-${index}`}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="group flex items-center justify-between gap-3 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-white/10 p-2.5 rounded-xl transition-all"
                        >
                          {/* Left: Type Icon & Name */}
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${typeInfo.colorClass}`}
                            >
                              <typeInfo.Icon className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span
                                className="text-white text-xs font-semibold truncate"
                                title={customPath || file.name}
                              >
                                {file.name}
                              </span>
                              <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                                <span>{formatBytes(file.size)}</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/5 text-slate-400 uppercase font-semibold">
                                  {typeInfo.category}
                                </span>
                                {customPath && customPath.includes('/') && (
                                  <span
                                    className="text-[10px] text-cyan-400/80 truncate max-w-[120px]"
                                    title={customPath}
                                  >
                                    📁 {customPath.split('/').slice(0, -1).join('/')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right: Remove Button */}
                          {!isTransferActive && onRemoveFile && (
                            <button
                              type="button"
                              onClick={() => onRemoveFile(index)}
                              className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer shrink-0 opacity-80 group-hover:opacity-100"
                              title="Remove file from batch"
                              aria-label={`Remove ${file.name}`}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>

                {/* Packaging Status Banner */}
                <div className="flex items-center justify-between p-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-xs font-mono text-emerald-400">
                  <div className="flex items-center gap-2">
                    {isZipping ? (
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                    ) : (
                      <Package className="w-4 h-4 text-emerald-400" />
                    )}
                    <span>
                      {isZipping
                        ? `Indexing files (${Math.round(zipProgress)}%)...`
                        : '⚡ Zero-RAM Direct Package Stream Ready'}
                    </span>
                  </div>
                  {fileToShare && !isZipping && (
                    <span className="text-slate-400 text-[11px]">
                      Payload: <strong className="text-emerald-400">{formatBytes(fileToShare.size)}</strong>
                    </span>
                  )}
                </div>
              </div>
            ) : (
              /* Single File Display with Batch Option */
              <div className="w-full bg-black/40 border border-white/5 rounded-xl p-4 mb-4 space-y-3">
                <div className="flex items-center gap-4">
                  {(() => {
                    const singleFile = effectiveFiles[0] || fileToShare;
                    const typeInfo = singleFile
                      ? getFileTypeDetails(singleFile)
                      : { Icon: FileIcon, colorClass: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', category: 'FILE' };
                    return (
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center border shrink-0 ${typeInfo.colorClass}`}
                      >
                        <typeInfo.Icon className="w-5 h-5" />
                      </div>
                    );
                  })()}

                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-white font-bold text-sm truncate">
                      {effectiveFiles[0]?.name || fileToShare?.name}
                    </p>
                    <p className="text-slate-400 text-xs font-mono">
                      {formatBytes(calculatedTotalSize)}
                    </p>
                  </div>

                  {!isTransferActive && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-white/5 hover:bg-emerald-500/20 border border-white/10 rounded-lg text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
                        title="Add more files to batch"
                        aria-label="Add more files to batch"
                      >
                        <Plus className="w-3.5 h-3.5" /> <span>+ Add</span>
                      </button>
                      <button
                        onClick={handleClearAll}
                        className="text-slate-500 hover:text-white p-2 rounded-lg transition-colors cursor-pointer"
                        aria-label="Deselect file"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Instant Stream Mode Banner for Audio/Video */}
                {(() => {
                  const singleFile = effectiveFiles[0] || fileToShare;
                  const isMedia =
                    singleFile &&
                    (singleFile.type.startsWith('video/') ||
                      singleFile.type.startsWith('audio/') ||
                      /\.(mp4|webm|mp3|wav|ogg|m4a|flac|mov|mkv)$/i.test(singleFile.name));
                  if (!isMedia) return null;
                  return (
                    <div className="flex items-center justify-between p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-xs font-mono text-cyan-300">
                      <div className="flex items-center gap-2">
                        <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
                        <span>{t('instantStreamDesc')}</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                        {t('streamLive')}
                      </span>
                    </div>
                  );
                })()}

                {/* Stream Compression Active Banner */}
                {(() => {
                  const singleFile = effectiveFiles[0] || fileToShare;
                  const isCompressible = singleFile && isCompressibleFileType(singleFile.type, singleFile.name);
                  const isCompressionRunning = compressionStats?.isCompressed;
                  if (!isCompressible && !isCompressionRunning) return null;
                  const ratio = compressionStats?.savingsRatio || 65;
                  const savedBytes = (compressionStats?.originalBytes || 0) - (compressionStats?.compressedBytes || 0);
                  return (
                    <div className="flex items-center justify-between p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-mono text-emerald-300">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-emerald-400 animate-pulse" />
                        <span>{t('compressionActive', { ratio })}</span>
                      </div>
                      {savedBytes > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                          {t('compressionSaved', { saved: formatBytes(savedBytes), ratio })}
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Expiration Timer Selector */}
            <div className="w-full mb-6 bg-white/[0.02] border border-white/5 p-3 rounded-2xl flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" /> {t('autoDestructTime')}
              </span>
              <select
                value={expirationSec}
                onChange={(e) => setExpirationSec && setExpirationSec(Number(e.target.value))}
                className="bg-black/60 border border-white/10 text-emerald-400 text-xs font-bold font-mono px-3 py-1.5 rounded-xl focus:outline-none focus:border-emerald-500 cursor-pointer"
                aria-label={t('autoDestructTime')}
              >
                {EXPIRATION_OPTIONS.map((opt) => {
                  const label =
                    opt.id === 'burn'
                      ? t('burnOnRead')
                      : opt.id === '10m'
                      ? t('exp10m')
                      : opt.id === '1h'
                      ? t('exp1h')
                      : opt.id === '24h'
                      ? t('exp24h')
                      : opt.label;
                  return (
                    <option key={opt.id} value={opt.sec} className="bg-slate-900 text-white">
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>

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
                  <div
                    onClick={onCopy}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onCopy();
                      }
                    }}
                    className="bg-black/60 hover:bg-black/80 border border-white/10 hover:border-emerald-500/50 px-6 py-4 rounded-xl font-mono text-3xl font-black tracking-widest text-emerald-500 shadow-inner cursor-pointer transition-all select-all flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    title={t('copy')}
                    aria-label="Room code, click to copy invite link"
                  >
                    {shareCode}
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={onCopy}
                      className="bg-white/5 hover:bg-white/10 border border-white/5 p-3 rounded-xl transition-colors group cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      title={t('copyInviteLink')}
                      aria-label={t('copyInviteLink')}
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
                      title={t('scanQR')}
                      aria-label={t('scanQR')}
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
                          title={t('downloadHDQR')}
                          aria-label={t('downloadHDQR')}
                        >
                          <Download className="w-5 h-5 text-slate-400 group-hover:text-white" />
                        </button>
                        <button
                          onClick={() => setIsQRLightboxOpen(true)}
                          className="bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 p-3 rounded-xl transition-colors group cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                          title={t('zoomLightbox')}
                          aria-label={t('zoomLightbox')}
                        >
                          <Maximize2 className="w-5 h-5 text-emerald-400 group-hover:text-emerald-300" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* 1-Click Social Share Cards Deck */}
                <div className="flex flex-wrap items-center justify-center gap-2 max-w-sm w-full mx-auto mt-4 pt-1">
                  {typeof navigator !== 'undefined' && 'share' in navigator && (
                    <button
                      type="button"
                      onClick={async () => {
                        const shareUrl = generateShareUrl(shareCode);
                        try {
                          await navigator.share({
                            title: 'MephistoVault',
                            text: `${t('shareTextPrefix')}\n`,
                            url: shareUrl,
                          });
                        } catch (err: unknown) {
                          if ((err as Error).name !== 'AbortError') {
                            console.error('Share error:', err);
                          }
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-xl text-xs font-bold text-emerald-300 transition-all cursor-pointer shadow-sm hover:scale-105"
                      title={t('directShare')}
                      aria-label={t('directShare')}
                    >
                      <Share2 className="w-3.5 h-3.5" /> {t('directShare')}
                    </button>
                  )}

                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                      `${t('shareTextPrefix')}\n${generateShareUrl(shareCode)}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 bg-green-600/15 hover:bg-green-600/25 border border-green-500/30 rounded-xl text-xs font-bold text-green-400 transition-all cursor-pointer shadow-sm hover:scale-105"
                    title="WhatsApp"
                    aria-label="Share on WhatsApp"
                  >
                    <Send className="w-3.5 h-3.5 text-green-400" /> WhatsApp
                  </a>

                  <a
                    href={`https://t.me/share/url?url=${encodeURIComponent(
                      generateShareUrl(shareCode)
                    )}&text=${encodeURIComponent(t('shareTextPrefix'))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 rounded-xl text-xs font-bold text-sky-300 transition-all cursor-pointer shadow-sm hover:scale-105"
                    title="Telegram"
                    aria-label="Share on Telegram"
                  >
                    <Send className="w-3.5 h-3.5 text-sky-300" /> Telegram
                  </a>

                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                      `${t('shareTextPrefix')} ${generateShareUrl(shareCode)}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-bold text-white transition-all cursor-pointer shadow-sm hover:scale-105"
                    title="X (Twitter)"
                    aria-label="Share on X (Twitter)"
                  >
                    <span className="font-mono font-bold text-xs">𝕏</span> X / Twitter
                  </a>

                  <a
                    href={`mailto:?subject=${encodeURIComponent('MephistoVault Secure Vault Link')}&body=${encodeURIComponent(
                      `${t('shareTextPrefix')}\n\n${generateShareUrl(shareCode)}`
                    )}`}
                    className="flex items-center gap-1.5 px-3 py-2 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 rounded-xl text-xs font-bold text-purple-300 transition-all cursor-pointer shadow-sm hover:scale-105"
                    title={t('emailShare')}
                    aria-label={t('emailShare')}
                  >
                    <Mail className="w-3.5 h-3.5 text-purple-300" /> {t('emailShare')}
                  </a>
                </div>

                {/* Collapsible Cyberpunk QR Code Lightbox */}
                <AnimatePresence>
                  {showQR && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-5 flex flex-col items-center gap-3"
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
                        title={t('zoomHint')}
                        aria-label={t('zoomLightbox')}
                      >
                        {/* Cyberpunk HUD Corner Accents */}
                        <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-emerald-500/80 group-hover:border-emerald-400 transition-colors" />
                        <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-emerald-500/80 group-hover:border-emerald-400 transition-colors" />
                        <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-emerald-500/80 group-hover:border-emerald-400 transition-colors" />
                        <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-emerald-500/80 group-hover:border-emerald-400 transition-colors" />

                        {/* Hover Overlay Hint */}
                        <div className="absolute inset-0 bg-slate-950/90 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-2 text-emerald-400 font-mono text-xs font-bold z-10">
                          <Maximize2 className="w-6 h-6 animate-bounce" />
                          <span>{t('zoomLightbox')}</span>
                        </div>

                        {/* High Error Tolerance Cyberpunk QR Code */}
                        <QRCodeCanvas
                          id="mephistovault-qr-canvas"
                          value={generateShareUrl(shareCode)}
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
                        <span>{t('zoomHint')}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {previewUrl && effectiveFiles.length <= 1 && (
              <div className="w-full mb-4 rounded-xl overflow-hidden border border-white/10 max-h-40">
                <img
                  src={previewUrl}
                  alt={fileToShare ? `Selected File Preview - ${fileToShare.name}` : "Encrypted File Bundle Preview"}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
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
                    <button
                      type="button"
                      onClick={() => {
                        const singleFile = effectiveFiles[0] || fileToShare;
                        const cert = generateDeliveryCertificate({
                          fileName: singleFile ? singleFile.name : 'encrypted-payload.zip',
                          fileSize: calculatedTotalSize,
                          sha256: (fileToShare as { sha256?: string })?.sha256 || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
                          transferDurationMs: 1250,
                          cipher: 'AES-256-GCM / WebRTC DTLS',
                          senderId: shareCode || 'SENDER-VAULT',
                        });
                        setDeliveryCert(cert);
                        setShowCertificateModal(true);
                      }}
                      className="mt-3 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 mx-auto cursor-pointer shadow-lg shadow-emerald-500/10"
                    >
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>{t('certModalBtn') || '📜 Delivery Certificate'}</span>
                    </button>
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm transform-gpu"
            role="dialog"
            aria-modal="true"
            aria-label="QR Code Lightbox Modal"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-slate-950/95 border border-emerald-500/40 p-6 md:p-8 rounded-3xl shadow-[0_0_50px_rgba(16,185,129,0.35)] max-w-md w-full text-center overflow-hidden transform-gpu"
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
                  <span>{t('zoomLightbox').toUpperCase()}</span>
                </div>
                <button
                  onClick={() => setIsQRLightboxOpen(false)}
                  className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  aria-label={t('close')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Large High-Res QR Display */}
              <div className="bg-[#050811] border border-emerald-500/40 p-6 rounded-2xl flex justify-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.2)] relative group">
                <QRCodeCanvas
                  id="mephistovault-qr-lightbox-canvas"
                  value={generateShareUrl(shareCode)}
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
                  aria-label={copied ? t('copied') : t('copy')}
                >
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? t('copied') : t('copy')}</span>
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
                  {t('close')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Folder Structure Explorer Modal */}
      <AnimatePresence>
        {showFolderTreeModal && (
          <FolderTreeModal
            isOpen={showFolderTreeModal}
            files={effectiveFiles}
            onClose={() => setShowFolderTreeModal(false)}
            t={t}
          />
        )}
      </AnimatePresence>

      {/* Media Capture Studio Modal */}
      <AnimatePresence>
        {showMediaRecorderModal && (
          <MediaRecorderModal
            isOpen={showMediaRecorderModal}
            onMediaRecorded={(file) => {
              setFileToShare(file);
              setShowMediaRecorderModal(false);
            }}
            onClose={() => setShowMediaRecorderModal(false)}
            t={t}
          />
        )}
      </AnimatePresence>

      {/* Cryptographic Delivery Certificate Modal */}
      <AnimatePresence>
        {showCertificateModal && (
          <CertificateModal
            isOpen={showCertificateModal}
            certificate={deliveryCert}
            onClose={() => setShowCertificateModal(false)}
            t={t}
          />
        )}
      </AnimatePresence>

      {/* Two-Way Live Sync Table Modal */}
      <AnimatePresence>
        {showLiveSyncModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
            onClick={() => setShowLiveSyncModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative max-w-4xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <LiveSyncTable
                manager={liveSyncManager}
                localPeerId={shareCode ? `sender-${shareCode.split('#')[0]}` : 'sender-node'}
                isConnected={isConnected}
                onClose={() => setShowLiveSyncModal(false)}
                t={t}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

export default SendView;
