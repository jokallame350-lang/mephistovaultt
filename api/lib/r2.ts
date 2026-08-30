import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { VaultRecord } from '../../src/types/vault';

const isR2Configured = Boolean(
  process.env.R2_ACCOUNT_ID &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  process.env.R2_BUCKET_NAME
);

export function getR2Client(): S3Client | null {
  if (!isR2Configured) return null;

  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

export function getBucketName(): string {
  return process.env.R2_BUCKET_NAME || 'mephistovault-blobs';
}

/**
 * Generate a presigned PUT upload URL for an encrypted blob directly to Cloudflare R2.
 */
export async function createPresignedUploadUrl(
  storageKey: string,
  contentType = 'application/octet-stream',
  expiresInSeconds = 3600
): Promise<string | null> {
  const client = getR2Client();
  if (!client) return null;

  const command = new PutObjectCommand({
    Bucket: getBucketName(),
    Key: storageKey,
    ContentType: contentType,
  });

  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/**
 * Generate a presigned GET download URL for an encrypted blob directly from Cloudflare R2.
 */
export async function createPresignedDownloadUrl(
  storageKey: string,
  expiresInSeconds = 900 // 15 minutes
): Promise<string | null> {
  const client = getR2Client();
  if (!client) return null;

  const command = new GetObjectCommand({
    Bucket: getBucketName(),
    Key: storageKey,
  });

  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/**
 * Delete a specific object from Cloudflare R2.
 */
export async function deleteObjectFromR2(storageKey: string): Promise<boolean> {
  const client = getR2Client();
  if (!client) return false;

  try {
    const command = new DeleteObjectCommand({
      Bucket: getBucketName(),
      Key: storageKey,
    });
    await client.send(command);
    return true;
  } catch (err) {
    console.error(`Failed to delete object ${storageKey} from R2:`, err);
    return false;
  }
}

/**
 * Purge all objects under a Vault prefix (e.g. vaults/v-1234/) from Cloudflare R2.
 */
export async function purgeVaultFromR2(vaultId: string): Promise<boolean> {
  const client = getR2Client();
  if (!client) return false;

  const prefix = `vaults/${vaultId}/`;
  try {
    const listCommand = new ListObjectsV2Command({
      Bucket: getBucketName(),
      Prefix: prefix,
    });
    const listed = await client.send(listCommand);

    if (listed.Contents && listed.Contents.length > 0) {
      for (const item of listed.Contents) {
        if (item.Key) {
          await deleteObjectFromR2(item.Key);
        }
      }
    }
    // Also delete metadata object
    await deleteObjectFromR2(`meta/${vaultId}.json`);
    return true;
  } catch (err) {
    console.error(`Failed to purge vault ${vaultId} from R2:`, err);
    return false;
  }
}

/**
 * Save Vault metadata as a JSON document in R2 or fallback.
 */
export async function saveVaultMetaToR2(vault: VaultRecord): Promise<void> {
  const client = getR2Client();
  if (!client) return;

  const metaKey = `meta/${vault.id}.json`;
  const jsonString = JSON.stringify(vault);

  const command = new PutObjectCommand({
    Bucket: getBucketName(),
    Key: metaKey,
    Body: jsonString,
    ContentType: 'application/json',
  });

  await client.send(command);
}

/**
 * Load Vault metadata JSON from R2.
 */
export async function loadVaultMetaFromR2(vaultId: string): Promise<VaultRecord | null> {
  const client = getR2Client();
  if (!client) return null;

  const metaKey = `meta/${vaultId}.json`;
  try {
    const command = new GetObjectCommand({
      Bucket: getBucketName(),
      Key: metaKey,
    });
    const response = await client.send(command);
    if (!response.Body) return null;

    const bodyString = await response.Body.transformToString();
    return JSON.parse(bodyString) as VaultRecord;
  } catch {
    return null;
  }
}
