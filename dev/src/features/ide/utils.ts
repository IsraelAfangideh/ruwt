/** Derive a short label from a file path (just the filename). */
export function tabLabel(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1];
}

/** Infer Monaco language from a file path extension. */
export function languageForPath(path: string): string {
  const ext = path.includes('.') ? path.split('.').pop()!.toLowerCase() : '';
  switch (ext) {
    case 'ts': case 'tsx': return 'typescript';
    case 'js': case 'jsx': return 'javascript';
    case 'json': return 'json';
    case 'md': return 'markdown';
    case 'css': return 'css';
    case 'html': return 'html';
    default: return 'plaintext';
  }
}
