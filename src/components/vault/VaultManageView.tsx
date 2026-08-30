import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderLock,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  Clock,
  AlertTriangle,
  FolderOpen,
  FileCheck,
} from 'lucide-react';
import { formatBytes } from '../../lib/utils';
import { deleteVaultWithToken } from '../../lib/vaultApi';

interface MyVaultItem {
  id: string;
  name?: string;
  createdAt: number;
  expiresAt: number | null;
  managementToken: string;
  fileCount: number;
  totalSize: number;
}

interface VaultManageViewProps {
  t: (key: string, params?: Record<string, string | number>) => string;
}

export const VaultManageView: React.FC<VaultManageViewProps> = ({ t }) => {
  const [vaults, setVaults] = useState<MyVaultItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('ms-my-vaults');
      if (stored) {
        setVaults(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  const handleCopyLink = async (vaultId: string) => {
    const origin = window.location.origin;
    const url = `${origin}/v/${vaultId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(vaultId);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      // fallback
    }
  };

  const handleDelete = async (vault: MyVaultItem) => {
    if (!confirm(t('confirmDeleteVault') || 'Are you sure you want to permanently delete this Vault and purge all its files?')) {
      return;
    }

    setDeletingId(vault.id);
    setErrorMessage(null);

    try {
      await deleteVaultWithToken(vault.id, vault.managementToken);
      const updated = vaults.filter((v) => v.id !== vault.id);
      setVaults(updated);
      localStorage.setItem('ms-my-vaults', JSON.stringify(updated));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <FolderLock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">{t('myVaults') || 'My Created Vaults'}</h2>
            <p className="text-[11px] font-mono text-slate-400">
              {t('myVaultsSubtitle') || 'Manage guest-created vaults on this device'}
            </p>
          </div>
        </div>
        <div className="text-xs font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1 rounded-full font-bold">
          {vaults.length} {t('vaultsActive') || 'vaults'}
        </div>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-mono flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {vaults.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-slate-950/60 border border-white/10 space-y-3">
          <FolderOpen className="w-10 h-10 text-slate-600 mx-auto" />
          <div className="text-sm font-bold text-slate-300">{t('noVaultsFound') || 'No active Vaults on this device'}</div>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {t('noVaultsHint') || 'Create a Vault to securely share encrypted files with expiration and download limits.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {vaults.map((vault) => {
              const isExpired = vault.expiresAt ? Date.now() > vault.expiresAt : false;
              return (
                <motion.div
                  key={vault.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 hover:border-cyan-500/30 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="space-y-1 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white font-mono truncate">
                        {vault.name || `Vault-${vault.id.toUpperCase()}`}
                      </span>
                      {isExpired ? (
                        <span className="px-2 py-0.5 rounded-md bg-red-500/15 border border-red-500/30 text-red-400 text-[10px] font-mono font-bold">
                          {t('expired') || 'EXPIRED'}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold">
                          {t('active') || 'ACTIVE'}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-400">
                      <span className="flex items-center gap-1">
                        <FileCheck className="w-3 h-3 text-cyan-400" />
                        {vault.fileCount} files ({formatBytes(vault.totalSize)})
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-400" />
                        {vault.expiresAt
                          ? `Expires: ${new Date(vault.expiresAt).toLocaleDateString()}`
                          : 'Never expires'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopyLink(vault.id)}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer text-xs flex items-center gap-1.5 font-mono"
                      title={t('copyLink') || 'Copy Link'}
                    >
                      {copiedId === vault.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span className="hidden sm:inline">{copiedId === vault.id ? 'Copied' : 'Link'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => window.open(`/v/${vault.id}`, '_blank')}
                      className="p-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 transition-colors cursor-pointer text-xs flex items-center gap-1 font-mono"
                      title={t('open') || 'Open'}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(vault)}
                      disabled={deletingId === vault.id}
                      className="p-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 hover:text-red-200 transition-colors cursor-pointer text-xs font-mono disabled:opacity-50"
                      title={t('delete') || 'Delete'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default VaultManageView;
