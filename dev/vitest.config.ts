import { defineConfig } from 'vitest/config';
import path from 'path';

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
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: ['src/**/*.ts', 'src/**/*.tsx', 'functions/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/*.d.ts',
        'src/stubs/**',
        'src/vite-env.d.ts',
      ],
    },
  },
});
