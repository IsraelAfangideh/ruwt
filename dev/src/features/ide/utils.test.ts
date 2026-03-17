import { describe, it, expect } from 'vitest';
import { tabLabel, languageForPath, GIT_TOKEN_KEY, buildGitStatusMap } from './utils';
import type { GitStatusEntry } from '@/lib/git/browser-git';

describe('utils', () => {
  describe('tabLabel', () => {
    it('returns filename from simple path', () => {
      expect(tabLabel('index.js')).toBe('index.js');
    });

    it('returns filename from nested path', () => {
      expect(tabLabel('src/components/App.tsx')).toBe('App.tsx');
    });

    it('returns the whole string when no slashes', () => {
      expect(tabLabel('README.md')).toBe('README.md');
    });
  });

  describe('languageForPath', () => {
    it('returns typescript for .ts files', () => {
      expect(languageForPath('index.ts')).toBe('typescript');
    });

    it('returns typescript for .tsx files', () => {
      expect(languageForPath('App.tsx')).toBe('typescript');
    });

    it('returns javascript for .js files', () => {
      expect(languageForPath('main.js')).toBe('javascript');
    });

    it('returns javascript for .jsx files', () => {
      expect(languageForPath('App.jsx')).toBe('javascript');
    });

    it('returns json for .json files', () => {
      expect(languageForPath('package.json')).toBe('json');
    });

    it('returns markdown for .md files', () => {
      expect(languageForPath('README.md')).toBe('markdown');
    });

    it('returns css for .css files', () => {
      expect(languageForPath('style.css')).toBe('css');
    });

    it('returns html for .html files', () => {
      expect(languageForPath('index.html')).toBe('html');
    });

    it('returns plaintext for unknown extensions', () => {
      expect(languageForPath('Makefile')).toBe('plaintext');
    });

    it('returns plaintext for files with no extension', () => {
      expect(languageForPath('Dockerfile')).toBe('plaintext');
    });
  });

  describe('GIT_TOKEN_KEY', () => {
    it('is the expected localStorage key', () => {
      expect(GIT_TOKEN_KEY).toBe('ruwt-git-token');
    });
  });

  describe('buildGitStatusMap', () => {
    it('returns empty object for empty array', () => {
      expect(buildGitStatusMap([])).toEqual({});
    });

    it('maps entries to filepath -> status', () => {
      const entries: GitStatusEntry[] = [
        { filepath: 'index.js', status: 'modified' },
        { filepath: 'new.ts', status: 'added' },
        { filepath: 'old.js', status: 'deleted' },
      ];
      expect(buildGitStatusMap(entries)).toEqual({
        'index.js': 'modified',
        'new.ts': 'added',
        'old.js': 'deleted',
      });
    });

    it('last entry wins for duplicate filepaths', () => {
      const entries: GitStatusEntry[] = [
        { filepath: 'file.js', status: 'modified' },
        { filepath: 'file.js', status: 'added' },
      ];
      expect(buildGitStatusMap(entries)).toEqual({
        'file.js': 'added',
      });
    });
  });
});
