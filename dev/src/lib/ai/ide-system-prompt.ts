/**
 * IDE system prompt builder.
 *
 * Builds context-aware system prompts for the standalone IDE.
 * Unlike Arena prompts (challenge-scoped), these describe a general project.
 */
import type { AIMode } from '@/features/shared-ide/lib/ai-types';
import { EDIT_FORMAT_RULES, SEARCH_REPLACE_WARNING } from '@/features/shared-ide/lib/ai-types';

export interface IDEPromptOptions {
  mode: AIMode;
  fileTree: string[];
  currentFile?: { path: string; content: string };
  packageJson?: string | null;
  language: string;
  includeToolDefs?: boolean;
  tier?: 'free' | 'byok';
}

const FREE_TREE_LIMIT = 50;
const BYOK_TREE_LIMIT = 20;

export function buildIDESystemPrompt(opts: IDEPromptOptions): string {
  const parts: string[] = [];

  parts.push(buildRole(opts.mode));
  parts.push(buildEnvironment());

  if (opts.mode !== 'ask') {
    parts.push(EDIT_FORMAT_RULES);
    parts.push(SEARCH_REPLACE_WARNING);
  }

  if (opts.includeToolDefs && opts.mode === 'agent') {
    parts.push(buildToolDefinitions());
  }

  parts.push(buildFileTree(opts.fileTree, opts.tier));

  if (opts.currentFile) {
    parts.push(buildCurrentFile(opts.currentFile));
  }

  if (opts.packageJson) {
    parts.push(buildPackageJson(opts.packageJson));
  }

  return parts.filter(Boolean).join('\n\n');
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function buildRole(mode: AIMode): string {
  switch (mode) {
    case 'agent':
      return `You are an autonomous coding agent in a browser-based IDE. You can read files, write files, search code, and run commands using the provided tools. Work step by step: understand the codebase, make changes, verify they work. Be concise.`;
    case 'plan':
      return `You are a planning assistant in a browser-based IDE. Analyze the codebase and create a numbered plan for the requested changes. Wrap your plan in <plan> tags. Do not write code until the user approves the plan.`;
    case 'debug':
      return `You are a debugging assistant in a browser-based IDE. Analyze errors, trace root causes methodically, and suggest targeted fixes. Use SEARCH/REPLACE blocks to apply fixes.`;
    case 'ask':
      return `You are a helpful coding assistant in a browser-based IDE. Answer questions, explain code, and provide guidance. Do not output code edits — only explain concepts and reference existing code.`;
  }
}

function buildEnvironment(): string {
  return `## Environment
- Browser-based IDE (ruwt.dev) with in-memory filesystem
- Runtime: QuickJS (JavaScript/TypeScript execution via WASM)
- Package manager: npm (browser-based, installs from registry)
- No real network access from user code
- Terminal commands: node, npm, npx, ls, cat, cd, mkdir, rm, etc.`;
}

function buildToolDefinitions(): string {
  return `## Available Tools
You can call these tools to interact with the project:

- **read_file(path)** — Read a file's content. Use this before editing to see the current code.
- **write_file(path, content)** — Write or create a file with the given content.
- **list_files(path?)** — List directory contents. Defaults to project root.
- **search_files(pattern, path?)** — Search file contents with a regex pattern. Returns matching lines with file paths.
- **run_command(command, args?)** — Run a terminal command (e.g., "node index.js", "npm test"). Returns stdout, stderr, and exit code.

Always read a file before editing it. Use search_files to find relevant code across the project.`;
}

function buildFileTree(files: string[], tier?: 'free' | 'byok'): string {
  if (files.length === 0) return '## Project Files\n(Empty project)';

  const limit = tier === 'byok' ? BYOK_TREE_LIMIT : FREE_TREE_LIMIT;
  const truncated = files.length > limit;
  const shown = truncated ? files.slice(0, limit) : files;

  let section = '## Project Files\n' + shown.map((f) => `- ${f}`).join('\n');
  if (truncated) {
    section += `\n- ... and ${files.length - limit} more files`;
  }
  return section;
}

function buildCurrentFile(file: { path: string; content: string }): string {
  return `## Currently Open File: ${file.path}\n\`\`\`\n${file.content}\n\`\`\``;
}

function buildPackageJson(content: string): string {
  return `## package.json\n\`\`\`json\n${content}\n\`\`\``;
}
