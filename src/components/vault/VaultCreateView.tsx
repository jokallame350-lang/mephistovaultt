import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cloud,
  FolderUp,
  FileUp,
  Lock,
  Clock,
  Download,
  Eye,
  Trash2,
  Share2,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { createEncryptedVault, type CreatedVaultResult } from '../../lib/vaultApi';
import { formatBytes } from '../../lib/utils';
import { scanEntry } from '../../hooks/useFileHandler';

interface VaultCreateViewProps {
  t: (key: string, params?: Record<string, string | number>) => string;
}

export const VaultCreateView: React.FC<VaultCreateViewProps> = ({ t }) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [vaultName, setVaultName] = useState('');
  const [expirationDays, setExpirationDays] = useState<number>(3); // 3 days default
  const [downloadLimit, setDownloadLimit] = useState<number | null>(null); // null = unlimited
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [password, setPassword] = useState('');
  const [allowPreview, setAllowPreview] = useState(true);
  const [allowDownload, setAllowDownload] = useState(true);

  // Creation state
  const [isCreating, setIsCreating] = useState(false);
  const [creationProgress, setCreationProgress] = useState(0);
  const [creationStatus, setCreationStatus] = useState('');
  const [createdVault, setCreatedVault] = useState<CreatedVaultResult | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const totalSize = selectedFiles.reduce((acc, f) => acc + (f.size || 0), 0);

  const handleFilesAdded = useCallback((newFiles: File[]) => {
    setSelectedFiles((prev) => [...prev, ...newFiles]);
    setErrorMessage(null);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      let files: File[] = [];

      if (e.dataTransfer.items) {
        const items = Array.from(e.dataTransfer.items);
        for (const item of items) {
          if (item.kind === 'file') {
            const entry = item.webkitGetAsEntry?.();
            if (entry) {
              const scanned = await scanEntry(entry);
              files = files.concat(scanned);
            } else {
              const f = item.getAsFile();
              if (f) files.push(f);
            }
          }
        }
      } else if (e.dataTransfer.files) {
        files = Array.from(e.dataTransfer.files);
      }

      if (files.length > 0) {
        handleFilesAdded(files);
      }
    },
    [handleFilesAdded]
  );

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearAll = () => {
    setSelectedFiles([]);
    setCreatedVault(null);
    setErrorMessage(null);
  };

  const handleCreateVault = async () => {
    if (selectedFiles.length === 0) {
      setErrorMessage(t('vaultSelectFileError') || 'Please select at least one file or folder.');
      return;
    }

    if (isPasswordProtected && (!password || password.trim().length < 4)) {
      setErrorMessage(t('vaultPasswordLengthError') || 'Password must be at least 4 characters long.');
      return;
    }

    setIsCreating(true);
    setErrorMessage(null);

    try {
      const result = await createEncryptedVault({
        name: vaultName.trim() || undefined,
        files: selectedFiles,
        expirationDays,
        downloadLimit,
        password: isPasswordProtected ? password.trim() : undefined,
        allowPreview,
        allowDownload,
        onProgress: (percent, statusText) => {
          setCreationProgress(percent);
          setCreationStatus(statusText);
        },
      });

      setCreatedVault(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (!createdVault) return;
    try {
      await navigator.clipboard.writeText(createdVault.shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // fallback
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Hidden File / Folder Inputs */}
      <input
        type="file"
        ref={fileInputRef}
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleFilesAdded(Array.from(e.target.files));
          e.target.value = '';
        }}
      />
      <input
        type="file"
        ref={folderInputRef}
        // @ts-expect-error webkitdirectory is standard in HTML5
        webkitdirectory=""
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleFilesAdded(Array.from(e.target.files));
          e.target.value = '';
        }}
      />

      {/* Success Created State */}
      <AnimatePresence>
        {createdVault ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="p-6 md:p-8 rounded-3xl bg-slate-950/80 border border-emerald-500/40 shadow-[0_0_50px_rgba(16,185,129,0.25)] text-center space-y-6"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(16,185,129,0.3)]">
              <ShieldCheck className="w-8 h-8 text-emerald-400" />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white mb-1">
                {t('vaultCreatedTitle') || '☁️ Encrypted Vault Ready!'}
              </h2>
              <p className="text-sm text-slate-400">
                {t('vaultCreatedSubtitle') || 'Files are encrypted in your browser and hosted safely. You can now go offline.'}
              </p>
            </div>

            {/* Share URL Box */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-emerald-500/30 flex items-center justify-between gap-3 text-left">
              <div className="overflow-hidden">
                <div className="text-[11px] font-mono text-emerald-400 uppercase font-bold">
                  {t('shareLink') || 'Shareable Recipient Link'}
                </div>
                <div className="text-xs text-slate-300 font-mono truncate select-all">
                  {createdVault.shareUrl}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyShareLink}
                className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shrink-0 cursor-pointer shadow-md shadow-emerald-500/20"
              >
                {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? (t('copied') || 'Copied!') : (t('copyLink') || 'Copy Link')}</span>
              </button>
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center justify-center gap-2 pt-2">
              <div className="p-3 bg-[#050811] border border-emerald-500/30 rounded-2xl shadow-md">
                <QRCodeCanvas
                  value={createdVault.shareUrl}
                  size={160}
                  bgColor="#050811"
                  fgColor="#10b981"
                  level="H"
                  marginSize={2}
                />
              </div>
              <span className="text-[11px] text-slate-400 font-mono">{t('scanQrToDownload') || 'Scan with phone camera to download'}</span>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => window.open(createdVault.shareUrl, '_blank')}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
                <span>{t('openRecipientPage') || 'Open Download Page'}</span>
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                {t('createAnotherVault') || '➕ Create Another Vault'}
              </button>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {/* Header Card */}
            <div className="text-center space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-cyan-400 text-xs font-mono font-bold">
                <Cloud className="w-3.5 h-3.5" />
                <span>{t('vaultShareModeBadge') || 'OFFLINE HOSTED ENCRYPTED VAULT'}</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                {t('vaultShareTitle') || 'Store Securely. Share with Control.'}
              </h1>
              <p className="text-xs md:text-sm text-slate-400 max-w-lg mx-auto">
                {t('vaultShareSubtitle') || 'Files are encrypted in your browser before upload. Senders do not need to stay online.'}
              </p>
            </div>

            {/* Drag & Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-3xl p-8 text-center transition-all cursor-pointer ${
                isDragging
                  ? 'border-cyan-400 bg-cyan-500/10 scale-[1.01]'
                  : selectedFiles.length > 0
                  ? 'border-cyan-500/40 bg-slate-950/60'
                  : 'border-white/10 hover:border-cyan-500/30 bg-slate-950/40'
              }`}
            >
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
                  <Cloud className="w-7 h-7" />
                </div>
                <div>
                  <div className="text-base font-bold text-white mb-0.5">
                    {t('dropVaultFiles') || 'Drop files or folders here'}
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    {t('maxVaultSizeHint') || 'Encrypted client-side with 256-bit AES-GCM (Up to 10 GB)'}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <FileUp className="w-4 h-4" />
                    <span>{t('selectFiles') || 'Select Files'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => folderInputRef.current?.click()}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <FolderUp className="w-4 h-4" />
                    <span>{t('selectFolder') || 'Select Folder'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Selected Files List */}
            {selectedFiles.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 rounded-2xl bg-slate-900/80 border border-white/10 space-y-3"
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold font-mono text-cyan-400">
                      {selectedFiles.length} {t('filesSelected') || 'files selected'}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">({formatBytes(totalSize)})</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-xs text-red-400 hover:text-red-300 font-mono transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> {t('clearAll') || 'Clear'}
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                  {selectedFiles.slice(0, 50).map((file, idx) => {
                    const customPath = (file as unknown as { customPath?: string }).customPath;
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-white/5 text-xs text-slate-300"
                      >
                        <div className="truncate mr-2 font-mono">
                          <span className="text-white font-medium">{file.name}</span>
                          {customPath && customPath !== file.name && (
                            <span className="text-[10px] text-slate-500 ml-1.5 truncate">({customPath})</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 font-mono text-slate-400 text-[11px]">
                          <span>{formatBytes(file.size)}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(idx)}
                            className="p-1 hover:text-red-400 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {selectedFiles.length > 50 && (
                    <div className="text-center text-xs text-slate-500 font-mono py-1">
                      + {selectedFiles.length - 50} more files
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Vault Settings Panel */}
            <div className="p-5 md:p-6 rounded-3xl bg-slate-950/80 border border-white/10 space-y-5">
              <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-white/10 pb-3">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>{t('vaultSettings') || 'Vault Access & Expiration Settings'}</span>
              </div>

              {/* Optional Vault Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5">
                  <span>{t('vaultNameLabel') || 'Vault Title (Optional)'}</span>
                </label>
                <input
                  type="text"
                  placeholder={t('vaultNamePlaceholder') || 'e.g. Project Assets Q3'}
                  value={vaultName}
                  onChange={(e) => setVaultName(e.target.value)}
                  className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 font-mono"
                />
              </div>

              {/* Expiration Settings */}
              <div className="space-y-2">
                <label className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t('vaultExpirationLabel') || 'Expiration (Server-Enforced)'}</span>
                </label>
                <div className="grid grid-cols-3 md:grid-cols-5 gap-2 text-xs font-mono">
                  {[
                    { days: 1, label: '24 Hours' },
                    { days: 3, label: '3 Days' },
                    { days: 7, label: '7 Days' },
                    { days: 30, label: '30 Days' },
                    { days: 0, label: 'Never' },
                  ].map((opt) => (
                    <button
                      key={opt.days}
                      type="button"
                      onClick={() => setExpirationDays(opt.days)}
                      className={`py-2 px-3 rounded-xl border text-center transition-all cursor-pointer ${
                        expirationDays === opt.days
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                          : 'bg-slate-900/60 border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Download Limit Settings */}
              <div className="space-y-2">
                <label className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t('vaultDownloadLimitLabel') || 'Download Limit (Auto-Destruct on Limit)'}</span>
                </label>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs font-mono">
                  {[
                    { limit: null, label: 'Unlimited' },
                    { limit: 1, label: '1 (Burn)' },
                    { limit: 5, label: '5' },
                    { limit: 10, label: '10' },
                    { limit: 25, label: '25' },
                    { limit: 100, label: '100' },
                  ].map((opt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setDownloadLimit(opt.limit)}
                      className={`py-2 px-2 rounded-xl border text-center transition-all cursor-pointer ${
                        downloadLimit === opt.limit
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                          : 'bg-slate-900/60 border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Password Protection */}
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5 cursor-pointer">
                    <Lock className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{t('vaultPasswordProtectLabel') || 'Password Protection'}</span>
                  </label>
                  <input
                    type="checkbox"
                    checked={isPasswordProtected}
                    onChange={(e) => setIsPasswordProtected(e.target.checked)}
                    className="w-4 h-4 accent-cyan-500 cursor-pointer rounded"
                  />
                </div>

                {isPasswordProtected && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-1"
                  >
                    <input
                      type="password"
                      placeholder={t('vaultPasswordPlaceholder') || 'Enter secure password...'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-900/90 border border-cyan-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                    />
                  </motion.div>
                )}
              </div>

              {/* Advanced Permissions */}
              <div className="flex items-center justify-between gap-4 pt-2 border-t border-white/5 text-xs font-mono text-slate-400">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowPreview}
                    onChange={(e) => setAllowPreview(e.target.checked)}
                    className="accent-cyan-500 rounded cursor-pointer"
                  />
                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                  <span>{t('allowPreview') || 'Allow In-Browser Preview'}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowDownload}
                    onChange={(e) => setAllowDownload(e.target.checked)}
                    className="accent-cyan-500 rounded cursor-pointer"
                  />
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                  <span>{t('allowDownload') || 'Allow Download'}</span>
                </label>
              </div>
            </div>

            {/* Error Display */}
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-mono flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </motion.div>
            )}

            {/* Creation Progress or Create Button */}
            {isCreating ? (
              <div className="p-5 rounded-2xl bg-slate-900/90 border border-cyan-500/30 text-center space-y-3">
                <div className="flex items-center justify-between text-xs font-mono text-cyan-400 font-bold">
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{creationStatus}</span>
                  </span>
                  <span>{creationProgress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full"
                    style={{ width: `${creationProgress}%` }}
                    transition={{ duration: 0.2 }}
                  />
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleCreateVault}
                disabled={selectedFiles.length === 0}
                className={`w-full py-4 px-6 rounded-2xl font-extrabold text-sm md:text-base transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer active:scale-[0.99] ${
                  selectedFiles.length > 0
                    ? 'bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 shadow-cyan-500/25 hover:shadow-cyan-500/40'
                    : 'bg-slate-800 text-slate-500 border border-white/5 cursor-not-allowed'
                }`}
              >
                <Share2 className="w-5 h-5" />
                <span>{t('createVaultButton') || '☁️ Encrypt & Create Vault'}</span>
              </button>
            )}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VaultCreateView;
