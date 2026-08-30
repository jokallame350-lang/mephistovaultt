import { describe, it, expect } from 'vitest';
import { VaultManager } from '../lib/vaultStore';
import { createEncryptedVault, getVaultMetadata, downloadAndDecryptVaultFile, deleteVaultWithToken } from '../lib/vaultApi';

describe('Vault Share Storage & API Integration Suite', () => {
  it('creates an encrypted Vault, stores encrypted blobs and allows offline decryption', async () => {
    const file1 = new File(['Contract PDF Content 2026'], 'contract.pdf', { type: 'application/pdf' });
    const file2 = new File(['Image Binary Data'], 'diagram.png', { type: 'image/png' });

    // 1. Create Vault
    const created = await createEncryptedVault({
      name: 'Client Project Alpha',
      files: [file1, file2],
      expirationDays: 7,
      downloadLimit: 10,
    });

    expect(created.vaultId).toBeDefined();
    expect(created.secretKeyString).toBeDefined();
    expect(created.shareUrl).toContain(`/v/${created.vaultId}#${created.secretKeyString}`);

    // 2. Fetch public metadata (as if recipient opens URL)
    const publicMeta = await getVaultMetadata(created.vaultId);
    expect(publicMeta.id).toBe(created.vaultId);
    expect(publicMeta.name).toBe('Client Project Alpha');
    expect(publicMeta.fileCount).toBe(2);
    expect(publicMeta.files.length).toBe(2);
    expect(publicMeta.status).toBe('active');
    expect(publicMeta.managementToken).toBeUndefined(); // Must not leak to recipient

    // 3. Recipient downloads and decrypts file1
    const decrypted1 = await downloadAndDecryptVaultFile(
      created.vaultId,
      publicMeta.files[0],
      created.secretKeyString
    );
    expect(decrypted1.name).toBe('contract.pdf');
    expect(await decrypted1.text()).toBe('Contract PDF Content 2026');

    // 4. Recipient downloads and decrypts file2
    const decrypted2 = await downloadAndDecryptVaultFile(
      created.vaultId,
      publicMeta.files[1],
      created.secretKeyString
    );
    expect(decrypted2.name).toBe('diagram.png');
    expect(await decrypted2.text()).toBe('Image Binary Data');
  });

  it('enforces download limits server-side and marks Vault limit reached', async () => {
    const testFile = new File(['One Time File'], 'secret.txt', { type: 'text/plain' });

    const created = await createEncryptedVault({
      name: 'Single Download Vault',
      files: [testFile],
      downloadLimit: 1, // Max 1 download
    });

    const meta = await getVaultMetadata(created.vaultId);

    // First download succeeds
    const downloaded = await downloadAndDecryptVaultFile(
      created.vaultId,
      meta.files[0],
      created.secretKeyString
    );
    expect(await downloaded.text()).toBe('One Time File');

    // Second download MUST fail because limit was 1
    await expect(
      downloadAndDecryptVaultFile(
        created.vaultId,
        meta.files[0],
        created.secretKeyString
      )
    ).rejects.toThrow();
  });

  it('enforces password protection on Vault download authorization', async () => {
    const testFile = new File(['Confidential Pass-Protected Data'], 'confidential.txt', { type: 'text/plain' });
    const password = 'SuperSecretVaultPassword!99';

    const created = await createEncryptedVault({
      name: 'Password Vault',
      files: [testFile],
      password,
    });

    const meta = await getVaultMetadata(created.vaultId);
    expect(meta.hasPassword).toBe(true);

    // Download with wrong password fails
    await expect(
      downloadAndDecryptVaultFile(
        created.vaultId,
        meta.files[0],
        created.secretKeyString,
        'WrongPassword123!',
        meta.passwordSalt || undefined
      )
    ).rejects.toThrow('Incorrect password.');

    // Download with correct password succeeds
    const downloaded = await downloadAndDecryptVaultFile(
      created.vaultId,
      meta.files[0],
      created.secretKeyString,
      password,
      meta.passwordSalt || undefined
    );
    expect(await downloaded.text()).toBe('Confidential Pass-Protected Data');
  });

  it('allows Vault deletion using management token and purges storage', async () => {
    const testFile = new File(['Delete Me'], 'temp.txt', { type: 'text/plain' });
    const created = await createEncryptedVault({
      name: 'Temporary Vault',
      files: [testFile],
    });

    // Delete with invalid token fails
    await expect(deleteVaultWithToken(created.vaultId, 'invalid-token-1234')).rejects.toThrow('Unauthorized');

    // Delete with valid token succeeds
    const success = await deleteVaultWithToken(created.vaultId, created.managementToken);
    expect(success).toBe(true);

    // Access after deletion fails
    await expect(getVaultMetadata(created.vaultId)).rejects.toThrow('deleted');
  });

  it('purges expired vaults automatically', async () => {
    const expiredPayload = {
      name: 'Expired Vault',
      expiresAt: Date.now() - 1000, // already expired in the past
      downloadLimit: null,
      allowPreview: true,
      allowDownload: true,
      notifyOnDownload: false,
      files: [{
        filename: 'old.txt',
        relativePath: 'old.txt',
        size: 10,
        mimeType: 'text/plain',
        checksum: '123456',
      }],
    };

    await VaultManager.createVault(expiredPayload);
    const purged = await VaultManager.purgeExpiredVaults();
    expect(purged).toBeGreaterThanOrEqual(1);
  });
});
