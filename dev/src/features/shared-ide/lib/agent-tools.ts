/**
 * IDE agent tool definitions and executor.
 *
 * Defines the tools available to the AI agent and executes them
 * against the VirtualFileSystem and RuntimeBackend.
 */
import type { VirtualFileSystem } from '../VirtualFileSystem';
import type { RuntimeBackend } from '@/lib/sandbox/runtime';
import { HOME_DIR } from '@/lib/runtime/constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentToolDef {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  tool: string;
  success: boolean;
  result: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export function getIDEAgentTools(): AgentToolDef[] {
  return [
    {
      name: 'read_file',
      description: 'Read the content of a file at the given path.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute or relative file path' },
        },
        required: ['path'],
      },
    },
    {
      name: 'write_file',
      description: 'Write content to a file, creating it if it does not exist.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to write to' },
          content: { type: 'string', description: 'Content to write' },
        },
        required: ['path', 'content'],
      },
    },
    {
      name: 'list_files',
      description: 'List files and directories at the given path.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path (defaults to project root)' },
        },
      },
    },
    {
      name: 'search_files',
      description: 'Search file contents with a regex pattern. Returns matching lines with file paths.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Regex pattern to search for' },
          path: { type: 'string', description: 'Directory to search in (defaults to project root)' },
        },
        required: ['pattern'],
      },
    },
    {
      name: 'run_command',
      description: 'Run a terminal command. Returns stdout, stderr, and exit code.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Command to run (e.g., "node", "npm")' },
          args: { type: 'string', description: 'Command arguments as space-separated string' },
        },
        required: ['command'],
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// Tool executor
// ---------------------------------------------------------------------------

export async function executeIDETool(
  call: ToolCall,
  vfs: VirtualFileSystem,
  backend: RuntimeBackend,
): Promise<ToolResult> {
  const toolName = call.name;

  switch (toolName) {
    case 'read_file':
      return execReadFile(vfs, call.arguments);
    case 'write_file':
      return execWriteFile(vfs, call.arguments);
    case 'list_files':
      return execListFiles(vfs, call.arguments);
    case 'search_files':
      return execSearchFiles(vfs, call.arguments);
    case 'run_command':
      return execRunCommand(backend, call.arguments);
    default:
      return { tool: toolName, success: false, result: '', error: `Unknown tool: ${toolName}` };
  }
}

// ---------------------------------------------------------------------------
// Individual tool implementations
// ---------------------------------------------------------------------------

function execReadFile(vfs: VirtualFileSystem, args: Record<string, unknown>): Promise<ToolResult> {
  const path = resolvePath(String(args.path ?? ''));
  const content = vfs.readFile(path);
  if (content === null) {
    return Promise.resolve({ tool: 'read_file', success: false, result: '', error: `File not found: ${args.path}` });
  }
  return Promise.resolve({ tool: 'read_file', success: true, result: content });
}

function execWriteFile(vfs: VirtualFileSystem, args: Record<string, unknown>): Promise<ToolResult> {
  const path = resolvePath(String(args.path ?? ''));
  const content = String(args.content ?? '');
  vfs.writeFile(path, content);
  return Promise.resolve({ tool: 'write_file', success: true, result: `Wrote ${content.length} bytes to ${args.path}` });
}

function execListFiles(vfs: VirtualFileSystem, args: Record<string, unknown>): Promise<ToolResult> {
  const path = resolvePath(String(args.path ?? HOME_DIR));
  const entries = vfs.readdir(path);
  if (entries === null) {
    return Promise.resolve({ tool: 'list_files', success: false, result: '', error: `Directory not found: ${args.path}` });
  }
  return Promise.resolve({ tool: 'list_files', success: true, result: entries.join('\n') });
}

function execSearchFiles(vfs: VirtualFileSystem, args: Record<string, unknown>): Promise<ToolResult> {
  const pattern = String(args.pattern ?? '');
  const searchDir = resolvePath(String(args.path ?? HOME_DIR));
  const results: string[] = [];

  try {
    const regex = new RegExp(pattern, 'g');
    searchDir_(vfs, searchDir, regex, results);
  } catch {
    return Promise.resolve({ tool: 'search_files', success: false, result: '', error: `Invalid regex: ${pattern}` });
  }

  if (results.length === 0) {
    return Promise.resolve({ tool: 'search_files', success: true, result: 'No matches found.' });
  }
  return Promise.resolve({ tool: 'search_files', success: true, result: results.join('\n') });
}

function searchDir_(vfs: VirtualFileSystem, dirPath: string, regex: RegExp, results: string[]): void {
  const entries = vfs.readdir(dirPath);
  if (!entries) return;

  for (const name of entries) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const fullPath = dirPath + '/' + name;
    const stat = vfs.stat(fullPath);
    if (!stat) continue;

    if (stat.isDirectory) {
      searchDir_(vfs, fullPath, regex, results);
    } else {
      const content = vfs.readFile(fullPath);
      if (!content) continue;
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        regex.lastIndex = 0;
        if (regex.test(lines[i])) {
          const relativePath = fullPath.startsWith(HOME_DIR + '/') ? fullPath.slice(HOME_DIR.length + 1) : fullPath;
          results.push(`${relativePath}:${i + 1}: ${lines[i].trim()}`);
        }
      }
    }
  }
}

async function execRunCommand(backend: RuntimeBackend, args: Record<string, unknown>): Promise<ToolResult> {
  const command = String(args.command ?? '');
  const argsStr = String(args.args ?? '');
  const cmdArgs = argsStr ? argsStr.split(' ') : [];

  try {
    const handle = await backend.spawn(command, cmdArgs);
    const reader = handle.output.getReader();
    let output = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      output += value;
    }
    const exitCode = await handle.exit;
    const result = output.trimEnd() + (exitCode !== 0 ? `\n(exit code: ${exitCode})` : '');
    return { tool: 'run_command', success: exitCode === 0, result };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { tool: 'run_command', success: false, result: '', error: msg };
  }
}

function resolvePath(path: string): string {
  if (path.startsWith('/')) return path;
  return HOME_DIR + '/' + path;
}
