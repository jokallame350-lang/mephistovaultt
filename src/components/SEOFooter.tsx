import { Shield } from 'lucide-react';

interface SEOFooterProps {
}

export function SEOFooter({}: SEOFooterProps) {
  return (
    <footer className="mt-16 border-t border-white/5 pt-10 pb-8 text-left space-y-10">
      {/* About Section */}
      <section>
        <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-500" /> What is MephistoVault?
        </h2>
        <p className="text-sm text-slate-400 leading-relaxed">
          MephistoVault is a <strong className="text-slate-300">zero-trace, end-to-end encrypted file transfer</strong> tool built for professionals who value privacy.
          Unlike cloud-based services, your files are never uploaded to any server. Instead, they travel directly between devices via <strong className="text-slate-300">WebRTC peer-to-peer</strong> technology,
          ensuring military-grade security with zero metadata collection.
        </p>
      </section>

      {/* Features Grid */}
      <section>
        <h2 className="text-lg font-bold text-white mb-4">Key Features</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
            <h3 className="text-emerald-400 font-bold mb-1">🔒 End-to-End Encryption</h3>
            <p className="text-slate-500">Files are AES-256-GCM encrypted (using Web Crypto API PBKDF2 derived keys) before transfer. Only the sender and receiver can decrypt them.</p>
          </div>
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
            <h3 className="text-emerald-400 font-bold mb-1">🚫 Zero Servers</h3>
            <p className="text-slate-500">No cloud storage, no relay servers. Direct P2P connection means your data never touches a third party.</p>
          </div>
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
            <h3 className="text-emerald-400 font-bold mb-1">💣 Self-Destructing</h3>
            <p className="text-slate-500">Transfer sessions auto-destruct after 5 minutes. No traces, no history, no evidence.</p>
          </div>
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
            <h3 className="text-emerald-400 font-bold mb-1">📱 No Installation</h3>
            <p className="text-slate-500">Works entirely in your browser. No app downloads, no sign-ups, no accounts required.</p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section>
        <h2 className="text-lg font-bold text-white mb-3">How Does It Work?</h2>
        <ol className="text-sm text-slate-400 space-y-2 list-decimal list-inside leading-relaxed">
          <li><strong className="text-slate-300">Select a file or folder</strong> — drag & drop or click to browse. Multiple files are automatically compressed into a ZIP.</li>
          <li><strong className="text-slate-300">Share the encrypted code</strong> — a unique room code is generated. Send it via any messaging app, copy it, or scan the QR code.</li>
          <li><strong className="text-slate-300">Receiver enters the code</strong> — the file transfers directly to the receiver's device. No middleman.</li>
          <li><strong className="text-slate-300">Session self-destructs</strong> — after transfer, all data is erased from memory. Nothing lingers.</li>
        </ol>
      </section>

      {/* FAQ for SEO */}
      <section>
        <h2 className="text-lg font-bold text-white mb-3">Frequently Asked Questions</h2>
        <div className="space-y-4 text-sm">
          <details className="group">
            <summary className="text-slate-300 font-medium cursor-pointer hover:text-white transition-colors select-none">Is MephistoVault really free?</summary>
            <p className="mt-2 text-slate-500 pl-4 border-l border-white/10">Yes, MephistoVault is 100% free and open source. There are no file size limits, no premium plans, and no hidden costs. The entire source code is publicly available on GitHub.</p>
          </details>
          <details className="group">
            <summary className="text-slate-300 font-medium cursor-pointer hover:text-white transition-colors select-none">Can anyone intercept my files?</summary>
            <p className="mt-2 text-slate-500 pl-4 border-l border-white/10">No. Files are encrypted with a unique PIN-based AES-256-GCM cipher before being sent through a direct WebRTC connection. Even if someone intercepted the traffic, they would not be able to read the contents without the room code.</p>
          </details>
          <details className="group">
            <summary className="text-slate-300 font-medium cursor-pointer hover:text-white transition-colors select-none">What's the maximum file size?</summary>
            <p className="mt-2 text-slate-500 pl-4 border-l border-white/10">There is no server-side file size limit because files are transferred peer-to-peer. However, very large files may take longer depending on your internet connection speed.</p>
          </details>
          <details className="group">
            <summary className="text-slate-300 font-medium cursor-pointer hover:text-white transition-colors select-none">Does MephistoVault store my files?</summary>
            <p className="mt-2 text-slate-500 pl-4 border-l border-white/10">Absolutely not. MephistoVault has zero storage. Files exist only in your browser's memory during the transfer and are immediately discarded. No logs, no analytics, no metadata collection.</p>
          </details>
        </div>
      </section>

      {/* Links & Copyright */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-white/5">
        <div className="flex items-center gap-3">
          <img src="/favicon.png" alt="MephistoVault" className="w-6 h-6 rounded" />
          <span className="text-sm text-slate-500">© {new Date().getFullYear()} MephistoVault — Zero-Trace Encrypted File Transfer</span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/jokallame350-lang/mephistovaultt"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-white transition-colors text-sm flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            GitHub
          </a>
          <span className="text-slate-600 text-xs">E2E Encrypted • Open Source • Free</span>
        </div>
      </div>
    </footer>
  );
}
export default SEOFooter;
