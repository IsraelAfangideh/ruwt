export function newIngestionKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const secret = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `ruwt_ing_${secret}`;
}

export async function hashIngestionKey(key: string) {
  const encoded = new TextEncoder().encode(key);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function keyPrefix(key: string) { return key.slice(0, 13); }
