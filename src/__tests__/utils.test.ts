import { describe, it, expect } from 'vitest';
import { parseRoomCode, formatBytes, formatSpeed, formatETA } from '../lib/utils';

describe('Utils & Room Code Parsing Suite', () => {
  it('parses room code with hash secret fragment (?room=abc-xyz#1234)', () => {
    const url = 'https://mephistoshares.online/?room=abc-xyz#1234';
    const code = parseRoomCode(url);
    expect(code).toBe('abc-xyz#1234');
  });

  it('parses direct room code without URL (abc-xyz#5678)', () => {
    const raw = 'abc-xyz#5678';
    const code = parseRoomCode(raw);
    expect(code).toBe('abc-xyz#5678');
  });

  it('returns empty string for bare homepage URL without room parameters', () => {
    expect(parseRoomCode('https://mephistoshares.online/')).toBe('');
    expect(parseRoomCode('https://www.mephistoshares.online')).toBe('');
    expect(parseRoomCode('http://localhost:5173/')).toBe('');
  });

  it('formats byte sizes cleanly', () => {
    expect(formatBytes(0)).toBe('0 Bytes');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1048576)).toBe('1 MB');
  });

  it('formats transfer speeds and ETAs', () => {
    expect(formatSpeed(1048576)).toContain('MB/s');
    expect(formatETA(60)).toBe('1m 00s remaining');
  });
});
