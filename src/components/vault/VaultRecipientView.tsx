import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cloud,
  Download,
  Lock,
  Clock,
  FileCheck,
  AlertCircle,
  Loader2,
  FileText,
  KeyRound,
  ShieldCheck,
  Eye,
} from 'lucide-react';
import { getVaultMetadata, downloadAndDecryptVaultFile } from '../../lib/vaultApi';
import { formatBytes, saveFile } from '../../lib/utils';
import type { VaultRecord, VaultFileItem } from '../../types/vault';

interface VaultRecipientViewProps {
  vaultId: string;
  secretKeyString?: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export const VaultRecipientView: React.FC<VaultRecipientViewProps> = ({
  vaultId,
  secretKeyString,
  t,
}) => {
  const [vault, setVault] = useState<VaultRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Decryption key
  const [decryptionSecret, setDecryptionSecret] = useState(secretKeyString || '');
  const [password, setPassword] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);

  // Downloading state
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [downloadProgressText, setDownloadProgressText] = useState('');
  const [previewBlobUrl, setPreviewBlobUrl] = useState<{ url: string; filename: string; mime: string } | null>(null);

  // Fetch Vault Metadata on mount
  useEffect(() => {
    let isMounted = true;
    const fetchMetadata = async () => {
      try {
        setIsLoading(true);
        setErrorMessage(null);
        const meta = await getVaultMetadata(vaultId);
        if (isMounted) {
          setVault(meta);
          if (!meta.hasPassword) {
            setIsUnlocked(true);
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : String(err);
          setErrorMessage(msg);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchMetadata();
    return () => {
      isMounted = false;
    };
  }, [vaultId]);

  // Clean up preview Blob URL
  useEffect(() => {
    return () => {
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl.url);
      }
    };
  }, [previewBlobUrl]);

  // Handle single file download
  const handleDownloadSingle = useCallback(
    async (fileItem: VaultFileItem) => {
      if (!vault) return;
      const keyToUse = decryptionSecret.trim();
      if (!keyToUse) {
        setErrorMessage(t('vaultMissingKey') || 'Decryption key missing. Please check your share URL.');
        return;
      }

      setDownloadingFileId(fileItem.id);
      setErrorMessage(null);

      try {
        const decryptedFile = await downloadAndDecryptVaultFile(
          vault.id,
          fileItem,
          keyToUse,
          password.trim() || undefined,
          vault.passwordSalt || undefined
        );

        await saveFile(decryptedFile, fileItem.filename);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMessage(msg);
      } finally {
        setDownloadingFileId(null);
      }
    },
    [vault, decryptionSecret, password, t]
  );

  // Handle previewing a file in-browser
  const handlePreviewFile = useCallback(
    async (fileItem: VaultFileItem) => {
      if (!vault) return;
      const keyToUse = decryptionSecret.trim();
      if (!keyToUse) return;

      try {
        setDownloadingFileId(fileItem.id);
        const decryptedFile = await downloadAndDecryptVaultFile(
          vault.id,
          fileItem,
          keyToUse,
          password.trim() || undefined,
          vault.passwordSalt || undefined
        );

        if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl.url);
        const url = URL.createObjectURL(decryptedFile);
        setPreviewBlobUrl({ url, filename: fileItem.filename, mime: fileItem.mimeType });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMessage(msg);
      } finally {
        setDownloadingFileId(null);
      }
    },
    [vault, decryptionSecret, password, previewBlobUrl]
  );

  // Handle Download All files
  const handleDownloadAll = async () => {
    if (!vault || vault.files.length === 0) return;
    const keyToUse = decryptionSecret.trim();
    if (!keyToUse) return;

    setIsDownloadingAll(true);
    setErrorMessage(null);

    try {
      const total = vault.files.length;
      for (let i = 0; i < total; i++) {
        const fileItem = vault.files[i];
        setDownloadProgressText(`Decrypting & downloading (${i + 1}/${total}): ${fileItem.filename}...`);
        const decryptedFile = await downloadAndDecryptVaultFile(
          vault.id,
          fileItem,
          keyToUse,
          password.trim() || undefined,
          vault.passwordSalt || undefined
        );
        await saveFile(decryptedFile, fileItem.filename);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsDownloadingAll(false);
      setDownloadProgressText('');
    }
  };

  const calculateExpiryLabel = (expiresAt: number | null) => {
    if (!expiresAt) return t('neverExpires') || 'Never expires';
    const remainingMs = expiresAt - Date.now();
    if (remainingMs <= 0) return t('expired') || 'Expired';
    const hours = Math.ceil(remainingMs / (1000 * 60 * 60));
    if (hours < 24) return `${hours} hours remaining`;
    const days = Math.ceil(hours / 24);
    return `${days} days remaining`;
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-xl mx-auto p-12 text-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mx-auto" />
        <div className="text-sm font-mono text-slate-400">{t('loadingVault') || 'Locating and verifying Vault...'}</div>
      </div>
    );
  }

  if (errorMessage && !vault) {
    return (
      <div className="w-full max-w-lg mx-auto p-8 rounded-3xl bg-slate-950/90 border border-red-500/30 text-center space-y-4 shadow-[0_0_40px_rgba(239,68,68,0.2)]">
        <div className="w-14 h-14 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto text-red-400">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-white">{t('vaultUnavailableTitle') || 'Vault Unavailable'}</h2>
        <p className="text-xs text-red-300 font-mono">{errorMessage}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
        >
          {t('retry') || 'Retry'}
        </button>
      </div>
    );
  }

  if (!vault) return null;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Vault Card Header */}
      <div className="p-6 md:p-8 rounded-3xl bg-slate-950/80 border border-cyan-500/30 shadow-[0_0_50px_rgba(6,182,212,0.15)] space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-mono text-cyan-400 font-bold uppercase tracking-wider">
                {t('vaultShareModeBadge') || 'ENCRYPTED VAULT'}
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                {vault.name || `Vault-${vault.id.toUpperCase()}`}
              </h1>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 font-mono text-[11px]">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-white/10 text-slate-300">
              <Clock className="w-3 h-3 text-amber-400" />
              <span>{calculateExpiryLabel(vault.expiresAt)}</span>
            </div>
            {vault.downloadLimit && (
              <div className="text-slate-400 text-[10px]">
                {vault.downloadCount} / {vault.downloadLimit} downloads used
              </div>
            )}
          </div>
        </div>

        {/* Security Seals */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-400">
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-emerald-500/20 text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>256-bit AES-GCM Encrypted</span>
          </div>
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-white/10 text-slate-300">
            <FileCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>{vault.fileCount} files ({formatBytes(vault.totalSize)})</span>
          </div>
        </div>

        {/* Missing Key Warning or Manual Key Prompt */}
        {!decryptionSecret && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono space-y-2">
            <div className="flex items-center gap-1.5 font-bold">
              <KeyRound className="w-4 h-4" />
              <span>{t('vaultKeyRequired') || 'Decryption Secret Required'}</span>
            </div>
            <p className="text-[11px] text-amber-400/90">
              The decryption secret was not included in the URL fragment. Please paste the secret key:
            </p>
            <input
              type="text"
              placeholder="Paste secret key from share link..."
              value={decryptionSecret}
              onChange={(e) => setDecryptionSecret(e.target.value)}
              className="w-full bg-slate-900 border border-amber-500/40 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none"
            />
          </div>
        )}

        {/* Password Prompt if Password Protected */}
        {vault.hasPassword && !isUnlocked && (
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-cyan-500/30 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-300 font-mono">
              <Lock className="w-4 h-4 text-cyan-400" />
              <span>{t('vaultPasswordPrompt') || 'This Vault is password protected. Enter password to unlock:'}</span>
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder={t('enterPassword') || 'Enter password...'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                onClick={() => {
                  if (password.trim()) setIsUnlocked(true);
                }}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs transition-all cursor-pointer font-mono"
              >
                {t('unlock') || 'Unlock'}
              </button>
            </div>
          </div>
        )}

        {/* Files List */}
        {isUnlocked && (
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-xs font-mono font-bold text-slate-300">
                {t('vaultFiles') || 'Vault Files'} ({vault.files.length})
              </span>
              {vault.allowDownload && vault.files.length > 1 && (
                <button
                  type="button"
                  onClick={handleDownloadAll}
                  disabled={isDownloadingAll}
                  className="text-xs font-mono font-bold text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isDownloadingAll ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{downloadProgressText || 'Downloading...'}</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>{t('downloadAll') || 'Download All'}</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
              {vault.files.map((file) => {
                const isCurrent = downloadingFileId === file.id;
                const canPreview =
                  vault.allowPreview &&
                  (file.mimeType.startsWith('image/') ||
                    file.mimeType.startsWith('video/') ||
                    file.mimeType.startsWith('audio/') ||
                    file.mimeType.startsWith('text/'));

                return (
                  <div
                    key={file.id}
                    className="p-3 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-cyan-500/20 transition-all flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 truncate">
                      <div className="p-2 rounded-xl bg-slate-800 text-slate-400 shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-bold text-white truncate">{file.filename}</div>
                        {file.relativePath && file.relativePath !== file.filename && (
                          <div className="text-[10px] text-slate-500 font-mono truncate">{file.relativePath}</div>
                        )}
                        <div className="text-[10px] text-slate-400 font-mono">{formatBytes(file.size)}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {canPreview && (
                        <button
                          type="button"
                          onClick={() => handlePreviewFile(file)}
                          disabled={Boolean(downloadingFileId)}
                          className="p-2 rounded-xl bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 transition-colors cursor-pointer text-xs flex items-center gap-1 font-mono disabled:opacity-50"
                          title="Preview"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {vault.allowDownload && (
                        <button
                          type="button"
                          onClick={() => handleDownloadSingle(file)}
                          disabled={Boolean(downloadingFileId)}
                          className="px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 hover:text-cyan-100 font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 font-mono shadow-sm disabled:opacity-50"
                        >
                          {isCurrent ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                          <span>{isCurrent ? 'Decrypting...' : (t('download') || 'Download')}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* In-Browser Preview Lightbox */}
        <AnimatePresence>
          {previewBlobUrl && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
              onClick={() => setPreviewBlobUrl(null)}
            >
              <div
                className="relative bg-slate-950 border border-cyan-500/30 p-6 rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col items-center justify-center"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="w-full flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                  <span className="text-xs font-mono font-bold text-white truncate">{previewBlobUrl.filename}</span>
                  <button
                    type="button"
                    onClick={() => setPreviewBlobUrl(null)}
                    className="text-slate-400 hover:text-white text-xs font-mono cursor-pointer"
                  >
                    ✕ Close
                  </button>
                </div>

                {previewBlobUrl.mime.startsWith('image/') && (
                  <img
                    src={previewBlobUrl.url}
                    alt={previewBlobUrl.filename}
                    className="max-h-[60vh] object-contain rounded-xl"
                  />
                )}
                {previewBlobUrl.mime.startsWith('video/') && (
                  <video
                    src={previewBlobUrl.url}
                    controls
                    autoPlay
                    className="max-h-[60vh] w-full rounded-xl"
                  />
                )}
                {previewBlobUrl.mime.startsWith('audio/') && (
                  <audio src={previewBlobUrl.url} controls autoPlay className="w-full my-4" />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Error Display */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-mono flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default VaultRecipientView;
