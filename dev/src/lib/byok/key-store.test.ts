import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KeyStore, type AIProvider } from './key-store';

// Mock localStorage
const store = new Map<string, string>();
const mockLocalStorage = {
  getItem: vi.fn((key: string) => store.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => store.set(key, value)),
  removeItem: vi.fn((key: string) => store.delete(key)),
};
vi.stubGlobal('localStorage', mockLocalStorage);

describe('KeyStore', () => {
  let keyStore: KeyStore;

  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
    keyStore = new KeyStore();
  });

  describe('setKey', () => {
    it('stores an API key for a provider', () => {
      keyStore.setKey('anthropic', 'sk-ant-xxx');
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('stores keys for different providers independently', () => {
      keyStore.setKey('anthropic', 'sk-ant-xxx');
      keyStore.setKey('openai', 'sk-oai-xxx');
      expect(keyStore.getKey('anthropic')).toBe('sk-ant-xxx');
      expect(keyStore.getKey('openai')).toBe('sk-oai-xxx');
    });
  });

  describe('getKey', () => {
    it('returns stored key for provider', () => {
      keyStore.setKey('anthropic', 'sk-ant-xxx');
      expect(keyStore.getKey('anthropic')).toBe('sk-ant-xxx');
    });

    it('returns null for provider with no key', () => {
      expect(keyStore.getKey('anthropic')).toBeNull();
    });
  });

  describe('removeKey', () => {
    it('removes stored key', () => {
      keyStore.setKey('anthropic', 'sk-ant-xxx');
      keyStore.removeKey('anthropic');
      expect(keyStore.getKey('anthropic')).toBeNull();
    });
  });

  describe('hasKey', () => {
    it('returns true when key is stored', () => {
      keyStore.setKey('openai', 'sk-xxx');
      expect(keyStore.hasKey('openai')).toBe(true);
    });

    it('returns false when no key stored', () => {
      expect(keyStore.hasKey('openai')).toBe(false);
    });
  });

  describe('listProviders', () => {
    it('returns empty array when no keys stored', () => {
      expect(keyStore.listProviders()).toEqual([]);
    });

    it('returns providers that have keys', () => {
      keyStore.setKey('anthropic', 'sk-ant');
      keyStore.setKey('groq', 'gsk-xxx');
      const providers = keyStore.listProviders();
      expect(providers).toContain('anthropic');
      expect(providers).toContain('groq');
      expect(providers).not.toContain('openai');
    });
  });

  describe('clearAll', () => {
    it('removes all stored keys', () => {
      keyStore.setKey('anthropic', 'sk-ant');
      keyStore.setKey('openai', 'sk-oai');
      keyStore.clearAll();
      expect(keyStore.listProviders()).toEqual([]);
    });
  });

  describe('provider validation', () => {
    const validProviders: AIProvider[] = ['anthropic', 'openai', 'groq', 'ollama'];

    it.each(validProviders)('accepts valid provider: %s', (provider) => {
      expect(() => keyStore.setKey(provider, 'key')).not.toThrow();
    });
  });

  describe('maskedKey', () => {
    it('returns masked version of stored key', () => {
      keyStore.setKey('anthropic', 'sk-ant-api03-xxxyyy');
      const masked = keyStore.maskedKey('anthropic');
      expect(masked).toContain('sk-ant');
      expect(masked).toContain('•••');
      expect(masked).not.toBe('sk-ant-api03-xxxyyy');
    });

    it('returns null for missing provider', () => {
      expect(keyStore.maskedKey('anthropic')).toBeNull();
    });
  });
});
