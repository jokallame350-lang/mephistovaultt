# ☁️ MephistoVault — Dual Product & Vault Share Architecture

MephistoVault delivers two distinct, decoupled products in a single unified interface:

1. **⚡ Quick Drop** (P2P Ephemeral WebRTC Direct Transfer)
2. **☁️ Vault Share** (Client-Side Encrypted Hosted Vaults with Offline Sender Capability)

---

## 1. Product Modes Comparison

| Feature | ⚡ Quick Drop (P2P) | ☁️ Vault Share (Hosted) |
| :--- | :--- | :--- |
| **Transfer Mechanism** | WebRTC DataChannel (Direct P2P) | Hosted Encrypted Object Storage (R2/S3) |
| **Sender Online Requirement** | Sender **must** remain online during transfer | Sender can upload and **immediately go offline** |
| **Storage Dependency** | **Zero server storage** (100% ephemeral) | Encrypted blobs with server-side expiration |
| **Encryption Model** | AES-256-GCM + WebRTC DTLS in memory | AES-256-GCM client-side before upload |
| **Key Distribution** | URL hash fragment / QR / PIN code | URL hash fragment (`/v/:id#VAULT_KEY`) |
| **Access Controls** | Ephemeral PIN + Burn on Read | Password, Expiration (24h–30d), Download Limit (1–100) |
| **Multi-File Packaging** | Zero-RAM Virtual TAR Stream / Folder Tree | Client-side encrypted individual & batch blobs |

---

## 2. Vault Share Cryptographic Architecture

```
[ Sender Browser ]
  1. Generate 256-bit AES-GCM Vault Key (K_vault)
  2. For each file:
     - Encrypt File -> [12-byte IV][Ciphertext + 16-byte Tag]
  3. (Optional) Password -> PBKDF2(Pass, Salt, 100k iter) -> PasswordHash
  4. POST /api/vaults (Metadata + PasswordHash)
  5. PUT Encrypted Blobs -> Object Storage
  6. Output Share URL: https://mephistoshares.online/v/{VAULT_ID}#{K_vault_base64url}
         │
         ▼
[ Recipient Browser ]
  1. Reads URL: /v/{VAULT_ID}
  2. Extracts Decryption Key from window.location.hash (Never sent to server)
  3. GET /api/vaults/{VAULT_ID} -> Checks server-side expiry & download limits
  4. (If password protected) Enter Password -> Authorize with server
  5. GET Encrypted Blob -> Object Storage
  6. In-Browser Decryption: decryptVaultBuffer(Blob, K_vault) -> Authentic File
```

---

## 3. Server-Side Security & Limits

- **Zero Plaintext Storage**: Storage buckets only hold AES-256-GCM encrypted binary blobs. Neither the server nor the storage provider ever holds or receives the decryption key.
- **Server-Side Expiration**: Expired vaults are rejected with `410 Expired` and automatically purged from storage.
- **Server-Side Download Limits**: Download limit counters are maintained atomically on the backend. When `download_count >= download_limit`, the vault is locked and purged.
- **Management Token**: Vault creators receive a 256-bit `managementToken` enabling them to delete or modify their guest vaults without requiring mandatory account creation.
