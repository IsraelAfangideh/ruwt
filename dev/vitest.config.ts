import { defineConfig } from 'vitest/config';
import path from 'path';
import fs from 'fs';

// Pre-create coverage temp directory to prevent ENOENT race condition
const coverageTmp = path.resolve(__dirname, 'coverage', '.tmp');
fs.mkdirSync(coverageTmp, { recursive: true });

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'react-native': 'react-native-web',
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'functions/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'istanbul',
      clean: false,
      reportOnFailure: true,
      reporter: ['text', 'text-summary'],
      include: ['src/**/*.ts', 'src/**/*.tsx', 'functions/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.d.ts',
        'src/stubs/**',
        'src/vite-env.d.ts',
        'src/components/ui/index.ts',
        'src/theme/index.ts',
        'src/navigation/types.ts',
      ],
    },
  },
});
