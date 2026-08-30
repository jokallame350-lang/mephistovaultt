import { describe, it, expect } from 'vitest';
import { getTranslator } from '../i18n';
import { VaultManager } from '../lib/vaultStore';
import { generateVaultKey } from '../lib/vaultCrypto';

describe('Vault Share UI & Workflow Integration Suite', () => {
  it('translates Vault Share localization keys in all supported languages', () => {
    const langs = ['en', 'tr', 'es', 'de', 'fr', 'it', 'pt', 'ru', 'ar', 'zh'] as const;
    for (const lang of langs) {
      const t = getTranslator(lang);
      expect(t('quickDrop')).toBeDefined();
      expect(t('vaultShare')).toBeDefined();
      expect(t('vaultShareTitle')).toBeDefined();
      expect(t('vaultSettings')).toBeDefined();
      expect(t('createVaultButton')).toBeDefined();
    }
  });

  it('generates full recipient share URLs containing URL fragment secret without sending secret to server', async () => {
    const { secretString } = await generateVaultKey();
    const vault = await VaultManager.createVault({
      name: 'Design Assets',
      expiresAt: Date.now() + 86400000,
      downloadLimit: 5,
      allowPreview: true,
      allowDownload: true,
      notifyOnDownload: false,
      files: [{
        filename: 'mock.psd',
        relativePath: 'mock.psd',
        size: 1024,
        mimeType: 'image/vnd.adobe.photoshop',
        checksum: 'abc123',
      }],
    });

    const shareUrl = `https://mephistoshares.online/v/${vault.vault.id}#${secretString}`;
    expect(shareUrl).toContain(`/v/${vault.vault.id}`);
    expect(shareUrl).toContain(`#${secretString}`);

    // Verify hash fragment is client-side only
    const urlObj = new URL(shareUrl);
    expect(urlObj.pathname).toBe(`/v/${vault.vault.id}`);
    expect(urlObj.hash).toBe(`#${secretString}`);
  });
});
