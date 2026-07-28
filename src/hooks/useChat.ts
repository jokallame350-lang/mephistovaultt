import { useState, useEffect, useRef } from 'react';
import type { ChatMessage, PeerMessage } from '../types';

export function useChat(broadcastFn: (msg: PeerMessage) => void) {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    if (chatMessages.length > 0) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  const sendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const msg = chatInput.trim();
    broadcastFn({ type: 'chat', text: msg });
    setChatMessages((prev) => [...prev, { id: Date.now(), text: msg, sender: 'me' }]);
    setChatInput('');
    setShowEmojiPicker(false);
  };

  const sendEmoji = (emoji: string) => {
    broadcastFn({ type: 'chat', text: emoji });
    setChatMessages((prev) => [...prev, { id: Date.now(), text: emoji, sender: 'me' }]);
    setShowEmojiPicker(false);
  };

  const sendClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        broadcastFn({ type: 'chat', text: `📋 ${text}` });
        setChatMessages((prev) => [...prev, { id: Date.now(), text: `📋 ${text}`, sender: 'me' }]);
      }
    } catch {
      // clipboard access denied
    }
  };

  const addPeerMessage = (text: string) => {
    setChatMessages((prev) => [...prev, { id: Date.now(), text, sender: 'peer' }]);
  };

  const clearMessages = () => {
    setChatMessages([]);
  };

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
