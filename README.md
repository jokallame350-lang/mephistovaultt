# 🛡️ MephistoVault — Zero-Trace, Peer-to-Peer Encrypted File Transfer & Ephemeral Privacy Drop

<p align="center">
  <a href="https://mephistoshares.online">
    <img src="public/favicon.png" alt="MephistoVault Logo" width="128" height="128" style="border-radius: 32px; box-shadow: 0 12px 36px rgba(16, 185, 129, 0.4);">
  </a>
</p>

<p align="center">
  <strong>The ultra-fast, serverless, browser-to-browser encrypted file sharing platform powered by WebRTC & AES-256-GCM.</strong><br>
  <em>No cloud storage. No file size limits. No accounts. Direct RAM-to-RAM streaming that burns on read without leaving a single trace.</em>
</p>

<p align="center">
  <a href="https://mephistoshares.online"><img src="https://img.shields.io/badge/Live_App-mephistoshares.online-10B981?style=for-the-badge&logo=google-chrome&logoColor=white" alt="Live Site"></a>
  <a href="https://github.com/jokallame350-lang/mephistovaultt"><img src="https://img.shields.io/badge/GitHub-Open_Source-blueviolet?style=for-the-badge&logo=github&logoColor=white" alt="Open Source"></a>
  <a href="https://mephistomail.site"><img src="https://img.shields.io/badge/Ecosystem-MephistoMail_Suite-EA580C?style=for-the-badge&logo=fastapi&logoColor=white" alt="Mephisto Suite"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="MIT License">
  <img src="https://img.shields.io/badge/Build-Passing-10B981?style=flat-square&logo=githubactions&logoColor=white" alt="Build Passing">
  <img src="https://img.shields.io/badge/Protocol-WebRTC_DataChannels-3178C6?style=flat-square&logo=webrtc&logoColor=white" alt="WebRTC">
  <img src="https://img.shields.io/badge/Cryptography-AES--256--GCM_%2B_PBKDF2-emerald?style=flat-square" alt="AES-256-GCM">
  <img src="https://img.shields.io/badge/Storage-0_Bytes_(RAM_Only)-red?style=flat-square" alt="0 Bytes Storage">
  <img src="https://img.shields.io/badge/File_Limit-UNLIMITED_(No_Cap)-purple?style=flat-square" alt="Unlimited">
  <img src="https://img.shields.io/badge/Languages-10_Supported_(RTL_Ready)-0284c7?style=flat-square" alt="10 Languages">
  <img src="https://img.shields.io/badge/React-19.2-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 19">
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind_CSS-4.2-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white" alt="Tailwind CSS">
</p>

---

## 🌟 Why MephistoVault?

In an era of centralized mass surveillance, third-party data scraping, and invasive cloud storage algorithms, **MephistoVault** establishes a new gold standard for **zero knowledge direct p2p** file sharing. 

Whether you need a **wormhole alternative** for instant transfers, a **snapdrop alternative open source** solution that works seamlessly across worldwide networks (WAN) without LAN limitations, or a **wetransfer alternative no limit** that refuses to hold your data hostage behind paywalls, MephistoVault delivers unmatched privacy, speed, and reliability.

- 🔒 **Zero Server Knowledge:** Files stream **RAM-to-RAM** directly between client browsers. Zero bytes are ever written to server hard drives or databases.
- ⚡ **Zero Speed Throttling:** Bypasses intermediate cloud servers entirely, running at the full line-speed of your local Wi-Fi or maximum ISP bandwidth (1+ Gbps).
- 🔥 **Burn on Read File Transfer:** Temporary memory buffers and WebRTC channels are zero-filled and permanently destroyed the millisecond a transfer concludes.
- 📱 **Universal Device Handoff:** Works effortlessly on iOS, Android, macOS, Windows, and Linux via any modern web browser without installing applications.

---

## 📸 Interface & Cyberpunk HUD Preview

<p align="center">
  <img src="public/og-image.png" alt="MephistoVault Cyberpunk Dashboard Interface" width="100%" style="border-radius: 14px; box-shadow: 0 20px 60px rgba(0,0,0,0.75);">
</p>

---

## 🛸 Feature Showcase & Capabilities

### 1. 🛸 Holographic Full-Screen Drag & Drop Zone with Cyberpunk HUD
Drag any file or folder anywhere over the browser window to activate the full-screen **holographic HUD overlay**. Engineered with real-time radial glow aesthetics, animated corner targeting reticles, radar sweep scanning lines, and drag-counter event listeners, dropping confidential files feels like interfacing with next-generation security hardware.

### 2. 📦 Multi-File Batch Queue with Automatic JSZip Stream Packaging
Queue dozens of files or drag entire nested folders at once. MephistoVault’s recursive `WebKitEntry` directory engine parses nested file trees and dynamically packages them into an in-memory **JSZip compressed archive** on-the-fly. Review, add, or remove individual items in the visual batch queue with live total payload size calculation before streaming.

### 3. 📊 Exponential Moving Average (EMA) Speed Meter & Dynamic ETA Countdown
Monitor transfers with telemetry-grade precision. Our adaptive transfer pipeline calculates instantaneous throughput and stabilizes readings using an **Exponential Moving Average ($0.35 \cdot \text{instant} + 0.65 \cdot \text{historical}$)** smoothing algorithm. Get flicker-free, accurate **MB/s metrics** accompanied by dynamic time-to-completion (ETA) countdowns and active shimmer indicators.

### 4. 🎵 Web Audio API In-Memory Sound FX (Zero Audio Assets)
Experience satisfying acoustic feedback without downloading external MP3/WAV files. MephistoVault features a built-in **Web Audio API synthesizer** that generates real-time audio waveforms purely from client RAM:
- **Peer Connection Chime:** 440 Hz $\rightarrow$ 880 Hz upward frequency sweep with a 1320 Hz triangle harmonic sparkle.
- **Transfer Complete Fanfare:** Arpeggiated Major 9th chord ($C_5 \rightarrow E_5 \rightarrow G_5 \rightarrow C_6 \rightarrow E_6$) with natural exponential gain decay.

### 5. 📲 1-Click Encrypted Room Sharing (WhatsApp, Telegram & X / Twitter)
Share confidential transfer rooms in seconds:
- **1-Click Social Triggers:** Dedicated direct-share launch buttons for **WhatsApp**, **Telegram**, **X (Twitter)**, and native system share sheets.
- **High Error Tolerance (Level H) QR Code:** Scan directly with iPhone / Android camera apps with built-in lightbox magnification and 1-click **1024x1024 HD PNG download**.
- **URL Hash Privacy:** Room secret keys are anchored inside the `#` URL hash fragment, ensuring encryption keys are **never transmitted in HTTP request headers** to signaling servers.

### 6. 🌍 10-Language Matrix with Zero Leakage
MephistoVault provides complete localized UI interfaces across **10 major languages** with bidirectional support:
- 🇬🇧 **English** (en)
- 🇹🇷 **Türkçe** (tr)
- 🇩🇪 **Deutsch** (de)
- 🇪🇸 **Español** (es)
- 🇫🇷 **Français** (fr)
- 🇮🇹 **Italiano** (it)
- 🇵🇹 **Português** (pt)
- 🇷🇺 **Русский** (ru)
- 🇸🇦 **العربية** (ar — Full Native RTL Layout)
- 🇨🇳 **中文** (zh)

### 7. 🛡️ In-Browser Sandbox Inspector & Security Scoring
Every incoming file undergoes client-side heuristic inspection before being saved:
- **Unicode RTLO Spoofing Detection:** Catches Right-to-Left Override characters used to disguise dangerous file extensions (e.g., `invoice\u202Egpj.exe`).
- **Double Extension Detection:** Flags deceptive files like `document.pdf.exe`.
- **MIME & Executable Binary Heuristics:** Evaluates risk profiles and displays clean safety scores before file execution.
- **SHA-256 Checksum Matching:** Computes and verifies cryptographic hashes for end-to-end data integrity.

### 8. 💾 Disk-Free Ephemeral Memory Vault
Need to inspect or hold a sensitive document without leaving traces on your local solid-state drive (SSD)? Save received files directly into the **in-memory browser vault**. Keep files volatile in RAM and purge them completely whenever you close the tab.

### 9. 💬 Phantom E2E Chat & Real-Time Collaborative Scratchpad
Communicate securely alongside your transfers:
- **Phantom Chat:** Ephemeral browser-to-browser chat encrypted with AES-256-GCM. All history is wiped on disconnect.
- **Live Scratchpad:** Real-time synchronized text and code editor to securely share API keys, environment variables, or private passwords.

### 10. 📸 In-RAM Instant Snap & Screen Capture
Capture webcam frames or desktop screens directly into browser RAM and transmit them instantly without saving temporary images to your hard drive.

---

## 📊 High-Converting Comparison Matrix

See how **MephistoVault** outperforms traditional cloud storage providers and legacy transfer tools:

| Feature / Metric | 🛡️ MephistoVault | 📦 WeTransfer | ☁️ Google Drive | 🕳️ Wormhole | 📡 Snapdrop |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Server Storage Footprint** | **0 Bytes (RAM Only)** | 100% Cloud Disk | 100% Cloud Disk | Cloud Staged | 0 Bytes |
| **Max File Size Limit** | **UNLIMITED (No Cap)** | 2 GB Free Cap | 15 GB Free Cap | 5 GB Cap | Browser RAM Limit |
| **Transfer Architecture** | **Direct WebRTC P2P** | Centralized Upload | Centralized Cloud | Hybrid Relay | WebRTC Local Subnet |
| **Worldwide WAN Support** | **Global (STUN/TURN)** | Yes (Via Server) | Yes (Via Server) | Yes (Via Server) | Local Wi-Fi Only |
| **End-to-End Encryption** | **AES-256-GCM + PBKDF2** | ❌ Server-Side Only | ❌ Server-Side Only | ✅ E2E Encrypted | ⚠️ DTLS Transport Only |
| **Burn-on-Read Auto Purge** | **Instant (Zero Trace)** | ❌ 7 Days on Disk | ❌ Permanent Storage | ⏱️ 24 Hours | ❌ No Auto Purge |
| **Account / Sign-up Required** | **NO (100% Anonymous)** | Optional / Email | ⚠️ Google Account | ❌ No | ❌ No |
| **Mobile QR Camera Scan** | **Native Camera Link** | ❌ No | ❌ App Required | ❌ No | ⚠️ Local Discovery |
| **Batch Folder Archiving** | **In-Memory JSZip Stream** | Server Zip | Manual Upload | Manual Upload | Single File Only |
| **Synthesized Audio FX** | **Pure Web Audio API** | ❌ None | ❌ None | ❌ None | ❌ None |
| **Multi-Language Matrix** | **10 Languages + RTL** | Limited | Multi-language | English Only | Limited |
| **Open Source & Self-Hostable**| **100% MIT License** | ❌ Proprietary | ❌ Proprietary | ⚠️ Partial | ✅ Open Source |

---

## 🏗️ Technical Architecture & Cryptographic Workflow

MephistoVault relies on the W3C standard **Web Crypto API** (`crypto.subtle`) combined with peer-to-peer **WebRTC DataChannels** to establish an untraceable, serverless transmission pipeline.

```
                    ┌─────────────────────────────────────────────────────────┐
                    │               SENDER BROWSER (RAM)                      │
                    │  • CSPRNG Session Key Derivation (PBKDF2-SHA256, 100k)  │
                    │  • 64KB ArrayBuffer Slicing & AES-256-GCM Encryption    │
                    │  • Adaptive WebRTC Backpressure Throttling (256KB cap)  │
                    └────────────────────────────┬────────────────────────────┘
                                                 │
                   ┌─────────────────────────────┴─────────────────────────────┐
                   │                                                           │
      [1] Ephemeral Signaling Handshake                           [2] Direct RAM-to-RAM Tunnel
     (Stateless SDP/ICE Session Exchange)                        (Encrypted WebRTC DataChannel)
                   │                                                           │
                   ▼                                                           │
     ┌───────────────────────────┐                                             │
     │   Stateless WebRTC Relay  │                                             │
     │  • Zero File Data / No DB │                                             │
     │  • Zero Logs / No Disk    │                                             │
     └─────────────┬─────────────┘                                             │
                   │                                                           │
                   └─────────────────────────────┬─────────────────────────────┘
                                                 │
                                                 ▼
                    ┌─────────────────────────────────────────────────────────┐
                    │              RECEIVER BROWSER (RAM)                     │
                    │  • In-Memory AES-256-GCM Chunk Decryption               │
                    │  • SHA-256 Stream Hash Integrity Verification           │
                    │  • Zero-Fill RAM Purge & Connection Self-Destruction    │
                    └─────────────────────────────────────────────────────────┘
```

### Cryptographic Lifecycle:
1. **Key Generation:** When a sender opens a room, an ephemeral code is generated. The encryption key is derived using **PBKDF2** (`100,000` iterations of SHA-256) with a unique cryptographic salt.
2. **Channel Establishment:** WebRTC signaling exchanges SDP offers and ICE candidates through a stateless WebSocket relay. No payload data ever enters the signaling pipeline.
3. **Chunked Pipeline Streaming:** Files are partitioned into **64KB binary chunks**. Each chunk is encrypted with a unique 96-bit Initialization Vector (IV) via **AES-256-GCM**, providing both confidentiality and cryptographic authentication.
4. **Backpressure Flow Control:** The sender continuously queries `dataChannel.bufferedAmount`. If the buffer exceeds 256KB, transmission yields to prevent packet dropping and browser tab memory crashes.
5. **Reassembly & Zero-Trace Wipe:** The receiver decrypts incoming chunks into volatile memory buffers. As soon as the file download triggers or the session expires, buffers are wiped with zeroes and the cryptographic key is dereferenced.

---

## ⚡ High-Converting Keyword Pool & Use Cases

MephistoVault solves mission-critical privacy challenges across diverse sectors:

- **Ultra-Fast P2P File Transfer:** Send multi-gigabyte ISOs, raw video shoots, and 3D assets without server upload bottlenecks.
- **Next-Gen WebRTC File Sharing:** Transfer documents securely between computers on different networks behind symmetric NATs via STUN/TURN traversal.
- **E2E Encrypted Share:** Send sensitive financial statements, medical records, and legal briefs protected by client-side AES-256-GCM cryptography.
- **Burn on Read File Transfer:** Protect confidential whistleblowing drops, trade secrets, and API credentials with automated post-download data purges.
- **Modern Wormhole Alternative:** Experience lightning-fast, zero-registration browser transfers with real-time ETA countdowns and live audio feedback.
- **Snapdrop Alternative Open Source:** Seamlessly share files between iOS, Android, macOS, and Windows devices without being restricted to the same local Wi-Fi router.
- **WeTransfer Alternative No Limit:** Bypass 2GB free caps and bandwidth throttling with unlimited, zero-cost peer-to-peer streaming.
- **Zero Knowledge Direct P2P:** Maintain total cryptographic sovereignty with zero logging, zero telemetry, and zero tracking.

---

## 🚀 Quick Start & Local Setup

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **Package Manager**: `npm`, `yarn`, or `pnpm`

### Installation & Development

```bash
# 1. Clone the repository
git clone https://github.com/jokallame350-lang/mephistovaultt.git

# 2. Navigate to project root
cd mephistovaultt

# 3. Install project dependencies
npm install

# 4. Start local development server (Vite + React 19)
npm run dev
```

Visit `http://localhost:5173` in your browser.

### Production Build

```bash
# Type-check and compile optimized static distribution
npm run build

# Preview production build locally
npm run preview
```

---

## 🌐 The Mephisto Open-Source Privacy Suite

MephistoVault is an integral component of the **Mephisto Privacy Ecosystem**:

- 🛡️ **[MephistoVault](https://mephistoshares.online)** — Zero-trace, serverless P2P encrypted file sharing & ephemeral privacy drop.
- 📧 **[MephistoMail](https://mephistomail.site)** — Next-generation RAM-only disposable email shield with 1-second OTP verification.
- 🧹 **[MephistoCleaner](https://github.com/jokallame350-lang/mephistocleaner)** — 150+ toggle Windows 10/11 system optimizer, telemetry disabler & privacy debloater.
- 🌐 **[Mephisto Translate](https://github.com/jokallame350-lang/translation)** — Instant on-screen floating HUD translator for multi-language workflows.

---

## 🛡️ Security, Privacy & Responsible Disclosure

- **Pure Client-Side Cryptography:** All cryptographic calculations execute strictly within the browser's execution sandbox using native W3C Web Cryptography primitives.
- **Zero Telemetry:** MephistoVault collects zero telemetry, zero analytics, zero cookies, and zero IP access logs.
- **Responsible Disclosure:** If you discover a potential vulnerability, please report it directly to our security maintainers at **[jokallame0@gmail.com](mailto:jokallame0@gmail.com)**.

---

## 👤 Author & Maintainer

Engineered with precision by **Mert Can Yıldız**.

- 🐙 **GitHub:** [@jokallame350-lang](https://github.com/jokallame350-lang)
- ✉️ **Email:** [jokallame0@gmail.com](mailto:jokallame0@gmail.com)
- 🚀 **Live Platform:** [https://mephistoshares.online](https://mephistoshares.online)

---

## ⭐ Star History

If you believe in open-source, private, decentralized file sharing, please support us by **starring this repository**! ⭐

<p align="center">
  <a href="https://github.com/jokallame350-lang/mephistovaultt">
    <img src="https://api.star-history.com/svg?repos=jokallame350-lang/mephistovaultt&type=Date" alt="MephistoVault Star History Chart" width="80%">
  </a>
</p>

---

<p align="center">
  Released under the <strong>MIT License</strong>. Copyright © 2026 <strong>MephistoVault</strong>.
</p>
