import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { mkdirSync } from 'fs';
import { resolve } from 'path';

// Ensure coverage temp directory exists — the V8 coverage provider may delete
// it during initialization even with `clean: false`.
try { mkdirSync(resolve(__dirname, '../../coverage/.tmp'), { recursive: true }); } catch {}

// Auto-cleanup after each test
afterEach(() => cleanup());
