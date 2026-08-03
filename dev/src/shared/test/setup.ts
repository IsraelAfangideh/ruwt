import { afterEach, expect } from 'vitest';
import { cleanup, configure } from '@testing-library/react';
import { mkdirSync } from 'fs';
import { resolve } from 'path';
import * as matchers from 'vitest-axe/matchers';
import 'vitest-axe/extend-expect';
import '@testing-library/jest-dom/vitest';

// Extend expect with a11y matchers (toHaveNoViolations)
expect.extend(matchers);

// Ensure coverage temp directory exists — the V8 coverage provider may delete
// it during initialization even with `clean: false`.
try { mkdirSync(resolve(__dirname, '../../coverage/.tmp'), { recursive: true }); } catch {}

// Testing Library retries waitFor/findBy for 1s by default. Screens that mount
// a lazy component behind Suspense (Monaco, TerminalPanel) can need longer on a
// loaded CI runner, and blowing that budget reports "Unable to find an element"
// rather than a timeout — which reads like a real bug. 5s stays well inside the
// 15s testTimeout, so a genuine miss still fails the test.
configure({ asyncUtilTimeout: 5000 });

// Auto-cleanup after each test
afterEach(() => cleanup());
