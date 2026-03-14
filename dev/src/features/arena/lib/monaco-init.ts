/**
 * Configure @monaco-editor/react to use the locally bundled monaco-editor
 * instead of loading from cdn.jsdelivr.net. This eliminates the CDN
 * supply chain risk and improves load performance.
 */
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

loader.config({ monaco });
