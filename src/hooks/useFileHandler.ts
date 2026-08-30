import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import JSZip from 'jszip';
import { playFileDropChime } from '../lib/audioFX';
import { VirtualPackage, readTarEntries } from '../lib/virtualPackage';
import type { CompletedFile, ZipEntry, FileWithCustomPath, WebKitEntry, WebKitFileEntry, WebKitDirectoryEntry } from '../types';

export async function scanEntry(entry: WebKitEntry, path = ''): Promise<File[]> {
  if (entry.isFile) {
    return new Promise<File[]>((resolve) => {
      (entry as WebKitFileEntry).file((file: File) => {
        (file as FileWithCustomPath).customPath = path + file.name;
        resolve([file]);
      });
    });
  } else if (entry.isDirectory) {
    const dirReader = (entry as WebKitDirectoryEntry).createReader();
    return new Promise<File[]>((resolve) => {
      const readAll = async () => {
        let allFiles: File[] = [];
        const readEntries = () => new Promise<WebKitEntry[]>((res) => dirReader.readEntries(res));

        let entries = await readEntries();
        while (entries.length > 0) {
          for (const cEntry of entries) {
            const files = await scanEntry(cEntry, path + entry.name + '/');
            allFiles = allFiles.concat(files);
          }
          entries = await readEntries();
        }
        resolve(allFiles);
      };
      readAll();
    });
  }
  return [];
}

export function useFileHandler(
  completedFile: CompletedFile | null,
  onFilesProcessed?: () => void,
) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileToShare, setFileToShare] = useState<File | null>(null);
  const fileToShareRef = useRef<File | null>(null);
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isGlobalDragging, setIsGlobalDragging] = useState(false);
  const dragCounterRef = useRef(0);
  const zipTaskSeqRef = useRef(0);

  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [zipContents, setZipContents] = useState<ZipEntry[]>([]);
  const [showZipPreview, setShowZipPreview] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Sync fileToShareRef with state
  useEffect(() => {
    fileToShareRef.current = fileToShare;
  }, [fileToShare]);

  // Total uncompressed payload size of selected batch files
  const totalPayloadSize = useMemo(() => {
    return selectedFiles.reduce((acc, file) => acc + (file.size || 0), 0);
  }, [selectedFiles]);

  // Image preview URL derived directly via useMemo with guaranteed URL cleanup
  const previewUrl = useMemo(() => {
    if (selectedFiles.length === 1 && selectedFiles[0].type.startsWith('image/')) {
      return URL.createObjectURL(selectedFiles[0]);
    }
    if (fileToShare && fileToShare.type.startsWith('image/')) {
      return URL.createObjectURL(fileToShare);
    }
    return null;
  }, [selectedFiles, fileToShare]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Video preview URL for completed file derived directly via useMemo
  const videoPreviewUrl = useMemo(() => {
    if (completedFile && completedFile.type.startsWith('video/')) {
      return URL.createObjectURL(completedFile.blob);
    }
    return null;
  }, [completedFile]);

  useEffect(() => {
    return () => {
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    };
  }, [videoPreviewUrl]);

  // UX Polish: Automatically extract ZIP/TAR file info if received
  useEffect(() => {
    let isMounted = true;
    if (completedFile && (completedFile.name.endsWith('.zip') || completedFile.name.endsWith('.tar'))) {
      const loadArchive = async () => {
        try {
          if (completedFile.name.endsWith('.tar')) {
            const entries = await readTarEntries(completedFile.blob);
            if (isMounted) {
              setZipContents(
                entries.map((e) => ({
                  name: e.name,
                  path: e.path,
                  dir: e.dir,
                  size: e.size,
                })).sort((a, b) => (a.dir === b.dir ? 0 : a.dir ? -1 : 1))
              );
            }
          } else {
            const zip = new JSZip();
            const loadedZip = await zip.loadAsync(completedFile.blob);
            const contents: ZipEntry[] = [];

            loadedZip.forEach((relativePath, zipEntry) => {
              contents.push({
                name: zipEntry.name.split('/').filter(Boolean).pop() || zipEntry.name,
                path: relativePath,
                dir: zipEntry.dir,
                size: (zipEntry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize || 0,
              });
            });

            if (isMounted) {
              setZipContents(contents.sort((a, b) => (a.dir === b.dir ? 0 : a.dir ? -1 : 1)));
            }
          }
        } catch {
          // handled silently
        }
      };
      loadArchive();
    } else {
      const resetTimer = setTimeout(() => {
        if (isMounted) {
          setZipContents((prev) => (prev.length === 0 ? prev : []));
          setShowZipPreview(false);
        }
      }, 0);
      return () => {
        clearTimeout(resetTimer);
        isMounted = false;
      };
    }
    return () => {
      isMounted = false;
    };
  }, [completedFile]);

  /**
   * Process and batch files, automatically creating an encrypted ZIP stream with JSZip when multiple files exist
   */
  const processFiles = useCallback(async (files: File[], append = false) => {
    let combinedFiles: File[] = [];
    if (append) {
      // Deduplicate files by reference and name+size+customPath
      const existingKeySet = new Set(
        selectedFiles.map(
          (f) => `${(f as FileWithCustomPath).customPath || f.name}-${f.size}-${f.lastModified}`
        )
      );
      const newUniqueFiles = files.filter(
        (f) =>
          !existingKeySet.has(
            `${(f as FileWithCustomPath).customPath || f.name}-${f.size}-${f.lastModified}`
          )
      );
      combinedFiles = [...selectedFiles, ...newUniqueFiles];
    } else {
      combinedFiles = [...files];
    }

    if (combinedFiles.length === 0) {
      zipTaskSeqRef.current++;
      setSelectedFiles([]);
      setFileToShare(null);
      setIsZipping(false);
      setZipProgress(0);
      return;
    }

    setSelectedFiles(combinedFiles);

    // Check if we need to package as ZIP: >1 file OR has directory/custom path structure
    const needsZip =
      combinedFiles.length > 1 ||
      combinedFiles.some(
        (f) =>
          (f as FileWithCustomPath).customPath?.includes('/') ||
          (f.webkitRelativePath && f.webkitRelativePath.includes('/')),
      );

    if (!needsZip) {
      zipTaskSeqRef.current++;
      setIsZipping(false);
      setZipProgress(0);
      setFileToShare(combinedFiles[0]);
    } else {
      zipTaskSeqRef.current++;
      try {
        const vpkg = new VirtualPackage(combinedFiles);
        const syntheticFile = vpkg.toSyntheticFile();
        setIsZipping(false);
        setZipProgress(100);
        setFileToShare(syntheticFile);
      } catch (err) {
        setIsZipping(false);
        console.error('VirtualPackage generation error:', err);
      }
    }
  }, [selectedFiles]);

  const removeFile = useCallback(
    (index: number) => {
      const nextFiles = selectedFiles.filter((_, i) => i !== index);
      processFiles(nextFiles, false);
    },
    [selectedFiles, processFiles],
  );

  const clearFiles = useCallback(() => {
    zipTaskSeqRef.current++;
    setSelectedFiles([]);
    setFileToShare(null);
    setIsZipping(false);
    setZipProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';
  }, []);

  const addFiles = useCallback(
    (newFiles: File[]) => {
      processFiles(newFiles, true);
    },
    [processFiles],
  );

  const extractFilesFromDataTransfer = useCallback(async (dataTransfer: DataTransfer): Promise<File[]> => {
    let allFiles: File[] = [];
    if (dataTransfer.items) {
      const items = Array.from(dataTransfer.items);
      for (const item of items) {
        if (item.kind === 'file') {
          const itemExt = item as unknown as { getAsEntry?: () => WebKitEntry | null };
          const entry = item.webkitGetAsEntry
            ? (item.webkitGetAsEntry() as unknown as WebKitEntry | null)
            : itemExt.getAsEntry
            ? itemExt.getAsEntry()
            : null;
          if (entry) {
            const files = await scanEntry(entry);
            allFiles = allFiles.concat(files);
          } else {
            const file = item.getAsFile();
            if (file) allFiles.push(file);
          }
        }
      }
    } else if (dataTransfer.files && dataTransfer.files.length > 0) {
      allFiles = Array.from(dataTransfer.files);
    }
    return allFiles;
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        const files = Array.from(e.target.files);
        playFileDropChime();
        processFiles(files, selectedFiles.length > 0);
        onFilesProcessed?.();
        e.target.value = '';
      }
    },
    [processFiles, selectedFiles.length, onFilesProcessed],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounterRef.current = 0;
      setIsGlobalDragging(false);
      const files = await extractFilesFromDataTransfer(e.dataTransfer);
      if (files.length > 0) {
        playFileDropChime();
        await processFiles(files, selectedFiles.length > 0);
        onFilesProcessed?.();
      }
    },
    [extractFilesFromDataTransfer, processFiles, selectedFiles.length, onFilesProcessed],
  );

  const handleGlobalDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      dragCounterRef.current = 0;
      setIsGlobalDragging(false);
    }
  }, []);

  const handleGlobalDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsGlobalDragging(false);
      const files = await extractFilesFromDataTransfer(e.dataTransfer);
      if (files.length > 0) {
        playFileDropChime();
        await processFiles(files, selectedFiles.length > 0);
        onFilesProcessed?.();
      }
    },
    [extractFilesFromDataTransfer, processFiles, selectedFiles.length, onFilesProcessed],
  );

  // Global window drag-and-drop event listeners
  useEffect(() => {
    const isDragWithFiles = (e: DragEvent) => {
      if (!e.dataTransfer) return false;
      const types = Array.from(e.dataTransfer.types || []);
      return types.includes('Files') || types.includes('application/x-moz-file');
    };

    const handleWindowDragEnter = (e: DragEvent) => {
      if (!isDragWithFiles(e)) return;
      e.preventDefault();
      dragCounterRef.current++;
      if (dragCounterRef.current === 1) {
        setIsGlobalDragging(true);
      }
    };

    const handleWindowDragOver = (e: DragEvent) => {
      if (!isDragWithFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      if (!isGlobalDragging) setIsGlobalDragging(true);
    };

    const handleWindowDragLeave = (e: DragEvent) => {
      if (!isDragWithFiles(e)) return;
      e.preventDefault();
      dragCounterRef.current--;
      if (
        dragCounterRef.current <= 0 ||
        e.clientX <= 0 ||
        e.clientY <= 0 ||
        e.clientX >= window.innerWidth ||
        e.clientY >= window.innerHeight
      ) {
        dragCounterRef.current = 0;
        setIsGlobalDragging(false);
      }
    };

    const handleWindowDrop = async (e: DragEvent) => {
      if (e.defaultPrevented) return;
      if (!isDragWithFiles(e)) return;
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsGlobalDragging(false);

      if (e.dataTransfer) {
        const files = await extractFilesFromDataTransfer(e.dataTransfer);
        if (files.length > 0) {
          playFileDropChime();
          await processFiles(files, selectedFiles.length > 0);
          onFilesProcessed?.();
        }
      }
    };

    const handleWindowBlur = () => {
      dragCounterRef.current = 0;
      setIsGlobalDragging(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dragCounterRef.current = 0;
        setIsGlobalDragging(false);
      }
    };

    window.addEventListener('dragenter', handleWindowDragEnter);
    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('dragleave', handleWindowDragLeave);
    window.addEventListener('drop', handleWindowDrop);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('dragenter', handleWindowDragEnter);
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('dragleave', handleWindowDragLeave);
      window.removeEventListener('drop', handleWindowDrop);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [extractFilesFromDataTransfer, processFiles, onFilesProcessed, isGlobalDragging, selectedFiles.length]);

  return {
    fileToShare,
    setFileToShare,
    fileToShareRef,
    selectedFiles,
    totalPayloadSize,
    removeFile,
    clearFiles,
    addFiles,
    isZipping,
    zipProgress,
    isDragging,
    isGlobalDragging,
    setIsGlobalDragging,
    previewUrl,
    videoPreviewUrl,
    showVideoPlayer,
    setShowVideoPlayer,
    zipContents,
    showZipPreview,
    setShowZipPreview,
    fileInputRef,
    folderInputRef,
    processFiles,
    handleFileChange,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleGlobalDragLeave,
    handleGlobalDrop,
  };
}

export default useFileHandler;
