import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import {
  sanitizePath,
  getRelativePathFromFile,
  buildFolderManifest,
  flattenManifest,
  findItemByPath,
  findDirectoryNode,
  findFileItem,
  getAllDirectoryPaths,
  getAllFilePaths,
  collectFilesUnderPath,
  filterManifestBySearch,
  createZipFromManifest,
} from '../lib/folderManifest';

describe('folderManifest Suite', () => {
  describe('sanitizePath', () => {
    it('sanitizes directory traversal sequences (../)', () => {
      expect(sanitizePath('../../etc/passwd')).toBe('etc/passwd');
      expect(sanitizePath('../../../secret/keys.json')).toBe('secret/keys.json');
      expect(sanitizePath('nested/./folder/../target.png')).toBe('nested/target.png');
      expect(sanitizePath('a/b/c/../../d/e.txt')).toBe('a/d/e.txt');
      expect(sanitizePath('../../../../root.txt')).toBe('root.txt');
    });

    it('sanitizes Windows absolute drive paths and backslashes', () => {
      expect(sanitizePath('C:\\Users\\Admin\\Documents\\file.txt')).toBe('Users/Admin/Documents/file.txt');
      expect(sanitizePath('d:\\projects\\repo\\src\\main.ts')).toBe('projects/repo/src/main.ts');
      expect(sanitizePath('z:\\data\\nested\\img.png')).toBe('data/nested/img.png');
      expect(sanitizePath('folder\\subfolder\\item.csv')).toBe('folder/subfolder/item.csv');
    });

    it('sanitizes Unix absolute paths and duplicate slashes', () => {
      expect(sanitizePath('/var/www/html/index.html')).toBe('var/www/html/index.html');
      expect(sanitizePath('///etc///shadow')).toBe('etc/shadow');
      expect(sanitizePath('//deep//nested///path//test.js')).toBe('deep/nested/path/test.js');
    });

    it('strips null bytes and non-printable control characters', () => {
      expect(sanitizePath('malicious\0file.exe')).toBe('maliciousfile.exe');
      expect(sanitizePath('\x01\x02test\x1F_document.pdf')).toBe('test_document.pdf');
    });

    it('replaces filesystem illegal characters in path segments', () => {
      expect(sanitizePath('folder/file:name*?.txt')).toBe('folder/file_name__.txt');
      expect(sanitizePath('bad<tag>|"quote".json')).toBe('bad_tag___quote_.json');
    });

    it('handles empty and whitespace-only inputs with safe fallback', () => {
      expect(sanitizePath('')).toBe('unnamed_file');
      expect(sanitizePath('   ')).toBe('unnamed_file');
      expect(sanitizePath('///')).toBe('unnamed_file');
      expect(sanitizePath('..//../')).toBe('unnamed_file');
    });
  });

  describe('getRelativePathFromFile', () => {
    it('extracts relative path from webkitRelativePath', () => {
      const file = new File(['content'], 'file.txt');
      Object.defineProperty(file, 'webkitRelativePath', {
        value: 'my-project/src/index.ts',
      });
      expect(getRelativePathFromFile(file)).toBe('my-project/src/index.ts');
    });

    it('extracts relative path from customPath', () => {
      const file = Object.assign(new File(['content'], 'data.json'), {
        customPath: 'assets/config/data.json',
      });
      expect(getRelativePathFromFile(file)).toBe('assets/config/data.json');
    });

    it('falls back to file name if no relative path is present', () => {
      const file = new File(['content'], 'standalone.pdf');
      expect(getRelativePathFromFile(file)).toBe('standalone.pdf');
    });
  });

  describe('buildFolderManifest', () => {
    it('handles empty file list gracefully', () => {
      const manifest = buildFolderManifest([]);
      expect(manifest.totalFiles).toBe(0);
      expect(manifest.totalSize).toBe(0);
      expect(manifest.root.children.length).toBe(0);
      expect(manifest.root.directories.length).toBe(0);
      expect(manifest.root.files.length).toBe(0);
    });

    it('builds flat single-level manifest correctly', () => {
      const files = [
        new File(['hello'], 'a.txt', { type: 'text/plain' }),
        new File(['world 12345'], 'b.png', { type: 'image/png' }),
      ];

      const manifest = buildFolderManifest(files);
      expect(manifest.totalFiles).toBe(2);
      expect(manifest.totalSize).toBe(5 + 11);
      expect(manifest.root.children.length).toBe(2);
      expect(manifest.root.files.length).toBe(2);
      expect(manifest.root.directories.length).toBe(0);
    });

    it('builds multi-level deeply nested folder manifest and calculates directory sizes', () => {
      const files = [
        Object.assign(new File(['root file data'], 'readme.md', { type: 'text/markdown' }), {
          customPath: 'readme.md',
        }),
        Object.assign(new File(['export const x = 10;'], 'math.ts', { type: 'text/typescript' }), {
          customPath: 'src/utils/math.ts',
        }),
        Object.assign(new File(['export const y = 20;'], 'string.ts', { type: 'text/typescript' }), {
          customPath: 'src/utils/string.ts',
        }),
        Object.assign(new File(['export const Button = () => null;'], 'Button.tsx', { type: 'text/typescript' }), {
          customPath: 'src/components/Button.tsx',
        }),
        Object.assign(new File(['logo image byte buffer'], 'logo.svg', { type: 'image/svg+xml' }), {
          customPath: 'public/images/logo.svg',
        }),
      ];

      const manifest = buildFolderManifest(files);

      // Total counts
      expect(manifest.totalFiles).toBe(5);
      expect(manifest.totalSize).toBe(
        'root file data'.length +
        'export const x = 10;'.length +
        'export const y = 20;'.length +
        'export const Button = () => null;'.length +
        'logo image byte buffer'.length
      );

      // Root children should contain: 'public', 'src', and 'readme.md' (sorted folders first)
      const rootChildrenNames = manifest.root.children.map((c) => c.name);
      expect(rootChildrenNames).toEqual(['public', 'src', 'readme.md']);

      // Check 'src' folder
      const srcNode = findItemByPath(manifest.root, 'src');
      expect(srcNode).not.toBeNull();
      expect(srcNode?.isFolder).toBe(true);
      expect(srcNode?.fileCount).toBe(3);

      // Check 'src/utils' folder
      const utilsNode = findItemByPath(manifest.root, 'src/utils');
      expect(utilsNode).not.toBeNull();
      expect(utilsNode?.fileCount).toBe(2);
      expect(utilsNode?.children.map((c) => c.name)).toEqual(['math.ts', 'string.ts']);

      // Check 'public/images/logo.svg'
      const logoItem = findFileItem(manifest.root, 'public/images/logo.svg');
      expect(logoItem).not.toBeNull();
      expect(logoItem?.name).toBe('logo.svg');
      expect(logoItem?.relativePath).toBe('public/images/logo.svg');
      expect(logoItem?.size).toBe('logo image byte buffer'.length);
    });
  });

  describe('flattenManifest', () => {
    it('flattens complex tree back to complete list of ManifestFileItems', () => {
      const files = [
        Object.assign(new File(['1'], 'one.txt'), { customPath: 'a/b/one.txt' }),
        Object.assign(new File(['22'], 'two.txt'), { customPath: 'a/two.txt' }),
        Object.assign(new File(['333'], 'three.txt'), { customPath: 'three.txt' }),
      ];

      const manifest = buildFolderManifest(files);
      const flat = flattenManifest(manifest);

      expect(flat.length).toBe(3);
      const paths = flat.map((f) => f.relativePath);
      expect(paths).toContain('a/b/one.txt');
      expect(paths).toContain('a/two.txt');
      expect(paths).toContain('three.txt');
    });
  });

  describe('findItemByPath, findDirectoryNode, findFileItem', () => {
    const files = [
      Object.assign(new File(['doc'], 'manual.pdf'), { customPath: 'docs/v1/manual.pdf' }),
      Object.assign(new File(['spec'], 'api.json'), { customPath: 'docs/api.json' }),
      Object.assign(new File(['main'], 'app.ts'), { customPath: 'src/app.ts' }),
    ];
    const manifest = buildFolderManifest(files);

    it('finds items by path correctly', () => {
      const docsV1 = findItemByPath(manifest.root, 'docs/v1');
      expect(docsV1).not.toBeNull();
      expect(docsV1?.isFolder).toBe(true);

      const manual = findItemByPath(manifest.root, 'docs/v1/manual.pdf');
      expect(manual).not.toBeNull();
      expect(manual?.isFolder).toBe(false);

      expect(findItemByPath(manifest.root, 'non/existent/path')).toBeNull();
    });

    it('finds directory nodes specifically', () => {
      expect(findDirectoryNode(manifest.root, 'docs')).not.toBeNull();
      expect(findDirectoryNode(manifest.root, 'docs/v1')).not.toBeNull();
      expect(findDirectoryNode(manifest.root, 'docs/v1/manual.pdf')).toBeNull();
    });

    it('finds file items specifically', () => {
      const file = findFileItem(manifest.root, 'docs/v1/manual.pdf');
      expect(file).not.toBeNull();
      expect(file?.name).toBe('manual.pdf');
      expect(findFileItem(manifest.root, 'docs/v1')).toBeNull();
    });
  });

  describe('getAllDirectoryPaths and getAllFilePaths', () => {
    it('retrieves all directory and file paths', () => {
      const files = [
        Object.assign(new File(['1'], 'a.txt'), { customPath: 'dir1/sub1/a.txt' }),
        Object.assign(new File(['2'], 'b.txt'), { customPath: 'dir1/sub2/b.txt' }),
        Object.assign(new File(['3'], 'c.txt'), { customPath: 'dir2/c.txt' }),
      ];
      const manifest = buildFolderManifest(files);

      const dirPaths = getAllDirectoryPaths(manifest.root);
      expect(dirPaths).toContain('dir1');
      expect(dirPaths).toContain('dir1/sub1');
      expect(dirPaths).toContain('dir1/sub2');
      expect(dirPaths).toContain('dir2');

      const filePaths = getAllFilePaths(manifest);
      expect(filePaths).toEqual(['dir1/sub1/a.txt', 'dir1/sub2/b.txt', 'dir2/c.txt']);
    });
  });

  describe('collectFilesUnderPath', () => {
    it('collects all files under a specific subfolder', () => {
      const files = [
        Object.assign(new File(['1'], 'f1.ts'), { customPath: 'src/lib/f1.ts' }),
        Object.assign(new File(['2'], 'f2.ts'), { customPath: 'src/lib/utils/f2.ts' }),
        Object.assign(new File(['3'], 'f3.ts'), { customPath: 'src/components/f3.ts' }),
        Object.assign(new File(['4'], 'f4.ts'), { customPath: 'tests/f4.ts' }),
      ];
      const manifest = buildFolderManifest(files);

      const libFiles = collectFilesUnderPath(manifest.root, 'src/lib');
      expect(libFiles.length).toBe(2);
      expect(libFiles.map((f) => f.name)).toContain('f1.ts');
      expect(libFiles.map((f) => f.name)).toContain('f2.ts');
    });
  });

  describe('filterManifestBySearch', () => {
    const files = [
      Object.assign(new File(['auth code'], 'authService.ts'), { customPath: 'services/authService.ts' }),
      Object.assign(new File(['user code'], 'userService.ts'), { customPath: 'services/userService.ts' }),
      Object.assign(new File(['avatar image'], 'avatar.png'), { customPath: 'public/avatar.png' }),
    ];
    const manifest = buildFolderManifest(files);

    it('returns entire manifest when query is empty', () => {
      const { filteredManifest, matchCount } = filterManifestBySearch(manifest, '');
      expect(matchCount).toBe(3);
      expect(filteredManifest.totalFiles).toBe(3);
    });

    it('filters manifest matching file names', () => {
      const { filteredManifest, matchCount } = filterManifestBySearch(manifest, 'auth');
      expect(matchCount).toBe(1);
      expect(filteredManifest.totalFiles).toBe(1);
      expect(filteredManifest.root.children.length).toBe(1);
      expect(filteredManifest.root.children[0].name).toBe('services');
    });

    it('filters manifest matching folder names', () => {
      const { filteredManifest, matchCount } = filterManifestBySearch(manifest, 'services');
      expect(matchCount).toBe(2);
      expect(filteredManifest.totalFiles).toBe(2);
    });

    it('returns empty manifest when query matches nothing', () => {
      const { filteredManifest, matchCount } = filterManifestBySearch(manifest, 'nonexistentxyz');
      expect(matchCount).toBe(0);
      expect(filteredManifest.totalFiles).toBe(0);
      expect(filteredManifest.root.children.length).toBe(0);
    });
  });

  describe('createZipFromManifest', () => {
    it('creates a valid ZIP blob with preserved folder structure', async () => {
      const files = [
        Object.assign(new File(['console.log("hello");'], 'index.js'), { customPath: 'app/index.js' }),
        Object.assign(new File(['body { color: red; }'], 'style.css'), { customPath: 'app/assets/style.css' }),
      ];

      const manifest = buildFolderManifest(files);
      const flatItems = flattenManifest(manifest);

      const zipBlob = await createZipFromManifest(flatItems);
      expect(zipBlob).toBeDefined();
      expect(zipBlob.size).toBeGreaterThan(0);

      // Verify ZIP contents using JSZip with arrayBuffer
      const arrayBuffer = await zipBlob.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      expect(zip.file('app/index.js')).not.toBeNull();
      expect(zip.file('app/assets/style.css')).not.toBeNull();

      const indexContent = await zip.file('app/index.js')?.async('text');
      expect(indexContent).toBe('console.log("hello");');
    });
  });
});
