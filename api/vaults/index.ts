import type { VercelRequest, VercelResponse } from '@vercel/node';
import { VaultManager } from '../../src/lib/vaultStore';
import { createPresignedUploadUrl, saveVaultMetaToR2 } from '../lib/r2';
import type { VaultCreatePayload } from '../../src/types/vault';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = req.body as VaultCreatePayload;
    if (!payload || !payload.files || payload.files.length === 0) {
      return res.status(400).json({ error: 'Invalid payload: files array is required.' });
    }

    const { vault, managementToken, uploadInstructions } = await VaultManager.createVault(payload);

    // If Cloudflare R2 is configured, generate presigned R2 upload URLs
    const presignedUploads = await Promise.all(
      uploadInstructions.map(async (item) => {
        const signedUrl = await createPresignedUploadUrl(item.storageKey);
        return {
          fileId: item.fileId,
          storageKey: item.storageKey,
          uploadUrl: signedUrl || `/api/vaults/${vault.id}/upload?fileId=${item.fileId}`,
        };
      })
    );

    // Persist metadata to R2 if configured
    await saveVaultMetaToR2(vault);

    return res.status(201).json({
      vault,
      managementToken,
      uploadUrls: presignedUploads,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
}
