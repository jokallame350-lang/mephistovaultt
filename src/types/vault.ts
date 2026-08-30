export type VaultExpirationOption = '24h' | '3d' | '7d' | '30d' | 'custom' | 'never';

export type VaultDownloadLimitOption = 'unlimited' | 1 | 5 | 10 | 25 | 50 | 100;

export interface VaultFileItem {
  id: string;
  vaultId: string;
  filename: string;
  relativePath: string;
  size: number;
  mimeType: string;
  checksum: string;
  storageKey: string;
  createdAt: number;
}

export interface VaultRecord {
  id: string;
  ownerId?: string | null;
  name?: string;
  createdAt: number;
  expiresAt: number | null; // Unix ms timestamp or null for never
  status: 'active' | 'expired' | 'download_limit_reached' | 'deleted';
  hasPassword: boolean;
  passwordSalt?: string | null;
  passwordHash?: string | null;
  downloadLimit: number | null; // null = unlimited
  downloadCount: number;
  allowPreview: boolean;
  allowDownload: boolean;
  notifyOnDownload: boolean;
  fileCount: number;
  totalSize: number;
  managementToken?: string; // Token required to manage/delete the vault
  files: VaultFileItem[];
}

export interface VaultCreatePayload {
  name?: string;
  expiresAt: number | null;
  passwordHash?: string | null;
  passwordSalt?: string | null;
  downloadLimit: number | null;
  allowPreview: boolean;
  allowDownload: boolean;
  notifyOnDownload: boolean;
  files: Array<{
    filename: string;
    relativePath: string;
    size: number;
    mimeType: string;
    checksum: string;
  }>;
}

export interface VaultCreateResponse {
  vault: VaultRecord;
  managementToken: string;
  uploadUrls: Array<{
    fileId: string;
    storageKey: string;
    uploadUrl: string;
  }>;
}

export interface VaultDownloadAuthResponse {
  authorized: boolean;
  downloadUrl?: string;
  storageKey?: string;
  expiresInSeconds?: number;
  error?: string;
}

export interface VaultAccessLog {
  id: string;
  vaultId: string;
  eventType: 'created' | 'opened' | 'download_started' | 'download_completed' | 'deleted' | 'expired';
  createdAt: number;
  anonymousIdentifier: string;
}
