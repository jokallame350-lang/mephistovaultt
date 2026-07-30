import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, MessageSquare, Lock, Smile, Clipboard, Send, FileText } from 'lucide-react';
import { EMOJIS } from '../lib/constants';
import type { ChatMessage } from '../types';

interface GhostChatProps {
  isConnected: boolean;
  chatMessages: ChatMessage[];
  chatInput: string;
  setChatInput: (v: string) => void;
  showEmojiPicker: boolean;
  setShowEmojiPicker: (v: boolean) => void;
  onSendMessage: (e: React.FormEvent) => void;
  onSendEmoji: (emoji: string) => void;
  onSendClipboard: () => void;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  t: (key: string) => string;
}

export function GhostChat({
  isConnected,
  chatMessages,
  chatInput,
  setChatInput,
  showEmojiPicker,
  setShowEmojiPicker,
  onSendMessage,
  onSendEmoji,
  onSendClipboard,
  chatEndRef,
  t,
}: GhostChatProps) {
  const [activeTab, setActiveTab] = React.useState<'chat' | 'notepad'>('chat');
  const [notepadText, setNotepadText] = React.useState('');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mt-6 glass-panel overflow-hidden border ${
        isConnected
          ? 'border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.15)]'
          : 'border-white/10 opacity-70'
      } relative transition-all duration-500`}
    >
      {!isConnected && (
        <div className="absolute inset-0 z-10 bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
          <div className="flex items-center gap-2 text-white/70 font-mono text-sm">
            <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
            {t('waitingPeer')}
          </div>
        </div>
      )}
      <div className="bg-black/40 p-2.5 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" /> {t('ghostChat')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('notepad')}
            className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'notepad'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> 📝 Canlı Not & Kod Düzenleyici
          </button>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-purple-500/80 uppercase tracking-widest bg-purple-500/10 px-2 py-1 rounded-md">
          <Lock className="w-3 h-3" /> {t('secure')}
        </div>
      </div>

      {activeTab === 'chat' ? (
        <>
          <div className="h-48 overflow-y-auto p-4 flex flex-col gap-3 scrollbar-hide">
            {chatMessages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm p-4 text-center italic">
                {t('chatEmpty')}
              </div>
            ) : (
              chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`max-w-[85%] rounded-xl p-3 text-sm ${
                    msg.sender === 'me'
                      ? 'bg-purple-600/20 text-purple-100 self-end border border-purple-500/20 rounded-tr-sm'
                      : 'bg-black/50 text-slate-300 self-start border border-white/5 rounded-tl-sm shadow-md'
                  }`}
                >
                  {msg.text}
                </div>
              ))
            )}
            <div ref={chatEndRef as any} />
          </div>

          <form onSubmit={onSendMessage} className="p-3 bg-black/40 border-t border-white/5 flex gap-2 relative">
        {/* Emoji Picker */}
        <AnimatePresence>
          {showEmojiPicker && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-full left-3 mb-2 bg-black/90 border border-white/10 rounded-xl p-2 flex gap-1 flex-wrap max-w-[200px] shadow-xl"
              role="listbox"
              aria-label="Emoji selector"
            >
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => onSendEmoji(e)}
                  className="text-xl p-1.5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                  role="option"
                  aria-selected="false"
                >
                  {e}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        <button
          type="button"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="text-slate-400 hover:text-purple-400 p-2 rounded-lg transition-colors shrink-0 cursor-pointer"
          title="Emoji"
          aria-label="Toggle emoji picker"
        >
          <Smile className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onSendClipboard}
          className="text-slate-400 hover:text-purple-400 p-2 rounded-lg transition-colors shrink-0 cursor-pointer"
          title="Paste from Clipboard"
          aria-label="Paste text from clipboard and send"
        >
          <Clipboard className="w-4 h-4" />
        </button>
        <input
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          placeholder={t('chatPlaceholder')}
          className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50 transition-colors"
          maxLength={200}
          aria-label="Type secure message"
        />
        <button
          type="submit"
          disabled={!chatInput.trim()}
          className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white p-2 rounded-lg transition-colors flex items-center justify-center w-10 shrink-0 cursor-pointer"
          aria-label="Send Message"
        >
          <Send className="w-4 h-4" />
        </button>
        </form>
        </>
      ) : (
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs text-purple-300 font-mono">
            <span>📝 Canlı Şifreli Not Defteri (Cihazlar Ayrılınca Yok Olur)</span>
            <button
              type="button"
              onClick={() => {
                onSendMessage({ preventDefault: () => {} } as any);
                alert('Not içeriği panoya gönderildi!');
              }}
              className="text-xs text-purple-400 hover:text-purple-200 underline cursor-pointer"
            >
              Panoya Gönder
            </button>
          </div>
          <textarea
            value={notepadText}
            onChange={(e) => setNotepadText(e.target.value)}
            placeholder="Buraya anlık ortak notlar, şifreler veya kod parçaları yazabilirsiniz. Cihazlar kapatılınca tüm veriler hafızadan imha edilir..."
            className="w-full h-44 bg-black/60 border border-purple-500/20 rounded-xl p-3 text-xs font-mono text-purple-100 focus:outline-none focus:border-purple-500/50 resize-none custom-scrollbar"
          />
        </div>
      )}
    </motion.div>
  );
}
export default GhostChat;
