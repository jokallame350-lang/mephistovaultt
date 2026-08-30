/**
 * MephistoVault — Hosted Vault Storage & State Manager
 * Provides server-side & local-first storage management,
 * enforcing expiration, download limits, password authorization, and deletion.
 */

import type { VaultRecord, VaultCreatePayload, VaultFileItem, VaultAccessLog } from '../types/vault';

/** Configurable Global Limits */
export const VAULT_LIMITS = {
  MAX_FILES_PER_VAULT: 500,
  MAX_VAULT_TOTAL_SIZE_BYTES: 10 * 1024 * 1024 * 1024, // 10 GB
  MAX_FILENAME_LENGTH: 255,
  MAX_FOLDER_DEPTH: 20,
  DEFAULT_EXPIRATION_HOURS: 72, // 3 days default
  MAX_EXPIRATION_DAYS: 90,
  MANAGEMENT_TOKEN_BYTES: 32,
};

// In-Memory / Local Storage Store for Serverless & Client mock
const vaultDatabase = new Map<string, VaultRecord>();
const vaultBlobStorage = new Map<string, Blob>();
const vaultAccessLogs = new Map<string, VaultAccessLog[]>();

/**
 * Generate a random cryptographically secure token.
 */
export function generateRandomToken(bytesLength = 16): string {
  const bytes = crypto.getRandomValues(new Uint8Array(bytesLength));
  let token = '';
  for (let i = 0; i < bytes.length; i++) {
    token += bytes[i].toString(16).padStart(2, '0');
  }
  return token;
}

/**
 * Generate a clean, readable Vault ID (e.g. "v-9a7f-4b12").
 */
export function generateVaultId(): string {
  const token = generateRandomToken(6);
  return `v-${token.slice(0, 4)}-${token.slice(4, 8)}`;
}

export class VaultManager {
  /**
   * Create a new Vault record with files metadata.
   */
  public static async createVault(payload: VaultCreatePayload): Promise<{
    vault: VaultRecord;
    managementToken: string;
    uploadInstructions: Array<{ fileId: string; storageKey: string }>;
  }> {
    if (!payload.files || payload.files.length === 0) {
      throw new Error('Vault must contain at least one file.');
    }

    if (payload.files.length > VAULT_LIMITS.MAX_FILES_PER_VAULT) {
      throw new Error(`File count exceeds limit of ${VAULT_LIMITS.MAX_FILES_PER_VAULT} files.`);
    }

    const totalSize = payload.files.reduce((sum, f) => sum + f.size, 0);
    if (totalSize > VAULT_LIMITS.MAX_VAULT_TOTAL_SIZE_BYTES) {
      throw new Error(`Total Vault size exceeds maximum limit of 10 GB.`);
    }

    const vaultId = generateVaultId();
    const managementToken = generateRandomToken(VAULT_LIMITS.MANAGEMENT_TOKEN_BYTES);
    const now = Date.now();

    const vaultFiles: VaultFileItem[] = payload.files.map((file, idx) => {
      const fileId = `file-${idx + 1}-${generateRandomToken(4)}`;
      const storageKey = `vaults/${vaultId}/${fileId}`;
      return {
        id: fileId,
        vaultId,
        filename: file.filename.slice(0, VAULT_LIMITS.MAX_FILENAME_LENGTH),
        relativePath: file.relativePath,
        size: file.size,
        mimeType: file.mimeType || 'application/octet-stream',
        checksum: file.checksum,
        storageKey,
        createdAt: now,
      };
    });

    const vaultRecord: VaultRecord = {
      id: vaultId,
      name: payload.name || `Vault-${vaultId.toUpperCase()}`,
      createdAt: now,
      expiresAt: payload.expiresAt,
      status: 'active',
      hasPassword: Boolean(payload.passwordHash),
      passwordSalt: payload.passwordSalt || null,
      passwordHash: payload.passwordHash || null,
      downloadLimit: payload.downloadLimit,
      downloadCount: 0,
      allowPreview: payload.allowPreview !== false,
      allowDownload: payload.allowDownload !== false,
      notifyOnDownload: Boolean(payload.notifyOnDownload),
      fileCount: vaultFiles.length,
      totalSize,
      managementToken,
      files: vaultFiles,
    };

    vaultDatabase.set(vaultId, vaultRecord);
    vaultAccessLogs.set(vaultId, [
      {
        id: generateRandomToken(8),
        vaultId,
        eventType: 'created',
        createdAt: now,
        anonymousIdentifier: 'creator',
      },
    ]);

    // Save to LocalStorage for guest creator persistence
    if (typeof localStorage !== 'undefined') {
      try {
        const myVaults = JSON.parse(localStorage.getItem('ms-my-vaults') || '[]');
        myVaults.unshift({
          id: vaultId,
          name: vaultRecord.name,
          createdAt: now,
          expiresAt: vaultRecord.expiresAt,
          managementToken,
          fileCount: vaultRecord.fileCount,
          totalSize: vaultRecord.totalSize,
        });
        localStorage.setItem('ms-my-vaults', JSON.stringify(myVaults.slice(0, 50)));
      } catch {
        // ignore storage error
      }
    }

    const uploadInstructions = vaultFiles.map((f) => ({
      fileId: f.id,
      storageKey: f.storageKey,
    }));

    return {
      vault: vaultRecord,
      managementToken,
      uploadInstructions,
    };
  }

  /**
   * Upload encrypted file blob to storage.
   */
  public static async putFileBlob(storageKey: string, encryptedBlob: Blob): Promise<void> {
    vaultBlobStorage.set(storageKey, encryptedBlob);
  }

  /**
   * Get encrypted file blob from storage.
   */
  public static async getFileBlob(storageKey: string): Promise<Blob | null> {
    return vaultBlobStorage.get(storageKey) || null;
  }

  /**
   * Fetch public metadata for a Vault, enforcing expiration and limit checks.
   */
  public static async getVault(vaultId: string): Promise<VaultRecord> {
    const vault = vaultDatabase.get(vaultId);
    if (!vault || vault.status === 'deleted') {
      throw new Error('Vault not found or has been deleted.');
    }

    const now = Date.now();

    // Check server-side expiration
    if (vault.expiresAt && now > vault.expiresAt) {
      vault.status = 'expired';
      throw new Error('This Vault has expired and is no longer accessible.');
    }

    // Check server-side download limit
    if (vault.downloadLimit && vault.downloadCount >= vault.downloadLimit) {
      vault.status = 'download_limit_reached';
      throw new Error('This Vault has reached its maximum download limit.');
    }

    // Return sanitized public record (omit managementToken and passwordHash)
    return {
      ...vault,
      managementToken: undefined,
      passwordHash: undefined,
    };
  }

  /**
   * Authorize and increment download count.
   */
  public static async authorizeDownload(
    vaultId: string,
    fileId?: string,
    passwordHashProvided?: string
  ): Promise<{ authorized: boolean; fileBlob?: Blob; error?: string }> {
    const vault = vaultDatabase.get(vaultId);
    if (!vault || vault.status === 'deleted') {
      return { authorized: false, error: 'Vault not found or deleted.' };
    }

    const now = Date.now();
    if (vault.expiresAt && now > vault.expiresAt) {
      vault.status = 'expired';
      return { authorized: false, error: 'Vault has expired.' };
    }

    if (vault.downloadLimit && vault.downloadCount >= vault.downloadLimit) {
      vault.status = 'download_limit_reached';
      return { authorized: false, error: 'Download limit exceeded.' };
    }

    if (vault.hasPassword) {
      if (!passwordHashProvided || passwordHashProvided !== vault.passwordHash) {
        return { authorized: false, error: 'Incorrect password.' };
      }
    }

    // Increment download count
    vault.downloadCount++;
    if (vault.downloadLimit && vault.downloadCount >= vault.downloadLimit) {
      vault.status = 'download_limit_reached';
    }

    // Record access event
    const logs = vaultAccessLogs.get(vaultId) || [];
    logs.push({
      id: generateRandomToken(8),
      vaultId,
      eventType: 'download_completed',
      createdAt: now,
      anonymousIdentifier: 'recipient',
    });
    vaultAccessLogs.set(vaultId, logs);

    if (fileId) {
      const fileMeta = vault.files.find((f) => f.id === fileId);
      if (fileMeta) {
        const blob = await this.getFileBlob(fileMeta.storageKey);
        return { authorized: true, fileBlob: blob || undefined };
      }
    }

    return { authorized: true };
  }

  /**
   * Update Vault settings using management token.
   */
  public static async updateVault(
    vaultId: string,
    managementToken: string,
    updates: {
      name?: string;
      expiresAt?: number | null;
      downloadLimit?: number | null;
      allowPreview?: boolean;
      allowDownload?: boolean;
    }
  ): Promise<VaultRecord> {
    const vault = vaultDatabase.get(vaultId);
    if (!vault || vault.status === 'deleted') {
      throw new Error('Vault not found.');
    }

    if (vault.managementToken !== managementToken) {
      throw new Error('Unauthorized: Invalid management token.');
    }

    if (updates.name !== undefined) vault.name = updates.name;
    if (updates.expiresAt !== undefined) vault.expiresAt = updates.expiresAt;
    if (updates.downloadLimit !== undefined) vault.downloadLimit = updates.downloadLimit;
    if (updates.allowPreview !== undefined) vault.allowPreview = updates.allowPreview;
    if (updates.allowDownload !== undefined) vault.allowDownload = updates.allowDownload;

    return vault;
  }

  /**
   * Delete Vault and purge all associated storage objects.
   */
  public static async deleteVault(vaultId: string, managementToken: string): Promise<boolean> {
    const vault = vaultDatabase.get(vaultId);
    if (!vault) return false;

    if (vault.managementToken !== managementToken) {
      throw new Error('Unauthorized: Invalid management token.');
    }

    // Purge all storage blobs
    for (const f of vault.files) {
      vaultBlobStorage.delete(f.storageKey);
    }

    vault.status = 'deleted';
    vaultDatabase.delete(vaultId);
    vaultAccessLogs.delete(vaultId);

    // Remove from local storage
    if (typeof localStorage !== 'undefined') {
      try {
        const myVaults = JSON.parse(localStorage.getItem('ms-my-vaults') || '[]');
        const updated = myVaults.filter((v: { id: string }) => v.id !== vaultId);
        localStorage.setItem('ms-my-vaults', JSON.stringify(updated));
      } catch {
        // ignore
      }
    }

    return true;
  }

  /**
   * Clean expired vaults and purge abandoned storage.
   */
  public static async purgeExpiredVaults(): Promise<number> {
    let purgedCount = 0;
    const now = Date.now();
    for (const [id, vault] of vaultDatabase.entries()) {
      if ((vault.expiresAt && now > vault.expiresAt) || vault.status === 'deleted') {
        for (const f of vault.files) {
          vaultBlobStorage.delete(f.storageKey);
        }
        vaultDatabase.delete(id);
        vaultAccessLogs.delete(id);
        purgedCount++;
      }
    }
    return purgedCount;
  }
}
