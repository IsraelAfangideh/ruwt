/**
 * BYOK (Bring Your Own Key) client-side key storage.
 *
 * Stores API keys in localStorage. Keys are stored per-provider
 * and can be retrieved for proxying through the BYOK API endpoint.
 */

export type AIProvider = 'anthropic' | 'openai' | 'groq' | 'ollama';

const STORAGE_KEY = 'ruwt-byok-keys';

export class KeyStore {
  private getAll(): Record<string, string> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private saveAll(keys: Record<string, string>): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  }

  setKey(provider: AIProvider, key: string): void {
    const keys = this.getAll();
    keys[provider] = key;
    this.saveAll(keys);
  }

  getKey(provider: AIProvider): string | null {
    const keys = this.getAll();
    return keys[provider] ?? null;
  }

  removeKey(provider: AIProvider): void {
    const keys = this.getAll();
    delete keys[provider];
    this.saveAll(keys);
  }

  hasKey(provider: AIProvider): boolean {
    return this.getKey(provider) !== null;
  }

  listProviders(): AIProvider[] {
    const keys = this.getAll();
    return Object.keys(keys).filter((k) => keys[k]) as AIProvider[];
  }

  clearAll(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  maskedKey(provider: AIProvider): string | null {
    const key = this.getKey(provider);
    if (!key) return null;
    if (key.length <= 8) return '•••' + key.slice(-4);
    return key.slice(0, 7) + '•••' + key.slice(-4);
  }
}
