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
    setupFiles: ['./src/shared/test/setup.ts'],
    coverage: {
      provider: 'istanbul',
      // REQUIRED: clean:false prevents vitest from deleting .tmp coverage data mid-run (vitest v4 bug)
      clean: false,
      // REQUIRED: prevents vitest from cleaning coverage on test failure
      reportOnFailure: true,
      reporter: ['text', 'text-summary', 'json-summary'],
      include: ['src/**/*.ts', 'src/**/*.tsx', 'functions/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.d.ts',
        'src/shared/stubs/**',
        'src/vite-env.d.ts',
        'src/shared/ui/index.ts',
        'src/shared/theme/index.ts',
        'src/shared/navigation/types.ts',
        'src/shared/test/helpers.ts',
      ],
    },
  },
});
