import { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { usePeerConnection } from './hooks/usePeerConnection';
import { useFileHandler } from './hooks/useFileHandler';
import { useChat } from './hooks/useChat';
import { useLANDiscovery } from './hooks/useLANDiscovery';
import { useSelfDestruct } from './hooks/useSelfDestruct';
import { usePanicKey } from './hooks/usePanicKey';
import { getTranslator, type LangKey } from './i18n';
import Header from './components/Header';
import IdleView from './components/IdleView';
import SendView from './components/SendView';
import ReceiveView from './components/ReceiveView';
import GhostChat from './components/GhostChat';
import NearbyDevices from './components/NearbyDevices';
import SEOFooter from './components/SEOFooter';
import GlobalDropzone from './components/GlobalDropzone';
import VaultCreateView from './components/vault/VaultCreateView';
import VaultRecipientView from './components/vault/VaultRecipientView';
import VaultManageView from './components/vault/VaultManageView';
import { Zap, Cloud, FolderLock } from 'lucide-react';
import { playTransferSound, copyToClipboard, downloadQRCode, generateCode, parseRoomCode, generateShareUrl } from './lib/utils';

import type { PeerMessage } from './types';

export function App() {
  const [theme, setTheme] = useState<string>(() => {
    return localStorage.getItem('ms-theme') || 'dark';
  });
  const [lang, setLang] = useState<LangKey>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlLang = params.get('lang') as LangKey | null;
      if (urlLang && ['en', 'tr', 'es', 'de', 'fr', 'it', 'pt', 'ru', 'ar', 'zh'].includes(urlLang)) {
        return urlLang;
      }
    }
    return (localStorage.getItem('ms-lang') as LangKey) || 'en';
  });
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [sessionTransfers, setSessionTransfers] = useState(0);

  // Dual-Product Mode: ⚡ Quick Drop (P2P) vs ☁️ Vault Share (Hosted E2E)
  const [productMode, setProductMode] = useState<'quick-drop' | 'vault-share' | 'vault-recipient' | 'vault-manage'>('quick-drop');
  const [recipientVaultId, setRecipientVaultId] = useState<string>('');
  const [recipientSecretKey, setRecipientSecretKey] = useState<string>('');
  const [vaultSubTab, setVaultSubTab] = useState<'create' | 'manage'>('create');

  const t = useCallback((key: string, params?: Record<string, string | number>) => getTranslator(lang)(key, params), [lang]);

  // Sync theme to document element
  useEffect(() => {
    localStorage.setItem('ms-theme', theme);
    document.documentElement.className = theme === 'cyberpunk' ? 'cyberpunk-theme' : theme === 'light' ? 'light-theme' : '';
  }, [theme]);

  // Sync language persistence, html document lang and RTL direction
  useEffect(() => {
    localStorage.setItem('ms-lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  // Wrapper for broadcast to avoid circular dependency issues
  const broadcastRef = useRef<((msg: PeerMessage) => void) | null>(null);
  const broadcastWrapper = useCallback((msg: PeerMessage) => {
    if (broadcastRef.current) {
      broadcastRef.current(msg);
    }
  }, []);

  // Hooks
  const chat = useChat(broadcastWrapper);
  const addPeerMessage = chat.addPeerMessage;
  const clearMessages = chat.clearMessages;

  const onChatMessage = useCallback(
    (text: string) => {
      addPeerMessage(text);
    },
    [addPeerMessage],
  );

  const clearChatMessages = useCallback(() => {
    clearMessages();
  }, [clearMessages]);

  const onTransferComplete = useCallback(() => {
    setSessionTransfers((prev) => prev + 1);
    playTransferSound();
  }, []);

  // Shared file ref
  const fileToShareRef = useRef<File | null>(null);

  // Initialize Peer connection
  const peer = usePeerConnection({
    fileToShareRef,
    onTransferComplete,
    onChatMessage,
    clearChatMessages,
    t,
  });

  const setPeerMode = peer.setMode;
  const onFilesProcessed = useCallback(() => {
    setPeerMode('send');
  }, [setPeerMode]);

  // Initialize file handler
  const fileHandler = useFileHandler(peer.completedFile, onFilesProcessed);

  const processFiles = fileHandler.processFiles;

  // Web Share Target API: Parse shared files, images, text, or links from mobile share menu
  useEffect(() => {
    const handleSharedContent = async () => {
      const params = new URLSearchParams(window.location.search);
      const isSharedPwa = params.get('shared') === 'true';

      if (isSharedPwa && 'caches' in window) {
        try {
          const cache = await caches.open('mephistovault-shares');
          const metaRes = await cache.match('/shared-meta');
          if (metaRes) {
            const meta = await metaRes.json();
            const retrievedFiles: File[] = [];

            let index = 0;
            while (true) {
              const fileRes = await cache.match(`/shared-file-${index}`);
              if (!fileRes) break;
              const fileBlob = await fileRes.blob();
              const fileName = decodeURIComponent(fileRes.headers.get('X-File-Name') || `shared-file-${index}`);
              const fileType = fileRes.headers.get('X-File-Type') || fileBlob.type;
              retrievedFiles.push(new File([fileBlob], fileName, { type: fileType }));
              await cache.delete(`/shared-file-${index}`);
              index++;
            }

            await cache.delete('/shared-meta');

            if (retrievedFiles.length > 0) {
              processFiles(retrievedFiles);
              setPeerMode('send');
            } else if (meta.text || meta.url || meta.title) {
              const sharedText = meta.text || meta.url || meta.title;
              const blob = new Blob([sharedText], { type: 'text/plain;charset=utf-8' });
              const sharedFile = new File([blob], `shared-note-${Date.now().toString().slice(-4)}.txt`, { type: 'text/plain' });
              processFiles([sharedFile]);
              setPeerMode('send');
            }
          }
        } catch {
          // ignore
        }
        window.history.replaceState({}, '', window.location.pathname);
      }

      // Direct URL query params fallback for text/links
      const sharedText = params.get('text') || params.get('title') || params.get('url');
      if (sharedText) {
        const blob = new Blob([sharedText], { type: 'text/plain;charset=utf-8' });
        const sharedFile = new File([blob], `shared-note-${Date.now().toString().slice(-4)}.txt`, { type: 'text/plain' });
        processFiles([sharedFile]);
        setPeerMode('send');
        window.history.replaceState({}, '', window.location.pathname);
      }
    };

    handleSharedContent();
  }, [processFiles, setPeerMode]);

  // Keep ref in sync with state
  useEffect(() => {
    fileToShareRef.current = fileHandler.fileToShare;
  }, [fileHandler.fileToShare]);

  // Keep broadcast ref in sync
  useEffect(() => {
    broadcastRef.current = peer.broadcastToAll;
  }, [peer.broadcastToAll]);

  // Initialize LAN Discovery
  const discovery = useLANDiscovery(
    peer.shareCode,
    peer.mode,
    peer.connectAsReceiver,
  );

  const peerResetConnection = peer.resetConnection;

  const { triggerPanic } = usePanicKey({ onPanic: peerResetConnection });

  const handleSelfDestruct = useCallback(() => {
    peerResetConnection();
    setPeerMode('idle');
  }, [peerResetConnection, setPeerMode]);

  const fileHandlerSetFile = fileHandler.setFileToShare;
  const handleMediaCaptured = useCallback((file: File) => {
    fileHandlerSetFile(file);
    setPeerMode('send');
  }, [fileHandlerSetFile, setPeerMode]);

  // Self destruct timer
  const selfDestructSec = useSelfDestruct(
    peer.transferProgress,
    peer.isConnected,
    handleSelfDestruct,
  );

  // Auto-connect room from URL query (?room=CODE / ?code=CODE) or hash (#CODE) or Vault route (/v/:id) on mount
  useEffect(() => {
    // 1. Check for Vault Share recipient or manage route (/v/:id#KEY or /v/:id/manage)
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      if (pathname.startsWith('/v/')) {
        const parts = pathname.slice(3).split('/');
        const id = parts[0];
        if (id) {
          setRecipientVaultId(id);
          const hashSecret = window.location.hash.replace(/^#/, '');
          setRecipientSecretKey(hashSecret);
          if (parts[1] === 'manage') {
            setProductMode('vault-manage');
          } else {
            setProductMode('vault-recipient');
          }
          return;
        }
      }
    }

    // 2. Check for P2P Quick Drop room code
    const rawUrl = window.location.href;
    const roomCode = parseRoomCode(rawUrl);

    if (roomCode && roomCode.length >= 6) {
      // Clean room/code/id params and hash from URL without triggering a page reload while preserving other params
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('room');
        url.searchParams.delete('code');
        url.searchParams.delete('id');
        url.hash = '';
        const newSearch = url.searchParams.toString();
        const newUrl = `${url.pathname}${newSearch ? `?${newSearch}` : ''}`;
        window.history.replaceState({}, '', newUrl);
      } catch {
        window.history.replaceState({}, '', window.location.pathname);
      }

      peer.setReceiveCode(roomCode);
      peer.setMode('receive');
      // Auto-connect after a short delay
      setTimeout(() => {
        peer.connectAsReceiver(roomCode);
      }, 250);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const peerMode = peer.mode;
  const peerShareCode = peer.shareCode;
  const setPeerShareCode = peer.setShareCode;
  const peerSetCopied = peer.setCopied;

  const peerInitSender = peer.initSender;

  // Generate share code and init sender atomically when mode is set to 'send'
  useEffect(() => {
    if (peerMode === 'send') {
      if (!peerShareCode) {
        const newCode = generateCode();
        setPeerShareCode(newCode);
        peerInitSender(newCode);
      } else {
        peerInitSender(peerShareCode);
      }
    }
  }, [peerMode, peerShareCode, setPeerShareCode, peerInitSender]);

  // Scroll to top only when mode actually changes to prevent old scroll offsets
  const prevModeRef = useRef(peerMode);
  useEffect(() => {
    if (prevModeRef.current !== peerMode) {
      prevModeRef.current = peerMode;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [peerMode]);

  const handleCopyLink = useCallback(async () => {
    const textToCopy = generateShareUrl(peerShareCode);
    const success = await copyToClipboard(textToCopy);
    if (success) {
      peerSetCopied(true);
      setTimeout(() => peerSetCopied(false), 2000);
    }
  }, [peerShareCode, peerSetCopied]);

  const handleDownloadQR = useCallback(() => {
    downloadQRCode(peerShareCode);
  }, [peerShareCode]);

  const setReceiveCode = peer.setReceiveCode;
  const connectAsReceiver = peer.connectAsReceiver;

  const handleConnectToDevice = useCallback(
    (code: string) => {
      setPeerMode('receive');
      setReceiveCode(code);
      setTimeout(() => {
        connectAsReceiver(code);
      }, 100);
    },
    [setPeerMode, setReceiveCode, connectAsReceiver],
  );

  const inviteDevice = discovery.inviteDevice;

  const handleInviteDevice = useCallback(
    (targetId: string) => {
      const newCode = generateCode();
      setPeerShareCode(newCode);
      setPeerMode('send');
      setTimeout(() => {
        inviteDevice(targetId);
      }, 100);
    },
    [setPeerShareCode, setPeerMode, inviteDevice],
  );

  const clearFiles = fileHandler.clearFiles;

  const handleSendClose = useCallback(() => {
    setPeerShareCode('');
    clearFiles();
    peerResetConnection();
    setPeerMode('idle');
  }, [setPeerShareCode, clearFiles, peerResetConnection, setPeerMode]);

  const handleReceiveClose = useCallback(() => {
    peerResetConnection();
    setPeerMode('idle');
  }, [peerResetConnection, setPeerMode]);

  return (
    <div
      className={`min-h-[100dvh] flex flex-col items-center justify-center p-4 selection:bg-emerald-500/30 transition-colors duration-300 ${
        theme === 'light' ? 'bg-slate-100 text-slate-900' : ''
      }`}
    >
      {/* Isolated Static Fixed Ambient Background Layer (Zero Scroll Repaint) */}
      <div
        className="fixed inset-0 pointer-events-none overflow-hidden z-0 contain-strict will-change-transform transform-gpu"
        aria-hidden="true"
      >
        <div className="ambient-bg-radial" />
        <div className="ambient-orb ambient-orb-1" />
        <div className="ambient-orb ambient-orb-2" />
        <div className="ambient-orb ambient-orb-3" />
      </div>

      {/* Global Full-Screen Holographic Drag & Drop Indicator */}
      <AnimatePresence>
        {fileHandler.isGlobalDragging && (
          <GlobalDropzone
            onDragLeave={fileHandler.handleGlobalDragLeave}
            onDrop={fileHandler.handleGlobalDrop}
            t={t}
          />
        )}
      </AnimatePresence>

      <Header
        isConnected={peer.isConnected}
        connTime={peer.connTime}
        theme={theme}
        setTheme={setTheme}
        lang={lang}
        setLang={setLang}
        showLangPicker={showLangPicker}
        setShowLangPicker={setShowLangPicker}
        onPanic={triggerPanic}
        t={t}
      />

      <main className="z-10 w-full max-w-lg" id="main-content">
        {/* Dual Mode Switcher (P2P Quick Drop vs Hosted Vault Share) */}
        {productMode !== 'vault-recipient' && (
          <div className="flex items-center justify-center p-1 bg-slate-950/80 border border-white/10 rounded-2xl max-w-xs mx-auto mb-6 backdrop-blur-md shadow-lg">
            <button
              type="button"
              onClick={() => setProductMode('quick-drop')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold font-mono transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                productMode === 'quick-drop'
                  ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                  : 'text-slate-400 hover:text-white border border-transparent'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('quickDrop') || '⚡ Quick Drop'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setProductMode('vault-share');
                setVaultSubTab('create');
              }}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold font-mono transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                productMode === 'vault-share' || productMode === 'vault-manage'
                  ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                  : 'text-slate-400 hover:text-white border border-transparent'
              }`}
            >
              <Cloud className="w-3.5 h-3.5 text-cyan-400" />
              <span>{t('vaultShare') || '☁️ Vault Share'}</span>
            </button>
          </div>
        )}

        {/* ☁️ VAULT SHARE MODE */}
        {(productMode === 'vault-share' || productMode === 'vault-manage') && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2 mb-4 text-xs font-mono">
              <button
                type="button"
                onClick={() => {
                  setProductMode('vault-share');
                  setVaultSubTab('create');
                }}
                className={`px-3.5 py-1.5 rounded-xl border transition-all cursor-pointer ${
                  vaultSubTab === 'create' && productMode === 'vault-share'
                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 font-bold shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                    : 'bg-slate-900/60 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                {t('createVaultButton') || '☁️ Create Vault'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setProductMode('vault-manage');
                  setVaultSubTab('manage');
                }}
                className={`px-3.5 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                  vaultSubTab === 'manage' || productMode === 'vault-manage'
                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 font-bold shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                    : 'bg-slate-900/60 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <FolderLock className="w-3.5 h-3.5" />
                <span>{t('myVaults') || 'My Vaults'}</span>
              </button>
            </div>

            {vaultSubTab === 'create' && productMode === 'vault-share' && (
              <VaultCreateView t={t} />
            )}

            {(vaultSubTab === 'manage' || productMode === 'vault-manage') && (
              <VaultManageView t={t} />
            )}
          </div>
        )}

        {/* ☁️ VAULT RECIPIENT MODE (/v/:vaultId) */}
        {productMode === 'vault-recipient' && (
          <div className="space-y-4">
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setProductMode('quick-drop');
                  window.history.pushState({}, '', '/');
                }}
                className="text-xs text-slate-400 hover:text-cyan-400 font-mono transition-colors cursor-pointer"
              >
                ← Back to MephistoVault Home
              </button>
            </div>
            <VaultRecipientView
              vaultId={recipientVaultId}
              secretKeyString={recipientSecretKey}
              t={t}
            />
          </div>
        )}

        {/* ⚡ QUICK DROP MODE (P2P WebRTC Direct) */}
        {productMode === 'quick-drop' && (
          <>
            <AnimatePresence mode="wait">
              {peer.mode === 'idle' && (
                <IdleView 
                  setMode={peer.setMode} 
                  sessionTransfers={sessionTransfers} 
                  onMediaCaptured={handleMediaCaptured}
                  t={t} 
                />
              )}

              {peer.mode === 'send' && (
                <SendView
                  fileToShare={fileHandler.fileToShare}
                  setFileToShare={fileHandler.setFileToShare}
                  selectedFiles={fileHandler.selectedFiles}
                  totalPayloadSize={fileHandler.totalPayloadSize}
                  onRemoveFile={fileHandler.removeFile}
                  onClearFiles={fileHandler.clearFiles}
                  onAddFiles={fileHandler.addFiles}
                  isZipping={fileHandler.isZipping}
                  zipProgress={fileHandler.zipProgress}
                  isDragging={fileHandler.isDragging}
                  previewUrl={fileHandler.previewUrl}
                  fileInputRef={fileHandler.fileInputRef}
                  folderInputRef={fileHandler.folderInputRef}
                  onFileChange={fileHandler.handleFileChange}
                  onDragOver={fileHandler.handleDragOver}
                  onDragLeave={fileHandler.handleDragLeave}
                  onDrop={fileHandler.handleDrop}
                  shareCode={peer.shareCode}
                  isConnected={peer.isConnected}
                  errorStatus={peer.errorStatus}
                  transferProgress={peer.transferProgress}
                  transferSpeed={peer.transferSpeed}
                  transferETA={peer.transferETA}
                  peerCount={peer.peerCount}
                  selfDestructSec={selfDestructSec}
                  copied={peer.copied}
                  showQR={peer.showQR}
                  setShowQR={peer.setShowQR}
                  expirationSec={peer.expirationSec}
                  setExpirationSec={peer.setExpirationSec}
                  onCopy={handleCopyLink}
                  onDownloadQR={handleDownloadQR}
                  onClose={handleSendClose}
                  liveSyncManager={peer.liveSyncManager}
                  compressionStats={peer.compressionStats}
                  t={t}
                />
              )}

              {peer.mode === 'receive' && (
                <ReceiveView
                  receiveCode={peer.receiveCode}
                  setReceiveCode={peer.setReceiveCode}
                  isConnected={peer.isConnected}
                  errorStatus={peer.errorStatus}
                  transferProgress={peer.transferProgress}
                  transferSpeed={peer.transferSpeed}
                  transferETA={peer.transferETA}
                  fileMeta={peer.fileMeta}
                  completedFile={peer.completedFile}
                  selfDestructSec={selfDestructSec}
                  showQRScanner={peer.showQR}
                  setShowQRScanner={peer.setShowQR}
                  videoPreviewUrl={fileHandler.videoPreviewUrl}
                  showVideoPlayer={fileHandler.showVideoPlayer}
                  setShowVideoPlayer={fileHandler.setShowVideoPlayer}
                  zipContents={fileHandler.zipContents}
                  showZipPreview={fileHandler.showZipPreview}
                  setShowZipPreview={fileHandler.setShowZipPreview}
                  liveMediaUrl={peer.liveMediaUrl}
                  isLiveMediaAvailable={peer.isLiveMediaAvailable}
                  handleBurnOnDownload={peer.handleBurnOnDownload}
                  onConnect={peer.connectAsReceiver}
                  onClose={handleReceiveClose}
                  liveSyncManager={peer.liveSyncManager}
                  compressionStats={peer.compressionStats}
                  t={t}
                />
              )}
            </AnimatePresence>

            {peer.mode !== 'idle' && (
              <GhostChat
                isConnected={peer.isConnected}
                chatMessages={chat.chatMessages}
                chatInput={chat.chatInput}
                setChatInput={chat.setChatInput}
                showEmojiPicker={chat.showEmojiPicker}
                setShowEmojiPicker={chat.setShowEmojiPicker}
                onSendMessage={chat.sendChatMessage}
                onSendEmoji={chat.sendEmoji}
                onSendClipboard={chat.sendClipboard}
                chatEndRef={chat.chatEndRef}
                t={t}
              />
            )}

            {peer.mode === 'idle' && (
              <NearbyDevices
                nearbyDevices={discovery.nearbyDevices}
                showNearby={discovery.showNearby}
                setShowNearby={discovery.setShowNearby}
                onConnectToDevice={handleConnectToDevice}
                onInviteDevice={handleInviteDevice}
                t={t}
              />
            )}
          </>
        )}
      </main>

      <div className="z-10 w-full max-w-3xl sm:max-w-4xl px-2">
        <SEOFooter lang={lang} t={t} />
      </div>
    </div>
  );
}

export default App;
