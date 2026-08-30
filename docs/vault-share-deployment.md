# 🚀 MephistoVault — Vault Share Deployment Guide

This guide describes how to configure and deploy the hosted **☁️ Vault Share** infrastructure alongside **⚡ Quick Drop**.

---

## 1. Storage & Database Prerequisites

MephistoVault's Vault Share backend is compatible with any S3-compliant object storage provider:
- **Cloudflare R2** (Zero egress fees — Recommended)
- **AWS S3**
- **Supabase Storage**
- **MinIO / Local Object Storage**

---

## 2. Production Environment Variables

Add the following environment variables to your deployment provider (e.g. Vercel Project Settings -> Environment Variables):

```bash
# Storage Configuration (Cloudflare R2 / AWS S3)
STORAGE_PROVIDER="r2"
R2_ACCOUNT_ID="your_cloudflare_account_id"
R2_ACCESS_KEY_ID="your_r2_access_key"
R2_SECRET_ACCESS_KEY="your_r2_secret_key"
R2_BUCKET_NAME="mephistovault-blobs"
R2_PUBLIC_DOMAIN="https://vault-storage.mephistoshares.online"

# Security & Global Limits
MAX_VAULT_FILE_SIZE_MB=2048
MAX_TOTAL_VAULT_SIZE_MB=10240
MAX_VAULT_EXPIRATION_DAYS=90
RATE_LIMIT_VAULT_CREATIONS_PER_HOUR=20
```

---

## 3. Storage Bucket CORS Configuration

Ensure your S3/R2 storage bucket has the following CORS policy to permit direct, secure in-browser encrypted uploads and downloads:

```json
[
  {
    "AllowedOrigins": [
      "https://mephistoshares.online",
      "https://www.mephistoshares.online",
      "http://localhost:5173"
    ],
    "AllowedMethods": ["GET", "PUT", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Length"],
    "MaxAgeSeconds": 3600
  }
]
```

---

## 4. Local Development & Testing

In local development and test environments, MephistoVault includes an automatic **Local-First Mock Storage Engine** (`src/lib/vaultStore.ts`), allowing full E2E encryption, upload, download, and limit testing with zero external cloud dependencies.

To run tests:
```bash
npm test
```

To run development server:
```bash
npm run dev
```
