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
  Mic,
  Database,
  RefreshCw,
  Keyboard,
} from 'lucide-react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { formatBytes, saveFile, parseRoomCode } from '../lib/utils';
import { DANGEROUS_EXTENSIONS } from '../lib/constants';
import { inspectFileSafety } from '../lib/sandboxInspector';
import { saveToMemoryVault } from '../lib/memoryVault';
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
  isVoiceActive?: boolean;
  toggleVoiceTalkie?: () => void;
  handleBurnOnDownload?: () => void;
  onConnect: (code: string) => void;
  onClose: () => void;
  t: (key: string) => string;
}

const MediaPreview = React.memo(function MediaPreview({
  completedFile,
}: {
  completedFile: CompletedFile;
}) {
  const mediaUrl = React.useMemo(() => {
    if (!completedFile) return null;
    return URL.createObjectURL(completedFile.blob);
  }, [completedFile]);

  React.useEffect(() => {
    return () => {
      if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    };
  }, [mediaUrl]);

  if (!mediaUrl) return null;

  if (completedFile.type.startsWith('audio/')) {
    return (
      <div className="p-3 bg-black/60 border border-white/10 rounded-2xl max-w-sm mx-auto">
        <audio controls className="w-full" src={mediaUrl} />
      </div>
    );
  }
  if (completedFile.type.startsWith('video/')) {
    return (
      <div className="p-2 bg-black/60 border border-white/10 rounded-2xl max-w-sm mx-auto overflow-hidden">
        <video controls className="w-full rounded-xl" src={mediaUrl} />
      </div>
    );
  }
  if (completedFile.type.startsWith('image/')) {
    return (
      <div className="p-2 bg-black/60 border border-white/10 rounded-2xl max-w-sm mx-auto overflow-hidden">
        <img
          src={mediaUrl}
          alt="Received Preview"
          className="w-full max-h-60 object-contain rounded-xl"
        />
      </div>
    );
  }
  return null;
});

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
  isVoiceActive = false,
  toggleVoiceTalkie,
  handleBurnOnDownload,
  onConnect,
  onClose,
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
    let message = 'Kamera erişiminde sorun oluştu.';

    if (
      errName === 'NotAllowedError' ||
      errName === 'PermissionDeniedError' ||
      /permission|denied|not allowed|allowed/i.test(errMsg)
    ) {
      type = 'permission';
      message = 'Kamera İzni Reddedildi: Tarayıcı ayarlarınızdan kamera erişimine izin verin veya oda kodunu manuel girin.';
    } else if (
      errName === 'NotFoundError' ||
      errName === 'DevicesNotFoundError' ||
      /not found|no camera|no media|device/i.test(errMsg)
    ) {
      type = 'not_found';
      message = 'Kamera Bulunamadı: Cihazınızda aktif veya uyumlu bir kamera tespit edilemedi.';
    } else if (
      errName === 'NotReadableError' ||
      errName === 'TrackStartError' ||
      /in use|readable|start/i.test(errMsg)
    ) {
      type = 'occupied';
      message = 'Kamera Kullanımda: Kamera başka bir uygulama veya sekme tarafından kullanılıyor olabilir.';
    } else {
      message = `Kamera Hatası: ${errMsg || 'Kamera görüntüsü alınamadı.'}`;
    }

    setCameraError({ type, message });
  }, []);

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

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (receiveCode.length >= 11) {
      onConnect(receiveCode);
    }
  };

  const safetyReport = React.useMemo(() => {
    if (!completedFile) return null;
    return inspectFileSafety(completedFile.name, completedFile.blob.size, completedFile.type);
  }, [completedFile]);

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
                onClick={() => onConnect(receiveCode)}
                className="flex-1 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" /> Yeniden Bağlan
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                }}
                className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                ✏️ Kodu Değiştir
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
                    placeholder="vault-xxxx-xxxx"
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
                disabled={receiveCode.length < 11}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 px-6 rounded-2xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] cursor-pointer"
              >
                {t('connect')}
              </button>
            </form>

            <AnimatePresence>
              {showQRScanner && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 border border-cyan-500/30 rounded-2xl overflow-hidden bg-black/90 shadow-xl"
                >
                  <div className="p-3 bg-cyan-500/10 flex items-center justify-between border-b border-cyan-500/20">
                    <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold font-mono">
                      <Camera className={`w-4 h-4 ${!isCameraPaused && !cameraError ? 'animate-pulse' : ''}`} />
                      <span>QR Tara (Otomatik Bağlan)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {!cameraError && (
                        <button
                          type="button"
                          onClick={() => setIsCameraPaused(!isCameraPaused)}
                          className="flex items-center gap-1 text-xs text-slate-300 hover:text-cyan-300 bg-white/5 hover:bg-cyan-500/20 border border-white/10 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                          title={isCameraPaused ? 'Kamerayı Başlat' : 'Kamerayı Duraklat'}
                          aria-label={isCameraPaused ? 'Kamerayı Başlat' : 'Kamerayı Duraklat'}
                        >
                          {isCameraPaused ? (
                            <>
                              <Play className="w-3.5 h-3.5 text-green-400" />
                              <span>Başlat</span>
                            </>
                          ) : (
                            <>
                              <Pause className="w-3.5 h-3.5 text-amber-400" />
                              <span>Duraklat</span>
                            </>
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowQRScanner(false)}
                        className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                        aria-label="Tarayıcıyı Kapat"
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
                              ? 'Kamera İzni Engellendi'
                              : cameraError.type === 'not_found'
                              ? 'Kamera Bulunamadı'
                              : cameraError.type === 'occupied'
                              ? 'Kamera Meşgul'
                              : 'Kamera Başlatılamadı'}
                          </h3>
                          <p className="text-slate-300 text-xs leading-relaxed">{cameraError.message}</p>
                        </div>

                        <div className="pt-2 flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={handleManualInputRedirect}
                            className="w-full bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-bold text-xs py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/10"
                          >
                            <Keyboard className="w-4 h-4 text-cyan-400" /> Manuel Kod Girişine Geç
                          </button>
                          <button
                            type="button"
                            onClick={handleRetryCamera}
                            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-medium text-xs py-2 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" /> Kamerayı Yeniden Dene
                          </button>
                        </div>
                      </div>
                    ) : isCameraPaused ? (
                      <div className="p-8 text-center space-y-3">
                        <CameraOff className="w-10 h-10 text-slate-500 mx-auto" />
                        <p className="text-slate-400 text-xs font-mono">Kamera Taraması Duraklatıldı</p>
                        <button
                          type="button"
                          onClick={() => setIsCameraPaused(false)}
                          className="bg-cyan-500 hover:bg-cyan-400 text-white font-bold text-xs py-2 px-4 rounded-xl transition-all flex items-center gap-2 mx-auto cursor-pointer"
                        >
                          <Play className="w-4 h-4" /> Taramayı Devam Ettir
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
                          <span className="font-mono text-[11px]">QR kodunu kareye hizalayın</span>
                          <button
                            type="button"
                            onClick={handleManualInputRedirect}
                            className="text-cyan-400 hover:underline flex items-center gap-1 font-mono text-[11px] cursor-pointer"
                          >
                            <Keyboard className="w-3 h-3" /> Manuel Kod Gir
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
            {/* Phantom Voice Walkie Talkie Controls */}
            {isConnected && (
              <div className="w-full mb-6 p-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2 text-purple-300 text-xs font-bold font-mono">
                  <Radio className="w-4 h-4 text-purple-400 animate-pulse" />
                  <span>Phantom Voice (P2P Telsiz)</span>
                </div>
                <button
                  type="button"
                  onClick={toggleVoiceTalkie}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer focus:outline-none ${
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
                        <Shield className="w-4 h-4" /> 🛡️ Sandbox Analizi
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
                        alert('💾 Dosya cihaza indirilmeden şifreli tarayıcı hafıza kasasına alındı! İstediğiniz an silebilirsiniz.');
                        if (handleBurnOnDownload) handleBurnOnDownload();
                      } catch (err: unknown) {
                        const message = err instanceof Error ? err.message : String(err);
                        alert('Hafıza kasasına yazma hatası: ' + message);
                      }
                    }}
                    className="bg-white/5 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-500/30 text-cyan-300 hover:text-cyan-100 font-bold py-2.5 px-4 w-full rounded-2xl transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
                    title="Cihazın İndirilenler klasöründe iz bırakmadan gizli tarayıcı hafızasına sakla"
                  >
                    <Database className="w-4 h-4 text-cyan-400" /> 💾 Diske Yazmadan Geçici Kasaya Sakla
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
                                        alert('Dosya çıkarılamadı: ' + message);
                                      }
                                    }}
                                    className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                                    title="Bu dosyayı tek başına indir"
                                    aria-label={`Download file ${f.name} individually`}
                                  >
                                    <Download className="w-3 h-3" /> Tek İndir
                                  </button>
                                )}
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
});

export default ReceiveView;
