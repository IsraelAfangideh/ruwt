/**
 * Shared lazy Monaco editor with eager prefetch.
 * Centralizes monaco-init + lazy import so all IDE screens benefit
 * from early chunk download and consistent configuration.
 */
import { lazy } from 'react';
import './monaco-init';

/* istanbul ignore next -- @preserve */
const monacoImport = () => import('@monaco-editor/react');
/* istanbul ignore next -- @preserve */
monacoImport().catch(() => {}); // prefetch — start download before any screen needs it
/* istanbul ignore next -- @preserve */
export const LazyMonacoEditor = lazy(monacoImport);
