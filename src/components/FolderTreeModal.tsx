import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import JSZip from 'jszip';
import {
  Folder,
  FolderOpen,
  File as FileIcon,
  FileText,
  FileCode,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  ChevronRight,
  Download,
  CheckSquare,
  Square,
  MinusSquare,
  Search,
  X,
  Layers,
  FolderTree,
  Loader2,
  Check,
  HardDrive,
} from 'lucide-react';
import type {
  FolderManifest,
  FolderTreeNode,
  ManifestFileItem,
} from '../lib/folderManifest';
import {
  buildFolderManifest,
  flattenManifest,
  getAllDirectoryPaths,
  filterManifestBySearch,
  collectFilesUnderPath,
  createZipFromManifest,
} from '../lib/folderManifest';
import type { FileWithCustomPath } from '../types';
import { formatBytes, saveFile } from '../lib/utils';
import { playToggleSound, playTransferCompleteChime, playErrorSound } from '../lib/audioFX';
import { readTarEntries, extractTarFile } from '../lib/virtualPackage';

export interface FolderTreeModalProps {
  isOpen: boolean;
  onClose: () => void;
  files?: (File | FileWithCustomPath)[];
  manifest?: FolderManifest | null;
  completedBlob?: Blob | null;
  title?: string;
  onDownloadFile?: (file: File) => void;
  onDownloadSelected?: (selectedFiles: ManifestFileItem[]) => Promise<void> | void;
  onDownloadSingle?: (fileItem: ManifestFileItem) => Promise<void> | void;
  t?: (key: string, params?: Record<string, string | number>) => string;
}

/**
 * Returns dynamic cybernetic icon and color styling based on file extension / mime type
 */
function getFileVisuals(name: string, type = '') {
  const lowerName = name.toLowerCase();
  const lowerType = type.toLowerCase();

  if (
    lowerType.startsWith('image/') ||
    /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|heic|avif)$/.test(lowerName)
  ) {
    return {
      Icon: FileImage,
      color: 'text-pink-400',
      bg: 'bg-pink-500/10 border-pink-500/30',
    };
  }
  if (
    lowerType.startsWith('video/') ||
    /\.(mp4|mkv|webm|avi|mov|wmv|flv|m4v)$/.test(lowerName)
  ) {
    return {
      Icon: FileVideo,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10 border-purple-500/30',
    };
  }
  if (
    lowerType.startsWith('audio/') ||
    /\.(mp3|wav|ogg|flac|aac|m4a|wma)$/.test(lowerName)
  ) {
    return {
      Icon: FileAudio,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/30',
    };
  }
  if (
    /\.(zip|tar|gz|rar|7z|bz2|xz|iso)$/.test(lowerName) ||
    lowerType.includes('zip') ||
    lowerType.includes('compressed') ||
    lowerType.includes('archive')
  ) {
    return {
      Icon: FileArchive,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/30',
    };
  }
  if (
    /\.(ts|tsx|js|jsx|json|html|css|py|rs|go|cpp|c|java|php|rb|sql|sh|yaml|yml|mdx)$/.test(
      lowerName
    )
  ) {
    return {
      Icon: FileCode,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10 border-cyan-500/30',
    };
  }
  if (
    /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|md|rtf|csv)$/.test(lowerName) ||
    lowerType.startsWith('text/')
  ) {
    return {
      Icon: FileText,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10 border-blue-500/30',
    };
  }
  return {
    Icon: FileIcon,
    color: 'text-slate-300',
    bg: 'bg-white/5 border-white/10',
  };
}

/**
 * Highlight search term in text
 */
function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <span>{text}</span>;

  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <span>
      {parts.map((part, index) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={index}
            className="bg-cyan-500/30 text-cyan-200 px-0.5 rounded font-bold underline"
          >
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </span>
  );
}

export const FolderTreeModal: React.FC<FolderTreeModalProps> = React.memo(function FolderTreeModal({
  isOpen,
  onClose,
  files,
  manifest: explicitManifest,
  completedBlob,
  title,
  onDownloadFile,
  onDownloadSelected,
  onDownloadSingle,
  t,
}) {
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [activeDownloadFile, setActiveDownloadFile] = useState<string | null>(null);

  // Compute active manifest from explicitManifest or files
  const activeManifest = useMemo<FolderManifest | null>(() => {
    if (explicitManifest) return explicitManifest;
    if (files && files.length > 0) return buildFolderManifest(files);
    return null;
  }, [explicitManifest, files]);

  const effectiveTitle = title || (t ? t('folderTreeTitle') : 'Selective Folder Inspector');

  // Initialize all files as selected and root directories expanded on manifest change
  useEffect(() => {
    if (activeManifest) {
      const allFiles = flattenManifest(activeManifest);
      setSelectedPaths(new Set(allFiles.map((f) => f.relativePath)));

      // Expand top 2 directory levels by default
      const defaultExpanded = new Set<string>();
      function expandInitial(node: FolderTreeNode, depth: number) {
        if (node.isFolder && node.relativePath) {
          defaultExpanded.add(node.relativePath);
        }
        if (depth < 2) {
          for (const sub of node.children) {
            if (sub.isFolder) {
              expandInitial(sub, depth + 1);
            }
          }
        }
      }
      expandInitial(activeManifest.root, 0);
      setExpandedDirs(defaultExpanded);
      setSearchQuery('');
    }
  }, [activeManifest]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Search filtered manifest
  const { filteredManifest, matchCount } = useMemo(() => {
    if (!activeManifest) {
      return { filteredManifest: null, matchCount: 0 };
    }
    return filterManifestBySearch(activeManifest, searchQuery);
  }, [activeManifest, searchQuery]);

  // Auto-expand all matching directories when searching
  useEffect(() => {
    if (searchQuery.trim() && filteredManifest) {
      const allPaths = getAllDirectoryPaths(filteredManifest.root);
      setExpandedDirs(new Set(allPaths));
    }
  }, [searchQuery, filteredManifest]);

  const allManifestFiles = useMemo(() => {
    return activeManifest ? flattenManifest(activeManifest) : [];
  }, [activeManifest]);

  // Selected files array and total size
  const selectedFilesList = useMemo(() => {
    return allManifestFiles.filter((f) => selectedPaths.has(f.relativePath));
  }, [allManifestFiles, selectedPaths]);

  const selectedTotalSize = useMemo(() => {
    return selectedFilesList.reduce((acc, f) => acc + f.size, 0);
  }, [selectedFilesList]);

  // Directory expansion toggle
  const toggleDir = useCallback((path: string) => {
    playToggleSound();
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // Expand all / Collapse all
  const handleExpandAll = useCallback(() => {
    playToggleSound();
    if (activeManifest) {
      const allPaths = getAllDirectoryPaths(activeManifest.root);
      setExpandedDirs(new Set(allPaths));
    }
  }, [activeManifest]);

  const handleCollapseAll = useCallback(() => {
    playToggleSound();
    setExpandedDirs(new Set());
  }, []);

  // Selection toggles
  const handleSelectAll = useCallback(() => {
    playToggleSound();
    setSelectedPaths(new Set(allManifestFiles.map((f) => f.relativePath)));
  }, [allManifestFiles]);

  const handleDeselectAll = useCallback(() => {
    playToggleSound();
    setSelectedPaths(new Set());
  }, []);

  const toggleFileSelection = useCallback((relativePath: string) => {
    playToggleSound();
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(relativePath)) {
        next.delete(relativePath);
      } else {
        next.add(relativePath);
      }
      return next;
    });
  }, []);

  // Directory check state: 'all' | 'some' | 'none'
  const getDirectoryCheckState = useCallback(
    (dirNode: FolderTreeNode): 'all' | 'some' | 'none' => {
      const filesUnder = collectFilesUnderPath(activeManifest?.root || dirNode, dirNode.relativePath);
      if (filesUnder.length === 0) return 'none';

      let selectedCount = 0;
      for (const f of filesUnder) {
        if (selectedPaths.has(f.relativePath)) {
          selectedCount++;
        }
      }

      if (selectedCount === filesUnder.length) return 'all';
      if (selectedCount > 0) return 'some';
      return 'none';
    },
    [activeManifest, selectedPaths]
  );

  // Toggle directory checkbox (select/deselect all children)
  const toggleDirectorySelection = useCallback(
    (dirNode: FolderTreeNode) => {
      playToggleSound();
      const filesUnder = collectFilesUnderPath(activeManifest?.root || dirNode, dirNode.relativePath);
      const state = getDirectoryCheckState(dirNode);

      setSelectedPaths((prev) => {
        const next = new Set(prev);
        if (state === 'all') {
          // Deselect all
          for (const f of filesUnder) {
            next.delete(f.relativePath);
          }
        } else {
          // Select all
          for (const f of filesUnder) {
            next.add(f.relativePath);
          }
        }
        return next;
      });
    },
    [activeManifest, getDirectoryCheckState]
  );

  // Single file download action
  const handleDownloadSingleFile = useCallback(
    async (fileItem: ManifestFileItem) => {
      try {
        playToggleSound();
        setActiveDownloadFile(fileItem.relativePath);

        if (onDownloadSingle) {
          await onDownloadSingle(fileItem);
          playTransferCompleteChime();
          return;
        }

        if (onDownloadFile && fileItem.file) {
          onDownloadFile(fileItem.file);
          playTransferCompleteChime();
          return;
        }

        // If a completed TAR or ZIP blob is available in memory
        if (completedBlob) {
          try {
            const tarEntries = await readTarEntries(completedBlob);
            const tarEntry = tarEntries.find((e) => e.path === fileItem.relativePath || e.name === fileItem.name);
            if (tarEntry) {
              const singleBlob = extractTarFile(completedBlob, tarEntry);
              await saveFile(singleBlob, fileItem.name);
              playTransferCompleteChime();
              return;
            }
          } catch {
            // fall back to JSZip
          }

          try {
            const zip = await JSZip.loadAsync(completedBlob);
            const zipEntry = zip.file(fileItem.relativePath);
            if (zipEntry) {
              const singleBlob = await zipEntry.async('blob');
              await saveFile(singleBlob, fileItem.name);
              playTransferCompleteChime();
              return;
            }
          } catch {
            // ignore
          }
        }

        // Direct File or Blob reference
        if (fileItem.file) {
          await saveFile(fileItem.file, fileItem.name);
          playTransferCompleteChime();
          return;
        }
        if (fileItem.blob) {
          await saveFile(fileItem.blob, fileItem.name);
          playTransferCompleteChime();
          return;
        }

        throw new Error(`File payload not available for ${fileItem.name}`);
      } catch (err) {
        playErrorSound();
        const msg = err instanceof Error ? err.message : String(err);
        alert(`Download failed: ${msg}`);
      } finally {
        setActiveDownloadFile(null);
      }
    },
    [completedBlob, onDownloadSingle, onDownloadFile]
  );

  // Download entire subfolder as a ZIP
  const handleDownloadFolderAsZip = useCallback(
    async (dirNode: FolderTreeNode) => {
      try {
        playToggleSound();
        setIsDownloading(true);

        const filesUnder = collectFilesUnderPath(activeManifest?.root || dirNode, dirNode.relativePath);
        if (filesUnder.length === 0) return;

        const zipName = `${dirNode.name || 'folder'}.zip`;

        if (completedBlob) {
          const loadedZip = await JSZip.loadAsync(completedBlob);
          const newZip = new JSZip();

          for (const item of filesUnder) {
            const entry = loadedZip.file(item.relativePath);
            if (entry) {
              const data = await entry.async('blob');
              // Make path relative to subfolder
              const subPath = item.relativePath.startsWith(`${dirNode.relativePath}/`)
                ? item.relativePath.slice(dirNode.relativePath.length + 1)
                : item.relativePath;
              newZip.file(subPath, data);
            }
          }

          const outBlob = await newZip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
          await saveFile(outBlob, zipName);
        } else {
          const outBlob = await createZipFromManifest(filesUnder);
          await saveFile(outBlob, zipName);
        }

        playTransferCompleteChime();
      } catch (err) {
        playErrorSound();
        const msg = err instanceof Error ? err.message : String(err);
        alert(`Folder download failed: ${msg}`);
      } finally {
        setIsDownloading(false);
      }
    },
    [activeManifest, completedBlob]
  );

  // Download selected files batch action
  const handleDownloadSelectedBatch = useCallback(async () => {
    if (selectedFilesList.length === 0) return;

    try {
      playToggleSound();
      setIsDownloading(true);

      if (onDownloadSelected) {
        await onDownloadSelected(selectedFilesList);
        playTransferCompleteChime();
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 2500);
        return;
      }

      // Single file download directly
      if (selectedFilesList.length === 1 && selectedFilesList[0]) {
        await handleDownloadSingleFile(selectedFilesList[0]);
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 2500);
        return;
      }

      // Multi-file ZIP compilation
      if (completedBlob) {
        const loadedZip = await JSZip.loadAsync(completedBlob);
        const newZip = new JSZip();

        for (const item of selectedFilesList) {
          const entry = loadedZip.file(item.relativePath);
          if (entry) {
            const data = await entry.async('blob');
            newZip.file(item.relativePath, data);
          }
        }

        const outBlob = await newZip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
        await saveFile(outBlob, 'selective_vault_files.zip');
      } else {
        const outBlob = await createZipFromManifest(selectedFilesList);
        await saveFile(outBlob, 'selective_vault_files.zip');
      }

      playTransferCompleteChime();
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2500);
    } catch (err) {
      playErrorSound();
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Batch download failed: ${msg}`);
    } finally {
      setIsDownloading(false);
    }
  }, [selectedFilesList, onDownloadSelected, completedBlob, handleDownloadSingleFile]);

  // Recursive Tree Node Renderer
  const renderTreeNode = (node: FolderTreeNode, depth = 0) => {
    if (node.isFolder) {
      const isRoot = !node.relativePath;
      const isExpanded = isRoot || expandedDirs.has(node.relativePath);
      const checkState = getDirectoryCheckState(node);

      return (
        <div key={node.id || `dir-${node.path}`} className="w-full">
          {!isRoot && (
            <div
              className={`group flex items-center gap-2 py-1.5 px-2 rounded-xl hover:bg-cyan-500/10 transition-colors border border-transparent hover:border-cyan-500/20 cursor-pointer ${
                depth > 0 ? 'ml-3 sm:ml-4' : ''
              }`}
              style={{ paddingLeft: `${Math.max(8, depth * 14)}px` }}
            >
              {/* Expand / Collapse Toggle Arrow */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleDir(node.relativePath);
                }}
                className="p-1 text-slate-400 hover:text-cyan-400 transition-transform rounded cursor-pointer"
                aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
              >
                <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.15 }}>
                  <ChevronRight className="w-4 h-4" />
                </motion.div>
              </button>

              {/* Checkbox */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleDirectorySelection(node);
                }}
                className="text-cyan-400 hover:text-cyan-300 p-0.5 rounded cursor-pointer transition-transform active:scale-95"
                aria-label={`Select folder ${node.name}`}
              >
                {checkState === 'all' && <CheckSquare className="w-4 h-4 text-cyan-400" />}
                {checkState === 'some' && <MinusSquare className="w-4 h-4 text-cyan-400/80" />}
                {checkState === 'none' && <Square className="w-4 h-4 text-slate-600 hover:text-slate-400" />}
              </button>

              {/* Folder Name & Info */}
              <div
                className="flex items-center gap-2 flex-1 min-w-0"
                onClick={() => toggleDir(node.relativePath)}
              >
                {isExpanded ? (
                  <FolderOpen className="w-4 h-4 text-cyan-400 shrink-0" />
                ) : (
                  <Folder className="w-4 h-4 text-cyan-500/80 shrink-0" />
                )}
                <span className="text-sm font-semibold text-slate-200 truncate group-hover:text-cyan-300 transition-colors">
                  <HighlightedText text={node.name} query={searchQuery} />
                </span>
                <span className="text-[11px] font-mono text-slate-500 shrink-0">
                  ({node.fileCount} {node.fileCount === 1 ? 'file' : 'files'}, {formatBytes(node.totalSize)})
                </span>
              </div>

              {/* Quick Folder Subtree Download Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownloadFolderAsZip(node);
                }}
                disabled={isDownloading}
                className="opacity-0 group-hover:opacity-100 px-2 py-0.5 bg-cyan-500/20 hover:bg-cyan-500 text-cyan-300 hover:text-black rounded-lg text-[10px] font-mono font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                title={`Download ${node.name} as ZIP`}
              >
                <Download className="w-3 h-3" />
                <span className="hidden sm:inline">ZIP</span>
              </button>
            </div>
          )}

          {/* Children Directories and Files */}
          <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className={`space-y-0.5 overflow-hidden ${
                  !isRoot ? 'border-l border-cyan-500/15 ml-3.5 sm:ml-5 pl-1' : ''
                }`}
              >
                {node.children.map((child) => renderTreeNode(child, depth + 1))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    }

    // Leaf file node
    const fileItem = node.fileItem;
    if (!fileItem) return null;

    const isSelected = selectedPaths.has(fileItem.relativePath);
    const { Icon, color, bg } = getFileVisuals(fileItem.name, fileItem.type);
    const isItemDownloading = activeDownloadFile === fileItem.relativePath;

    return (
      <div
        key={fileItem.id || `file-${node.path}`}
        className={`group flex items-center gap-2 py-1.5 px-2 rounded-xl transition-all border cursor-pointer ${
          isSelected
            ? 'bg-cyan-500/10 border-cyan-500/30'
            : 'bg-white/[0.02] hover:bg-white/[0.06] border-transparent'
        }`}
        style={{ paddingLeft: `${Math.max(12, (depth + 1) * 12)}px` }}
        onClick={() => toggleFileSelection(fileItem.relativePath)}
      >
        {/* File Checkbox */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleFileSelection(fileItem.relativePath);
          }}
          className="p-0.5 rounded cursor-pointer transition-transform active:scale-95 shrink-0"
          aria-label={`Select file ${fileItem.name}`}
        >
          {isSelected ? (
            <CheckSquare className="w-4 h-4 text-cyan-400" />
          ) : (
            <Square className="w-4 h-4 text-slate-600 hover:text-slate-400" />
          )}
        </button>

        {/* File Icon */}
        <div className={`p-1 rounded-lg border shrink-0 ${bg}`}>
          <Icon className={`w-3.5 h-3.5 ${color}`} />
        </div>

        {/* File Info */}
        <div className="flex-1 min-w-0">
          <p
            className={`text-xs font-medium truncate ${
              isSelected ? 'text-white' : 'text-slate-300'
            }`}
            title={fileItem.relativePath}
          >
            <HighlightedText text={fileItem.name} query={searchQuery} />
          </p>
          <p className="text-[10px] font-mono text-slate-500">
            {formatBytes(fileItem.size)}
          </p>
        </div>

        {/* Individual Download Action */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleDownloadSingleFile(fileItem);
          }}
          disabled={isDownloading || isItemDownloading}
          className="px-2 py-1 bg-white/5 hover:bg-cyan-500/20 text-slate-400 hover:text-cyan-300 border border-white/10 hover:border-cyan-500/40 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
          title={`Download ${fileItem.name}`}
          aria-label={`Download ${fileItem.name}`}
        >
          {isItemDownloading ? (
            <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
          ) : (
            <Download className="w-3 h-3" />
          )}
          <span className="hidden sm:inline text-[11px]">Save</span>
        </button>
      </div>
    );
  };

  if (!isOpen || !activeManifest) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xl overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-slate-950/90 border border-cyan-500/30 rounded-3xl shadow-[0_0_50px_rgba(6,182,212,0.15)] overflow-hidden text-slate-200"
          role="dialog"
          aria-modal="true"
          aria-label={effectiveTitle}
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-cyan-950/40 via-slate-900/60 to-purple-950/40">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                <FolderTree className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <span>{effectiveTitle}</span>
                  <span className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-full font-bold">
                    TREE MATRIX
                  </span>
                </h2>
                <p className="text-xs text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                  <span>{activeManifest.totalFiles} Total Files</span>
                  <span>•</span>
                  <span>{formatBytes(activeManifest.totalSize)}</span>
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                playToggleSound();
                onClose();
              }}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Close Inspector"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search & Control Toolbar */}
          <div className="p-3 sm:p-4 border-b border-white/5 bg-black/40 space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search files or subfolders..."
                className="w-full bg-white/5 border border-white/10 focus:border-cyan-500/50 rounded-2xl pl-10 pr-10 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all font-mono"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-md cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Actions & Status Summary */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  Deselect All
                </button>
                <div className="h-4 w-[1px] bg-white/10 mx-1" />
                <button
                  type="button"
                  onClick={handleExpandAll}
                  className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  Expand All
                </button>
                <button
                  type="button"
                  onClick={handleCollapseAll}
                  className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  Collapse All
                </button>
              </div>

              {/* Counter Pill */}
              <div className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 rounded-full font-bold text-[11px] flex items-center gap-1.5 ml-auto">
                <HardDrive className="w-3 h-3" />
                <span>
                  {searchQuery.trim()
                    ? `${matchCount} matches (${selectedFilesList.length} selected)`
                    : `${selectedFilesList.length} of ${allManifestFiles.length} selected (${formatBytes(selectedTotalSize)})`}
                </span>
              </div>
            </div>
          </div>

          {/* Tree Explorer Container */}
          <div className="flex-1 p-3 sm:p-4 overflow-y-auto max-h-[50vh] min-h-[220px] custom-scrollbar bg-black/20">
            {filteredManifest && filteredManifest.totalFiles > 0 ? (
              <div className="space-y-1">
                {renderTreeNode(filteredManifest.root, 0)}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-500 font-mono text-xs space-y-2">
                <Layers className="w-8 h-8 mx-auto text-slate-600" />
                <p>No files match search filter "{searchQuery}"</p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-cyan-400 hover:underline cursor-pointer font-bold"
                >
                  Clear search query
                </button>
              </div>
            )}
          </div>

          {/* Footer Action Bar */}
          <div className="p-4 border-t border-white/10 bg-slate-900/80 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-400 font-mono text-center sm:text-left">
              {selectedFilesList.length === 0 ? (
                <span className="text-amber-400/90">Select at least one file to download</span>
              ) : (
                <span>
                  Ready to download{' '}
                  <strong className="text-white">{selectedFilesList.length}</strong> selected{' '}
                  {selectedFilesList.length === 1 ? 'file' : 'files'} (
                  <strong className="text-cyan-300">{formatBytes(selectedTotalSize)}</strong>)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl text-xs font-bold font-mono transition-colors cursor-pointer border border-white/10"
              >
                Close
              </button>

              <button
                type="button"
                onClick={handleDownloadSelectedBatch}
                disabled={selectedFilesList.length === 0 || isDownloading}
                className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-bold font-mono text-xs transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer ${
                  selectedFilesList.length === 0 || isDownloading
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
                    : downloadSuccess
                    ? 'bg-emerald-500 text-black shadow-emerald-500/30'
                    : 'bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-black shadow-cyan-500/25 active:scale-95'
                }`}
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Packaging ZIP...</span>
                  </>
                ) : downloadSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-black" />
                    <span>Downloaded!</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download Selected ({selectedFilesList.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
});

export default FolderTreeModal;
