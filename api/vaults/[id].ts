import type { VercelRequest, VercelResponse } from '@vercel/node';
import { VaultManager } from '../../src/lib/vaultStore';
import { loadVaultMetaFromR2, purgeVaultFromR2 } from '../lib/r2';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-management-token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;
  const vaultId = Array.isArray(id) ? id[0] : id;

  if (!vaultId) {
    return res.status(400).json({ error: 'Vault ID is required.' });
  }

  // Handle GET /api/vaults/[id]
  if (req.method === 'GET') {
    try {
      // 1. Check in-memory/KV store first
      let vault = await VaultManager.getVault(vaultId).catch(() => null);

      // 2. Fallback to R2 persistent JSON metadata if available
      if (!vault) {
        vault = await loadVaultMetaFromR2(vaultId);
      }

      if (!vault || vault.status === 'deleted') {
        return res.status(404).json({ error: 'Vault not found or has been deleted.' });
      }

      const now = Date.now();
      if (vault.expiresAt && now > vault.expiresAt) {
        return res.status(410).json({ error: 'This Vault has expired and is no longer accessible.' });
      }

      if (vault.downloadLimit && vault.downloadCount >= vault.downloadLimit) {
        return res.status(410).json({ error: 'This Vault has reached its download limit.' });
      }

      // Return sanitized public metadata
      return res.status(200).json({
        id: vault.id,
        name: vault.name,
        createdAt: vault.createdAt,
        expiresAt: vault.expiresAt,
        status: vault.status,
        hasPassword: vault.hasPassword,
        passwordSalt: vault.passwordSalt,
        downloadLimit: vault.downloadLimit,
        downloadCount: vault.downloadCount,
        allowPreview: vault.allowPreview,
        allowDownload: vault.allowDownload,
        fileCount: vault.fileCount,
        totalSize: vault.totalSize,
        files: vault.files,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: message });
    }
  }

  // Handle DELETE /api/vaults/[id]
  if (req.method === 'DELETE') {
    const managementToken =
      (req.headers['x-management-token'] as string) ||
      (req.query.token as string) ||
      (req.body && req.body.managementToken);

    if (!managementToken) {
      return res.status(401).json({ error: 'Unauthorized: Management token required.' });
    }

    try {
      // Purge from memory / store
      await VaultManager.deleteVault(vaultId, managementToken).catch(() => false);
      // Purge from Cloudflare R2
      await purgeVaultFromR2(vaultId);

      return res.status(200).json({ success: true, message: 'Vault permanently deleted from storage.' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return res.status(403).json({ error: message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
