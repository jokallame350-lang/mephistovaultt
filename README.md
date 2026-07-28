# 🔐 MephistoVault — Zero-Trace Encrypted File Transfer

![License](https://img.shields.io/badge/license-MIT-blue.svg) ![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue) ![React](https://img.shields.io/badge/React-19-61DAFB) ![Vite](https://img.shields.io/badge/Vite-7.0-646CFF) ![WebRTC](https://img.shields.io/badge/WebRTC-P2P-green)

> **"Your files. Your rules. Zero traces."**

MephistoVault is a **military-grade, end-to-end encrypted** peer-to-peer file transfer tool designed for professionals who demand absolute privacy. Files never touch any server — they travel directly between devices via **WebRTC**, encrypted with a unique session PIN. After transfer, all data self-destructs from memory. No logs. No cloud. No evidence.

🌐 **Live:** [mephistoshares.online](https://mephistoshares.online)

---

## 🚀 Other Projects by Mephisto

| Project | Description | Links |
|---------|-------------|-------|
| **MephistoMail** | Privacy-first disposable email service with RAM-only architecture | [🌐 Site](https://mephistomail.site) · [📦 GitHub](https://github.com/jokallame350-lang/temp-mailmephisto) |

---

## ✨ Key Features

- 🔒 **End-to-End Encryption** — Files are AES-256-GCM encrypted with a unique PIN before transfer. Only sender and receiver can decrypt.
- 🚫 **Zero Servers** — No cloud storage, no relay. Direct WebRTC P2P means your data never touches a third party.
- 💣 **Self-Destructing Sessions** — Transfer sessions auto-destruct after 5 minutes. No traces, no history.
- 📱 **No Installation Required** — Works entirely in your browser. No downloads, no sign-ups, no accounts.
- 📂 **Folder & Multi-File Support** — Drag & drop entire folders. Multiple files are automatically compressed into ZIP.
- 📷 **QR Code Sharing** — Generate a QR code for the share link to instantly transfer to mobile devices.
- 💬 **Ghost Chat** — Encrypted real-time messaging between peers during file transfers.
- 🌍 **Multi-Language** — Built-in support for English, Turkish, Spanish, German, French, and Arabic.
- 🎨 **Dark Mode** — Premium dark-themed UI designed for focus and security.
- 📊 **Transfer Dashboard** — Real-time progress bars, connection timers, and peer counters.

## 🏗️ Architecture

```
┌─────────────┐     WebRTC (P2P)     ┌──────────────┐
│   SENDER    │ ◄──────────────────► │   RECEIVER   │
│  Browser A  │   AES-256-GCM       │  Browser B   │
│  (in-memory)│   chunks via        │  (in-memory)  │
└─────────────┘   DataChannel       └──────────────┘
       │                                     │
       └── PeerJS signaling server ──────────┘
             (only for initial handshake,
              no file data passes through)
```

**Key architectural decisions:**

- **Files never leave the browser.** They are chunked, AES-256-GCM encrypted, and sent directly via WebRTC DataChannels.
- **PeerJS** is used only for signaling (establishing the P2P connection). Once connected, all data flows directly between peers.
- **No backend.** The entire application is a static site hosted on Vercel.
- **Session data is RAM-only.** Close the tab → everything is gone. No localStorage for file data.

## 🔐 Security Model

| Layer | Protection |
|-------|-----------|
| **Transport** | WebRTC DTLS (TLS 1.2+) encryption on the wire |
| **Application** | AES-256-GCM cipher with unique session PIN per transfer |
| **Storage** | Zero persistence — all data lives in browser RAM only |
| **Metadata** | No analytics, no tracking, no user identification |
| **Expiry** | Sessions auto-destruct after 5 minutes of inactivity |

## 🛠️ Tech Stack

| Technology | Purpose |
|-----------|---------|
| [React 19](https://react.dev/) | UI framework |
| [TypeScript](https://www.typescriptlang.org/) | Type safety |
| [Vite 7](https://vitejs.dev/) | Build tool & dev server |
| [Tailwind CSS](https://tailwindcss.com/) | Styling |
| [Framer Motion](https://www.framer.com/motion/) | Animations |
| [PeerJS](https://peerjs.com/) | WebRTC signaling |
| [Lucide Icons](https://lucide.dev/) | Icon set |
| [JSZip](https://stuk.github.io/jszip/) | Client-side ZIP compression |
| [html5-qrcode](https://github.com/mebjas/html5-qrcode) | QR code scanning |
| [qrcode.react](https://github.com/zpao/qrcode.react) | QR code generation |

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/jokallame350-lang/mephistovaultt.git
   cd mephistovaultt
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to `http://localhost:5173`

### Building for Production

```bash
npm run build
```

The output will be in the `dist/` directory, ready to deploy to Vercel, Netlify, or any static host.

## 📋 How It Works

1. **Sender selects files** — Drag & drop or browse. Folders and multi-files are auto-zipped.
2. **Unique room code generated** — A random encrypted code with a PIN is created.
3. **Receiver enters the code** — Connects directly to the sender via WebRTC.
4. **Encrypted transfer begins** — File chunks are AES-256-GCM encrypted and sent through a direct P2P DataChannel.
5. **Session self-destructs** — After completion (or 5 min timeout), all data is purged from memory.

## ❓ FAQ

**Q: Is MephistoVault really free?**
A: Yes, 100% free and open source. No file size limits, no premium plans, no hidden costs.

**Q: Can anyone intercept my files?**
A: No. Files are encrypted with a unique PIN-based cipher and sent through an encrypted WebRTC connection. Even ISPs cannot read the contents.

**Q: What's the maximum file size?**
A: There is no server-side limit because transfers are peer-to-peer. Speed depends on your connection.

**Q: Does MephistoVault store my files?**
A: Absolutely not. Zero storage. Files exist only in browser memory during transfer and are immediately discarded.

**Q: Do I need an account?**
A: No. No accounts, no sign-ups, no personal information collected. Ever.

## 🤝 Contributing

Contributions are welcome! If you have ideas for improvements or bug fixes:

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'Add amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

## 👤 Author

**Crow | Indie Developer**

- 𝕏 (Twitter): [@benmxrt](https://x.com/benmxrt)
- 🌐 MephistoVault: [mephistoshares.online](https://mephistoshares.online)
- 📧 MephistoMail: [mephistomail.site](https://mephistomail.site)

---

*Enjoying MephistoVault? Give it a ⭐️ star on GitHub!*
