import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  Download,
  Trash2,
  Eye,
  X,
  File as FileIcon,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  FileCode,
  Check,
  Loader2,
  Plus,
  Search,
  Radio,
  Users,
  HardDrive,
  Sparkles,
  Zap,
  ArrowDownToLine,
  Copy,
  FolderUp,
} from 'lucide-react';
import type { DataConnection } from 'peerjs';
import {
  type SyncItem,
  type LiveSyncMessage,
  useLiveSync,
  downloadSyncItem,
  downloadAllAsZip,
  LiveSyncManager,
} from '../lib/liveSync';
import { formatBytes, playFileDropChime, playTransferSound } from '../lib/utils';

export interface LiveSyncTableProps {
  localPeerId?: string;
  connectedPeers?: string[];
  connections?: DataConnection[];
  broadcastFn?: (msg: LiveSyncMessage) => void;
  manager?: LiveSyncManager;
  onClose?: () => void;
  isConnected?: boolean;
  t?: (key: string, params?: Record<string, string | number>) => string;
  className?: string;
}

/**
 * Returns type icon, color theme, and category label for a given sync item
 */
function getFileTypeDetails(name: string, type: string) {
  const n = name.toLowerCase();
  const t = type.toLowerCase();

  if (t.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|heic|avif)$/.test(n)) {
    return {
      Icon: FileImage,
      colorClass: 'text-pink-400 bg-pink-500/10 border-pink-500/30',
      badgeClass: 'bg-pink-500/20 text-pink-300 border-pink-500/40',
      category: 'IMAGE',
    };
  }
  if (t.startsWith('video/') || /\.(mp4|mkv|webm|avi|mov|wmv|flv|m4v)$/.test(n)) {
    return {
      Icon: FileVideo,
      colorClass: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
      badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
      category: 'VIDEO',
    };
  }
  if (t.startsWith('audio/') || /\.(mp3|wav|ogg|flac|aac|m4a|wma)$/.test(n)) {
    return {
      Icon: FileAudio,
      colorClass: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      category: 'AUDIO',
    };
  }
  if (
    /\.(zip|tar|gz|rar|7z|bz2|xz|iso)$/.test(n) ||
    t.includes('zip') ||
    t.includes('compressed') ||
    t.includes('archive')
  ) {
    return {
      Icon: FileArchive,
      colorClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      category: 'ARCHIVE',
    };
  }
  if (/\.(ts|tsx|js|jsx|json|html|css|py|rs|go|cpp|c|java|php|rb|sql|sh|yaml|yml)$/.test(n)) {
    return {
      Icon: FileCode,
      colorClass: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
      badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
      category: 'CODE',
    };
  }
  if (/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|md|rtf|csv)$/.test(n) || t.startsWith('text/')) {
    return {
      Icon: FileText,
      colorClass: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
      badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
      category: 'DOC',
    };
  }
  return {
    Icon: FileIcon,
    colorClass: 'text-slate-400 bg-white/5 border-white/10',
    badgeClass: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
    category: 'FILE',
  };
}

export const LiveSyncTable: React.FC<LiveSyncTableProps> = ({
  localPeerId = 'local-node',
  connectedPeers = [],
  connections,
  broadcastFn,
  manager: customManager,
  onClose,
  isConnected = true,
  t: _t = (k: string) => k,
  className = '',
}) => {
  // Built-in LiveSync hook instance if no external manager is supplied
  const sync = useLiveSync({
    localPeerId,
    connections,
    broadcastFn,
    onItemCompleted: () => {
      playTransferSound();
    },
  });

  const manager = customManager || sync.manager;
  const items = customManager ? customManager.getItems() : sync.items;

  // UI States
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOC' | 'CODE' | 'ARCHIVE'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'SYNCING'>('ALL');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);
  const [previewItem, setPreviewItem] = useState<SyncItem | null>(null);
  const [previewTextContent, setPreviewTextContent] = useState<string | null>(null);
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Read text content for preview modal
  useEffect(() => {
    if (previewItem && previewItem.blob) {
      const isText =
        previewItem.type.startsWith('text/') ||
        /\.(txt|md|json|ts|tsx|js|jsx|css|html|py|rs|go|c|cpp|yaml|yml|sh)$/i.test(previewItem.name);

      if (isText) {
        previewItem.blob
          .text()
          .then((text) => setPreviewTextContent(text))
          .catch(() => setPreviewTextContent(null));
      } else {
        setPreviewTextContent(null);
      }
    } else {
      setPreviewTextContent(null);
    }
  }, [previewItem]);

  // Handle Drag and Drop
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only deactivate if leaving the container
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDraggingOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const droppedFiles = Array.from(e.dataTransfer.files);
        playFileDropChime();
        for (const file of droppedFiles) {
          await manager.addFile(file);
        }
      }
    },
    [manager]
  );

  // File Input Handler
  const handleFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        const selected = Array.from(e.target.files);
        playFileDropChime();
        for (const file of selected) {
          await manager.addFile(file);
        }
        e.target.value = '';
      }
    },
    [manager]
  );

  // Handle Download All as ZIP
  const handleDownloadAll = useCallback(async () => {
    setIsZipping(true);
    setZipProgress(0);
    try {
      await downloadAllAsZip(items, `live-workspace-${Date.now().toString(36)}.zip`, (progress) => {
        setZipProgress(progress);
      });
    } catch (err) {
      console.error('[LiveSyncTable] ZIP Export error:', err);
    } finally {
      setIsZipping(false);
    }
  }, [items]);

  // Handle Copy Name / Info
  const handleCopyItemName = useCallback((item: SyncItem) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(item.name);
      setCopiedItemId(item.id);
      setTimeout(() => setCopiedItemId(null), 1500);
    }
  }, []);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchSender = item.senderId.toLowerCase().includes(q);
        if (!matchName && !matchSender) return false;
      }

      // Category filter
      if (categoryFilter !== 'ALL') {
        const { category } = getFileTypeDetails(item.name, item.type);
        if (category !== categoryFilter) return false;
      }

      // Status filter
      if (statusFilter === 'COMPLETED' && item.status !== 'completed') return false;
      if (statusFilter === 'SYNCING' && item.status !== 'transferring' && item.status !== 'pending') {
        return false;
      }

      return true;
    });
  }, [items, searchQuery, categoryFilter, statusFilter]);

  // Stats
  const totalBytes = useMemo(() => items.reduce((acc, i) => acc + (i.size || 0), 0), [items]);
  const completedCount = useMemo(() => items.filter((i) => i.status === 'completed').length, [items]);
  const activeCount = useMemo(
    () => items.filter((i) => i.status === 'transferring' || i.status === 'pending').length,
    [items]
  );

  return (
    <div
      className={`relative w-full max-w-5xl mx-auto glass-panel p-4 sm:p-6 text-slate-100 overflow-hidden ${className}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Holographic Cyberpunk Drag Overlay */}
      <AnimatePresence>
        {isDraggingOver && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-md border-2 border-dashed border-cyan-400 rounded-3xl flex flex-col items-center justify-center p-6 text-center shadow-[0_0_50px_rgba(6,182,212,0.4)] pointer-events-none"
          >
            <div className="p-4 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-400/50 mb-3 animate-bounce">
              <Upload className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold font-mono tracking-wider text-cyan-300">
              DROP ASSETS TO BROADCAST
            </h3>
            <p className="text-xs font-mono text-cyan-200/70 mt-1 max-w-md">
              Real-time WebRTC stream will immediately propagate chunks to all linked peers.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is standard in browsers
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Workspace Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-5 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/20 border border-cyan-400/30 text-cyan-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black font-mono tracking-wide bg-gradient-to-r from-cyan-400 via-emerald-400 to-fuchsia-400 bg-clip-text text-transparent">
                  LIVE WORKSPACE
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold tracking-widest uppercase rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  REALTIME P2P
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Bidirectional synchronized workspace table over WebRTC mesh
              </p>
            </div>
          </div>
        </div>

        {/* Peer Indicators & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Local Node Badge */}
          <div className="px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <div className="flex flex-col">
              <span className="text-[9px] font-mono uppercase text-cyan-400 font-semibold tracking-wider">
                Local Node
              </span>
              <span className="text-xs font-mono text-slate-200 font-bold truncate max-w-[120px]">
                {localPeerId}
              </span>
            </div>
          </div>

          {/* Peer Nodes Badge */}
          <div className="px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-400" />
            <div className="flex flex-col">
              <span className="text-[9px] font-mono uppercase text-purple-400 font-semibold tracking-wider">
                Peers Linked
              </span>
              <span className="text-xs font-mono text-slate-200 font-bold">
                {connectedPeers.length > 0
                  ? connectedPeers.length
                  : isConnected
                  ? '1 Active'
                  : '0 (Offline)'}
              </span>
            </div>
          </div>

          {/* Close / Minimize button if provided */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors border border-white/10"
              title="Close Workspace"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 my-4">
        <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
              Shared Assets
            </span>
            <span className="text-lg font-mono font-bold text-white">{items.length}</span>
          </div>
          <HardDrive className="w-5 h-5 text-slate-500" />
        </div>

        <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
              Total Volume
            </span>
            <span className="text-lg font-mono font-bold text-cyan-400">
              {formatBytes(totalBytes)}
            </span>
          </div>
          <Zap className="w-5 h-5 text-cyan-500" />
        </div>

        <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
              Synced Ready
            </span>
            <span className="text-lg font-mono font-bold text-emerald-400">{completedCount}</span>
          </div>
          <Check className="w-5 h-5 text-emerald-500" />
        </div>

        <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
              In-Flight
            </span>
            <span className="text-lg font-mono font-bold text-amber-400">{activeCount}</span>
          </div>
          <Radio className="w-5 h-5 text-amber-500" />
        </div>
      </div>

      {/* Toolbar: Actions & Search & Filters */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 mb-4">
        {/* Left Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-mono text-xs font-bold tracking-wider flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            ADD FILES
          </button>

          <button
            onClick={() => folderInputRef.current?.click()}
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 font-mono text-xs font-semibold tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FolderUp className="w-4 h-4 text-amber-400" />
            ADD FOLDER
          </button>

          {completedCount > 0 && (
            <button
              onClick={handleDownloadAll}
              disabled={isZipping}
              className="px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-mono text-xs font-bold tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isZipping ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  PACKING {zipProgress}%
                </>
              ) : (
                <>
                  <ArrowDownToLine className="w-4 h-4" />
                  ZIP ALL ({completedCount})
                </>
              )}
            </button>
          )}

          {items.length > 0 && (
            <button
              onClick={() => manager.clearWorkspace()}
              className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono text-xs font-semibold tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Clear all assets from workspace"
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
              CLEAR
            </button>
          )}
        </div>

        {/* Right Search & Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-48">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center bg-black/40 p-0.5 rounded-xl border border-white/10">
            {(['ALL', 'COMPLETED', 'SYNCING'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold uppercase transition-colors cursor-pointer ${
                  statusFilter === st
                    ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-hide">
        {(
          [
            { id: 'ALL', label: 'All Types' },
            { id: 'IMAGE', label: 'Images' },
            { id: 'VIDEO', label: 'Videos' },
            { id: 'AUDIO', label: 'Audio' },
            { id: 'DOC', label: 'Documents' },
            { id: 'CODE', label: 'Code' },
            { id: 'ARCHIVE', label: 'Archives' },
          ] as const
        ).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setCategoryFilter(id)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono whitespace-nowrap transition-colors cursor-pointer ${
              categoryFilter === id
                ? 'bg-white/15 text-white border border-white/20 font-bold'
                : 'text-slate-400 hover:text-slate-200 bg-white/[0.02] border border-transparent'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Workspace Items Table / Matrix View */}
      {filteredItems.length === 0 ? (
        <div className="py-14 text-center rounded-2xl bg-black/30 border border-dashed border-white/10 flex flex-col items-center justify-center p-6">
          <div className="p-4 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-3 animate-pulse">
            <Upload className="w-8 h-8" />
          </div>
          <h3 className="text-sm sm:text-base font-mono font-bold text-slate-200">
            {items.length === 0
              ? 'LIVE WORKSPACE EMPTY'
              : 'NO MATCHING ASSETS FOUND'}
          </h3>
          <p className="text-xs text-slate-400 font-mono mt-1 max-w-sm">
            {items.length === 0
              ? 'Drag & drop files anywhere onto this table or click "ADD FILES" to broadcast to connected peers.'
              : 'Try clearing your search query or switching category filters.'}
          </p>
          {items.length === 0 && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-mono font-bold tracking-wider transition-colors cursor-pointer"
            >
              BROWSE LOCAL ASSETS
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/20">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-[10px] font-mono uppercase tracking-wider text-slate-400 bg-white/[0.02]">
                <th className="py-3 px-4 font-semibold">Asset / File Name</th>
                <th className="py-3 px-3 font-semibold">Size</th>
                <th className="py-3 px-3 font-semibold">Origin</th>
                <th className="py-3 px-4 font-semibold">Sync Status</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-xs">
              {filteredItems.map((item) => {
                const { Icon, colorClass, category } = getFileTypeDetails(
                  item.name,
                  item.type
                );
                const isLocal = item.senderId === localPeerId;
                const isComplete = item.status === 'completed';
                const isTransferring = item.status === 'transferring';

                return (
                  <tr
                    key={item.id}
                    className="hover:bg-white/[0.04] transition-colors group"
                  >
                    {/* File Name & Icon */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-xl border flex-shrink-0 ${colorClass}`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 max-w-[200px] sm:max-w-[280px]">
                          <div
                            className="font-semibold text-white truncate cursor-pointer hover:text-cyan-300 transition-colors"
                            onClick={() => handleCopyItemName(item)}
                            title="Click to copy name"
                          >
                            {item.name}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400">
                            <span className="uppercase font-bold tracking-wider text-slate-400">
                              {category}
                            </span>
                            <span>•</span>
                            <span>
                              {new Date(item.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* File Size */}
                    <td className="py-3 px-3 text-slate-300 whitespace-nowrap">
                      {formatBytes(item.size)}
                    </td>

                    {/* Origin / Sender Badge */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                          isLocal
                            ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                            : 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isLocal ? 'bg-cyan-400' : 'bg-fuchsia-400'
                          }`}
                        />
                        {isLocal ? 'YOU' : `PEER: ${item.senderId.slice(-4)}`}
                      </span>
                    </td>

                    {/* Sync Status / Progress */}
                    <td className="py-3 px-4 min-w-[140px]">
                      {isComplete ? (
                        <div className="flex items-center gap-1.5 text-emerald-400">
                          <Check className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="text-[11px] font-bold tracking-wider">
                            READY
                          </span>
                        </div>
                      ) : isTransferring ? (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-amber-400 flex items-center gap-1 font-bold">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              SYNCING
                            </span>
                            <span className="text-slate-300 font-bold">
                              {item.progress}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden border border-white/10">
                            <div
                              className="bg-gradient-to-r from-amber-500 to-cyan-400 h-full rounded-full transition-all duration-200"
                              style={{ width: `${item.progress}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-bold uppercase">
                          {item.status}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        {/* Preview button */}
                        {isComplete && item.blob && (
                          <button
                            onClick={() => setPreviewItem(item)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
                            title="Preview Asset"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}

                        {/* Download button */}
                        {isComplete && item.blob && (
                          <button
                            onClick={() => downloadSyncItem(item)}
                            className="p-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 hover:text-cyan-200 border border-cyan-500/40 transition-colors cursor-pointer"
                            title="Download to device"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        )}

                        {/* Copy button */}
                        <button
                          onClick={() => handleCopyItemName(item)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 border border-white/10 transition-colors cursor-pointer"
                          title="Copy file name"
                        >
                          {copiedItemId === item.id ? (
                            <Check className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>

                        {/* Delete button */}
                        <button
                          onClick={() => manager.removeFile(item.id)}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 transition-colors cursor-pointer"
                          title="Remove from workspace"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Built-in Cyberpunk Modal Preview */}
      <AnimatePresence>
        {previewItem && previewItem.blob && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setPreviewItem(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative max-w-2xl w-full glass-panel border border-cyan-500/40 p-4 sm:p-6 text-slate-100 max-h-[90vh] flex flex-col shadow-[0_0_50px_rgba(6,182,212,0.3)]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="p-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-400">
                    <Eye className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <h4 className="text-sm font-mono font-bold text-white truncate">
                      {previewItem.name}
                    </h4>
                    <span className="text-[10px] font-mono text-slate-400">
                      {formatBytes(previewItem.size)} • {previewItem.type}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => downloadSyncItem(previewItem)}
                    className="p-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-mono font-semibold flex items-center gap-1"
                  >
                    <Download className="w-4 h-4" />
                    SAVE
                  </button>
                  <button
                    onClick={() => setPreviewItem(null)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="my-4 flex-1 overflow-auto flex items-center justify-center min-h-[240px] max-h-[60vh] bg-black/40 rounded-xl border border-white/10 p-2">
                {/* Images */}
                {previewItem.type.startsWith('image/') ||
                /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(previewItem.name) ? (
                  <img
                    src={URL.createObjectURL(previewItem.blob)}
                    alt={previewItem.name}
                    className="max-h-[55vh] max-w-full object-contain rounded-lg shadow-lg"
                  />
                ) : /* Videos */
                previewItem.type.startsWith('video/') ||
                  /\.(mp4|webm|ogv|mov)$/i.test(previewItem.name) ? (
                  <video
                    src={URL.createObjectURL(previewItem.blob)}
                    controls
                    autoPlay
                    className="max-h-[55vh] max-w-full rounded-lg"
                  />
                ) : /* Audio */
                previewItem.type.startsWith('audio/') ||
                  /\.(mp3|wav|ogg|flac|aac|m4a)$/i.test(previewItem.name) ? (
                  <div className="w-full max-w-md p-6 text-center space-y-4">
                    <div className="p-4 mx-auto w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center animate-pulse">
                      <FileAudio className="w-8 h-8" />
                    </div>
                    <audio
                      src={URL.createObjectURL(previewItem.blob)}
                      controls
                      className="w-full"
                    />
                  </div>
                ) : /* Text / Code */
                previewTextContent !== null ? (
                  <pre className="w-full h-full p-3 font-mono text-xs text-cyan-200 overflow-auto whitespace-pre-wrap select-text">
                    {previewTextContent.slice(0, 10000)}
                    {previewTextContent.length > 10000 && (
                      <span className="text-amber-400 block mt-2">
                        ...[Truncated preview of large document]
                      </span>
                    )}
                  </pre>
                ) : (
                  <div className="text-center p-6 space-y-2">
                    <FileIcon className="w-12 h-12 text-slate-500 mx-auto" />
                    <p className="text-xs font-mono text-slate-300">
                      Binary payload ready for download.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LiveSyncTable;
