import type { VercelRequest, VercelResponse } from '@vercel/node';
import { VaultManager } from '../../../src/lib/vaultStore';
import { createPresignedDownloadUrl, loadVaultMetaFromR2, saveVaultMetaToR2 } from '../../lib/r2';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const vaultId = Array.isArray(id) ? id[0] : id;

  if (!vaultId) {
    return res.status(400).json({ error: 'Vault ID is required.' });
  }

  try {
    const { fileId, passwordHash } = req.body || {};

    // 1. Authorize via store
    let auth = await VaultManager.authorizeDownload(vaultId, fileId, passwordHash);

    // 2. If not in local store, try loading from R2
    if (!auth.authorized) {
      const r2Vault = await loadVaultMetaFromR2(vaultId);
      if (r2Vault) {
        if (r2Vault.hasPassword && r2Vault.passwordHash !== passwordHash) {
          return res.status(401).json({ error: 'Incorrect password.' });
        }
        if (r2Vault.expiresAt && Date.now() > r2Vault.expiresAt) {
          return res.status(410).json({ error: 'Vault has expired.' });
        }
        if (r2Vault.downloadLimit && r2Vault.downloadCount >= r2Vault.downloadLimit) {
          return res.status(410).json({ error: 'Download limit exceeded.' });
        }

        // Increment count
        r2Vault.downloadCount++;
        await saveVaultMetaToR2(r2Vault);
        auth = { authorized: true };
      }
    }

    if (!auth.authorized) {
      return res.status(403).json({ error: auth.error || 'Unauthorized download.' });
    }

    // 3. Generate presigned R2 download URL if fileId was requested
    let downloadUrl: string | null = null;
    if (fileId) {
      const storageKey = `vaults/${vaultId}/${fileId}`;
      downloadUrl = await createPresignedDownloadUrl(storageKey);
    }

    return res.status(200).json({
      authorized: true,
      downloadUrl: downloadUrl || undefined,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
}
