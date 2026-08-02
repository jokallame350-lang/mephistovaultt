import { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import type { CompletedFile, ZipEntry, FileWithCustomPath, WebKitEntry, WebKitFileEntry, WebKitDirectoryEntry } from '../types';

export function useFileHandler(completedFile: CompletedFile | null) {
  const [fileToShare, setFileToShare] = useState<File | null>(null);
  const fileToShareRef = useRef<File | null>(null);
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);

  const [zipContents, setZipContents] = useState<ZipEntry[]>([]);
  const [showZipPreview, setShowZipPreview] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Sync fileToShareRef with state
  useEffect(() => {
    fileToShareRef.current = fileToShare;
    if (fileToShare && fileToShare.type.startsWith('image/')) {
      const url = URL.createObjectURL(fileToShare);
      queueMicrotask(() => setPreviewUrl(url));
      return () => URL.revokeObjectURL(url);
    } else {
      queueMicrotask(() => setPreviewUrl(null));
    }
  }, [fileToShare]);

  // Video preview URL for completed file
  useEffect(() => {
    if (completedFile && completedFile.type.startsWith('video/')) {
      const url = URL.createObjectURL(completedFile.blob);
      queueMicrotask(() => setVideoPreviewUrl(url));
      return () => URL.revokeObjectURL(url);
    } else {
      queueMicrotask(() => {
        setVideoPreviewUrl(null);
        setShowVideoPlayer(false);
      });
    }
  }, [completedFile]);

  // UX Polish: Automatically extract ZIP file info if received
  useEffect(() => {
    if (completedFile && completedFile.name.endsWith('.zip')) {
      const loadZip = async () => {
        try {
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

          setZipContents(contents.sort((a, b) => (a.dir === b.dir ? 0 : a.dir ? -1 : 1)));
        } catch {
          // handled silently
        }
      };
      loadZip();
    } else {
      queueMicrotask(() => {
        setZipContents([]);
        setShowZipPreview(false);
      });
    }
  }, [completedFile]);

  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;

    // Check if we need to zip: >1 file OR it has a custom path/folder structure
    const needsZip =
      files.length > 1 ||
      files.some(
        (f) =>
          (f as FileWithCustomPath).customPath?.includes('/') ||
          (f.webkitRelativePath && f.webkitRelativePath.includes('/')),
      );

    if (!needsZip) {
      const file = files[0];
      setFileToShare(file);
    } else {
      setIsZipping(true);
      const zip = new JSZip();

      files.forEach((f) => {
        const path =
          (f as FileWithCustomPath).customPath ||
          (f.webkitRelativePath && f.webkitRelativePath.includes('/')
            ? f.webkitRelativePath
            : f.name);
        zip.file(path, f);
      });

      const content = await zip.generateAsync(
        {
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 5 },
        },
        (meta) => {
          setZipProgress(meta.percent);
        },
      );

      const bundledFile = new File(
        [content],
        `mephisto-bundle-${Math.floor(Date.now() / 1000)}.zip`,
        { type: 'application/zip' },
      );
      setIsZipping(false);
      setFileToShare(bundledFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(Array.from(e.target.files));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const scanEntry = async (entry: WebKitEntry, path = ''): Promise<File[]> => {
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
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.items) {
      const items = Array.from(e.dataTransfer.items);
      let allFiles: File[] = [];
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
      processFiles(allFiles);
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  return {
    fileToShare,
    setFileToShare,
    fileToShareRef,
    isZipping,
    zipProgress,
    isDragging,
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
  };
}
