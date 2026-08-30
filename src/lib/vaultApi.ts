/**
 * MephistoVault — Vault Share Client API SDK
 * Orchestrates client-side encryption, uploading, progress monitoring, and downloading.
 * Supports direct-to-R2 presigned uploads and local-first fallback.
 */

import { VaultManager } from './vaultStore';
import {
  generateVaultKey,
  importVaultKey,
  hashPasswordForVault,
  encryptFileToBlob,
  decryptBlobToFile,
} from './vaultCrypto';
import { calculateSHA256 } from './encryption';
import type { VaultRecord, VaultCreatePayload, VaultFileItem, VaultCreateResponse } from '../types/vault';

export interface CreateVaultOptions {
  name?: string;
  files: File[];
  expirationDays?: number; // e.g. 1, 3, 7, 30 or 0 for never
  downloadLimit?: number | null; // null for unlimited
  password?: string;
  allowPreview?: boolean;
  allowDownload?: boolean;
  notifyOnDownload?: boolean;
  onProgress?: (progress: number, statusText: string) => void;
}

export interface CreatedVaultResult {
  vault: VaultRecord;
  vaultId: string;
  secretKeyString: string;
  shareUrl: string;
  managementToken: string;
}

/**
 * Encrypts files client-side and creates a hosted Vault Share.
 * When Cloudflare R2 is configured, uploads directly to R2 via presigned URLs.
 */
export async function createEncryptedVault(options: CreateVaultOptions): Promise<CreatedVaultResult> {
  const { files, onProgress } = options;
  if (!files || files.length === 0) {
    throw new Error('Please select at least one file to create a Vault.');
  }

  onProgress?.(5, 'Generating 256-bit AES-GCM Vault Master Key...');
  const { key, secretString } = await generateVaultKey();

  let passwordHash: string | null = null;
  let passwordSalt: string | null = null;

  if (options.password && options.password.trim()) {
    onProgress?.(10, 'Hashing password verifier with PBKDF2...');
    const pwdRes = await hashPasswordForVault(options.password.trim());
    passwordHash = pwdRes.hash;
    passwordSalt = pwdRes.salt;
  }

  // Calculate expiration timestamp
  let expiresAt: number | null = null;
  if (options.expirationDays && options.expirationDays > 0) {
    expiresAt = Date.now() + options.expirationDays * 24 * 60 * 60 * 1000;
  }

  onProgress?.(15, 'Preparing file manifests and calculating checksums...');
  const filePayloads: Array<{
    filename: string;
    relativePath: string;
    size: number;
    mimeType: string;
    checksum: string;
  }> = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const rawPath =
      (file as unknown as { customPath?: string }).customPath ||
      (file.webkitRelativePath && file.webkitRelativePath.includes('/') ? file.webkitRelativePath : file.name);

    const buf = await file.arrayBuffer();
    const sha = await calculateSHA256(buf);

    filePayloads.push({
      filename: file.name,
      relativePath: rawPath,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      checksum: sha,
    });
  }

  const payload: VaultCreatePayload = {
    name: options.name || `Vault-${files.length}-files`,
    expiresAt,
    passwordHash,
    passwordSalt,
    downloadLimit: options.downloadLimit || null,
    allowPreview: options.allowPreview !== false,
    allowDownload: options.allowDownload !== false,
    notifyOnDownload: Boolean(options.notifyOnDownload),
    files: filePayloads,
  };

  onProgress?.(30, 'Registering secure Vault manifest...');

  let vault!: VaultRecord;
  let managementToken = '';
  let uploadUrls: Array<{ fileId: string; storageKey: string; uploadUrl: string }> = [];

  // Try serverless API first
  let useApi = false;
  if (typeof window !== 'undefined') {
    try {
      const response = await fetch('/api/vaults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        const data = (await response.json()) as VaultCreateResponse;
        vault = data.vault;
        managementToken = data.managementToken;
        uploadUrls = data.uploadUrls || [];
        useApi = true;
      }
    } catch {
      useApi = false;
    }
  }

  // Fallback to local-first storage manager
  if (!useApi) {
    const localRes = await VaultManager.createVault(payload);
    vault = localRes.vault;
    managementToken = localRes.managementToken;
    uploadUrls = localRes.uploadInstructions.map((ins) => ({
      fileId: ins.fileId,
      storageKey: ins.storageKey,
      uploadUrl: '',
    }));
  }

  // Encrypt and upload each file
  const totalFiles = files.length;
  for (let i = 0; i < totalFiles; i++) {
    const file = files[i];
    const instruction = uploadUrls[i];

    const currentPercent = 30 + Math.round(((i + 1) / totalFiles) * 65);
    onProgress?.(currentPercent, `Encrypting and uploading: ${file.name} (${i + 1}/${totalFiles})...`);

    const encryptedBlob = await encryptFileToBlob(file, key);

    // If presigned R2 upload URL is available, PUT directly to Cloudflare R2
    if (instruction?.uploadUrl && instruction.uploadUrl.startsWith('http')) {
      await fetch(instruction.uploadUrl, {
        method: 'PUT',
        body: encryptedBlob,
        headers: { 'Content-Type': 'application/octet-stream' },
      });
    } else {
      // Store in memory / local store
      await VaultManager.putFileBlob(instruction.storageKey, encryptedBlob);
    }
  }

  onProgress?.(100, 'Vault creation complete!');

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const shareUrl = `${origin}/v/${vault.id}#${secretString}`;

  return {
    vault,
    vaultId: vault.id,
    secretKeyString: secretString,
    shareUrl,
    managementToken,
  };
}

/**
 * Fetches public metadata of a Vault by its Vault ID.
 */
export async function getVaultMetadata(vaultId: string): Promise<VaultRecord> {
  if (typeof window !== 'undefined') {
    try {
      const response = await fetch(`/api/vaults/${vaultId}`);
      if (response.ok) {
        return (await response.json()) as VaultRecord;
      }
    } catch {
      // fallback
    }
  }
  return VaultManager.getVault(vaultId);
}

/**
 * Downloads and decrypts a specific file from a Vault.
 */
export async function downloadAndDecryptVaultFile(
  vaultId: string,
  fileItem: VaultFileItem,
  secretKeyString: string,
  password?: string,
  passwordSalt?: string
): Promise<File> {
  let pwdHash: string | undefined;
  if (password && passwordSalt) {
    const res = await hashPasswordForVault(password, passwordSalt);
    pwdHash = res.hash;
  }

  let encryptedBlob: Blob | null = null;

  // Try downloading via API / Presigned R2 URL
  if (typeof window !== 'undefined') {
    try {
      const authRes = await fetch(`/api/vaults/${vaultId}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: fileItem.id, passwordHash: pwdHash }),
      });

      if (authRes.ok) {
        const authData = await authRes.json();
        if (authData.downloadUrl) {
          const blobRes = await fetch(authData.downloadUrl);
          if (blobRes.ok) {
            encryptedBlob = await blobRes.blob();
          }
        }
      }
    } catch {
      // fallback
    }
  }

  // Fallback to local store
  if (!encryptedBlob) {
    const auth = await VaultManager.authorizeDownload(vaultId, fileItem.id, pwdHash);
    if (!auth.authorized || !auth.fileBlob) {
      throw new Error(auth.error || 'Unauthorized download.');
    }
    encryptedBlob = auth.fileBlob;
  }

  const key = await importVaultKey(secretKeyString);
  return decryptBlobToFile(encryptedBlob, key, fileItem.filename, fileItem.mimeType);
}

/**
 * Deletes a Vault and removes all objects using management token.
 */
export async function deleteVaultWithToken(vaultId: string, managementToken: string): Promise<boolean> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/vaults/${vaultId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-management-token': managementToken,
        },
      });
      if (res.ok) return true;
    } catch {
      // fallback
    }
  }
  return VaultManager.deleteVault(vaultId, managementToken);
}
