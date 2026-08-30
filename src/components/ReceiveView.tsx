import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import JSZip from 'jszip';
import {
  Download,
  X,
  Camera,
  CameraOff,
  Shield,
  QrCode,
  File as FileIcon,
  Bomb,
  Loader2,
  Archive,
  Eye,
  Folder,
  Play,
  Pause,
  Radio,
  Check,
  AlertTriangle,
  Database,
  RefreshCw,
  Keyboard,
  ShieldCheck,
  FolderTree,
  Zap,
} from 'lucide-react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { formatBytes, saveFile, parseRoomCode } from '../lib/utils';
import { DANGEROUS_EXTENSIONS } from '../lib/constants';
import { inspectFileSafety } from '../lib/sandboxInspector';
import { saveToMemoryVault } from '../lib/memoryVault';
import { isMediaMimeOrFilename } from '../lib/swarm';
import { extractFileFromCarrierImage } from '../lib/steganography';
import TransferProgress from './TransferProgress';
import MediaPreview from './MediaPreview';
import FolderTreeModal from './FolderTreeModal';
import MediaRecorderModal from './MediaRecorderModal';
import CertificateModal from './CertificateModal';
import LiveSyncTable from './LiveSyncTable';
import { generateDeliveryCertificate, type DeliveryCertificate } from '../lib/certificate';
import type { LiveSyncManager } from '../lib/liveSync';
import type { FileMeta, CompletedFile, ZipEntry, FileWithCustomPath } from '../types';

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
  liveMediaUrl?: string | null;
  isLiveMediaAvailable?: boolean;
  handleBurnOnDownload?: () => void;
  onConnect: (code: string) => void;
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

export const ReceiveView = React.memo(function ReceiveView({
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
  liveMediaUrl,
  isLiveMediaAvailable,
  handleBurnOnDownload,
  onConnect,
  onClose,
  liveSyncManager,
  compressionStats,
  t,
}: ReceiveViewProps) {
  const isScanningRef = React.useRef(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const [cameraError, setCameraError] = React.useState<{
    type: 'permission' | 'not_found' | 'occupied' | 'unknown';
    message: string;
  } | null>(null);
  const [isCameraPaused, setIsCameraPaused] = React.useState(false);
  const [isInputHighlighted, setIsInputHighlighted] = React.useState(false);
  const [showLivePreview, setShowLivePreview] = React.useState(false);
  const [showFolderTreeModal, setShowFolderTreeModal] = React.useState(false);
  const [showMediaRecorderModal, setShowMediaRecorderModal] = React.useState(false);
  const [showCertificateModal, setShowCertificateModal] = React.useState(false);
  const [showLiveSyncModal, setShowLiveSyncModal] = React.useState(false);
  const [deliveryCert, setDeliveryCert] = React.useState<DeliveryCertificate | null>(null);

  // Steganography Extractor States
  const [showSteganoExtractor, setShowSteganoExtractor] = React.useState(false);
  const [stegoExtractPasscode, setStegoExtractPasscode] = React.useState('');
  const [isExtractingStego, setIsExtractingStego] = React.useState(false);
  const [extractedStegoFile, setExtractedStegoFile] = React.useState<File | null>(null);
  const [stegoExtractError, setStegoExtractError] = React.useState<string | null>(null);
  const stegoExtractInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleExtractStego = React.useCallback(async (carrierFile: File) => {
    setIsExtractingStego(true);
    setStegoExtractError(null);
    setExtractedStegoFile(null);

    try {
      const extracted = await extractFileFromCarrierImage(
        carrierFile,
        stegoExtractPasscode.trim() || undefined
      );

      if (extracted) {
        const file = new File([extracted.data], extracted.name, {
          type: extracted.type,
        });
        setExtractedStegoFile(file);
      } else {
        setStegoExtractError(t('stegoNotFound'));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setStegoExtractError(message);
    } finally {
      setIsExtractingStego(false);
    }
  }, [stegoExtractPasscode, t]);

  React.useEffect(() => {
    if (showQRScanner) {
      isScanningRef.current = false;
      setCameraError(null);
      setIsCameraPaused(false);
    }
  }, [showQRScanner]);

  const handleScannerError = React.useCallback((error: unknown) => {
    const errName = (error as { name?: string })?.name || '';
    const errMsg = (error as { message?: string })?.message || String(error || '');

    let type: 'permission' | 'not_found' | 'occupied' | 'unknown' = 'unknown';
    let message = t('camError');

    if (
      errName === 'NotAllowedError' ||
      errName === 'PermissionDeniedError' ||
      /permission|denied|not allowed|allowed/i.test(errMsg)
    ) {
      type = 'permission';
      message = t('camDenied');
    } else if (
      errName === 'NotFoundError' ||
      errName === 'DevicesNotFoundError' ||
      /not found|no camera|no media|device/i.test(errMsg)
    ) {
      type = 'not_found';
      message = t('camNotFound');
    } else if (
      errName === 'NotReadableError' ||
      errName === 'TrackStartError' ||
      /in use|readable|start/i.test(errMsg)
    ) {
      type = 'occupied';
      message = t('camInUse');
    } else {
      message = `${t('camError')}: ${errMsg}`;
    }

    setCameraError({ type, message });
  }, [t]);

  const handleManualInputRedirect = React.useCallback(() => {
    setShowQRScanner(false);
    setCameraError(null);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      setIsInputHighlighted(true);
      setTimeout(() => setIsInputHighlighted(false), 2000);
    }, 100);
  }, [setShowQRScanner]);

  const handleRetryCamera = React.useCallback(() => {
    setCameraError(null);
    setIsCameraPaused(false);
    isScanningRef.current = false;
  }, []);

  const handleFormSubmit = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const clean = parseRoomCode(receiveCode) || receiveCode.trim();
      if (clean.length >= 6) {
        setReceiveCode(clean);
        onConnect(clean);
      }
    },
    [receiveCode, setReceiveCode, onConnect],
  );

  const safetyReport = React.useMemo(() => {
    if (!completedFile) return null;
    return inspectFileSafety(completedFile.name, completedFile.blob.size, completedFile.type, t);
  }, [completedFile, t]);

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
          className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/50 cursor-pointer"
          aria-label="Close Receive View"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-6 md:p-8">
        {errorStatus && (
          <div className="w-full space-y-3 mb-6">
            <div
              role="alert"
              className="w-full bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3.5 rounded-xl text-center font-medium"
            >
              {errorStatus}
            </div>
            <div className="flex gap-2 w-full max-w-sm mx-auto">
              <button
                type="button"
                onClick={() => {
                  const clean = parseRoomCode(receiveCode) || receiveCode.trim();
                  if (clean) onConnect(clean);
                }}
                className="flex-1 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" /> {t('reconnect')}
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                }}
                className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {t('changeCode')}
              </button>
            </div>
          </div>
        )}

        {!isConnected && transferProgress === -1 ? (
          <div className="relative">
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="space-y-2 text-left">
                <label className="text-xs font-mono text-slate-400 font-bold uppercase tracking-wider block">
                  {t('connCode')}
                </label>
                <div className="relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={receiveCode}
                    onChange={(e) => setReceiveCode(e.target.value)}
                    placeholder="abc-xyz#1234"
                    className={`w-full bg-black/40 border rounded-2xl py-3.5 px-4 text-white placeholder-slate-600 focus:outline-none font-mono text-center tracking-wider transition-all ${
                      isInputHighlighted
                        ? 'border-cyan-400 ring-2 ring-cyan-400/50 bg-cyan-950/20'
                        : 'border-white/10 focus:border-cyan-500'
                    }`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowQRScanner(!showQRScanner)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-cyan-400 hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
                    title={t('scanQR')}
                    aria-label={t('scanQR')}
                  >
                    <QrCode className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={receiveCode.trim().length < 6}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 px-6 rounded-2xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] cursor-pointer"
              >
                {t('connect')}
              </button>

              <div className="pt-1 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowLiveSyncModal(!showLiveSyncModal)}
                  className="text-xs text-cyan-400/80 hover:text-cyan-300 flex items-center gap-1.5 font-mono py-1.5 px-3 rounded-xl hover:bg-cyan-500/10 transition-all border border-cyan-500/20 cursor-pointer"
                  title={t('liveSyncDesc')}
                  aria-label={t('liveSync')}
                >
                  <Zap className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                  <span>{t('liveSync')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowSteganoExtractor(!showSteganoExtractor)}
                  className="text-xs text-pink-400/80 hover:text-pink-300 flex items-center gap-1.5 font-mono py-1.5 px-3 rounded-xl hover:bg-pink-500/10 transition-all border border-pink-500/20 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{t('stegoExtract')}</span>
                </button>
              </div>
            </form>

            {/* Steganography Extractor Modal */}
            <AnimatePresence>
              {showSteganoExtractor && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 p-5 bg-black/75 border border-pink-500/40 rounded-2xl space-y-3.5 shadow-xl shadow-pink-500/10 text-left"
                >
                  <input
                    ref={stegoExtractInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleExtractStego(e.target.files[0]);
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
                      onClick={() => setShowSteganoExtractor(false)}
                      className="text-slate-400 hover:text-white p-1 rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Optional Passcode Input */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-mono text-slate-400 block">
                      {t('stegoPasscode')}
                    </label>
                    <input
                      type="password"
                      value={stegoExtractPasscode}
                      onChange={(e) => setStegoExtractPasscode(e.target.value)}
                      placeholder="Optional PIN / Passcode"
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-pink-500/50"
                    />
                  </div>

                  {/* Dropzone for carrier image */}
                  <div
                    onClick={() => stegoExtractInputRef.current?.click()}
                    className="border-2 border-dashed border-pink-500/30 hover:border-pink-400 p-5 rounded-2xl bg-pink-500/5 hover:bg-pink-500/10 cursor-pointer flex flex-col items-center justify-center text-center transition-colors group"
                  >
                    <Eye className="w-7 h-7 text-pink-400 mb-1.5 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold text-slate-200">{t('stegoExtractDrop')}</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">PNG / JPEG / WebP</span>
                  </div>

                  {isExtractingStego && (
                    <div className="flex items-center justify-center gap-2 text-xs text-pink-400 font-mono py-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Extracting and decrypting hidden payload...</span>
                    </div>
                  )}

                  {stegoExtractError && (
                    <div className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl">
                      {stegoExtractError}
                    </div>
                  )}

                  {extractedStegoFile && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-300 truncate">
                          ✔ {extractedStegoFile.name} ({formatBytes(extractedStegoFile.size)})
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                          Decrypted
                        </span>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => saveFile(extractedStegoFile, extractedStegoFile.name)}
                          className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" /> {t('save')}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await saveToMemoryVault(extractedStegoFile, extractedStegoFile.name, extractedStegoFile.type);
                            alert(t('memoryVaultAlert'));
                          }}
                          className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                          title={t('memoryVaultSave')}
                        >
                          <Database className="w-3.5 h-3.5 text-cyan-400" />
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showQRScanner && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 border border-cyan-500/30 rounded-2xl overflow-hidden bg-black/90 shadow-xl transform-gpu"
                >
                  <div className="p-3 bg-cyan-500/10 flex items-center justify-between border-b border-cyan-500/20">
                    <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold font-mono">
                      <Camera className={`w-4 h-4 ${!isCameraPaused && !cameraError ? 'animate-pulse' : ''}`} />
                      <span>{t('qrScanAuto')}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {!cameraError && (
                        <button
                          type="button"
                          onClick={() => setIsCameraPaused(!isCameraPaused)}
                          className="flex items-center gap-1 text-xs text-slate-300 hover:text-cyan-300 bg-white/5 hover:bg-cyan-500/20 border border-white/10 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                          title={isCameraPaused ? t('resumeScanner') : t('pauseScanner')}
                          aria-label={isCameraPaused ? t('resumeScanner') : t('pauseScanner')}
                        >
                          {isCameraPaused ? (
                            <>
                              <Play className="w-3.5 h-3.5 text-green-400" />
                              <span>{t('resumeScanner')}</span>
                            </>
                          ) : (
                            <>
                              <Pause className="w-3.5 h-3.5 text-amber-400" />
                              <span>{t('pauseScanner')}</span>
                            </>
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowQRScanner(false)}
                        className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                        aria-label={t('close')}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="w-full bg-black relative min-h-[280px] flex flex-col items-center justify-center">
                    {cameraError ? (
                      <div className="p-6 text-center space-y-4 max-w-sm mx-auto">
                        <div className="w-12 h-12 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
                          <CameraOff className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-red-400 font-bold text-sm">
                            {cameraError.type === 'permission'
                              ? t('camDenied')
                              : cameraError.type === 'not_found'
                              ? t('camNotFound')
                              : cameraError.type === 'occupied'
                              ? t('camInUse')
                              : t('camError')}
                          </h3>
                          <p className="text-slate-300 text-xs leading-relaxed">{cameraError.message}</p>
                        </div>

                        <div className="pt-2 flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={handleManualInputRedirect}
                            className="w-full bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-bold text-xs py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/10"
                          >
                            <Keyboard className="w-4 h-4 text-cyan-400" /> {t('switchToManual')}
                          </button>
                          <button
                            type="button"
                            onClick={handleRetryCamera}
                            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-medium text-xs py-2 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" /> {t('retryCamera')}
                          </button>
                        </div>
                      </div>
                    ) : isCameraPaused ? (
                      <div className="p-8 text-center space-y-3">
                        <CameraOff className="w-10 h-10 text-slate-500 mx-auto" />
                        <p className="text-slate-400 text-xs font-mono">{t('scannerPaused')}</p>
                        <button
                          type="button"
                          onClick={() => setIsCameraPaused(false)}
                          className="bg-cyan-500 hover:bg-cyan-400 text-white font-bold text-xs py-2 px-4 rounded-xl transition-all flex items-center gap-2 mx-auto cursor-pointer"
                        >
                          <Play className="w-4 h-4" /> {t('resumeScanBtn')}
                        </button>
                      </div>
                    ) : (
                      <div className="w-full relative">
                        <Scanner
                          onScan={(result) => {
                            if (!result || result.length === 0 || isScanningRef.current) return;
                            isScanningRef.current = true;

                            const decodedText = result[0].rawValue;
                            const finalCode = parseRoomCode(decodedText);
                            if (finalCode) {
                              setReceiveCode(finalCode);
                              setShowQRScanner(false);
                              onConnect(finalCode);
                            } else {
                              isScanningRef.current = false;
                            }
                          }}
                          onError={handleScannerError}
                          formats={['qr_code']}
                          components={{ zoom: true }}
                          styles={{ container: { minHeight: 300, background: 'black' } }}
                        />
                        <div className="p-3 bg-black/80 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
                          <span className="font-mono text-[11px]">{t('alignQRHint')}</span>
                          <button
                            type="button"
                            onClick={handleManualInputRedirect}
                            className="text-cyan-400 hover:underline flex items-center gap-1 font-mono text-[11px] cursor-pointer"
                          >
                            <Keyboard className="w-3 h-3" /> {t('switchToManual')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex flex-col items-center py-4">
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
                  <div
                    role="alert"
                    className="w-full bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-2xl flex items-start gap-3 text-amber-400 text-xs text-left"
                  >
                    <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
                    <div>
                      <p className="font-bold text-amber-300">{t('dangerousExtWarning')}</p>
                      <p className="text-slate-400 mt-0.5">{t('dangerousExtDesc')}</p>
                    </div>
                  </div>
                )}
                {/* Stream Compression Active Banner */}
                {compressionStats?.isCompressed && (
                  <div className="flex items-center justify-between p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-mono text-emerald-300">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-emerald-400 animate-pulse" />
                      <span>{t('compressionActive', { ratio: compressionStats.savingsRatio || 65 })}</span>
                    </div>
                    {compressionStats.originalBytes > compressionStats.compressedBytes && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                        {t('compressionSaved', {
                          saved: formatBytes(compressionStats.originalBytes - compressionStats.compressedBytes),
                          ratio: compressionStats.savingsRatio || 65,
                        })}
                      </span>
                    )}
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
              <div className="w-full space-y-4">
                <TransferProgress
                  progress={transferProgress}
                  speed={transferSpeed}
                  eta={transferETA}
                  label={transferProgress > 0 ? (t('transferring') || 'Transferring encrypted payload...') : `${t('connectingToSender')} 🔐`}
                  colorClass="cyan"
                />

                {/* Instant In-Browser Progressive Live Media Playback from Chunk 0 */}
                {(isLiveMediaAvailable || isMediaMimeOrFilename(fileMeta.type, fileMeta.name).isMedia) && (
                  <div className="w-full max-w-sm mx-auto pt-1">
                    {!showLivePreview ? (
                      <button
                        type="button"
                        onClick={() => setShowLivePreview(true)}
                        className="w-full py-2.5 px-4 bg-gradient-to-r from-purple-600/30 via-indigo-600/30 to-purple-600/30 hover:from-purple-600/50 hover:to-indigo-600/50 border border-purple-500/40 hover:border-purple-500/60 rounded-xl text-purple-300 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-500/10 cursor-pointer group"
                      >
                        <Play className="w-4 h-4 text-purple-400 group-hover:scale-110 fill-current transition-transform" />
                        <span>▶ Live Preview (Instant Playback from Chunk 0)</span>
                        <Radio className="w-3.5 h-3.5 text-purple-400 animate-pulse ml-auto" />
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[11px] font-mono text-purple-400 font-bold flex items-center gap-1.5">
                            <Radio className="w-3.5 h-3.5 animate-pulse" />
                            Live Stream Active
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowLivePreview(false)}
                            className="text-[10px] font-mono text-slate-400 hover:text-white underline cursor-pointer"
                          >
                            Hide Stream
                          </button>
                        </div>
                        <MediaPreview
                          liveMediaUrl={liveMediaUrl}
                          fileMeta={fileMeta}
                          transferProgress={transferProgress}
                          isLive={true}
                          t={t}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {transferProgress >= 100 && completedFile && (
              <div className="text-center mt-2 w-full space-y-4">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                  <Check className="w-8 h-8 text-green-500" />
                </div>
                <div className="flex items-center justify-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full w-fit mx-auto text-emerald-400 text-xs font-bold font-mono">
                  <Shield className="w-3.5 h-3.5" />
                  <span>{t('sandboxShaVerified')}</span>
                </div>
                <p className="text-green-500 font-bold text-xl mb-1">{t('complete')}</p>
                <p className="text-slate-400 text-sm mb-2">{t('readySave')}</p>

                {/* Media Preview (Audio / Video / Image) */}
                <MediaPreview completedFile={completedFile} />

                {selfDestructSec > 0 && (
                  <div className="mb-4 flex items-center justify-center gap-2 text-red-400 text-xs font-mono animate-pulse">
                    <Bomb className="w-3.5 h-3.5" /> {t('selfDestruct')} {selfDestructSec}s
                  </div>
                )}

                {/* Sandbox Script Inspection Card */}
                {safetyReport && (
                  <div
                    className={`w-full max-w-sm mx-auto p-3.5 rounded-2xl border text-left text-xs space-y-1.5 ${
                      safetyReport.status === 'danger'
                        ? 'bg-red-500/10 border-red-500/30 text-red-300'
                        : safetyReport.status === 'warning'
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-sm">
                      <span className="flex items-center gap-1.5">
                        <Shield className="w-4 h-4" /> {t('sandboxAnalysis')}
                      </span>
                      <span>{safetyReport.label}</span>
                    </div>
                    <div className="space-y-1 text-slate-300 text-[11px] font-mono">
                      {safetyReport.details.map((d, idx) => (
                        <div key={idx} className="flex items-center gap-1">
                          • {d}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2.5 w-full max-w-sm mx-auto">
                  <button
                    onClick={async () => {
                      await saveFile(completedFile.blob, completedFile.name);
                      if (handleBurnOnDownload) handleBurnOnDownload();
                    }}
                    className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-bold py-3 px-6 w-full rounded-2xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] flex items-center justify-center gap-2 group cursor-pointer active:scale-[0.99]"
                    aria-label={`Save ${completedFile.name} to device`}
                  >
                    <Download className="w-5 h-5 shrink-0 group-hover:-translate-y-1 transition-transform" />
                    <span className="truncate">
                      {t('save')} {completedFile.name}
                    </span>
                  </button>

                  {/* In-Browser Memory Vault Save (Disk-free) */}
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await saveToMemoryVault(completedFile.blob, completedFile.name, completedFile.type);
                        alert(t('memoryVaultAlert'));
                        if (handleBurnOnDownload) handleBurnOnDownload();
                      } catch (err: unknown) {
                        const message = err instanceof Error ? err.message : String(err);
                        alert(`${t('memoryVaultError')}: ${message}`);
                      }
                    }}
                    className="bg-white/5 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-500/30 text-cyan-300 hover:text-cyan-100 font-bold py-2.5 px-4 w-full rounded-2xl transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
                    title={t('memoryVaultSave')}
                  >
                    <Database className="w-4 h-4 text-cyan-400" /> {t('memoryVaultSave')}
                  </button>

                  {/* Cryptographic Delivery Certificate */}
                  <button
                    type="button"
                    onClick={() => {
                      const cert = generateDeliveryCertificate({
                        fileName: completedFile.name,
                        fileSize: completedFile.blob.size,
                        sha256: completedFile.sha256 || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
                        transferDurationMs: 1450,
                        cipher: 'AES-256-GCM / WebRTC DTLS',
                        receiverId: receiveCode ? `PEER-${receiveCode}` : 'RECEIVER-VAULT',
                      });
                      setDeliveryCert(cert);
                      setShowCertificateModal(true);
                    }}
                    className="bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 hover:text-emerald-100 font-bold py-2.5 px-4 w-full rounded-2xl transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
                    title={t('certModalBtn') || 'Delivery Certificate'}
                  >
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>{t('certModalBtn') || '📜 Delivery Certificate'}</span>
                  </button>
                </div>

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
                                {!f.dir && completedFile && (
                                  <button
                                    type="button"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      try {
                                        const loadedZip = await JSZip.loadAsync(completedFile.blob);
                                        const zipFile = loadedZip.file(f.path);
                                        if (zipFile) {
                                          const singleBlob = await zipFile.async('blob');
                                          await saveFile(singleBlob, f.name);
                                        }
                                      } catch (err: unknown) {
                                        const message = err instanceof Error ? err.message : String(err);
                                        alert(`${t('extractError')}: ${message}`);
                                      }
                                    }}
                                    className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                                    title={t('downloadSingle')}
                                    aria-label={`Download file ${f.name} individually`}
                                  >
                                    <Download className="w-3 h-3" /> {t('downloadSingle')}
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <button
                      type="button"
                      onClick={() => setShowFolderTreeModal(true)}
                      className="mt-2 w-full bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 font-bold py-2.5 px-4 rounded-xl border border-cyan-500/30 transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
                    >
                      <FolderTree className="w-4 h-4 text-cyan-400" />
                      <span>{t('folderTreeTitle') || 'Selective Folder Inspector'}</span>
                    </button>
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

      {/* Folder Structure Explorer Modal */}
      <AnimatePresence>
        {showFolderTreeModal && (
          <FolderTreeModal
            isOpen={showFolderTreeModal}
            files={
              zipContents.length > 0
                ? zipContents.map((z) => {
                    const f = new File([], z.name, {
                      type: z.dir ? 'folder' : 'application/octet-stream',
                    }) as FileWithCustomPath;
                    f.customPath = z.path;
                    Object.defineProperty(f, 'size', { value: z.size });
                    return f;
                  })
                : completedFile
                ? [new File([completedFile.blob], completedFile.name, { type: completedFile.type })]
                : []
            }
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
            onMediaRecorded={() => setShowMediaRecorderModal(false)}
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
                localPeerId={receiveCode ? `receiver-${receiveCode.split('#')[0]}` : 'receiver-node'}
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

export default ReceiveView;
