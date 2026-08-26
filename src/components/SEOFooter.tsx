import React, { useState, useMemo, useCallback } from 'react';
import {
  Shield,
  Lock,
  Zap,
  CloudOff,
  Flame,
  Cpu,
  CheckCircle2,
  HelpCircle,
  ShieldCheck,
  ChevronDown,
  ServerOff,
  FileCheck,
  Layers,
} from 'lucide-react';
import type { LangKey } from '../i18n';

interface SEOFooterProps {
  lang?: LangKey;
  setLang?: (l: LangKey) => void;
  t?: (key: string) => string;
}

const FAQ_ITEMS = [
  {
    qTr: "MephistoVault nedir ve nasıl çalışır?",
    qEn: "What is MephistoVault and how does it work?",
    aTr: "MephistoVault, dosyalarınızı doğrudan tarayıcılar arasında uçtan uca şifreli (E2E) olarak aktaran sıfır iz (zero-trace) P2P (Peer-to-Peer) dosya transfer platformudur. Dosyalarınız hiçbir sunucuya yüklenmez; doğrudan alıcının cihazına aktarılır.",
    aEn: "MephistoVault is a zero-trace P2P (Peer-to-Peer) file transfer platform that sends files directly between browsers using end-to-end encryption (E2E). Your files are never uploaded to any server; they transfer directly to the recipient's device."
  },
  {
    qTr: "Dosyalarım sunucularda saklanıyor mu?",
    qEn: "Are my files stored on any server?",
    aTr: "Kesinlikle HAYIR. MephistoVault bulut veya veritabanı depolaması kullanmaz. Veriler doğrudan iki cihaz arasındaki WebRTC veri tünelinden aktarılır ve tarayıcı kapatıldığında bellekteki (RAM) geçici veriler otomatik olarak imha edilir.",
    aEn: "Absolutely NOT. MephistoVault uses zero cloud or database storage. Data flows directly through an encrypted WebRTC data channel between devices. Once the connection closes, volatile RAM memory is immediately wiped."
  },
  {
    qTr: "Şifreleme ne kadar güvenli? Dosyalarımı kimse görebilir mi?",
    qEn: "How secure is the encryption? Can anyone intercept my files?",
    aTr: "Verileriniz Web Crypto API kullanılarak PBKDF2 anahtar türetme ve askeri düzeyde AES-256-GCM algoritması ile cihazınızda şifrelenir. Bağlantı kodu olmadan şifre çözülemez. Araya giren hiç kimse, servis sağlayıcıları bile dosyalarınızın içeriğini göremez.",
    aEn: "Your data is encrypted locally using Web Crypto API with PBKDF2 key derivation and military-grade AES-256-GCM cipher. Without the room key, decryption is mathematically impossible. Neither ISP nor middleman can read your content."
  },
  {
    qTr: "Dosya boyutu veya hız sınırı var mı?",
    qEn: "Is there any file size limit or speed capping?",
    aTr: "Herhangi bir dosya boyutu limiti veya bant genişliği kısıtlaması yoktur. Transfer hızı tamamen sizin ve alıcının anlık internet bağlantı hızına bağlıdır.",
    aEn: "There are no file size limits or bandwidth throttling. The transfer speed is only limited by your local network and internet bandwidth."
  },
  {
    qTr: "Oturum kendini imha etme (Self-Destruct) özelliği nasıl çalışır?",
    qEn: "How does the Burn-on-Read Self-Destruct feature work?",
    aTr: "Transfer tamamlandıktan sonra veya 5 dakikalık zaman aşımı süresi dolduğunda, tüm WebRTC tünelleri kapatılır ve bellek sıfırlanır. Dijital ayak izi veya geçmiş kaydı kalmaz.",
    aEn: "Once a transfer completes or the 5-minute timeout expires, WebRTC tunnels close and temporary buffers auto-purge. No logs, history, or digital footprint remain."
  },
  {
    qTr: "Klasör gönderimi ve otomatik arşivleme destekleniyor mu?",
    qEn: "Does it support folder transfers and automatic ZIP compression?",
    aTr: "Evet! MephistoVault ile tüm klasörleri sürükleyip bırakarak gönderebilirsiniz. Dosyalar cihazınızda yerel olarak şifreli bir ZIP paketine dönüştürülür ve tek bir güvenli bağlantı kodu ile aktarılır.",
    aEn: "Yes! You can drag and drop entire directory folders into MephistoVault. Files are bundled into an encrypted ZIP package locally before being sent over the secure channel."
  },
  {
    qTr: "MephistoVault kullanmak için üyelik veya uygulama indirmek gerekiyor mu?",
    qEn: "Do I need to sign up or download an app to use MephistoVault?",
    aTr: "Hayır. MephistoVault %100 ücretsizdir, hesap açma, e-posta doğrulama veya uygulama indirme gerektirmez. Herhangi bir modern web tarayıcısında (Chrome, Firefox, Safari, Edge, Brave) anında çalışır.",
    aEn: "No. MephistoVault is 100% free and open-source. No accounts, email sign-ups, or software downloads required. It works instantly inside any modern desktop or mobile browser."
  }
];

export const SEOFooter = React.memo(function SEOFooter({ lang = 'en', setLang }: SEOFooterProps) {
  const isTr = lang === 'tr';

  // State for active accordion item filter or open state if needed, or details/summary standard with smooth CSS
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const toggleFaq = useCallback((index: number) => {
    setOpenFaqIndex((prev) => (prev === index ? null : index));
  }, []);

  // Generate Google Schema.org FAQPage JSON-LD
  const faqSchemaString = useMemo(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": FAQ_ITEMS.map((item) => ({
        "@type": "Question",
        "name": isTr ? item.qTr : item.qEn,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": isTr ? item.aTr : item.aEn,
        },
      })),
    };
    return JSON.stringify(schema);
  }, [isTr]);

  return (
    <footer className="mt-16 border-t border-white/10 pt-12 pb-12 text-left space-y-14 w-full content-visibility-auto contain-layout">
      {/* FAQ Schema Script for Google Rich Snippets */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: faqSchemaString }}
      />

      {/* 1. SECTION: Primary Overview & Semantic Micro-badge */}
      <section aria-labelledby="sec-overview-title" className="space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
          <Shield className="w-3.5 h-3.5" />
          <span>Zero-Trace Encrypted Protocol • WebRTC P2P</span>
        </div>
        <h2
          id="sec-overview-title"
          className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5"
        >
          <ShieldCheck className="w-7 h-7 text-emerald-400 shrink-0" />
          {isTr
            ? 'MephistoVault: Sıfır İz, Uçtan Uca Şifreli Dosya Transferi'
            : 'MephistoVault: Zero-Trace, End-to-End Encrypted File Transfer'}
        </h2>
        <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
          {isTr ? (
            <>
              <strong>MephistoVault</strong>, gizlilik ve veri güvenliğine önem veren profesyoneller için geliştirilmiş{' '}
              <strong className="text-emerald-400">iz bırakmayan, bulutsuz P2P dosya transfer</strong> platformudur. Dosyalarınız hiçbir sunucuya yüklenmeden doğrudan cihazlar arası <strong className="text-slate-200">WebRTC DataChannels</strong> tüneli üzerinden <strong className="text-slate-200">AES-256-GCM</strong> şifreleme algoritması ile aktarılır.
            </>
          ) : (
            <>
              <strong>MephistoVault</strong> is a zero-trace, serverless <strong className="text-emerald-400">peer-to-peer file sharing platform</strong> built for ultimate privacy. Your data travels directly browser-to-browser via <strong className="text-slate-200">WebRTC DataChannels</strong>, encrypted on-the-fly with <strong className="text-slate-200">AES-256-GCM</strong> ciphers with no middleman or storage logs.
            </>
          )}
        </p>
      </section>

      {/* 2. SECTION: Key Feature Cards Grid */}
      <section aria-labelledby="sec-features-title" className="space-y-6">
        <h2 id="sec-features-title" className="text-xl font-bold text-white flex items-center gap-2">
          <Zap className="w-5 h-5 text-emerald-400" />
          {isTr ? 'Öne Çıkan Güvenlik ve Performans Özellikleri' : 'Core Architecture & Security Highlights'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <article className="bg-white/[0.02] border border-white/10 hover:border-emerald-500/30 rounded-2xl p-5 transition-all duration-300 group transform-gpu contain-layout">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Lock className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="text-white font-bold text-sm mb-1.5">{isTr ? 'Askeri Seviye Şifreleme' : 'Military-Grade E2E Encryption'}</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              {isTr
                ? 'Web Crypto API ile cihazda PBKDF2 türetilmiş AES-256-GCM ciphers. Dosyalar çıkmadan şifrelenir.'
                : 'Local AES-256-GCM ciphers via Web Crypto API PBKDF2 keys. Encrypted before leaving memory.'}
            </p>
          </article>

          <article className="bg-white/[0.02] border border-white/10 hover:border-cyan-500/30 rounded-2xl p-5 transition-all duration-300 group transform-gpu contain-layout">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <ServerOff className="w-5 h-5 text-cyan-400" />
            </div>
            <h3 className="text-white font-bold text-sm mb-1.5">{isTr ? 'Sıfır Sunucu Depolaması' : 'Zero Server Storage'}</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              {isTr
                ? 'Bulut yok, veri tabanı yok. Verileriniz üçüncü şahıs sunucularında asla tutulmaz ve işlenmez.'
                : 'No cloud drives, no server logs. Data never touches third-party storage during transfer.'}
            </p>
          </article>

          <article className="bg-white/[0.02] border border-white/10 hover:border-red-500/30 rounded-2xl p-5 transition-all duration-300 group transform-gpu contain-layout">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Flame className="w-5 h-5 text-red-400" />
            </div>
            <h3 className="text-white font-bold text-sm mb-1.5">{isTr ? 'Kendini İmha Eden Oturum' : 'Burn-on-Read Self-Destruct'}</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              {isTr
                ? 'Aktarım bitince veya 5 dakikalık zaman aşımında bağlantı kapanır, geçici bellek temizlenir.'
                : 'WebRTC channels terminate instantly after download. RAM buffers purge automatically.'}
            </p>
          </article>

          <article className="bg-white/[0.02] border border-white/10 hover:border-purple-500/30 rounded-2xl p-5 transition-all duration-300 group transform-gpu contain-layout">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Cpu className="w-5 h-5 text-purple-400" />
            </div>
            <h3 className="text-white font-bold text-sm mb-1.5">{isTr ? 'Sınırsız P2P Hız' : 'Unlimited Peer-to-Peer Speed'}</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              {isTr
                ? 'Sunucu hız kısıtlaması olmadan yerel internet bant genişliğinizin elverdiği maksimum hızda transfer.'
                : 'Direct peer connections allow maximum speed limited only by local ISP network bandwidth.'}
            </p>
          </article>
        </div>
      </section>

      {/* 3. SECTION: How It Works Step-by-Step */}
      <section aria-labelledby="sec-how-title" className="bg-white/[0.01] border border-white/5 rounded-3xl p-6 sm:p-8 space-y-6">
        <h2 id="sec-how-title" className="text-xl font-bold text-white flex items-center gap-2">
          <Layers className="w-5 h-5 text-teal-400" />
          {isTr ? 'Nasıl Çalışır? 4 Adımda İz Bırakmayan Transfer' : 'How It Works: 4 Simple Steps to Secure Transfer'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <div className="space-y-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-mono font-bold flex items-center justify-center">1</div>
            <h3 className="font-bold text-white text-sm">{isTr ? 'Dosya veya Klasör Seç' : 'Select Files or Folders'}</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              {isTr ? 'Dosyaları sürükleyip bırakın. Klasörler anında yerel olarak şifreli ZIP arşivine paketlenir.' : 'Drag & drop your files. Folders are automatically compressed into encrypted ZIP bundles locally.'}
            </p>
          </div>
          <div className="space-y-2">
            <div className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 font-mono font-bold flex items-center justify-center">2</div>
            <h3 className="font-bold text-white text-sm">{isTr ? 'Güvenli Oda Kodu Al' : 'Generate Room Code'}</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              {isTr ? 'Benzersiz şifreli oda kodu veya QR kod oluşturulur. Bunu alıcıyla güvenli bir kanaldan paylaşın.' : 'A unique encryption room key and QR code are created. Send it securely to your peer.'}
            </p>
          </div>
          <div className="space-y-2">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 font-mono font-bold flex items-center justify-center">3</div>
            <h3 className="font-bold text-white text-sm">{isTr ? 'Doğrudan P2P Tüneli' : 'Direct P2P Tunnel'}</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              {isTr ? 'Alıcı kodu girdiğinde WebRTC tüneli kurulur ve dosyalar doğrudan cihaza akar.' : 'When receiver enters the code, a direct WebRTC peer connection decrypts data live.'}
            </p>
          </div>
          <div className="space-y-2">
            <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/40 font-mono font-bold flex items-center justify-center">4</div>
            <h3 className="font-bold text-white text-sm">{isTr ? 'Hafızadan Tamamen İmha' : 'Complete Purge'}</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              {isTr ? 'Transfer bitince bağlantı kapatılır, tüm geçici bellek verileri silinir ve iz kalmaz.' : 'Once downloaded, connection drops and volatile memory purges. Zero footprints remain.'}
            </p>
          </div>
        </div>
      </section>

      {/* 4. SECTION: Collapsible Accordion FAQ (Katlanabilir Sıkça Sorulan Sorular) */}
      <section aria-labelledby="sec-faq-title" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
          <h2 id="sec-faq-title" className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
            <HelpCircle className="w-6 h-6 text-emerald-400 shrink-0" />
            {isTr ? 'Sıkça Sorulan Sorular (FAQ)' : 'Frequently Asked Questions (FAQ)'}
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            {isTr ? 'Türkçe & English SEO Verified' : 'Verified Security & Privacy FAQ'}
          </span>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div
                key={idx}
                className={`border rounded-2xl transition-all duration-300 overflow-hidden transform-gpu contain-layout ${
                  isOpen
                    ? 'bg-white/[0.04] border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.1)]'
                    : 'bg-white/[0.015] border-white/10 hover:border-white/20'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/50 rounded-2xl select-none"
                  aria-expanded={isOpen}
                >
                  <span className="font-bold text-sm sm:text-base text-slate-200 flex items-center gap-3">
                    <CheckCircle2 className={`w-4 h-4 shrink-0 transition-colors ${isOpen ? 'text-emerald-400' : 'text-slate-500'}`} />
                    {isTr ? item.qTr : item.qEn}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-300 ${
                      isOpen ? 'rotate-180 text-emerald-400' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-slate-300 text-xs sm:text-sm leading-relaxed border-t border-white/5 space-y-2">
                    <p className="font-medium text-slate-200">
                      {isTr ? item.aTr : item.aEn}
                    </p>
                    {isTr && (
                      <div className="pt-2 flex items-center gap-2 text-[11px] text-slate-400 font-mono italic">
                        <span>Alternate Language:</span>
                        <span>{item.qEn}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. SECTION: Comprehensive SEO Content Description Block */}
      <article aria-labelledby="sec-seo-article-title" className="bg-gradient-to-br from-black/80 via-emerald-950/10 to-black/80 border border-emerald-500/20 rounded-3xl p-6 sm:p-8 space-y-6">
        <h2 id="sec-seo-article-title" className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
          <CloudOff className="w-6 h-6 text-emerald-400 shrink-0" />
          {isTr
            ? 'Neden MephistoVault? Bulutsuz & Şifreli P2P Transfer Teknolojisi'
            : 'Why MephistoVault? Zero-Trace Serverless Encrypted File Sharing'}
        </h2>

        <div className="text-slate-300 text-xs sm:text-sm leading-relaxed space-y-4">
          <p>
            {isTr ? (
              <>
                Geleneksel dosya paylaşım servisleri (WeTransfer, Google Drive, Dropbox vb.) dosyalarınızı kendi merkezi sunucularına yükler. Bu durum verilerinizin sunucularda saklanmasına, işlenmesine ve siber saldırılara maruz kalmasına yol açabilir. <strong>MephistoVault</strong> ise <strong className="text-white">Sıfır Bilgi (Zero-Knowledge)</strong> mimarisi üzerine kuruludur. Dosyalarınız hiçbir üçüncü taraf sunucuya temas etmez.
              </>
            ) : (
              <>
                Traditional cloud sharing services (WeTransfer, Google Drive, Dropbox, etc.) upload your confidential files to remote central servers. This exposes your sensitive data to server-side retention, data breaches, and tracking. <strong>MephistoVault</strong> is engineered strictly on a <strong className="text-white">Zero-Knowledge architecture</strong>: your files never touch any intermediary server.
              </>
            )}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
            <div className="bg-black/50 border border-white/10 rounded-xl p-4 space-y-2">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-400" />
                {isTr ? 'Geleneksel Bulut Servisleri' : 'Traditional Cloud Services'}
              </h3>
              <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
                {isTr ? (
                  <>
                    <li>Dosyalar üçüncü taraf sunucularda saklanır</li>
                    <li>Sunucu tarafında log ve IP metadata kaydı tutulur</li>
                    <li>Dosya boyutu ve indirme hızında kısıtlamalar vardır</li>
                    <li>Veri sızıntısı ve hacklenme riski yüksektir</li>
                  </>
                ) : (
                  <>
                    <li>Files stored indefinitely on third-party servers</li>
                    <li>Server-side logging and IP metadata tracking</li>
                    <li>File size limitations and bandwidth throttling</li>
                    <li>High vulnerability to data leaks and cloud breaches</li>
                  </>
                )}
              </ul>
            </div>

            <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-4 space-y-2">
              <h3 className="font-bold text-emerald-400 text-sm flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                MephistoVault P2P Protocol
              </h3>
              <ul className="text-xs text-emerald-200/80 space-y-1 list-disc list-inside">
                {isTr ? (
                  <>
                    <li>%100 Sunucusuz, tarayıcıdan tarayıcıya doğrudan aktarım</li>
                    <li>Sıfır kayıt, sıfır log, sıfır IP takibi</li>
                    <li>Dosya boyutu kısıtlaması ve bant genişliği limiti yok</li>
                    <li>Askeri seviye AES-256-GCM ile anında kendini imha</li>
                  </>
                ) : (
                  <>
                    <li>100% Serverless, direct browser-to-browser P2P tunnel</li>
                    <li>Zero logs, zero activity tracking, zero metadata retention</li>
                    <li>No file size limits and no bandwidth throttling</li>
                    <li>Military-grade AES-256-GCM with instant self-destruction</li>
                  </>
                )}
              </ul>
            </div>
          </div>

          <p>
            {isTr ? (
              <>
                MephistoVault, <strong>WebRTC (Web Real-Time Communication)</strong> protokolünün sunduğu Peer-to-Peer DataChannels yeteneğini kullanarak tarayıcınız ile alıcının tarayıcısı arasında şifreli bir dijital tünel açar. Şifreleme anahtarı (Vault Code) yalnızca gönderici ve alıcı tarafından bilindiği için, veriler ağ seviyesinde bile dinlenemez veya kopyalanamaz.
              </>
            ) : (
              <>
                MephistoVault utilizes <strong>WebRTC (Web Real-Time Communication) DataChannels</strong> to establish a direct, encrypted digital pipeline between sender and receiver browsers. Since the cryptographic key (Vault Code) resides only in client volatile memory, your data cannot be intercepted, snooped, or decrypted in transit.
              </>
            )}
          </p>
        </div>

        {/* Micro-Keywords Tag Cloud for Google Bot Match */}
        <div className="pt-4 border-t border-white/10">
          <p className="text-slate-400 text-[11px] font-mono mb-2 uppercase tracking-wider">
            {isTr ? 'İlişkili Arama Terimleri & Anahtar Kelimeler' : 'Indexed Search Keywords & Related Topics'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(isTr
              ? [
                  'Encrypted File Transfer',
                  'P2P File Sharing',
                  'Zero Knowledge Vault',
                  'WebRTC Peer to Peer',
                  'Burn-on-Read Self Destruct',
                  'AES-256-GCM Encryption',
                  'Şifreli Dosya Gönderme',
                  'İz Bırakmayan Transfer',
                  'Bulutsuz Dosya Paylaşımı',
                  'Güvenli Dosya Transferi',
                  'No Log File Drop',
                  'Anonymous File Transfer',
                ]
              : [
                  'Encrypted File Transfer',
                  'P2P File Sharing',
                  'Zero Knowledge Vault',
                  'WebRTC Peer to Peer',
                  'Burn-on-Read Self Destruct',
                  'AES-256-GCM Encryption',
                  'Private File Sharing',
                  'Untraceable Drop',
                  'Serverless File Delivery',
                  'Direct Browser Transfer',
                  'No Log File Drop',
                  'Anonymous File Transfer',
                ]
            ).map((tag, i) => (
              <span
                key={i}
                className="text-[10px] bg-white/5 border border-white/10 text-slate-400 px-2.5 py-1 rounded-md hover:text-white transition-colors"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      </article>

      {/* 6. SECTION: Multi-Language Navigation Links for Search Engines */}
      <nav aria-label="Supported Languages Navigation" className="pt-4 border-t border-white/5">
        <p className="text-slate-400 text-[11px] font-mono mb-2 uppercase tracking-wider">
          {isTr ? 'Desteklenen Diller (Languages)' : 'Supported International Languages'}
        </p>
        <div className="flex flex-wrap gap-2 text-xs">
          {[
            { code: 'en' as LangKey, label: 'English', flag: '🇬🇧' },
            { code: 'tr' as LangKey, label: 'Türkçe', flag: '🇹🇷' },
            { code: 'es' as LangKey, label: 'Español', flag: '🇪🇸' },
            { code: 'de' as LangKey, label: 'Deutsch', flag: '🇩🇪' },
            { code: 'fr' as LangKey, label: 'Français', flag: '🇫🇷' },
            { code: 'it' as LangKey, label: 'Italiano', flag: '🇮🇹' },
            { code: 'pt' as LangKey, label: 'Português', flag: '🇵🇹' },
            { code: 'ru' as LangKey, label: 'Русский', flag: '🇷🇺' },
            { code: 'ar' as LangKey, label: 'العربية', flag: '🇸🇦' },
            { code: 'zh' as LangKey, label: '中文', flag: '🇨🇳' },
          ].map((l) => (
            <a
              key={l.code}
              href={`/?lang=${l.code}`}
              onClick={(e) => {
                if (setLang) {
                  e.preventDefault();
                  setLang(l.code);
                  if (typeof window !== 'undefined') {
                    const url = new URL(window.location.href);
                    url.searchParams.set('lang', l.code);
                    window.history.replaceState({}, '', url.toString());
                  }
                }
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors ${
                lang === l.code
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-bold'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:border-white/20'
              }`}
              title={`Switch site language to ${l.label}`}
              aria-label={`Switch site language to ${l.label}`}
            >
              <span>{l.flag}</span>
              <span>{l.label}</span>
            </a>
          ))}
        </div>
      </nav>

      {/* 7. SECTION: Bottom Copyright & Navigation Links */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-white/10 text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <img
            src="/favicon.png"
            alt="MephistoVault Secure P2P Encryption Logo"
            width="24"
            height="24"
            loading="lazy"
            decoding="async"
            className="w-6 h-6 rounded"
          />
          <span>
            © {new Date().getFullYear()} <strong>MephistoVault</strong> — Zero-Trace Encrypted P2P Platform
          </span>
        </div>

        <div className="flex items-center gap-5">
          <a
            href="https://github.com/jokallame350-lang/mephistovaultt"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 rounded-md"
            aria-label="GitHub Repository"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            GitHub Source
          </a>
          <span className="text-emerald-400 font-mono">WebRTC • AES-256-GCM • Free</span>
        </div>
      </div>
    </footer>
  );
});

export default SEOFooter;

