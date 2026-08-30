import { describe, it, expect } from 'vitest';
import { VirtualPackage } from '../lib/virtualPackage';

describe('Virtual Package Streamer Suite', () => {
  it('instantly builds a virtual tar package for multiple files with zero delay', () => {
    const file1 = new File(['Hello MephistoVault'], 'hello.txt', { type: 'text/plain' });
    const file2 = new File(['Data stream payload content'], 'data.json', { type: 'application/json' });

    const pkg = new VirtualPackage([file1, file2], 'test-package.tar');
    expect(pkg.fileCount).toBe(2);
    expect(pkg.totalSize).toBeGreaterThan(file1.size + file2.size);
    expect(pkg.entries.length).toBe(2);
  });

  it('slices and reads virtual tar headers and file bytes accurately', async () => {
    const content1 = 'First file contents in virtual tar';
    const content2 = 'Second file content in virtual tar';
    const file1 = new File([content1], 'sub/file1.txt', { type: 'text/plain' });
    const file2 = new File([content2], 'sub/file2.txt', { type: 'text/plain' });

    const pkg = new VirtualPackage([file1, file2]);
    const syntheticFile = pkg.toSyntheticFile();

    expect(syntheticFile.size).toBe(pkg.totalSize);

    // Read full synthetic package
    const fullBuffer = await syntheticFile.slice(0, syntheticFile.size).arrayBuffer();
    expect(fullBuffer.byteLength).toBe(pkg.totalSize);

    const fullText = new TextDecoder().decode(fullBuffer);
    expect(fullText).toContain('sub/file1.txt');
    expect(fullText).toContain('sub/file2.txt');
    expect(fullText).toContain(content1);
    expect(fullText).toContain(content2);
    expect(fullText).toContain('ustar');
  });

  it('handles chunked slicing across header and data boundaries', async () => {
    const file = new File(['A'.repeat(2048)], 'big.txt', { type: 'text/plain' });
    const pkg = new VirtualPackage([file]);
    const syntheticFile = pkg.toSyntheticFile();

    // Read first 256 bytes (header part)
    const chunk1 = await syntheticFile.slice(0, 256).arrayBuffer();
    expect(chunk1.byteLength).toBe(256);

    // Read across 512 boundary (header -> data)
    const chunk2 = await syntheticFile.slice(500, 600).arrayBuffer();
    expect(chunk2.byteLength).toBe(100);
    const chunk2Text = new TextDecoder().decode(chunk2);
    expect(chunk2Text.endsWith('A'.repeat(88))).toBe(true);
  });
});
