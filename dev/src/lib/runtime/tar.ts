/**
 * Minimal tar archive parser.
 *
 * Parses a raw tar archive (Uint8Array) and extracts file entries.
 * Handles the standard USTAR format with 512-byte headers.
 * Strips the leading "package/" prefix common in npm tarballs.
 */

export interface TarEntry {
  name: string;
  content: string;
}

const sharedDecoder = new TextDecoder();

/** Parse a tar archive and return file entries (skips directories). */
export function parseTar(data: Uint8Array): TarEntry[] {
  const entries: TarEntry[] = [];
  let offset = 0;

  while (offset + 512 <= data.length) {
    const header = data.subarray(offset, offset + 512);

    // Check for end-of-archive marker (512 bytes of zeros)
    if (isZeroBlock(header)) break;

    // Parse header fields
    const rawName = readString(header, 0, 100);
    const size = readOctal(header, 124, 12);
    const typeFlag = String.fromCharCode(header[156]);

    offset += 512; // Move past header

    // Skip directory entries
    if (typeFlag === '5' || rawName.endsWith('/')) {
      offset += Math.ceil(size / 512) * 512;
      continue;
    }

    // Read file content
    const content = sharedDecoder.decode(data.subarray(offset, offset + size));

    // Strip "package/" prefix (standard in npm tarballs)
    let name = rawName;
    if (name.startsWith('package/')) {
      name = name.substring('package/'.length);
    }

    entries.push({ name, content });

    // Advance past data blocks (padded to 512 bytes)
    offset += Math.ceil(size / 512) * 512;
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Read a null-terminated string from a buffer region. */
function readString(buf: Uint8Array, offset: number, length: number): string {
  let end = offset;
  const limit = offset + length;
  while (end < limit && buf[end] !== 0) end++;
  return sharedDecoder.decode(buf.subarray(offset, end));
}

/** Read an octal number from a buffer region. */
function readOctal(buf: Uint8Array, offset: number, length: number): number {
  const str = readString(buf, offset, length).trim();
  return str.length > 0 ? parseInt(str, 8) : 0;
}

/** Check if a 512-byte block is all zeros. */
function isZeroBlock(block: Uint8Array): boolean {
  for (let i = 0; i < block.length; i++) {
    if (block[i] !== 0) return false;
  }
  return true;
}
