# 🛡️ MephistoVault — Zero-Trace Peer-to-Peer Encrypted File Sharing

<p align="center">
  <strong>Fast, self-destructing, browser-to-browser P2P file transfers powered by WebRTC. No intermediate cloud servers, zero file size limits, zero logs.</strong>
</p>

<p align="center">
  <a href="https://mephistoshares.online"><img src="https://img.shields.io/badge/Live_Site-mephistoshares.online-EA580C?style=for-the-badge&logo=google-chrome&logoColor=white" alt="Live Site"></a>
  <a href="https://github.com/jokallame350-lang/temp-mailmephisto"><img src="https://img.shields.io/badge/Ecosystem-Mephisto_Suite-blueviolet?style=for-the-badge" alt="Mephisto Suite"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="MIT License">
  <img src="https://img.shields.io/badge/Protocol-WebRTC_P2P-3178C6?style=flat-square" alt="WebRTC P2P">
  <img src="https://img.shields.io/badge/Encryption-E2E_Encrypted-emerald?style=flat-square" alt="E2E Encrypted">
  <img src="https://img.shields.io/badge/Server_Storage-0_Bytes_(RAM_Only)-red?style=flat-square" alt="Zero Server Storage">
  <img src="https://img.shields.io/badge/Vite-5.0-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite 5">
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white" alt="Tailwind CSS">
</p>

---

## 🎯 What is MephistoVault?

Traditional file transfer services (WeTransfer, Google Drive, Dropbox) upload your sensitive files to central third-party servers where they are scanned, analyzed, and stored for days.

**MephistoVault completely eliminates the middleman:**
- 🔗 **Direct Browser-to-Browser Pipe:** Files stream straight from your device to the recipient's device via encrypted WebRTC channels (`PeerJS`).
- ☁️ **0 Bytes Server Storage:** Our server only facilitates the initial cryptographic handshake. Your actual files **never touch our servers**.
- ⏱️ **Instant Self-Destruction:** The moment either browser tab closes or the transfer finishes, the connection vanishes permanently.
- 📱 **QR Code Mobile Handoff:** Scan the on-screen QR code with your phone camera to transfer files instantly between PC and smartphone without installing apps.
- 📦 **Zip Archive Packaging:** Multi-file drag-and-drop auto-bundled via client-side `JSZip`.

---

## 📸 How It Works

```
  [Sender Browser] ── (Direct Encrypted WebRTC Stream) ──► [Receiver Browser]
         │                                                        │
         └─────────────► [Signaling Relay (0 File Data)] ◄────────┘
```

1. **Select Files:** Drop any document, image, 4K video, or archive.
2. **Share 6-Digit Code / QR:** Give the recipient your unique room code or let them scan the QR code.
3. **Instant Transfer:** Watch the real-time progress bar stream at full network bandwidth.

---

## 🚀 Quickstart & Local Development

### Prerequisites
- Node.js 18+ & npm

```bash
# 1. Clone repository
git clone https://github.com/jokallame350-lang/mephistovaultt.git
cd mephistovaultt

# 2. Install dependencies
npm install

# 3. Start local development server
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 👤 Creator & Community

Maintained with ❤️ by **Mert Can Yıldız** ([@jokallame350-lang](https://github.com/jokallame350-lang))  
Contact: [jokallame0@gmail.com](mailto:jokallame0@gmail.com) · [mephistoshares.online](https://mephistoshares.online)

---

## ⭐ Star MephistoVault

If you love private, decentralized file sharing, give us a **Star** on GitHub! ⭐
