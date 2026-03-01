import { afterEach, expect } from 'vitest';
import { cleanup } from '@testing-library/react';
import { mkdirSync } from 'fs';
import { resolve } from 'path';
import * as matchers from 'vitest-axe/matchers';
import 'vitest-axe/extend-expect';

// Extend expect with a11y matchers (toHaveNoViolations)
expect.extend(matchers);

// Ensure coverage temp directory exists — the V8 coverage provider may delete
// it during initialization even with `clean: false`.
try { mkdirSync(resolve(__dirname, '../../coverage/.tmp'), { recursive: true }); } catch {}

// Auto-cleanup after each test
afterEach(() => cleanup());
