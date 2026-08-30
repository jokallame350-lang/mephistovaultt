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
  Share2,
  Sparkles,
} from 'lucide-react';
import type { LangKey } from '../i18n';

interface SEOFooterProps {
  lang?: LangKey;
  setLang?: (l: LangKey) => void;
  t?: (key: string) => string;
}

// 4 High-Converting Keyword Pillars across all 10 supported languages
const HIGH_CONVERTING_KEYWORD_PILLARS: Record<
  LangKey,
  Array<{
    title: string;
    sentence: string;
    badge: string;
  }>
> = {
  en: [
    {
      title: 'Direct WebRTC P2P Transfer',
      sentence: 'Direct browser-to-browser P2P file transfer powered by WebRTC and AES-256-GCM end-to-end encryption',
      badge: 'E2E Cipher',
    },
    {
      title: 'Holographic Multi-File ZIP Bundling',
      sentence: 'Holographic full-screen drag and drop file sharing with automatic multi-file ZIP bundling',
      badge: 'Batch Stream',
    },
    {
      title: 'Zero Cloud Storage & Ephemeral Rooms',
      sentence: 'Zero cloud storage, unlimited file sizes, and ephemeral self-destructing rooms',
      badge: 'Zero-Trace',
    },
    {
      title: 'Instant 1-Click & QR Code Handoff',
      sentence: 'Instant 1-click room sharing over WhatsApp, Telegram, and QR Code handoff',
      badge: 'Instant Connect',
    },
  ],
  tr: [
    {
      title: 'Doğrudan WebRTC P2P Transferi',
      sentence: 'WebRTC ve AES-256-GCM uçtan uca şifreleme ile güçlendirilmiş, tarayıcıdan tarayıcıya doğrudan P2P dosya transferi',
      badge: 'Uçtan Uca Şifreli',
    },
    {
      title: 'Holografik Çoklu Dosya ZIP Paketleme',
      sentence: 'Otomatik çoklu dosya ZIP arşivleme özellikli, holografik tam ekran sürükle-bırak dosya paylaşımı',
      badge: 'Toplu Arşiv',
    },
    {
      title: 'Sıfır Bulut Depolama & Geçici Odalar',
      sentence: 'Sıfır bulut depolama, sınırsız dosya boyutu ve anında kendini imha eden geçici odalar',
      badge: 'Sıfır İz',
    },
    {
      title: 'Tek Tıkla ve QR Kod ile Paylaşım',
      sentence: 'WhatsApp, Telegram ve QR Kod aktarımı ile anında tek tıkla oda paylaşımı',
      badge: 'Anında Bağlantı',
    },
  ],
  es: [
    {
      title: 'Transferencia P2P Directa WebRTC',
      sentence: 'Transferencia directa de archivos P2P de navegador a navegador con WebRTC y cifrado de extremo a extremo AES-256-GCM',
      badge: 'Cifrado E2E',
    },
    {
      title: 'Empaquetado ZIP Holográfico por Lotes',
      sentence: 'Compartición holográfica de archivos mediante arrastrar y soltar a pantalla completa con empaquetado ZIP automático de múltiples archivos',
      badge: 'Lote ZIP',
    },
    {
      title: 'Cero Nube y Salas Efímeras',
      sentence: 'Cero almacenamiento en la nube, tamaños de archivo ilimitados y salas efímeras que se autodestruyen',
      badge: 'Sin Rastro',
    },
    {
      title: 'Compartición en 1 Clic y Código QR',
      sentence: 'Compartición instantánea de salas en 1 clic a través de WhatsApp, Telegram y transferencia por código QR',
      badge: 'Conexión Inmediata',
    },
  ],
  de: [
    {
      title: 'Direkte WebRTC P2P-Übertragung',
      sentence: 'Direkte P2P-Dateiübertragung von Browser zu Browser mit WebRTC und durchgehender AES-256-GCM-Ende-zu-Ende-Verschlüsselung',
      badge: 'E2E-Verschlüsselt',
    },
    {
      title: 'Holografische ZIP-Bündelung',
      sentence: 'Holografische Vollbild-Drag-and-Drop-Dateifreigabe mit automatischer ZIP-Bündelung mehrerer Dateien',
      badge: 'Stapel-Stream',
    },
    {
      title: 'Keine Cloud & Selbstzerstörende Räume',
      sentence: 'Keine Cloud-Speicherung, unbegrenzte Dateigrößen und flüchtige, sich selbst zerstörende Räume',
      badge: 'Spurlos',
    },
    {
      title: '1-Klick-Freigabe & QR-Code-Übergabe',
      sentence: 'Sofortige 1-Klick-Raumfreigabe über WhatsApp, Telegram und QR-Code-Übergabe',
      badge: 'Sofort-Verbindung',
    },
  ],
  fr: [
    {
      title: 'Transfert P2P Direct WebRTC',
      sentence: 'Transfert de fichiers P2P direct de navigateur à navigateur alimenté par WebRTC et chiffrement de bout en bout AES-256-GCM',
      badge: 'Chiffrement E2E',
    },
    {
      title: 'Compression ZIP Holographique Multi-Fichiers',
      sentence: 'Partage de fichiers par glisser-déposer holographique en plein écran avec compression ZIP automatique de plusieurs fichiers',
      badge: 'Flux ZIP',
    },
    {
      title: 'Zéro Stockage Cloud & Salles Éphémères',
      sentence: 'Zéro stockage cloud, tailles de fichiers illimitées et salles éphémères à autodestruction',
      badge: 'Sans Trace',
    },
    {
      title: 'Partage en 1 Clic & Transmission QR Code',
      sentence: 'Partage instantané de salle en 1 clic via WhatsApp, Telegram et transmission par code QR',
      badge: 'Connexion Directe',
    },
  ],
  it: [
    {
      title: 'Trasferimento P2P Diretto WebRTC',
      sentence: 'Trasferimento file P2P diretto da browser a browser basato su WebRTC e crittografia end-to-end AES-256-GCM',
      badge: 'Cifratura E2E',
    },
    {
      title: 'Raggruppamento ZIP Olografico Multi-File',
      sentence: 'Condivisione file olografica drag-and-drop a schermo intero con raggruppamento ZIP automatico di più file',
      badge: 'Flusso ZIP',
    },
    {
      title: 'Zero Cloud & Stanze con Autodistruzione',
      sentence: 'Zero archiviazione cloud, dimensioni dei file illimitate e stanze effimere con autodistruzione',
      badge: 'Senza Tracce',
    },
    {
      title: 'Condivisione in 1 Clic & Codice QR',
      sentence: 'Condivisione istantanea della stanza con 1 clic su WhatsApp, Telegram e passaggio tramite codice QR',
      badge: 'Connessione Immediata',
    },
  ],
  pt: [
    {
      title: 'Transferência Direta WebRTC P2P',
      sentence: 'Transferência direta de arquivos P2P de navegador para navegador com WebRTC e criptografia ponta a ponta AES-256-GCM',
      badge: 'Criptografia E2E',
    },
    {
      title: 'Compactação ZIP Holográfica de Vários Arquivos',
      sentence: 'Compartilhamento de arquivos holográfico arrastar e soltar em tela cheia com compactação ZIP automática de vários arquivos',
      badge: 'Lote ZIP',
    },
    {
      title: 'Zero Nuvem & Salas Autodestrutivas',
      sentence: 'Zero armazenamento em nuvem, tamanho ilimitado de arquivos e salas efêmeras autodestrutivas',
      badge: 'Sem Rastros',
    },
    {
      title: 'Compartilhamento em 1 Clique & QR Code',
      sentence: 'Compartilhamento instantâneo de sala com 1 clique via WhatsApp, Telegram e transferência por código QR',
      badge: 'Conexão Instantânea',
    },
  ],
  ru: [
    {
      title: 'Прямая передача WebRTC P2P',
      sentence: 'Прямая передача файлов P2P из браузера в браузер на базе WebRTC и сквозного шифрования AES-256-GCM',
      badge: 'E2E Шифрование',
    },
    {
      title: 'Голографическая ZIP-упаковка пакетов',
      sentence: 'Голографический полноэкранный обмен файлами перетаскиванием с автоматической ZIP-упаковкой нескольких файлов',
      badge: 'ZIP Пакет',
    },
    {
      title: 'Без облака и самоуничтожающиеся комнаты',
      sentence: 'Нулевое облачное хранилище, неограниченный размер файлов и эфемерные самоуничтожающиеся комнаты',
      badge: 'Без Следов',
    },
    {
      title: 'Обмен в 1 клик и передача по QR-коду',
      sentence: 'Мгновенный обмен ссылкой на комнату в 1 клик через WhatsApp, Telegram и передача по QR-коду',
      badge: 'Быстрое Соединение',
    },
  ],
  ar: [
    {
      title: 'نقل مباشر بتقنية WebRTC P2P',
      sentence: 'نقل ملفات مباشر من متصفح إلى متصفح بتقنية P2P مدعوم بـ WebRTC وتشفير طرف إلى طرف AES-256-GCM',
      badge: 'تشفير شامل',
    },
    {
      title: 'تجميع ملفات ZIP متعددة بالسحب والإفلات',
      sentence: 'مشاركة ملفات ثلاثية الأبعاد بملء الشاشة عبر السحب والإفلات مع تجميع تلقائي للملفات المتعددة في ملف ZIP',
      badge: 'حزمة ZIP',
    },
    {
      title: 'بدون تخزين سحابي وغرف ذاتية التدمير',
      sentence: 'تخزين سحابي صفري وأحجام ملفات غير محدودة وغرف مؤقتة ذاتية التدمير',
      badge: 'بدون أي أثر',
    },
    {
      title: 'مشاركة بنقرة واحدة ونقل عبر رمز QR',
      sentence: 'مشاركة فورية للغرفة بنقرة واحدة عبر WhatsApp و Telegram ونقل عبر رمز QR',
      badge: 'اتصال فوري',
    },
  ],
  zh: [
    {
      title: 'WebRTC P2P 直接传输与端到端加密',
      sentence: '基于 WebRTC 与 AES-256-GCM 端到端加密的浏览器对浏览器直接 P2P 文件传输',
      badge: '军工级加密',
    },
    {
      title: '全息全屏拖拽与多文件自动 ZIP 打包',
      sentence: '支持全屏全息拖拽分享与多文件自动 ZIP 打包压缩',
      badge: '批量归档',
    },
    {
      title: '零云端存储与临时自毁房间',
      sentence: '零云端存储、无文件大小限制以及临时自毁房间',
      badge: '零痕迹',
    },
    {
      title: '一键社交分享与二维码秒级交接',
      sentence: '支持通过 WhatsApp、Telegram 与二维码交接一键即时分享房间',
      badge: '极速直连',
    },
  ],
};

interface FAQItem {
  q: Record<LangKey, string>;
  a: Record<LangKey, string>;
}

const EXPANDED_FAQ_ITEMS: FAQItem[] = [
  {
    q: {
      en: 'How does zero cloud storage and zero-trace privacy protect my confidential data?',
      tr: 'Sıfır bulut depolaması ve sıfır iz gizliliği verilerimi nasıl korur?',
      es: '¿Cómo protege mis datos confidenciales el almacenamiento cero en la nube y la privacidad sin rastros?',
      de: 'Wie schützt Zero-Cloud-Speicherung und spurloser Datenschutz meine Daten?',
      fr: 'Comment le stockage zéro cloud et la confidentialité sans trace protègent-ils mes données confidentielles ?',
      it: "In che modo l'archiviazione zero cloud e la privacy senza tracce proteggono i miei dati riservati?",
      pt: 'Como o armazenamento zero em nuvem e a privacidade sem rastros protegem meus dados confidenciais?',
      ru: 'Как нулевое облачное хранилище и полная конфиденциальность защищают мои данные?',
      ar: 'كيف يحمي التخزين السحابي الصفري والخصوصية الخالية من الأثر بياناتي السرية؟',
      zh: '零云端存储与无痕隐私是如何保护我的敏感数据安全的？',
    },
    a: {
      en: 'MephistoVault enforces a strict zero-cloud architecture: files never touch a remote server, database, or third-party storage. Data streams directly browser-to-browser via WebRTC encrypted channels, and volatile RAM buffers purge instantly when the session ends.',
      tr: 'MephistoVault katı bir sıfır bulut mimarisi uygular: dosyalarınız asla uzak bir sunucuya, veritabanına veya üçüncü şahıs depolama alanına yüklenmez. Veriler WebRTC şifreli kanalları üzerinden doğrudan tarayıcılar arasında aktarılır ve oturum sona erdiğinde geçici RAM belleği anında temizlenir.',
      es: 'MephistoVault aplica una arquitectura estricta sin nube: los archivos nunca tocan un servidor ni una base de datos remota. Los datos se transmiten directamente de navegador a navegador a través de canales WebRTC cifrados, y la memoria RAM volátil se purga al instante al finalizar la sesión.',
      de: 'MephistoVault erzwingt eine strikte Zero-Cloud-Architektur: Dateien berühren niemals einen Remote-Server oder eine Datenbank. Die Daten fließen direkt von Browser zu Browser über verschlüsselte WebRTC-Kanäle, und flüchtige RAM-Puffer werden sofort nach Sitzungsende gelöscht.',
      fr: 'MephistoVault applique une architecture stricte sans cloud : les fichiers ne touchent jamais de serveur distant ni de base de données. Les données transitent directement de navigateur à navigateur via des canaux WebRTC chiffrés, et la mémoire RAM temporaire est immédiatement purgée dès la fin de session.',
      it: 'MephistoVault applica una rigorosa architettura senza cloud: i file non toccano mai server remoti o database. I dati fluiscono direttamente da browser a browser tramite canali WebRTC crittografati e la memoria volatile RAM viene cancellata all\'istante al termine della sessione.',
      pt: 'O MephistoVault adota uma arquitetura estrita sem nuvem: os arquivos nunca tocam servidores ou bancos de dados remotos. Os dados fluem diretamente de navegador para navegador por meio de canais criptografados WebRTC, e a memória RAM volátil é expurgada instantaneamente ao encerrar a sessão.',
      ru: 'MephistoVault использует строгую архитектуру без облака: файлы никогда не попадают на удаленный сервер или в базу данных. Данные передаются напрямую из браузера в браузер через зашифрованные каналы WebRTC, а оперативная память (RAM) мгновенно очищается при завершении сеанса.',
      ar: 'يطبق MephistoVault بنية تحتية صارمة بدون سحابة: لا يتم تحميل الملفات على أي خادم أو قاعدة بيانات عن بُعد. تتدفق البيانات مباشرة من متصفح إلى متصفح عبر قنوات WebRTC المشفرة، ويتم مسح ذاكرة RAM المؤقتة فور انتهاء الجلسة.',
      zh: 'MephistoVault 采用严格的零云端架构：文件绝不会上传或存储在任何远程服务器、数据库或第三方存储中。数据通过 WebRTC 加密通道直接在浏览器与浏览器之间高速流转，会话结束时易失性内存（RAM）立即自动销毁清空。',
    },
  },
  {
    q: {
      en: 'How does holographic drag and drop multi-file batch transfer and automatic ZIP bundling work?',
      tr: 'Holografik sürükle-bırak çoklu dosya toplu aktarımı ve otomatik ZIP paketleme nasıl çalışır?',
      es: '¿Cómo funciona la transferencia por lotes holográfica y el empaquetado ZIP automático de múltiples archivos?',
      de: 'Wie funktioniert die holografische Drag-and-Drop-Mehrfachübertragung und automatische ZIP-Bündelung?',
      fr: 'Comment fonctionne le transfert par lots holographique par glisser-déposer et la compression ZIP automatique ?',
      it: 'Come funziona il trasferimento batch olografico drag and drop e l\'impacchettamento ZIP automatico?',
      pt: 'Como funciona a transferência em lote holográfica por arrastar e soltar e a compactação ZIP automática?',
      ru: 'Как работает голографическая пакетная передача перетаскиванием и автоматическая упаковка в ZIP?',
      ar: 'كيف يعمل النقل المجمع بالسحب والإفلات والتجميع التلقائي في ملف ZIP؟',
      zh: '全息拖拽多文件批量传输与自动 ZIP 打包是如何工作的？',
    },
    a: {
      en: 'You can drag and drop multiple files or entire folder hierarchies directly into the full-screen holographic dropzone. MephistoVault automatically bundles and compresses the batch into a secure ZIP package locally inside client memory before streaming it across the direct P2P tunnel.',
      tr: 'Birden fazla dosyayı veya tüm klasör hiyerarşilerini doğrudan tam ekran holografik bırakma alanına sürükleyip bırakabilirsiniz. MephistoVault, dosyaları doğrudan P2P tüneli üzerinden aktarmadan önce istemci belleğinde yerel olarak otomatik olarak güvenli bir ZIP paketine dönüştürür.',
      es: 'Puedes arrastrar y soltar múltiples archivos o carpetas completas en la zona de colocación holográfica. MephistoVault comprime y empaqueta automáticamente el lote en un archivo ZIP seguro localmente en tu navegador antes de transmitirlo por el túnel P2P.',
      de: 'Sie können mehrere Dateien oder ganze Ordnerstrukturen direkt in die holografische Dropzone ziehen. MephistoVault bündelt und komprimiert den Stapel lokal im Browser automatisch in ein sicheres ZIP-Paket, bevor er über den direkten P2P-Tunnel übertragen wird.',
      fr: 'Vous pouvez glisser-déposer plusieurs fichiers ou des dossiers entiers dans la zone de dépôt holographique. MephistoVault regroupe et compresse automatiquement le lot dans un fichier ZIP sécurisé localement dans votre navigateur avant le streaming direct P2P.',
      it: 'Puoi trascinare e rilasciare più file o intere cartelle direttamente nella zona di rilascio olografica. MephistoVault raggruppa e comprime automaticamente il batch in un pacchetto ZIP sicuro localmente nel browser prima dello streaming P2P.',
      pt: 'Você pode arrastar e soltar vários arquivos ou pastas inteiras na área de transferência holográfica. O MephistoVault compacta e empacota o lote automaticamente em um arquivo ZIP seguro localmente no navegador antes do streaming P2P direto.',
      ru: 'Вы можете перетаскивать несколько файлов или целые папки прямо в голографическую зону сброса. MephistoVault автоматически объединяет и сжимает файлы в безопасный ZIP-архив локально в браузере перед передачей по прямому P2P-туннелю.',
      ar: 'يمكنك سحب وإفلات ملفات متعددة أو مجلدات كاملة في منطقة الإسقاط. يقوم MephistoVault بتجميع وحزم الدفعة تلقائيًا في حزمة ZIP آمنة محليًا داخل متصفحك قبل بثها عبر نفق P2P المباشر.',
      zh: '您可以直接将多个文件或整个文件夹目录拖拽至全屏全息投放区。MephistoVault 会在浏览器客户端内存中自动将批量文件打包并压缩为安全 ZIP 归档流，随后通过直接 P2P 隧道高速流式传输至对端。',
    },
  },
  {
    q: {
      en: 'How does direct browser-to-browser P2P file transfer powered by WebRTC and AES-256-GCM operate?',
      tr: 'WebRTC ve AES-256-GCM uçtan uca şifrelemeli doğrudan tarayıcıdan tarayıcıya P2P transfer nasıl işler?',
      es: '¿Cómo funciona la transferencia P2P directa entre navegadores con cifrado AES-256-GCM y WebRTC?',
      de: 'Wie funktioniert die direkte P2P-Übertragung von Browser zu Browser mit WebRTC und AES-256-GCM-Verschlüsselung?',
      fr: 'Comment fonctionne le transfert P2P direct de navigateur à navigateur avec WebRTC et chiffrement AES-256-GCM ?',
      it: 'Come funziona il trasferimento P2P diretto da browser a browser basato su WebRTC e crittografia AES-256-GCM?',
      pt: 'Como opera a transferência P2P direta de navegador para navegador com WebRTC e criptografia AES-256-GCM?',
      ru: 'Как работает прямая передача файлов P2P из браузера в браузер на базе WebRTC и шифрования AES-256-GCM?',
      ar: 'كيف يعمل النقل المباشر من متصفح إلى متصفح بتقنية P2P المدعومة بـ WebRTC وتشفير AES-256-GCM؟',
      zh: '基于 WebRTC 与 AES-256-GCM 端到端加密的点对点直连是如何运作的？',
    },
    a: {
      en: 'MephistoVault leverages WebRTC DataChannels with PBKDF2-derived AES-256-GCM encryption via the native Web Crypto API. Encryption and decryption occur entirely on client hardware, meaning intermediate nodes, ISPs, or servers cannot intercept or decrypt payloads.',
      tr: 'MephistoVault, yerel Web Crypto API üzerinden PBKDF2 türetilmiş AES-256-GCM şifreleme ve WebRTC DataChannels teknolojisini kullanır. Şifreleme ve çözme işlemleri tamamen istemci donanımında gerçekleşir; aradaki hiçbir ağ veya sunucu aktarılan verileri göremez.',
      es: 'MephistoVault utiliza WebRTC DataChannels con cifrado AES-256-GCM derivado de PBKDF2 a través de la Web Crypto API nativa. El cifrado ocurre totalmente en el hardware del cliente, por lo que nadie puede interceptar los datos.',
      de: 'MephistoVault nutzt WebRTC DataChannels mit PBKDF2-abgeleiteter AES-256-GCM-Verschlüsselung über die native Web Crypto API. Ver- und Entschlüsselung erfolgen vollständig auf der Client-Hardware ohne Abhörmöglichkeit.',
      fr: 'MephistoVault s\'appuie sur WebRTC DataChannels avec chiffrement AES-256-GCM dérivé de PBKDF2 via l\'API Web Crypto native. Le chiffrement s\'effectue intégralement sur l\'appareil client, empêchant toute interception.',
      it: 'MephistoVault sfrutta i DataChannel WebRTC con crittografia AES-256-GCM derivata da PBKDF2 tramite la Web Crypto API nativa. Crittografia e decrittografia avvengono completamente sul dispositivo dell\'utente.',
      pt: 'O MephistoVault utiliza WebRTC DataChannels com criptografia AES-256-GCM derivada de PBKDF2 por meio da API Web Crypto nativa. O processamento criptográfico ocorre exclusivamente no dispositivo do usuário.',
      ru: 'MephistoVault использует WebRTC DataChannels со сквозным шифрованием AES-256-GCM на базе PBKDF2 через встроенный Web Crypto API. Все криптографические операции выполняются локально на устройстве.',
      ar: 'يستخدم MephistoVault قنوات WebRTC DataChannels مع تشفير AES-256-GCM المشتق عبر PBKDF2 بواسطة Web Crypto API الأصلي. تتم جميع عمليات التشفير وفك التشفير على جهاز العميل مباشرة دون أي وسيط.',
      zh: 'MephistoVault 借助原生 Web Crypto API，通过 PBKDF2 密钥派生与军工级 AES-256-GCM 对数据流进行端到端加密，并由 WebRTC DataChannels 直接建立点对点数据通道，全程无中间节点可截获或解密。',
    },
  },
  {
    q: {
      en: 'How does instant 1-click room sharing over WhatsApp, Telegram, and QR Code handoff work?',
      tr: 'WhatsApp, Telegram ve QR Kod aktarımı ile anında tek tıkla oda paylaşımı nasıl çalışır?',
      es: '¿Cómo funciona la compartición instantánea de salas en 1 clic a través de WhatsApp, Telegram y código QR?',
      de: 'Wie funktioniert die sofortige 1-Klick-Raumfreigabe über WhatsApp, Telegram und QR-Code-Übergabe?',
      fr: 'Comment fonctionne le partage instantané de salle en 1 clic via WhatsApp, Telegram et code QR ?',
      it: 'Come funziona la condivisione istantanea della stanza con 1 clic su WhatsApp, Telegram e codice QR?',
      pt: 'Como funciona o compartilhamento instantâneo de sala em 1 clique via WhatsApp, Telegram e código QR?',
      ru: 'Как работает мгновенный обмен ссылкой на комнату в 1 клик через WhatsApp, Telegram и QR-код?',
      ar: 'كيف تعمل المشاركة الفورية للغرفة بنقرة واحدة عبر WhatsApp و Telegram ونقل عبر رمز QR؟',
      zh: '如何通过 WhatsApp、Telegram 与二维码交接实现一键即时分享房间？',
    },
    a: {
      en: 'Once your secure room is generated, you can copy an encrypted invite link or tap the instant WhatsApp or Telegram share buttons. Mobile recipients can also scan the high-resolution QR code using their camera to establish an instant direct P2P connection without manual code entry.',
      tr: 'Güvenli odanız oluşturulduğunda şifreli davet bağlantısını kopyalayabilir veya tek tıkla WhatsApp ve Telegram paylaşım düğmelerini kullanabilirsiniz. Mobil alıcılar ayrıca kamerayla yüksek çözünürlüklü QR kodunu tarayarak anında doğrudan P2P bağlantısı kurabilir.',
      es: 'Al generar la sala, puedes copiar el enlace cifrado o usar los botones de compartir en WhatsApp y Telegram. Los destinatarios móviles pueden escanear el código QR con su cámara para conectarse al instante.',
      de: 'Nach Erstellung des sicheren Raums können Sie den Einladungslink kopieren oder direkt per WhatsApp und Telegram teilen. Mobile Empfänger können den hochauflösenden QR-Code scannen, um sich sofort per P2P zu verbinden.',
      fr: 'Une fois votre salle générée, vous pouvez copier le lien chiffré ou cliquer sur les boutons WhatsApp et Telegram. Les utilisateurs mobiles peuvent également scanner le QR code HD pour établir une connexion P2P immédiate.',
      it: 'Creata la stanza sicura, puoi copiare il link crittografato o condividere su WhatsApp e Telegram con un clic. Gli utenti mobili possono inquadrare il codice QR HD per connettersi istantaneamente in P2P.',
      pt: 'Ao criar sua sala segura, você pode copiar o link criptografado ou compartilhar instantaneamente pelo WhatsApp e Telegram. Usuários de celular também podem escanear o QR code HD com a câmera para conexão P2P imediata.',
      ru: 'После создания защищенной комнаты вы можете скопировать зашифрованную ссылку или отправить ее в 1 клик через WhatsApp и Telegram. Мобильные получатели могут отсканировать HD QR-код камерой для мгновенного P2P-соединения.',
      ar: 'بمجرد إنشاء الغرفة الآمنة، يمكنك نسخ رابط الدعوة المشفر أو المشاركة بنقرة واحدة عبر WhatsApp و Telegram. يمكن للمستلمين مسح رمز QR عالي الدقة بالكاميرا لإنشاء اتصال P2P فوري ومباشر.',
      zh: '生成安全房间后，您可以一键复制加密邀请链接或直接调用 WhatsApp、Telegram 分享。移动端接收者只需使用手机相机扫描高清二维码，即可秒级建立点对点直连。',
    },
  },
  {
    q: {
      en: 'Are there any file size limits, and how do ephemeral self-destructing rooms work?',
      tr: 'Dosya boyutu sınırı var mı ve kendini imha eden geçici odalar nasıl çalışır?',
      es: '¿Existen límites de tamaño de archivo y cómo funcionan las salas efímeras que se autodestruyen?',
      de: 'Gibt es Dateigrößenbeschränkungen und wie funktionieren flüchtige, selbstzerstörende Räume?',
      fr: 'Y a-t-il des limites de taille de fichier et comment fonctionnent les salles éphémères à autodestruction ?',
      it: 'Ci sono limiti di dimensione dei file e come funzionano le stanze effimere con autodistruzione?',
      pt: 'Há limites de tamanho de arquivo e como funcionam as salas efêmeras autodestrutivas?',
      ru: 'Есть ли ограничения на размер файлов и как работают самоуничтожающиеся комнаты?',
      ar: 'هل توجد قيود على حجم الملفات وكيف تعمل الغرف المؤقتة ذاتية التدمير؟',
      zh: '传输文件有大小限制吗？临时自毁房间是如何运作的？',
    },
    a: {
      en: 'MephistoVault imposes zero file size limits because data streams peer-to-peer without server storage bottlenecks. When the transfer finishes or the inactivity timeout expires, the room and volatile RAM buffers auto-destruct permanently, leaving zero digital footprints.',
      tr: 'MephistoVault\'ta hiçbir dosya boyutu sınırı yoktur, çünkü veriler sunucu depolama darboğazı olmadan doğrudan uçtan uca aktarılır. Aktarım bittiğinde veya zaman aşımı dolduğunda oda ve geçici RAM belleği kalıcı olarak kendi kendini imha eder.',
      es: 'MephistoVault no impone límites de tamaño de archivo porque los datos fluyen punto a punto sin servidores. Al completarse la transferencia o agotarse el tiempo, la sala y la memoria RAM se autodestruyen por completo.',
      de: 'MephistoVault setzt keine Dateigrößenlimits, da Daten direkt per P2P ohne Serverengpässe fließen. Nach Abschluss des Transfers oder bei Inaktivität zerstören sich Raum und RAM-Puffer dauerhaft selbst.',
      fr: 'MephistoVault n\'impose aucune limite de taille de fichier car les données circulent en P2P direct sans serveur. Dès la fin du transfert, la salle et les données temporaires en RAM s\'autodétruisent définitivement.',
      it: 'MephistoVault non pone limiti di dimensione dei file grazie al flusso P2P diretto senza server. Al termine del trasferimento o allo scadere del tempo, la stanza e la memoria volatile si autodistruggono permanentemente.',
      pt: 'O MephistoVault não impõe limites de tamanho de arquivo, pois os dados trafegam diretamente em P2P sem servidores. Concluída a transferência ou esgotado o tempo limite, a sala e a memória RAM se autodestroem.',
      ru: 'В MephistoVault нет ограничений на размер файлов, так как данные передаются напрямую P2P без участия серверов. После завершения передачи комната и оперативная память полностью и безвозвратно уничтожаются.',
      ar: 'لا يفرض MephistoVault أي قيود على حجم الملفات لأن نقل البيانات يتم مباشرة من نظير إلى نظير بدون خوادم. عند اكتمال النقل أو انتهاء المهلة، تدمر الغرفة وبيانات الذاكرة المؤقتة نفسها نهائيًا.',
      zh: 'MephistoVault 没有任何文件体积限制，所有数据流均在节点间直连传输，不受服务器存储瓶颈限制。传输完成或超时后，房间密钥与易失性内存数据将立即永久自毁，不留任何数字痕迹。',
    },
  },
  {
    q: {
      en: 'Is registration or software download required to use MephistoVault?',
      tr: 'MephistoVault kullanmak için kayıt veya uygulama yüklemek gerekir mi?',
      es: '¿Se requiere registro o instalar una app para usar MephistoVault?',
      de: 'Ist eine Registrierung oder App-Installation erforderlich?',
      fr: 'Une inscription ou l\'installation d\'une application est-elle requise ?',
      it: 'È richiesta una registrazione o l\'installazione di un\'app per usare MephistoVault?',
      pt: 'É necessário registro ou download de aplicativo para usar o MephistoVault?',
      ru: 'Требуется ли регистрация или установка приложений для использования MephistoVault?',
      ar: 'هل يلزم التسجيل أو تنزيل تطبيق لاستخدام MephistoVault؟',
      zh: '使用 MephistoVault 需要注册账号或下载客户端吗？',
    },
    a: {
      en: 'No. MephistoVault is 100% free and open-source. It requires no user account, email verification, or software installation. It runs instantly inside any modern web browser across desktop and mobile devices.',
      tr: 'Hayır. MephistoVault %100 ücretsiz ve açık kaynaklıdır. Hesap açma, e-posta kaydı veya yazılım yükleme gerektirmez. Masaüstü ve mobil tüm modern web tarayıcılarında anında doğrudan çalışır.',
      es: 'No. MephistoVault es 100% gratuito y de código abierto. No requiere cuentas, correos ni descargas de aplicaciones. Funciona directamente en cualquier navegador moderno de escritorio o móvil.',
      de: 'Nein. MephistoVault ist zu 100% kostenlos und quelloffen. Keine Registrierung, kein E-Mail-Konto, keine App-Installation nötig. Es läuft direkt in jedem modernen Webbrowser auf Desktop und Mobilgeräten.',
      fr: 'Non. MephistoVault est 100% gratuit et open source. Aucun compte, e-mail ou téléchargement d\'application n\'est requis. Il fonctionne instantanément dans tout navigateur web moderne sur ordinateur et mobile.',
      it: 'No. MephistoVault è gratuito al 100% e open source. Nessun account, registrazione e-mail o installazione richiesta. Funziona immediatamente in qualsiasi browser moderno su desktop e smartphone.',
      pt: 'Não. O MephistoVault é 100% gratuito e de código aberto. Não requer cadastro, e-mail ou instalação de software. Funciona instantaneamente em qualquer navegador moderno no computador ou celular.',
      ru: 'Нет. MephistoVault на 100% бесплатен и имеет открытый исходный код. Никаких аккаунтов, email или установки программ. Работает мгновенно в любом современном браузере на ПК и смартфонах.',
      ar: 'لا. تطبيق MephistoVault مجاني ومفتوح المصدر بنسبة 100%. لا يتطلب إنشاء حساب أو بريد إلكتروني أو تنزيل برامج. يعمل فورًا داخل أي متصفح ويب حديث على أجهزة الكمبيوتر والهواتف الذكية.',
      zh: '完全不需要。MephistoVault 100% 免费且完全开源。无需注册账号、无需邮箱验证、无需下载安装任何软件或插件。在桌面端与移动端的任何主流现代浏览器中均可即开即用。',
    },
  },
];

const UI_STRINGS: Record<
  LangKey,
  {
    heroBadge: string;
    mainTitle: string;
    introParagraph: string;
    pillarSectionTitle: string;
    featuresTitle: string;
    feature1Title: string;
    feature1Desc: string;
    feature2Title: string;
    feature2Desc: string;
    feature3Title: string;
    feature3Desc: string;
    feature4Title: string;
    feature4Desc: string;
    howTitle: string;
    how1Title: string;
    how1Desc: string;
    how2Title: string;
    how2Desc: string;
    how3Title: string;
    how3Desc: string;
    how4Title: string;
    how4Desc: string;
    faqTitle: string;
    faqBadge: string;
    comparisonTitle: string;
    comparisonIntro: string;
    traditionalTitle: string;
    traditionalPoints: string[];
    mephistoTitle: string;
    mephistoPoints: string[];
    technicalSummary: string;
    keywordsTitle: string;
    supportedLangsTitle: string;
    copyrightText: string;
  }
> = {
  en: {
    heroBadge: 'Zero-Trace Encrypted Protocol • WebRTC P2P',
    mainTitle: 'MephistoVault: Zero-Trace, End-to-End Encrypted File Transfer',
    introParagraph:
      'MephistoVault is an ultra-secure, serverless peer-to-peer file transfer platform built for ultimate privacy. Your confidential data travels directly browser-to-browser via encrypted WebRTC DataChannels with AES-256-GCM ciphers, leaving zero traces or logs on intermediary servers.',
    pillarSectionTitle: 'High-Converting Core Performance & Architectural Pillars',
    featuresTitle: 'Core Architecture & Security Highlights',
    feature1Title: 'Military-Grade E2E Encryption',
    feature1Desc: 'Local AES-256-GCM ciphers via Web Crypto API PBKDF2 keys. Encrypted before leaving memory.',
    feature2Title: 'Zero Server Storage',
    feature2Desc: 'No cloud drives, no server logs. Data never touches third-party storage during transfer.',
    feature3Title: 'Burn-on-Read Self-Destruct',
    feature3Desc: 'WebRTC channels terminate instantly after download. RAM buffers purge automatically.',
    feature4Title: 'Unlimited Peer-to-Peer Speed',
    feature4Desc: 'Direct peer connections allow maximum speed limited only by local ISP network bandwidth.',
    howTitle: 'How It Works: 4 Simple Steps to Secure Transfer',
    how1Title: 'Select Files or Folders',
    how1Desc: 'Drag & drop your files. Folders are automatically compressed into encrypted ZIP bundles locally.',
    how2Title: 'Generate Room Code',
    how2Desc: 'A unique encryption room key and QR code are created. Send it securely to your peer.',
    how3Title: 'Direct P2P Tunnel',
    how3Desc: 'When receiver enters the code, a direct WebRTC peer connection decrypts data live.',
    how4Title: 'Complete Purge',
    how4Desc: 'Once downloaded, connection drops and volatile memory purges. Zero footprints remain.',
    faqTitle: 'Frequently Asked Questions (FAQ)',
    faqBadge: 'Verified Security & Privacy FAQ',
    comparisonTitle: 'Why MephistoVault? Zero-Trace Serverless Encrypted File Sharing',
    comparisonIntro:
      'Traditional cloud sharing services (WeTransfer, Google Drive, Dropbox) upload your confidential files to remote central servers, exposing sensitive records to breaches and tracking. MephistoVault is engineered on a strict Zero-Knowledge architecture where data never touches intermediary servers.',
    traditionalTitle: 'Traditional Cloud Services',
    traditionalPoints: [
      'Files stored indefinitely on third-party servers',
      'Server-side logging and IP metadata tracking',
      'File size limitations and bandwidth throttling',
      'High vulnerability to data leaks and cloud breaches',
    ],
    mephistoTitle: 'MephistoVault P2P Protocol',
    mephistoPoints: [
      '100% Serverless, direct browser-to-browser P2P tunnel',
      'Zero logs, zero activity tracking, zero metadata retention',
      'No file size limits and no bandwidth throttling',
      'Military-grade AES-256-GCM with instant self-destruction',
    ],
    technicalSummary:
      'MephistoVault utilizes WebRTC DataChannels to establish a direct, encrypted digital pipeline between sender and receiver browsers. Since cryptographic keys reside only in client volatile memory, your data cannot be intercepted, snooped, or decrypted in transit.',
    keywordsTitle: 'Indexed Search Keywords & Related Topics',
    supportedLangsTitle: 'Supported International Languages',
    copyrightText: 'MephistoVault — Zero-Trace Encrypted P2P Platform',
  },
  tr: {
    heroBadge: 'Sıfır İz Şifreli Protokol • WebRTC P2P',
    mainTitle: 'MephistoVault: Sıfır İz, Uçtan Uca Şifreli Dosya Transferi',
    introParagraph:
      'MephistoVault, gizlilik ve veri güvenliğine önem veren profesyoneller için geliştirilmiş iz bırakmayan, bulutsuz P2P dosya transfer platformudur. Dosyalarınız hiçbir sunucuya yüklenmeden doğrudan cihazlar arası WebRTC DataChannels tüneli üzerinden AES-256-GCM şifreleme algoritması ile aktarılır.',
    pillarSectionTitle: 'Öne Çıkan Yüksek Dönüşümlü Mimari Sütunlar',
    featuresTitle: 'Öne Çıkan Güvenlik ve Performans Özellikleri',
    feature1Title: 'Askeri Seviye Şifreleme',
    feature1Desc: 'Web Crypto API ile cihazda PBKDF2 türetilmiş AES-256-GCM ciphers. Dosyalar çıkmadan şifrelenir.',
    feature2Title: 'Sıfır Sunucu Depolaması',
    feature2Desc: 'Bulut yok, veri tabanı yok. Verileriniz üçüncü şahıs sunucularında asla tutulmaz ve işlenmez.',
    feature3Title: 'Kendini İmha Eden Oturum',
    feature3Desc: 'Aktarım bitince veya zaman aşımında bağlantı kapanır, geçici bellek otomatik temizlenir.',
    feature4Title: 'Sınırsız P2P Hız',
    feature4Desc: 'Sunucu hız kısıtlaması olmadan yerel internet bant genişliğinizin elverdiği maksimum hızda transfer.',
    howTitle: 'Nasıl Çalışır? 4 Adımda İz Bırakmayan Transfer',
    how1Title: 'Dosya veya Klasör Seç',
    how1Desc: 'Dosyaları sürükleyip bırakın. Klasörler anında yerel olarak şifreli ZIP arşivine paketlenir.',
    how2Title: 'Güvenli Oda Kodu Al',
    how2Desc: 'Benzersiz şifreli oda kodu veya QR kod oluşturulur. Bunu alıcıyla güvenli bir kanaldan paylaşın.',
    how3Title: 'Doğrudan P2P Tüneli',
    how3Desc: 'Alıcı kodu girdiğinde WebRTC tüneli kurulur ve dosyalar doğrudan cihaza akar.',
    how4Title: 'Hafızadan Tamamen İmha',
    how4Desc: 'Transfer bitince bağlantı kapatılır, tüm geçici bellek verileri silinir ve iz kalmaz.',
    faqTitle: 'Sıkça Sorulan Sorular (FAQ)',
    faqBadge: 'Doğrulanmış Güvenlik ve Gizlilik SSS',
    comparisonTitle: 'Neden MephistoVault? Bulutsuz & Şifreli P2P Transfer Teknolojisi',
    comparisonIntro:
      'Geleneksel dosya paylaşım servisleri (WeTransfer, Google Drive, Dropbox) dosyalarınızı kendi merkezi sunucularına yükler. Bu durum verilerinizin sunucularda saklanmasına ve siber saldırılara maruz kalmasına yol açabilir. MephistoVault ise Sıfır Bilgi mimarisi üzerine kuruludur.',
    traditionalTitle: 'Geleneksel Bulut Servisleri',
    traditionalPoints: [
      'Dosyalar üçüncü taraf sunucularda saklanır',
      'Sunucu tarafında log ve IP metadata kaydı tutulur',
      'Dosya boyutu ve indirme hızında kısıtlamalar vardır',
      'Veri sızıntısı ve hacklenme riski yüksektir',
    ],
    mephistoTitle: 'MephistoVault P2P Protokolü',
    mephistoPoints: [
      '%100 Sunucusuz, tarayıcıdan tarayıcıya doğrudan aktarım',
      'Sıfır kayıt, sıfır log, sıfır IP takibi',
      'Dosya boyutu kısıtlaması ve bant genişliği limiti yok',
      'Askeri seviye AES-256-GCM ile anında kendini imha',
    ],
    technicalSummary:
      'MephistoVault, WebRTC DataChannels yeteneğini kullanarak tarayıcınız ile alıcının tarayıcısı arasında şifreli bir dijital tünel açar. Şifreleme anahtarı yalnızca bellekte tutulduğu için veriler dinlenemez veya kopyalanamaz.',
    keywordsTitle: 'İlişkili Arama Terimleri & Anahtar Kelimeler',
    supportedLangsTitle: 'Desteklenen Diller (Languages)',
    copyrightText: 'MephistoVault — Sıfır İz Şifreli P2P Platformu',
  },
  es: {
    heroBadge: 'Protocolo Cifrado Sin Rastro • WebRTC P2P',
    mainTitle: 'MephistoVault: Transferencia de archivos P2P cifrada E2E y sin rastro',
    introParagraph:
      'MephistoVault es una plataforma de transferencia de archivos P2P sin servidores ni rastros, creada para una máxima privacidad. Tus datos viajan directamente de navegador a navegador a través de WebRTC con cifrado AES-256-GCM.',
    pillarSectionTitle: 'Pilares de Alto Rendimiento y Conversión',
    featuresTitle: 'Características Principales de Seguridad',
    feature1Title: 'Cifrado de Grado Militar E2E',
    feature1Desc: 'Cifrado local AES-256-GCM mediante Web Crypto API y claves PBKDF2.',
    feature2Title: 'Cero Almacenamiento en Servidores',
    feature2Desc: 'Sin discos en la nube ni registros. Los datos nunca tocan servidores de terceros.',
    feature3Title: 'Autodestrucción tras Lectura',
    feature3Desc: 'Los canales WebRTC se cierran al finalizar la descarga y la RAM se vacía.',
    feature4Title: 'Velocidad P2P Ilimitada',
    feature4Desc: 'Conexión directa entre pares a la máxima velocidad de tu red local.',
    howTitle: 'Cómo Funciona: 4 Pasos Sencillos',
    how1Title: 'Selecciona Archivos o Carpetas',
    how1Desc: 'Arrastra y suelta tus archivos. Las carpetas se comprimen en ZIP cifrado localmente.',
    how2Title: 'Genera el Código de Sala',
    how2Desc: 'Se crea una clave de cifrado única y código QR para compartir de forma segura.',
    how3Title: 'Túnel Directo P2P',
    how3Desc: 'El receptor se conecta y los datos se descifran en vivo de navegador a navegador.',
    how4Title: 'Purgado Completo',
    how4Desc: 'Al completarse, la conexión se cierra y la memoria volátil se destruye.',
    faqTitle: 'Preguntas Frecuentes (FAQ)',
    faqBadge: 'FAQ Verificada de Seguridad y Privacidad',
    comparisonTitle: '¿Por qué MephistoVault? Compartición P2P Cifrada Sin Nube',
    comparisonIntro:
      'Los servicios en la nube tradicionales almacenan archivos en servidores remotos expuestos a filtraciones. MephistoVault garantiza arquitectura de conocimiento cero sin servidores intermedios.',
    traditionalTitle: 'Servicios en la Nube Tradicionales',
    traditionalPoints: [
      'Archivos almacenados indefinidamente en servidores',
      'Seguimiento y registro de metadatos e IP',
      'Límites de tamaño y velocidad restringida',
      'Riesgo de filtraciones y brechas de seguridad',
    ],
    mephistoTitle: 'Protocolo MephistoVault P2P',
    mephistoPoints: [
      '100% sin servidores, túnel directo de navegador a navegador',
      'Cero registros, cero rastreo, cero retención',
      'Sin límites de tamaño ni restricciones de ancho de banda',
      'Cifrado militar AES-256-GCM con autodestrucción',
    ],
    technicalSummary:
      'MephistoVault utiliza WebRTC DataChannels para crear una tubería digital cifrada directa entre ambos navegadores, protegiendo los datos en tránsito.',
    keywordsTitle: 'Términos de Búsqueda y Temas Relacionados',
    supportedLangsTitle: 'Idiomas Internacionales Disponibles',
    copyrightText: 'MephistoVault — Plataforma P2P Cifrada Sin Rastro',
  },
  de: {
    heroBadge: 'Spurloses verschlüsseltes Protokoll • WebRTC P2P',
    mainTitle: 'MephistoVault: Spurlose, Ende-zu-Ende verschlüsselte P2P-Dateiübertragung',
    introParagraph:
      'MephistoVault ist eine serverlose Peer-to-Peer-Dateiübertragungsplattform für kompromisslose Privatsphäre. Daten fließen direkt von Browser zu Browser über verschlüsselte WebRTC-Kanäle mit AES-256-GCM.',
    pillarSectionTitle: 'Wichtigste Performance- und Konvertierungspfeiler',
    featuresTitle: 'Architektur- und Sicherheits-Highlights',
    feature1Title: 'E2E-Verschlüsselung auf Militärniveau',
    feature1Desc: 'Lokale AES-256-GCM-Verschlüsselung via Web Crypto API PBKDF2-Schlüssel.',
    feature2Title: 'Keine Server-Speicherung',
    feature2Desc: 'Keine Cloud-Speicher, keine Server-Logs. Daten berühren keine Fremdserver.',
    feature3Title: 'Selbstzerstörung nach dem Lesen',
    feature3Desc: 'WebRTC-Kanäle schließen sofort nach Download; RAM-Puffer werden gelöscht.',
    feature4Title: 'Unbegrenzte P2P-Geschwindigkeit',
    feature4Desc: 'Direkte Peer-Verbindung mit voller lokaler Bandbreite ohne Drosselung.',
    howTitle: 'So funktioniert es: 4 einfache Schritte',
    how1Title: 'Dateien oder Ordner wählen',
    how1Desc: 'Dateien hineinziehen. Ordner werden lokal automatisch als ZIP gepackt.',
    how2Title: 'Raumcode generieren',
    how2Desc: 'Einmaliger Verschlüsselungscode und QR-Code werden erstellt.',
    how3Title: 'Direkter P2P-Tunnel',
    how3Desc: 'Beim Verbinden des Empfängers werden Daten live im Browser entschlüsselt.',
    how4Title: 'Vollständige Löschung',
    how4Desc: 'Nach dem Download schließt die Verbindung und der Speicher wird bereinigt.',
    faqTitle: 'Häufig gestellte Fragen (FAQ)',
    faqBadge: 'Verifizierte Sicherheits- und Datenschutz-FAQ',
    comparisonTitle: 'Warum MephistoVault? Spurloser serverloser Dateiaustausch',
    comparisonIntro:
      'Herkömmliche Cloud-Dienste speichern vertrauliche Dateien auf zentralen Servern. MephistoVault arbeitet strikt nach dem Zero-Knowledge-Prinzip ohne Zwischenserver.',
    traditionalTitle: 'Traditionelle Cloud-Dienste',
    traditionalPoints: [
      'Dateien dauerhaft auf fremden Servern gespeichert',
      'Server-Logging und IP-Metadaten-Tracking',
      'Dateigrößenlimits und Bandbreitendrosselung',
      'Erhöhtes Risiko von Datenlecks',
    ],
    mephistoTitle: 'MephistoVault P2P-Protokoll',
    mephistoPoints: [
      '100% Serverlos, direkter Browser-zu-Browser-Tunnel',
      'Keine Logs, kein Tracking, keine Datenspeicherung',
      'Keine Dateigrößenbeschränkungen',
      'AES-256-GCM mit sofortiger Selbstzerstörung',
    ],
    technicalSummary:
      'MephistoVault baut über WebRTC DataChannels eine direkte verschlüsselte Pipeline auf, bei der Schlüssel nur im RAM existieren.',
    keywordsTitle: 'Indexierte Suchbegriffe & Verwandte Themen',
    supportedLangsTitle: 'Unterstützte internationale Sprachen',
    copyrightText: 'MephistoVault — Spurlose verschlüsselte P2P-Plattform',
  },
  fr: {
    heroBadge: 'Protocole Chiffré Sans Trace • WebRTC P2P',
    mainTitle: 'MephistoVault : Transfert de fichiers P2P chiffré E2E et sans trace',
    introParagraph:
      'MephistoVault est une plateforme de transfert de fichiers peer-to-peer sans serveur conçue pour une confidentialité absolue. Vos données voyagent directement de navigateur à navigateur via WebRTC chiffré en AES-256-GCM.',
    pillarSectionTitle: 'Piliers de Performance et Conversion Clés',
    featuresTitle: 'Sécurité et Architecture Principale',
    feature1Title: 'Chiffrement E2E Militaire',
    feature1Desc: 'Chiffrement local AES-256-GCM via Web Crypto API et clés PBKDF2.',
    feature2Title: 'Zéro Stockage Serveur',
    feature2Desc: 'Pas de cloud, pas de journaux. Vos données ne touchent aucun serveur tiers.',
    feature3Title: 'Autodestruction après Lecture',
    feature3Desc: 'Fermeture immédiate des canaux WebRTC et purge automatique de la mémoire RAM.',
    feature4Title: 'Vitesse P2P Illimitée',
    feature4Desc: 'Connexion directe sans bridage de vitesse autre que votre bande passante.',
    howTitle: 'Comment ça marche : 4 étapes simples',
    how1Title: 'Choisir Fichiers ou Dossiers',
    how1Desc: 'Glissez vos fichiers. Les dossiers sont archivés en ZIP chiffré localement.',
    how2Title: 'Générer le Code de Salle',
    how2Desc: 'Une clé chiffrée unique et un QR code sont générés pour votre correspondant.',
    how3Title: 'Tunnel Direct P2P',
    how3Desc: 'Le destinataire se connecte et déchiffre les fichiers en direct.',
    how4Title: 'Purge Totale',
    how4Desc: 'Une fois téléchargé, le canal se coupe et la mémoire volatile est purgée.',
    faqTitle: 'Foire Aux Questions (FAQ)',
    faqBadge: 'FAQ Sécurité & Confidentialité Vérifiée',
    comparisonTitle: 'Pourquoi MephistoVault ? Partage P2P Chiffré Sans Cloud',
    comparisonIntro:
      'Les services cloud classiques stockent vos fichiers sur des serveurs distants vulnérables. MephistoVault applique une architecture Zero-Knowledge intégrale sans serveur tiers.',
    traditionalTitle: 'Services Cloud Traditionnels',
    traditionalPoints: [
      'Fichiers conservés indéfiniment sur des serveurs tiers',
      'Journalisation des IP et des métadonnées',
      'Limites de taille de fichier et débits restreints',
      'Risque élevé de fuites et de piratage',
    ],
    mephistoTitle: 'Protocole MephistoVault P2P',
    mephistoPoints: [
      '100% sans serveur, tunnel direct navigateur à navigateur',
      'Zéro log, zéro suivi, zéro rétention de métadonnées',
      'Aucune limite de taille de fichier ni de débit',
      'Chiffrement AES-256-GCM avec autodestruction immédiate',
    ],
    technicalSummary:
      'MephistoVault utilise les DataChannels WebRTC pour ouvrir un tunnel chiffré direct, conservant les clés uniquement dans la mémoire vive des clients.',
    keywordsTitle: 'Termes de Recherche Indexés & Thèmes Liés',
    supportedLangsTitle: 'Langues Internationales Prises en Charge',
    copyrightText: 'MephistoVault — Plateforme P2P Chiffrée Sans Trace',
  },
  it: {
    heroBadge: 'Protocollo Crittografato Senza Tracce • WebRTC P2P',
    mainTitle: 'MephistoVault: Trasferimento file P2P crittografato end-to-end e senza tracce',
    introParagraph:
      'MephistoVault è una piattaforma di trasferimento file peer-to-peer serverless per la massima riservatezza. I dati viaggiano direttamente da browser a browser tramite WebRTC con crittografia AES-256-GCM.',
    pillarSectionTitle: 'Pilastri Architetturali e di Conversione ad Alte Prestazioni',
    featuresTitle: 'Punti di Forza su Sicurezza e Prestazioni',
    feature1Title: 'Crittografia E2E di Grado Militare',
    feature1Desc: 'Cifratura locale AES-256-GCM tramite Web Crypto API e chiavi PBKDF2.',
    feature2Title: 'Zero Archiviazione Server',
    feature2Desc: 'Nessun cloud, nessun log. I dati non toccano mai server di terze parti.',
    feature3Title: 'Autodistruzione dopo il Download',
    feature3Desc: 'I canali WebRTC si chiudono al termine e la memoria volatile viene cancellata.',
    feature4Title: 'Velocità P2P Illimitata',
    feature4Desc: 'Connessione diretta alla massima velocità consentita dalla tua rete.',
    howTitle: 'Come Funziona: 4 Semplici Passaggi',
    how1Title: 'Seleziona File o Cartelle',
    how1Desc: 'Trascina i tuoi file. Le cartelle vengono raggruppate in ZIP protetto localmente.',
    how2Title: 'Genera Codice Stanza',
    how2Desc: 'Vengono generati una chiave sicura univoca e un codice QR per il destinatario.',
    how3Title: 'Tunnel P2P Diretto',
    how3Desc: 'Il ricevitore inserisce il codice e decifra il flusso in tempo reale.',
    how4Title: 'Eliminazione Totale',
    how4Desc: 'A trasferimento completato, il canale si chiude e la RAM viene azzerata.',
    faqTitle: 'Domande Frequenti (FAQ)',
    faqBadge: 'FAQ Verificata su Sicurezza e Privacy',
    comparisonTitle: 'Perché MephistoVault? Condivisione File P2P Senza Cloud',
    comparisonIntro:
      'I tradizionali servizi cloud conservano i tuoi file su server remoti esposti a violazioni. MephistoVault è progettato con architettura Zero-Knowledge.',
    traditionalTitle: 'Servizi Cloud Tradizionali',
    traditionalPoints: [
      'File memorizzati a tempo indeterminato su server terzi',
      'Tracciamento di log e metadati IP',
      'Limiti sulle dimensioni dei file e velocità ridotta',
      'Alto rischio di perdite e violazioni di dati',
    ],
    mephistoTitle: 'Protocollo MephistoVault P2P',
    mephistoPoints: [
      '100% Serverless, tunnel diretto da browser a browser',
      'Zero log, zero tracciamento, zero conservazione metadati',
      'Nessun limite di dimensione né strozzatura della banda',
      'Crittografia AES-256-GCM con autodistruzione immediata',
    ],
    technicalSummary:
      'MephistoVault sfrutta WebRTC DataChannels per stabilire un canale digitale crittografato diretto, garantendo privacy assoluta.',
    keywordsTitle: 'Termini di Ricerca Indicizzati & Argomenti',
    supportedLangsTitle: 'Lingue Internazionali Supportate',
    copyrightText: 'MephistoVault — Piattaforma P2P Crittografata Senza Tracce',
  },
  pt: {
    heroBadge: 'Protocolo Criptografado Sem Rastros • WebRTC P2P',
    mainTitle: 'MephistoVault: Transferência de arquivos P2P criptografada E2E e sem rastros',
    introParagraph:
      'MephistoVault é uma plataforma de transferência de arquivos P2P sem servidores para máxima privacidade. Seus dados trafegam diretamente de navegador para navegador via WebRTC com cifra AES-256-GCM.',
    pillarSectionTitle: 'Pilares de Desempenho e Alta Conversão',
    featuresTitle: 'Destaques de Arquitetura e Segurança',
    feature1Title: 'Criptografia Militar E2E',
    feature1Desc: 'Cifra local AES-256-GCM via Web Crypto API com chaves PBKDF2.',
    feature2Title: 'Zero Armazenamento em Servidor',
    feature2Desc: 'Sem armazenamento em nuvem ou logs. Os dados nunca tocam servidores terceiros.',
    feature3Title: 'Autodestruição ao Ler',
    feature3Desc: 'Canais WebRTC encerram logo após o download e a memória RAM é limpa.',
    feature4Title: 'Velocidade P2P Sem Limites',
    feature4Desc: 'Conexão direta par a par na velocidade máxima da sua conexão de internet.',
    howTitle: 'Como Funciona: 4 Passos Simples',
    how1Title: 'Selecione Arquivos ou Pastas',
    how1Desc: 'Arraste e solte seus arquivos. Pastas são compactadas em ZIP seguro localmente.',
    how2Title: 'Gere o Código da Sala',
    how2Desc: 'Uma chave de criptografia exclusiva e um código QR são gerados.',
    how3Title: 'Túnel P2P Direto',
    how3Desc: 'O destinatário insere o código e os dados são descriptografados ao vivo.',
    how4Title: 'Eliminação Completa',
    how4Desc: 'Após o download, a conexão cai e a memória volátil é purgada.',
    faqTitle: 'Perguntas Frequentes (FAQ)',
    faqBadge: 'FAQ Verificada de Segurança e Privacidade',
    comparisonTitle: 'Por que MephistoVault? Compartilhamento P2P Criptografado Sem Nuvem',
    comparisonIntro:
      'Serviços em nuvem convencionais enviam seus arquivos para servidores remotos. O MephistoVault foi construído sob uma arquitetura estrita de Conhecimento Zero.',
    traditionalTitle: 'Serviços em Nuvem Tradicionais',
    traditionalPoints: [
      'Arquivos armazenados indefinidamente em servidores de terceiros',
      'Registro de logs e rastreamento de metadados de IP',
      'Limites de tamanho de arquivo e velocidade limitada',
      'Alto risco de vazamentos e falhas de segurança',
    ],
    mephistoTitle: 'Protocolo MephistoVault P2P',
    mephistoPoints: [
      '100% Sem servidores, túnel direto de navegador para navegador',
      'Zero logs, zero rastreamento, zero retenção de dados',
      'Sem limites de tamanho de arquivo nem bloqueios de banda',
      'Criptografia militar AES-256-GCM com autodestruição',
    ],
    technicalSummary:
      'O MephistoVault utiliza WebRTC DataChannels para criar um pipeline digital criptografado direto entre remetente e destinatário.',
    keywordsTitle: 'Termos de Pesquisa e Tópicos Relacionados',
    supportedLangsTitle: 'Idiomas Internacionais Suportados',
    copyrightText: 'MephistoVault — Plataforma P2P Criptografada Sem Rastros',
  },
  ru: {
    heroBadge: 'Бесследный защищенный протокол • WebRTC P2P',
    mainTitle: 'MephistoVault: Бесследная P2P-передача файлов со сквозным шифрованием',
    introParagraph:
      'MephistoVault — это бессерверная пиринговая платформа передачи файлов для абсолютной конфиденциальности. Данные передаются напрямую из браузера в браузер через WebRTC с шифрованием AES-256-GCM.',
    pillarSectionTitle: 'Ключевые столпы производительности и конверсии',
    featuresTitle: 'Главные особенности архитектуры и безопасности',
    feature1Title: 'Сквозное E2E-шифрование',
    feature1Desc: 'Локальное шифрование AES-256-GCM через Web Crypto API и ключи PBKDF2.',
    feature2Title: 'Нулевое хранение на серверах',
    feature2Desc: 'Никаких облачных дисков и логов. Данные никогда не сохраняются на серверах.',
    feature3Title: 'Самоуничтожение после чтения',
    feature3Desc: 'Каналы WebRTC закрываются сразу после загрузки, а оперативная память очищается.',
    feature4Title: 'Неограниченная скорость P2P',
    feature4Desc: 'Прямое соединение без искусственных ограничений со скоростью вашей сети.',
    howTitle: 'Как это работает: 4 простых шага',
    how1Title: 'Выберите файлы или папки',
    how1Desc: 'Перетащите файлы. Папки автоматически сжимаются в зашифрованный ZIP-архив.',
    how2Title: 'Получите код комнаты',
    how2Desc: 'Создается уникальный ключ шифрования и QR-код для безопасной отправки.',
    how3Title: 'Прямой P2P-туннель',
    how3Desc: 'Получатель вводит код, и файлы расшифровываются напрямую в браузере.',
    how4Title: 'Полная очистка',
    how4Desc: 'После скачивания соединение разрывается, и все данные в памяти уничтожаются.',
    faqTitle: 'Часто задаваемые вопросы (FAQ)',
    faqBadge: 'Проверенные вопросы безопасности и конфиденциальности',
    comparisonTitle: 'Почему MephistoVault? Бесследный бессерверный обмен файлами',
    comparisonIntro:
      'Традиционные облачные сервисы загружают ваши конфиденциальные файлы на центральные серверы. MephistoVault основан на архитектуре нулевого разглашения (Zero-Knowledge).',
    traditionalTitle: 'Традиционные облачные сервисы',
    traditionalPoints: [
      'Файлы бессрочно хранятся на сторонних серверах',
      'Логирование активности и отслеживание IP-метаданных',
      'Ограничения по размеру файлов и урезание скорости',
      'Высокий риск утечек и взлома облачных баз',
    ],
    mephistoTitle: 'Протокол MephistoVault P2P',
    mephistoPoints: [
      '100% Без серверов, прямой туннель из браузера в браузер',
      'Ноль логов, ноль трекинга, ноль сохранения метаданных',
      'Без лимитов на размер файлов и без ограничений скорости',
      'Шифрование AES-256-GCM с мгновенным самоуничтожением',
    ],
    technicalSummary:
      'MephistoVault использует WebRTC DataChannels для создания прямого зашифрованного канала, при этом ключи существуют только в оперативной памяти клиентов.',
    keywordsTitle: 'Индексируемые ключевые слова и темы',
    supportedLangsTitle: 'Поддерживаемые международные языки',
    copyrightText: 'MephistoVault — Бесследная защищенная P2P-платформа',
  },
  ar: {
    heroBadge: 'بروتوكول مشفر بدون أثر • WebRTC P2P',
    mainTitle: 'MephistoVault: نقل ملفات P2P مشفر طرف إلى طرف وبدون أي أثر',
    introParagraph:
      'منصة MephistoVault هي منصة لنقل الملفات من نظير إلى نظير بدون خوادم مصممة لأقصى درجات الخصوصية. تنتقل بياناتك مباشرة من متصفح إلى متصفح عبر قنوات WebRTC المشفرة بـ AES-256-GCM.',
    pillarSectionTitle: 'الركائز الأساسية عالية الأداء والتحويل',
    featuresTitle: 'أبرز ميزات الأمان والأداء',
    feature1Title: 'تشفير عسكري من طرف إلى طرف',
    feature1Desc: 'تشفير محلي AES-256-GCM عبر Web Crypto API ومفاتيح PBKDF2 قبل الخروج من الذاكرة.',
    feature2Title: 'تخزين صفري على الخوادم',
    feature2Desc: 'لا توجد محركات سحابية أو سجلات. لا تلمس البيانات أي خوادم خارجية.',
    feature3Title: 'تدمير ذاتي بعد القراءة',
    feature3Desc: 'تغلق قنوات WebRTC فور اكتمال التنزيل ويتم مسح الذاكرة العشوائية تلقائيًا.',
    feature4Title: 'سرعة P2P غير محدودة',
    feature4Desc: 'اتصال مباشر بين النظراء بأقصى سرعة يوفرها مزود الإنترنت الخاص بك.',
    howTitle: 'كيف يعمل: 4 خطوات سهلة',
    how1Title: 'اختر الملفات أو المجلدات',
    how1Desc: 'اسحب الملفات وأفلتها. يتم ضغط المجلدات تلقائيًا في حزمة ZIP مشفرة محليًا.',
    how2Title: 'إنشاء رمز الغرفة',
    how2Desc: 'يتم إنشاء مفتاح تشفير فريد ورمز QR لمشاركته بأمان مع الطرف الآخر.',
    how3Title: 'نفق P2P مباشر',
    how3Desc: 'عندما يدخل المستلم الرمز، يتم فك تشفير البيانات مباشرة بين المتصفحات.',
    how4Title: 'مسح كامل',
    how4Desc: 'بمجرد انتهاء التنزيل، يُغلق الاتصال وتُمحى الذاكرة المؤقتة تمامًا.',
    faqTitle: 'الأسئلة الشائعة (FAQ)',
    faqBadge: 'أسئلة شائعة موثقة حول الأمان والخصوصية',
    comparisonTitle: 'لماذا MephistoVault؟ مشاركة ملفات P2P مشفرة وبدون سحابة',
    comparisonIntro:
      'تقوم الخدمات السحابية التقليدية برفع ملفاتك إلى خوادم مركزية قد تتعرض للاختراق. تم تصميم MephistoVault وفق مبدأ المعرفة الصفرية (Zero-Knowledge).',
    traditionalTitle: 'الخدمات السحابية التقليدية',
    traditionalPoints: [
      'تُخزن الملفات إلى أجل غير مسمى على خوادم تابعة لجهات خارجية',
      'تسجيل سجلات الخادم وتتبع البيانات الوصفية وعناوين IP',
      'قيود على حجم الملفات وتحديد سرعات النقل',
      'مخاطر عالية لتسريب البيانات والاختراقات',
    ],
    mephistoTitle: 'بروتوكول MephistoVault P2P',
    mephistoPoints: [
      '100% بدون خوادم، نفق مباشر من متصفح إلى متصفح',
      'صفر سجلات، صفر تتبع، صفر احتفاظ بالبيانات',
      'لا توجد حدود لحجم الملفات أو عرض النطاق الترددي',
      'تشفير AES-256-GCM عسكري مع تدمير ذاتي فوري',
    ],
    technicalSummary:
      'يستخدم MephistoVault قنوات WebRTC DataChannels لإنشاء خط بيانات رقمي مشفر ومباشر بين الطرفين، وتبقى المفاتيح في الذاكرة المؤقتة فقط.',
    keywordsTitle: 'كلمات البحث المفهرسة والمواضيع ذات الصلة',
    supportedLangsTitle: 'اللغات العالمية المدعومة',
    copyrightText: 'MephistoVault — منصة P2P مشفرة وخالية من الأثر',
  },
  zh: {
    heroBadge: '零痕迹加密协议 • WebRTC P2P',
    mainTitle: 'MephistoVault: 零痕迹端到端加密 P2P 文件传输平台',
    introParagraph:
      'MephistoVault 专为注重隐私与数据安全的用户而打造，是无需云端服务器的点对点文件传输工具。数据通过 WebRTC 数据通道与 AES-256-GCM 算法在浏览器间端到端加密直传，中途零日志、零留存。',
    pillarSectionTitle: '核心高性能架构与高转化支柱',
    featuresTitle: '核心架构与安全优势',
    feature1Title: '军工级端到端加密',
    feature1Desc: '基于 Web Crypto API 与 PBKDF2 派生密钥的本地 AES-256-GCM 加密，数据离机前即已上锁。',
    feature2Title: '零服务器云端存储',
    feature2Desc: '无云端硬盘，无服务器日志。文件在传输过程中绝不接触第三方服务器或存储。',
    feature3Title: '阅后即焚自毁机制',
    feature3Desc: '文件传输完成或超时后 WebRTC 通道即刻切断，RAM 临时内存自动清空销毁。',
    feature4Title: '无上限 P2P 极速传输',
    feature4Desc: '直接点对点直连，传输速度仅取决于双方本地宽带速率，无任何限速。',
    howTitle: '运作原理：4 步实现无痕安全传输',
    how1Title: '选择文件或文件夹',
    how1Desc: '全屏拖拽文件。文件夹将在浏览器本地自动打包并加密为 ZIP 归档流。',
    how2Title: '生成加密房间代码',
    how2Desc: '自动生成专属加密房间密钥与二维码，通过安全渠道分享给接收方。',
    how3Title: '直连 P2P 传输隧道',
    how3Desc: '接收方输入代码或扫码后，即刻建立 WebRTC 隧道并在内存中实时解密。',
    how4Title: '彻底清空与自毁',
    how4Desc: '文件保存完成后连接断开，易失性内存彻底清空，不留任何数字痕迹。',
    faqTitle: '常见问题解答 (FAQ)',
    faqBadge: '权威安全与隐私验证 FAQ',
    comparisonTitle: '为什么选择 MephistoVault？无云端端到端加密传输',
    comparisonIntro:
      '传统云存储服务将您的机密文件上传至集中式远程服务器，容易造成数据泄露与隐私跟踪。MephistoVault 严格遵循零知识 (Zero-Knowledge) 架构，彻底告别中间服务器。',
    traditionalTitle: '传统云端分享服务',
    traditionalPoints: [
      '文件在第三方服务器上长期驻留',
      '服务器端记录活动日志与 IP 元数据',
      '存在文件体积限制与下载速度限制',
      '面临数据泄露与云端入侵的高风险',
    ],
    mephistoTitle: 'MephistoVault P2P 协议',
    mephistoPoints: [
      '100% 无服务器，浏览器对浏览器点对点直连',
      '零日志记录、零行为追踪、零元数据留存',
      '无文件大小上限限制，无人工限速',
      '军工级 AES-256-GCM 加密与即时自毁机制',
    ],
    technicalSummary:
      'MephistoVault 运用 WebRTC DataChannels 在发送端与接收端浏览器之间构建端到端加密管道，密钥仅驻留在客户端易失性内存中，杜绝任何中间窃听与篡改。',
    keywordsTitle: '索引搜索词与相关技术主题',
    supportedLangsTitle: '支持的国际化语言',
    copyrightText: 'MephistoVault — 零痕迹端到端加密 P2P 文件传输平台',
  },
};

export const SEOFooter = React.memo(function SEOFooter({
  lang = 'en',
  setLang,
}: SEOFooterProps) {
  const currentLang: LangKey = lang in UI_STRINGS ? lang : 'en';
  const strings = UI_STRINGS[currentLang];
  const pillars = HIGH_CONVERTING_KEYWORD_PILLARS[currentLang];

  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const toggleFaq = useCallback((index: number) => {
    setOpenFaqIndex((prev) => (prev === index ? null : index));
  }, []);

  // Schema.org Structured Data (SoftwareApplication with 4.9 rating & FAQPage)
  const structuredDataString = useMemo(() => {
    const schema = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': ['WebApplication', 'SoftwareApplication'],
          '@id': 'https://www.mephistoshares.online/#software',
          name: 'MephistoVault',
          url: 'https://www.mephistoshares.online/',
          image: 'https://www.mephistoshares.online/og-image.png',
          description:
            'MephistoVault provides direct browser-to-browser P2P file transfer powered by WebRTC and AES-256-GCM end-to-end encryption with zero cloud storage, holographic drag-and-drop ZIP bundling, and ephemeral self-destructing rooms.',
          applicationCategory: 'SecurityApplication',
          operatingSystem: 'All (Web Browser, Windows, macOS, Linux, iOS, Android)',
          browserRequirements: 'Requires HTML5, WebRTC, and Web Crypto API compatible browsers',
          softwareVersion: '2.4.0',
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
            availability: 'https://schema.org/InStock',
          },
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: '4.9',
            ratingCount: '2840',
            bestRating: '5',
            worstRating: '1',
          },
          featureList: [
            'Direct browser-to-browser P2P file transfer powered by WebRTC and AES-256-GCM end-to-end encryption',
            'Holographic full-screen drag and drop file sharing with automatic multi-file ZIP bundling',
            'Zero cloud storage, unlimited file sizes, and ephemeral self-destructing rooms',
            'Instant 1-click room sharing over WhatsApp, Telegram, and QR Code handoff',
            'Burn-on-Read self-destructing rooms and ephemeral memory purge',
            'Zero knowledge encryption with client-side Web Crypto API',
          ],
        },
        {
          '@type': 'FAQPage',
          '@id': 'https://www.mephistoshares.online/#faq',
          mainEntity: EXPANDED_FAQ_ITEMS.map((item) => ({
            '@type': 'Question',
            name: item.q[currentLang] || item.q.en,
            acceptedAnswer: {
              '@type': 'Answer',
              text: item.a[currentLang] || item.a.en,
            },
          })),
        },
      ],
    };
    return JSON.stringify(schema);
  }, [currentLang]);

  return (
    <footer className="mt-16 border-t border-white/10 pt-12 pb-12 text-left space-y-14 w-full content-visibility-auto contain-layout">
      {/* Schema.org Structured Data Injection */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: structuredDataString }}
      />

      {/* 1. SECTION: Primary Overview & Semantic Micro-badge */}
      <section aria-labelledby="sec-overview-title" className="space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
          <Shield className="w-3.5 h-3.5 shrink-0" />
          <span>{strings.heroBadge}</span>
        </div>
        <h2
          id="sec-overview-title"
          className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5"
        >
          <ShieldCheck className="w-7 h-7 text-emerald-400 shrink-0" />
          {strings.mainTitle}
        </h2>
        <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
          {strings.introParagraph}
        </p>
      </section>

      {/* 2. SECTION: 4 High-Converting Keyword Pillars Showcase */}
      <section aria-labelledby="sec-pillars-title" className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h2 id="sec-pillars-title" className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />
            {strings.pillarSectionTitle}
          </h2>
          <span className="text-[11px] text-emerald-400 font-mono hidden sm:inline-block">
            WebRTC • AES-256-GCM • Zero-Cloud
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pillars.map((pillar, idx) => {
            const icons = [
              <ShieldCheck key="0" className="w-5 h-5 text-emerald-400" />,
              <Layers key="1" className="w-5 h-5 text-cyan-400" />,
              <CloudOff key="2" className="w-5 h-5 text-purple-400" />,
              <Share2 key="3" className="w-5 h-5 text-amber-400" />,
            ];
            const borderColors = [
              'hover:border-emerald-500/40 bg-emerald-950/10',
              'hover:border-cyan-500/40 bg-cyan-950/10',
              'hover:border-purple-500/40 bg-purple-950/10',
              'hover:border-amber-500/40 bg-amber-950/10',
            ];
            const badgeBg = [
              'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
              'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
              'bg-purple-500/20 text-purple-300 border-purple-500/30',
              'bg-amber-500/20 text-amber-300 border-amber-500/30',
            ];

            return (
              <article
                key={idx}
                className={`border border-white/10 rounded-2xl p-5 transition-all duration-300 group contain-layout ${borderColors[idx % 4]}`}
              >
                <div className="flex items-center justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      {icons[idx % 4]}
                    </div>
                    <h3 className="font-bold text-white text-sm sm:text-base">{pillar.title}</h3>
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${badgeBg[idx % 4]}`}>
                    {pillar.badge}
                  </span>
                </div>
                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed font-medium">
                  {pillar.sentence}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      {/* 3. SECTION: Core Architecture Cards Grid */}
      <section aria-labelledby="sec-features-title" className="space-y-6">
        <h2 id="sec-features-title" className="text-xl font-bold text-white flex items-center gap-2">
          <Zap className="w-5 h-5 text-emerald-400" />
          {strings.featuresTitle}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <article className="bg-white/[0.02] border border-white/10 hover:border-emerald-500/30 rounded-2xl p-5 transition-all duration-300 group transform-gpu contain-layout">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Lock className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="text-white font-bold text-sm mb-1.5">{strings.feature1Title}</h3>
            <p className="text-slate-400 text-xs leading-relaxed">{strings.feature1Desc}</p>
          </article>

          <article className="bg-white/[0.02] border border-white/10 hover:border-cyan-500/30 rounded-2xl p-5 transition-all duration-300 group transform-gpu contain-layout">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <ServerOff className="w-5 h-5 text-cyan-400" />
            </div>
            <h3 className="text-white font-bold text-sm mb-1.5">{strings.feature2Title}</h3>
            <p className="text-slate-400 text-xs leading-relaxed">{strings.feature2Desc}</p>
          </article>

          <article className="bg-white/[0.02] border border-white/10 hover:border-red-500/30 rounded-2xl p-5 transition-all duration-300 group transform-gpu contain-layout">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Flame className="w-5 h-5 text-red-400" />
            </div>
            <h3 className="text-white font-bold text-sm mb-1.5">{strings.feature3Title}</h3>
            <p className="text-slate-400 text-xs leading-relaxed">{strings.feature3Desc}</p>
          </article>

          <article className="bg-white/[0.02] border border-white/10 hover:border-purple-500/30 rounded-2xl p-5 transition-all duration-300 group transform-gpu contain-layout">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Cpu className="w-5 h-5 text-purple-400" />
            </div>
            <h3 className="text-white font-bold text-sm mb-1.5">{strings.feature4Title}</h3>
            <p className="text-slate-400 text-xs leading-relaxed">{strings.feature4Desc}</p>
          </article>
        </div>
      </section>

      {/* 4. SECTION: How It Works Step-by-Step */}
      <section aria-labelledby="sec-how-title" className="bg-white/[0.01] border border-white/5 rounded-3xl p-6 sm:p-8 space-y-6">
        <h2 id="sec-how-title" className="text-xl font-bold text-white flex items-center gap-2">
          <Layers className="w-5 h-5 text-teal-400" />
          {strings.howTitle}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <div className="space-y-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-mono font-bold flex items-center justify-center">
              1
            </div>
            <h3 className="font-bold text-white text-sm">{strings.how1Title}</h3>
            <p className="text-slate-400 text-xs leading-relaxed">{strings.how1Desc}</p>
          </div>
          <div className="space-y-2">
            <div className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 font-mono font-bold flex items-center justify-center">
              2
            </div>
            <h3 className="font-bold text-white text-sm">{strings.how2Title}</h3>
            <p className="text-slate-400 text-xs leading-relaxed">{strings.how2Desc}</p>
          </div>
          <div className="space-y-2">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 font-mono font-bold flex items-center justify-center">
              3
            </div>
            <h3 className="font-bold text-white text-sm">{strings.how3Title}</h3>
            <p className="text-slate-400 text-xs leading-relaxed">{strings.how3Desc}</p>
          </div>
          <div className="space-y-2">
            <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/40 font-mono font-bold flex items-center justify-center">
              4
            </div>
            <h3 className="font-bold text-white text-sm">{strings.how4Title}</h3>
            <p className="text-slate-400 text-xs leading-relaxed">{strings.how4Desc}</p>
          </div>
        </div>
      </section>

      {/* 5. SECTION: Collapsible Accordion FAQ */}
      <section aria-labelledby="sec-faq-title" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
          <h2 id="sec-faq-title" className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
            <HelpCircle className="w-6 h-6 text-emerald-400 shrink-0" />
            {strings.faqTitle}
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            {strings.faqBadge}
          </span>
        </div>

        <div className="space-y-3">
          {EXPANDED_FAQ_ITEMS.map((item, idx) => {
            const isOpen = openFaqIndex === idx;
            const questionText = item.q[currentLang] || item.q.en;
            const answerText = item.a[currentLang] || item.a.en;

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
                    <CheckCircle2
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isOpen ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    />
                    {questionText}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-300 ${
                      isOpen ? 'rotate-180 text-emerald-400' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-slate-300 text-xs sm:text-sm leading-relaxed border-t border-white/5 space-y-2">
                    <p className="font-medium text-slate-200">{answerText}</p>
                    {currentLang !== 'en' && (
                      <div className="pt-2 flex items-center gap-2 text-[11px] text-slate-400 font-mono italic">
                        <span>English Reference:</span>
                        <span>{item.q.en}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. SECTION: Comprehensive Comparison Block */}
      <article
        aria-labelledby="sec-seo-article-title"
        className="bg-gradient-to-br from-black/80 via-emerald-950/10 to-black/80 border border-emerald-500/20 rounded-3xl p-6 sm:p-8 space-y-6"
      >
        <h2
          id="sec-seo-article-title"
          className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2"
        >
          <CloudOff className="w-6 h-6 text-emerald-400 shrink-0" />
          {strings.comparisonTitle}
        </h2>

        <div className="text-slate-300 text-xs sm:text-sm leading-relaxed space-y-4">
          <p>{strings.comparisonIntro}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
            <div className="bg-black/50 border border-white/10 rounded-xl p-4 space-y-2">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-400" />
                {strings.traditionalTitle}
              </h3>
              <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
                {strings.traditionalPoints.map((pt, i) => (
                  <li key={i}>{pt}</li>
                ))}
              </ul>
            </div>

            <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-4 space-y-2">
              <h3 className="font-bold text-emerald-400 text-sm flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                {strings.mephistoTitle}
              </h3>
              <ul className="text-xs text-emerald-200/80 space-y-1 list-disc list-inside">
                {strings.mephistoPoints.map((pt, i) => (
                  <li key={i}>{pt}</li>
                ))}
              </ul>
            </div>
          </div>

          <p>{strings.technicalSummary}</p>
        </div>

        {/* Micro-Keywords Tag Cloud */}
        <div className="pt-4 border-t border-white/10">
          <p className="text-slate-400 text-[11px] font-mono mb-2 uppercase tracking-wider">
            {strings.keywordsTitle}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {[
              'Direct browser-to-browser P2P file transfer',
              'WebRTC AES-256-GCM end-to-end encryption',
              'Holographic full-screen drag and drop',
              'Automatic multi-file ZIP bundling',
              'Zero cloud storage',
              'Unlimited file sizes',
              'Ephemeral self-destructing rooms',
              'WhatsApp 1-click room sharing',
              'Telegram encrypted handoff',
              'QR Code peer connection',
              'Zero knowledge file sharing',
              'Burn on read transfer',
              'No account file drop',
              'Encrypted peer-to-peer sharing',
            ].map((tag, i) => (
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

      {/* 7. SECTION: Multi-Language Navigation Links */}
      <nav aria-label="Supported Languages Navigation" className="pt-4 border-t border-white/5">
        <p className="text-slate-400 text-[11px] font-mono mb-2 uppercase tracking-wider">
          {strings.supportedLangsTitle}
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
                currentLang === l.code
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

      {/* 8. SECTION: Bottom Copyright & Navigation Links */}
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
            © {new Date().getFullYear()} <strong>MephistoVault</strong> — {strings.copyrightText}
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
