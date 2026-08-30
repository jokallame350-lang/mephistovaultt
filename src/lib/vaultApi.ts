/**
 * MephistoVault — Vault Share Client API SDK
 * Orchestrates client-side encryption, uploading, progress monitoring, and downloading.
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
import type { VaultRecord, VaultCreatePayload, VaultFileItem } from '../types/vault';

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
  const { vault, managementToken, uploadInstructions } = await VaultManager.createVault(payload);

  // Encrypt and upload each file
  const totalFiles = files.length;
  for (let i = 0; i < totalFiles; i++) {
    const file = files[i];
    const instruction = uploadInstructions[i];

    const currentPercent = 30 + Math.round(((i + 1) / totalFiles) * 65);
    onProgress?.(currentPercent, `Encrypting and uploading: ${file.name} (${i + 1}/${totalFiles})...`);

    const encryptedBlob = await encryptFileToBlob(file, key);
    await VaultManager.putFileBlob(instruction.storageKey, encryptedBlob);
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

  const auth = await VaultManager.authorizeDownload(vaultId, fileItem.id, pwdHash);
  if (!auth.authorized || !auth.fileBlob) {
    throw new Error(auth.error || 'Unauthorized download.');
  }

  const key = await importVaultKey(secretKeyString);
  return decryptBlobToFile(auth.fileBlob, key, fileItem.filename, fileItem.mimeType);
}

/**
 * Deletes a Vault and removes all objects using management token.
 */
export async function deleteVaultWithToken(vaultId: string, managementToken: string): Promise<boolean> {
  return VaultManager.deleteVault(vaultId, managementToken);
}
