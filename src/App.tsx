import { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { usePeerConnection } from './hooks/usePeerConnection';
import { useFileHandler } from './hooks/useFileHandler';
import { useChat } from './hooks/useChat';
import { useLANDiscovery } from './hooks/useLANDiscovery';
import { useSelfDestruct } from './hooks/useSelfDestruct';
import { getTranslator, type LangKey } from './i18n';
import Header from './components/Header';
import IdleView from './components/IdleView';
import SendView from './components/SendView';
import ReceiveView from './components/ReceiveView';
import GhostChat from './components/GhostChat';
import NearbyDevices from './components/NearbyDevices';
import SEOFooter from './components/SEOFooter';
import { playTransferSound, copyToClipboard, downloadQRCode, generateCode } from './lib/utils';

import type { PeerMessage } from './types';

export function App() {
  const [theme, setTheme] = useState<string>(() => {
    return localStorage.getItem('ms-theme') || 'dark';
  });
  const [lang, setLang] = useState<LangKey>(() => {
    return (localStorage.getItem('ms-lang') as LangKey) || 'en';
  });
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [sessionTransfers, setSessionTransfers] = useState(0);

  const t = getTranslator(lang);

  // Sync theme to document element
  useEffect(() => {
    localStorage.setItem('ms-theme', theme);
    document.documentElement.className = theme === 'cyberpunk' ? 'cyberpunk-theme' : theme === 'light' ? 'light-theme' : '';
  }, [theme]);

  // Sync language persistence
  useEffect(() => {
    localStorage.setItem('ms-lang', lang);
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

  const onChatMessage = useCallback(
    (text: string) => {
      chat.addPeerMessage(text);
    },
    [chat],
  );

  const clearChatMessages = useCallback(() => {
    chat.clearMessages();
  }, [chat]);

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
  });

  // Initialize file handler
  const fileHandler = useFileHandler(peer.completedFile);

  const processFiles = fileHandler.processFiles;
  const setPeerMode = peer.setMode;

  // Web Share Target API: Parse shared text or link from mobile share menu
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedText = params.get('text') || params.get('title') || params.get('url');
    if (sharedText) {
      const blob = new Blob([sharedText], { type: 'text/plain;charset=utf-8' });
      const sharedFile = new File([blob], `shared-note-${Date.now().toString().slice(-4)}.txt`, { type: 'text/plain' });
      processFiles([sharedFile]);
      setPeerMode('send');
      window.history.replaceState({}, '', window.location.pathname);
    }
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

  // Self destruct timer
  const selfDestructSec = useSelfDestruct(
    peer.transferProgress,
    peer.isConnected,
    useCallback(() => {
      peer.resetConnection();
      peer.setMode('idle');
    }, [peer]),
  );

  // Auto-connect room from URL param (?room=abc-xyz%231234) on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('room');
    if (roomCode) {
      // Clean URL without reload
      window.history.replaceState({}, '', window.location.pathname);
      peer.setReceiveCode(roomCode);
      peer.setMode('receive');
      // Auto-connect after a short delay
      setTimeout(() => {
        peer.connectAsReceiver(roomCode);
      }, 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const peerMode = peer.mode;
  const peerShareCode = peer.shareCode;
  const setPeerShareCode = peer.setShareCode;
  const peerSetCopied = peer.setCopied;

  // Generate share code when mode is set to 'send'
  useEffect(() => {
    if (peerMode === 'send' && !peerShareCode) {
      const newCode = generateCode();
      setPeerShareCode(newCode);
    }
    // Scroll to top on mode change to prevent old scroll offsets
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [peerMode, peerShareCode, setPeerShareCode]);

  const handleCopyLink = useCallback(async () => {
    const textToCopy = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(peerShareCode)}`;
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

  return (
    <div
      className={`min-h-[100dvh] flex flex-col items-center justify-center p-4 selection:bg-emerald-500/30 transition-colors duration-300 ${
        theme === 'light' ? 'bg-slate-100 text-slate-900' : ''
      }`}
    >
      <Header
        isConnected={peer.isConnected}
        connTime={peer.connTime}
        theme={theme}
        setTheme={setTheme}
        lang={lang}
        setLang={setLang}
        showLangPicker={showLangPicker}
        setShowLangPicker={setShowLangPicker}
        t={t}
      />

      <div className="z-10 w-full max-w-lg">
        <AnimatePresence mode="wait">
          {peer.mode === 'idle' && (
            <IdleView setMode={peer.setMode} sessionTransfers={sessionTransfers} t={t} />
          )}

          {peer.mode === 'send' && (
            <SendView
              fileToShare={fileHandler.fileToShare}
              setFileToShare={fileHandler.setFileToShare}
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
              isVoiceActive={peer.isVoiceActive}
              toggleVoiceTalkie={peer.toggleVoiceTalkie}
              onCopy={handleCopyLink}
              onDownloadQR={handleDownloadQR}
              onClose={() => {
                peer.setShareCode('');
                fileHandler.setFileToShare(null);
                peer.resetConnection();
                peer.setMode('idle');
              }}
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
              isVoiceActive={peer.isVoiceActive}
              toggleVoiceTalkie={peer.toggleVoiceTalkie}
              handleBurnOnDownload={peer.handleBurnOnDownload}
              onConnect={peer.connectAsReceiver}
              onClose={() => {
                peer.resetConnection();
                peer.setMode('idle');
              }}
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

        <SEOFooter />
      </div>
    </div>
  );
}

export default App;
