import { useState, useEffect, useRef, useCallback } from 'react';
import type { ChatMessage, PeerMessage } from '../types';

export function useChat(broadcastFn: (msg: PeerMessage) => void) {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const broadcastFnRef = useRef(broadcastFn);

  useEffect(() => {
    broadcastFnRef.current = broadcastFn;
  }, [broadcastFn]);

  const sendChatMessage = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!chatInput.trim()) return;
      const msg = chatInput.trim();
      broadcastFnRef.current({ type: 'chat', text: msg });
      setChatMessages((prev) => [...prev, { id: Date.now(), text: msg, sender: 'me' }]);
      setChatInput('');
      setShowEmojiPicker(false);
    },
    [chatInput],
  );

  const sendEmoji = useCallback((emoji: string) => {
    broadcastFnRef.current({ type: 'chat', text: emoji });
    setChatMessages((prev) => [...prev, { id: Date.now(), text: emoji, sender: 'me' }]);
    setShowEmojiPicker(false);
  }, []);

  const sendClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        broadcastFnRef.current({ type: 'chat', text: `📋 ${text}` });
        setChatMessages((prev) => [...prev, { id: Date.now(), text: `📋 ${text}`, sender: 'me' }]);
      }
    } catch {
      // clipboard access denied
    }
  }, []);

  const addPeerMessage = useCallback((text: string) => {
    setChatMessages((prev) => [...prev, { id: Date.now(), text, sender: 'peer' }]);
    if (text.startsWith('📋 ')) {
      const clipContent = text.slice(3);
      try {
        navigator.clipboard.writeText(clipContent).catch(() => {});
      } catch {
        // ignore
      }
    }
  }, []);

  const clearMessages = useCallback(() => {
    setChatMessages([]);
  }, []);

  return {
    chatMessages,
    setChatMessages,
    chatInput,
    setChatInput,
    showEmojiPicker,
    setShowEmojiPicker,
    chatEndRef,
    sendChatMessage,
    sendEmoji,
    sendClipboard,
    addPeerMessage,
    clearMessages,
  };
}

export default useChat;
