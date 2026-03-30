import { describe, it, expect } from 'vitest';
import { parseTar } from './tar';

// ---------------------------------------------------------------------------
// Helpers: build minimal tar archives for testing
// ---------------------------------------------------------------------------

/** Create a tar header (512 bytes) for a file entry. */
function createTarHeader(name: string, sizeBytes: number, type: '0' | '5' = '0'): Uint8Array {
  const header = new Uint8Array(512);
  // Name field: bytes 0-99
  const nameBytes = new TextEncoder().encode(name);
  header.set(nameBytes.subarray(0, 100), 0);
  // Size field: bytes 124-135, octal ASCII
  const sizeOctal = sizeBytes.toString(8).padStart(11, '0');
  header.set(new TextEncoder().encode(sizeOctal), 124);
  // Type flag: byte 156
  header[156] = type.charCodeAt(0);
  return header;
}

/** Create a tar file data block (padded to 512 bytes). */
function createTarData(content: string): Uint8Array {
  const encoded = new TextEncoder().encode(content);
  const paddedSize = Math.ceil(encoded.length / 512) * 512;
  const block = new Uint8Array(paddedSize);
  block.set(encoded, 0);
  return block;
}

/** Build a minimal tar archive from entries. */
function buildTar(entries: Array<{ name: string; content?: string; type?: '0' | '5' }>): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const entry of entries) {
    const content = entry.content ?? '';
    const encoded = new TextEncoder().encode(content);
    const header = createTarHeader(entry.name, encoded.length, entry.type ?? '0');
    parts.push(header);
    if (encoded.length > 0) {
      parts.push(createTarData(content));
    }
  }
  // Two 512-byte zero blocks mark end of archive
  parts.push(new Uint8Array(1024));
  const totalSize = parts.reduce((s, p) => s + p.length, 0);
  const archive = new Uint8Array(totalSize);
  let offset = 0;
  for (const part of parts) {
    archive.set(part, offset);
    offset += part.length;
  }
  return archive;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseTar', () => {
  it('extracts a single file', () => {
    const archive = buildTar([{ name: 'hello.txt', content: 'hello world' }]);
    const files = parseTar(archive);
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('hello.txt');
    expect(files[0].content).toBe('hello world');
  });

  it('extracts multiple files', () => {
    const archive = buildTar([
      { name: 'a.txt', content: 'aaa' },
      { name: 'b.txt', content: 'bbb' },
      { name: 'c.txt', content: 'ccc' },
    ]);
    const files = parseTar(archive);
    expect(files).toHaveLength(3);
    expect(files[0].name).toBe('a.txt');
    expect(files[1].name).toBe('b.txt');
    expect(files[2].name).toBe('c.txt');
  });

  it('strips leading "package/" prefix from tar entries', () => {
    const archive = buildTar([
      { name: 'package/index.js', content: 'code' },
      { name: 'package/package.json', content: '{}' },
    ]);
    const files = parseTar(archive);
    expect(files[0].name).toBe('index.js');
    expect(files[1].name).toBe('package.json');
  });

  it('handles long filenames up to 100 bytes', () => {
    const longName = 'a'.repeat(96) + '.js'; // 99 bytes, fits in 100-byte field
    const archive = buildTar([{ name: longName, content: 'x' }]);
    const files = parseTar(archive);
    expect(files[0].name).toBe(longName);
  });

  it('skips directory entries (type 5)', () => {
    const archive = buildTar([
      { name: 'package/src/', type: '5' },
      { name: 'package/src/index.js', content: 'code' },
    ]);
    const files = parseTar(archive);
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('src/index.js');
  });

  it('returns empty array for empty archive', () => {
    const archive = new Uint8Array(1024); // Just end-of-archive markers
    const files = parseTar(archive);
    expect(files).toEqual([]);
  });

  it('returns { name, content } for each entry', () => {
    const archive = buildTar([{ name: 'test.js', content: 'const x = 1;' }]);
    const files = parseTar(archive);
    expect(files[0]).toHaveProperty('name');
    expect(files[0]).toHaveProperty('content');
  });

  it('handles file content with special characters', () => {
    const content = 'const ñ = "héllo wörld €";\n';
    const archive = buildTar([{ name: 'unicode.js', content }]);
    const files = parseTar(archive);
    expect(files[0].content).toBe(content);
  });
});
