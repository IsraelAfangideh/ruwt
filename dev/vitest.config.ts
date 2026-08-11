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
    // scripts/ carries the seed data, which the app depends on being the right
    // shape — see scripts/seed-d1.test.ts.
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'functions/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['./src/shared/test/setup.ts'],
    // Vitest's 5s default is wall-clock, and vitest runs ~13 forked workers,
    // each with its own jsdom. Under CPU contention a worker can be descheduled
    // long enough that a trivial synchronous test blows the deadline — which
    // showed up as 2-21 failures per run, in a different random set of files
    // each time, all passing in isolation. The suite's slowest actual test is
    // ~1.2s, so this is pure headroom: a measured A/B under identical load went
    // from 7 failures to 0 with no change in wall time. Real hangs are still
    // caught. Do not lower this to "make failures visible" — they were noise.
    testTimeout: 15000,
    coverage: {
      provider: 'istanbul',
      // REQUIRED: clean:false prevents vitest from deleting .tmp coverage data mid-run (vitest v4 bug)
      clean: false,
      // REQUIRED: prevents vitest from cleaning coverage on test failure
      reportOnFailure: true,
      reporter: ['text', 'text-summary', 'json-summary', 'json'],
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
