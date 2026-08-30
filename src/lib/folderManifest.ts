import JSZip from 'jszip';
import type { FileWithCustomPath } from '../types';
import { formatBytes, saveFile } from './utils';

// ── Types ──

export interface ManifestFileItem {
  id: string;
  name: string;
  relativePath: string;
  path: string;
  size: number;
  sizeFormatted: string;
  type: string;
  lastModified?: number;
  file?: File;
  blob?: Blob;
}

export interface FolderTreeNode {
  id: string;
  name: string;
  path: string;
  relativePath: string;
  isFolder: boolean;
  size: number;
  sizeFormatted: string;
  fileCount: number;
  totalSize: number;
  children: FolderTreeNode[];
  directories: FolderTreeNode[];
  files: ManifestFileItem[];
  fileItem?: ManifestFileItem;
}

export type ManifestDirectoryNode = FolderTreeNode;

export interface FolderManifest {
  root: FolderTreeNode;
  totalFiles: number;
  totalSize: number;
  totalSizeFormatted: string;
  createdAt: number;
}

// ── Path Sanitization ──

/**
 * Sanitize raw paths to prevent directory traversal attacks (../),
 * remove absolute path roots (C:\ or /), strip null bytes, normalize backslashes,
 * and ensure safe relative paths.
 */
export function sanitizePath(rawPath: string): string {
  if (!rawPath || typeof rawPath !== 'string') {
    return 'unnamed_file';
  }

  // 1. Remove null bytes and non-printable control characters safely
  let cleaned = '';
  for (let i = 0; i < rawPath.length; i++) {
    const code = rawPath.charCodeAt(i);
    // Keep characters >= 32 and not DEL (127)
    if (code >= 32 && code !== 127) {
      cleaned += rawPath[i];
    }
  }
  cleaned = cleaned.trim();

  // 2. Normalize Windows backslashes to standard forward slashes
  cleaned = cleaned.replace(/\\+/g, '/');

  // 3. Remove Windows drive letters (e.g., "C:", "d:", "Z:")
  cleaned = cleaned.replace(/^[a-zA-Z]:/i, '');

  // 4. Remove leading forward slashes to prevent absolute Unix paths
  cleaned = cleaned.replace(/^\/+/, '');

  // 5. Split by forward slash and resolve path components safely
  const rawSegments = cleaned.split('/');
  const safeSegments: string[] = [];

  for (const rawSeg of rawSegments) {
    const seg = rawSeg.trim();

    // Skip empty segments or current-directory '.'
    if (!seg || seg === '.') {
      continue;
    }

    // Handle parent-directory '..'
    if (seg === '..') {
      // Pop previous segment if present, but never navigate above root
      if (safeSegments.length > 0) {
        safeSegments.pop();
      }
      continue;
    }

    // Strip characters that are invalid across major filesystems (< > : " | ? *)
    const safeSeg = seg.replace(/[<>:"|?*]/g, '_');
    if (safeSeg.length > 0) {
      safeSegments.push(safeSeg);
    }
  }

  if (safeSegments.length === 0) {
    return 'unnamed_file';
  }

  return safeSegments.join('/');
}

/**
 * Extract and sanitize the relative path from various File structures
 * (standard File, webkitRelativePath, FileWithCustomPath, or generic object).
 */
export function getRelativePathFromFile(
  file: File | FileWithCustomPath | { name: string; webkitRelativePath?: string; customPath?: string; relativePath?: string; path?: string }
): string {
  const raw =
    (file as { webkitRelativePath?: string }).webkitRelativePath ||
    (file as FileWithCustomPath).customPath ||
    (file as { relativePath?: string }).relativePath ||
    (file as { path?: string }).path ||
    file.name ||
    'unnamed_file';

  return sanitizePath(raw);
}

// ── Tree Construction ──

/**
 * Recursively computes and updates size, totalSize, fileCount, and sizeFormatted for each node.
 */
function computeNodeStats(node: FolderTreeNode): { totalSize: number; fileCount: number } {
  if (!node.isFolder) {
    node.sizeFormatted = formatBytes(node.size);
    node.totalSize = node.size;
    node.fileCount = 1;
    return { totalSize: node.size, fileCount: 1 };
  }

  let size = 0;
  let count = 0;

  for (const child of node.children) {
    const childStats = computeNodeStats(child);
    size += childStats.totalSize;
    count += childStats.fileCount;
  }

  node.size = size;
  node.totalSize = size;
  node.sizeFormatted = formatBytes(size);
  node.fileCount = count;
  return { totalSize: size, fileCount: count };
}

/**
 * Sorts children, directories, and files alphabetically at all tree levels.
 */
function sortDirectoryTree(node: FolderTreeNode): void {
  node.children.sort((a, b) => {
    // Folders first, then files
    if (a.isFolder && !b.isFolder) return -1;
    if (!a.isFolder && b.isFolder) return 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  node.directories.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  node.files.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  for (const subDir of node.directories) {
    sortDirectoryTree(subDir);
  }
}

/**
 * Build a structured FolderManifest from a list of files or file descriptors.
 */
export function buildFolderManifest(
  files: (File | FileWithCustomPath | { name: string; size?: number; type?: string; webkitRelativePath?: string; customPath?: string; relativePath?: string; path?: string; file?: File; blob?: Blob; lastModified?: number })[]
): FolderManifest {
  const root: FolderTreeNode = {
    id: 'root',
    name: 'root',
    path: '',
    relativePath: '',
    isFolder: true,
    size: 0,
    sizeFormatted: '0 Bytes',
    fileCount: 0,
    totalSize: 0,
    children: [],
    directories: [],
    files: [],
  };

  if (!files || files.length === 0) {
    return {
      root,
      totalFiles: 0,
      totalSize: 0,
      totalSizeFormatted: '0 Bytes',
      createdAt: Date.now(),
    };
  }

  for (const item of files) {
    const sanitizedRelPath = getRelativePathFromFile(item);
    const parts = sanitizedRelPath.split('/');
    const fileName = parts[parts.length - 1] || 'unnamed_file';
    const dirParts = parts.slice(0, parts.length - 1);

    // Traverse or create nested directories
    let currentDir = root;
    let accumulatedPath = '';

    for (const seg of dirParts) {
      accumulatedPath = accumulatedPath ? `${accumulatedPath}/${seg}` : seg;
      let nextDir = currentDir.directories.find((d) => d.name === seg);

      if (!nextDir) {
        nextDir = {
          id: accumulatedPath,
          name: seg,
          path: accumulatedPath,
          relativePath: accumulatedPath,
          isFolder: true,
          size: 0,
          sizeFormatted: '0 Bytes',
          fileCount: 0,
          totalSize: 0,
          children: [],
          directories: [],
          files: [],
        };
        currentDir.children.push(nextDir);
        currentDir.directories.push(nextDir);
      }
      currentDir = nextDir;
    }

    const fileSize = typeof item.size === 'number' ? item.size : 0;
    const fileEntry: ManifestFileItem = {
      id: sanitizedRelPath,
      name: fileName,
      relativePath: sanitizedRelPath,
      path: sanitizedRelPath,
      size: fileSize,
      sizeFormatted: formatBytes(fileSize),
      type: item.type || '',
      lastModified: (item as { lastModified?: number }).lastModified,
      file: item instanceof File ? item : (item as { file?: File }).file,
      blob: (item as { blob?: Blob }).blob,
    };

    const leafNode: FolderTreeNode = {
      id: sanitizedRelPath,
      name: fileName,
      path: sanitizedRelPath,
      relativePath: sanitizedRelPath,
      isFolder: false,
      size: fileSize,
      sizeFormatted: fileEntry.sizeFormatted,
      fileCount: 1,
      totalSize: fileSize,
      children: [],
      directories: [],
      files: [],
      fileItem: fileEntry,
    };

    currentDir.files.push(fileEntry);
    currentDir.children.push(leafNode);
  }

  // Calculate statistics & sort hierarchy
  computeNodeStats(root);
  sortDirectoryTree(root);

  return {
    root,
    totalFiles: root.fileCount,
    totalSize: root.totalSize,
    totalSizeFormatted: root.sizeFormatted,
    createdAt: Date.now(),
  };
}

/**
 * Flatten a FolderManifest or directory tree into a single array of ManifestFileItems.
 */
export function flattenManifest(manifestOrNode: FolderManifest | FolderTreeNode): ManifestFileItem[] {
  const rootNode = 'root' in manifestOrNode ? manifestOrNode.root : manifestOrNode;
  const result: ManifestFileItem[] = [];

  function traverse(node: FolderTreeNode) {
    if (!node.isFolder && node.fileItem) {
      if (!result.some((existing) => existing.relativePath === node.fileItem!.relativePath)) {
        result.push(node.fileItem);
      }
      return;
    }
    for (const f of node.files) {
      if (!result.some((existing) => existing.relativePath === f.relativePath)) {
        result.push(f);
      }
    }
    for (const child of node.children) {
      if (child.isFolder) {
        traverse(child);
      } else if (child.fileItem && !result.some((existing) => existing.relativePath === child.fileItem!.relativePath)) {
        result.push(child.fileItem);
      }
    }
  }

  traverse(rootNode);
  return result;
}

// ── Search & Query Utilities ──

/**
 * Find a specific item (folder or file node) by its relative path.
 */
export function findItemByPath(root: FolderTreeNode, targetPath: string): FolderTreeNode | null {
  const cleanPath = sanitizePath(targetPath);
  if (!cleanPath || cleanPath === 'unnamed_file') return root;

  const parts = cleanPath.split('/');
  let current: FolderTreeNode | null = root;

  for (const part of parts) {
    if (!current || !current.isFolder) return null;
    const found: FolderTreeNode | undefined = current.children.find((c: FolderTreeNode) => c.name === part);
    if (!found) return null;
    current = found;
  }

  return current;
}

/**
 * Find a specific directory node by its relative path.
 */
export function findDirectoryNode(
  root: FolderTreeNode,
  relativePath: string
): FolderTreeNode | null {
  const node = findItemByPath(root, relativePath);
  return node && node.isFolder ? node : null;
}

/**
 * Find a specific file item by its relative path.
 */
export function findFileItem(
  root: FolderTreeNode,
  relativePath: string
): ManifestFileItem | null {
  const node = findItemByPath(root, relativePath);
  if (node && !node.isFolder && node.fileItem) {
    return node.fileItem;
  }
  const cleanPath = sanitizePath(relativePath);
  const allFiles = flattenManifest(root);
  return allFiles.find((f) => f.relativePath === cleanPath) || null;
}

/**
 * Retrieve all unique directory paths in the tree (useful for expand all/collapse all).
 */
export function getAllDirectoryPaths(root: FolderTreeNode): string[] {
  const paths: string[] = [];

  function traverse(node: FolderTreeNode) {
    if (node.isFolder && node.relativePath) {
      paths.push(node.relativePath);
    }
    for (const child of node.children) {
      if (child.isFolder) {
        traverse(child);
      }
    }
  }

  traverse(root);
  return paths;
}

/**
 * Retrieve all file paths in the manifest.
 */
export function getAllFilePaths(manifestOrNode: FolderManifest | FolderTreeNode): string[] {
  return flattenManifest(manifestOrNode).map((f) => f.relativePath);
}

/**
 * Collect all files under a specific directory path.
 */
export function collectFilesUnderPath(
  root: FolderTreeNode,
  dirPath: string
): ManifestFileItem[] {
  if (!dirPath) {
    return flattenManifest(root);
  }
  const targetNode = findItemByPath(root, dirPath);
  if (!targetNode) return [];
  return flattenManifest(targetNode);
}

/**
 * Filter a manifest based on search query matching file or directory names.
 */
export function filterManifestBySearch(
  manifest: FolderManifest,
  query: string
): { filteredManifest: FolderManifest; matchCount: number } {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return { filteredManifest: manifest, matchCount: manifest.totalFiles };
  }

  let matchCount = 0;

  function filterNode(node: FolderTreeNode): FolderTreeNode | null {
    if (!node.isFolder) {
      const match =
        node.name.toLowerCase().includes(trimmed) ||
        node.path.toLowerCase().includes(trimmed);
      if (match) {
        matchCount++;
        return { ...node };
      }
      return null;
    }

    const filteredChildren: FolderTreeNode[] = [];
    for (const child of node.children) {
      const filteredChild = filterNode(child);
      if (filteredChild) {
        filteredChildren.push(filteredChild);
      }
    }

    if (filteredChildren.length === 0) {
      return null;
    }

    const filteredDirs = filteredChildren.filter((c) => c.isFolder);
    const filteredFiles = filteredChildren
      .filter((c) => !c.isFolder && c.fileItem)
      .map((c) => c.fileItem!);

    const newNode: FolderTreeNode = {
      id: node.id,
      name: node.name,
      path: node.path,
      relativePath: node.relativePath,
      isFolder: true,
      size: 0,
      sizeFormatted: '0 Bytes',
      fileCount: 0,
      totalSize: 0,
      children: filteredChildren,
      directories: filteredDirs,
      files: filteredFiles,
    };

    return newNode;
  }

  const filteredRoot = filterNode(manifest.root) || {
    id: 'root',
    name: 'root',
    path: '',
    relativePath: '',
    isFolder: true,
    size: 0,
    sizeFormatted: '0 Bytes',
    fileCount: 0,
    totalSize: 0,
    children: [],
    directories: [],
    files: [],
  };

  computeNodeStats(filteredRoot);

  return {
    filteredManifest: {
      root: filteredRoot,
      totalFiles: filteredRoot.fileCount,
      totalSize: filteredRoot.totalSize,
      totalSizeFormatted: filteredRoot.sizeFormatted,
      createdAt: manifest.createdAt,
    },
    matchCount,
  };
}

// ── Zip Creation & Selective Extraction ──

/**
 * Package a selective list of ManifestFileItems into a zip blob using JSZip,
 * preserving relative folder hierarchy.
 */
export async function createZipFromManifest(
  files: ManifestFileItem[],
  options?: {
    zipFilename?: string;
    onProgress?: (percent: number) => void;
  }
): Promise<Blob> {
  const zip = new JSZip();

  for (const item of files) {
    if (item.file) {
      if (typeof item.file.arrayBuffer === 'function') {
        const buffer = await item.file.arrayBuffer();
        zip.file(item.relativePath, buffer);
      } else if ('text' in item.file && typeof (item.file as unknown as Blob).text === 'function') {
        const txt = await (item.file as unknown as Blob).text();
        zip.file(item.relativePath, txt);
      } else {
        zip.file(item.relativePath, item.file);
      }
    } else if (item.blob) {
      if (typeof item.blob.arrayBuffer === 'function') {
        const buffer = await item.blob.arrayBuffer();
        zip.file(item.relativePath, buffer);
      } else {
        zip.file(item.relativePath, item.blob);
      }
    }
  }

  const zipBlob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    },
    (metadata) => {
      if (options?.onProgress) {
        options.onProgress(metadata.percent);
      }
    }
  );

  return zipBlob;
}

/**
 * Trigger immediate download of selected manifest files packaged as a ZIP archive.
 */
export async function downloadManifestAsZip(
  files: ManifestFileItem[],
  zipFilename = 'selective_download.zip'
): Promise<void> {
  if (files.length === 0) return;

  // If only one file is selected, download directly without wrapping in zip
  if (files.length === 1 && files[0]) {
    const single = files[0];
    if (single.file) {
      await saveFile(single.file, single.name);
      return;
    }
    if (single.blob) {
      await saveFile(single.blob, single.name);
      return;
    }
  }

  const zipBlob = await createZipFromManifest(files);
  await saveFile(zipBlob, zipFilename.endsWith('.zip') ? zipFilename : `${zipFilename}.zip`);
}
