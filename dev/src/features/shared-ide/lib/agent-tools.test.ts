import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VirtualFileSystem } from '../VirtualFileSystem';
import { getIDEAgentTools, executeIDETool } from './agent-tools';
import type { ToolCall } from './agent-tools';

describe('agent-tools', () => {
  let vfs: VirtualFileSystem;

  // Mock backend for run_command
  const mockSpawn = vi.fn();
  const mockBackend = {
    mode: 'browser' as const,
    spawn: mockSpawn,
    readFile: vi.fn(),
    writeFile: vi.fn(),
    readdir: vi.fn(),
    mkdir: vi.fn(),
    rm: vi.fn(),
    stat: vi.fn(),
    connectTerminal: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vfs = new VirtualFileSystem('javascript', '');
  });

  describe('getIDEAgentTools', () => {
    it('returns 5 tools with correct names', () => {
      const tools = getIDEAgentTools();
      expect(tools).toHaveLength(5);
      const names = tools.map((t) => t.name);
      expect(names).toContain('read_file');
      expect(names).toContain('write_file');
      expect(names).toContain('list_files');
      expect(names).toContain('search_files');
      expect(names).toContain('run_command');
    });

    it('each tool has name, description, and parameters', () => {
      const tools = getIDEAgentTools();
      for (const tool of tools) {
        expect(tool.name).toBeTruthy();
        expect(tool.description).toBeTruthy();
        expect(tool.parameters).toBeDefined();
      }
    });
  });

  describe('executeIDETool', () => {
    describe('read_file', () => {
      it('returns file content from VFS', async () => {
        vfs.writeFile('/home/user/index.js', 'console.log("hello")');
        const call: ToolCall = { name: 'read_file', arguments: { path: '/home/user/index.js' } };
        const result = await executeIDETool(call, vfs, mockBackend as any);
        expect(result.success).toBe(true);
        expect(result.result).toContain('console.log');
      });

      it('returns error for missing file', async () => {
        const call: ToolCall = { name: 'read_file', arguments: { path: '/missing.js' } };
        const result = await executeIDETool(call, vfs, mockBackend as any);
        expect(result.success).toBe(false);
        expect(result.error).toContain('not found');
      });
    });

    describe('write_file', () => {
      it('creates file in VFS', async () => {
        const call: ToolCall = { name: 'write_file', arguments: { path: '/home/user/new.js', content: 'const x = 1;' } };
        const result = await executeIDETool(call, vfs, mockBackend as any);
        expect(result.success).toBe(true);
        expect(vfs.readFile('/home/user/new.js')).toBe('const x = 1;');
      });
    });

    describe('list_files', () => {
      it('returns directory entries', async () => {
        vfs.writeFile('/home/user/a.js', 'a');
        vfs.writeFile('/home/user/b.js', 'b');
        const call: ToolCall = { name: 'list_files', arguments: { path: '/home/user' } };
        const result = await executeIDETool(call, vfs, mockBackend as any);
        expect(result.success).toBe(true);
        expect(result.result).toContain('a.js');
        expect(result.result).toContain('b.js');
      });

      it('returns error for missing directory', async () => {
        const call: ToolCall = { name: 'list_files', arguments: { path: '/nonexistent' } };
        const result = await executeIDETool(call, vfs, mockBackend as any);
        expect(result.success).toBe(false);
      });
    });

    describe('search_files', () => {
      it('finds matching content across files', async () => {
        vfs.writeFile('/home/user/a.js', 'const hello = "world"');
        vfs.writeFile('/home/user/b.js', 'function test() {}');
        const call: ToolCall = { name: 'search_files', arguments: { pattern: 'hello' } };
        const result = await executeIDETool(call, vfs, mockBackend as any);
        expect(result.success).toBe(true);
        expect(result.result).toContain('a.js');
        expect(result.result).toContain('hello');
      });

      it('returns empty results for no matches', async () => {
        vfs.writeFile('/home/user/a.js', 'const x = 1');
        const call: ToolCall = { name: 'search_files', arguments: { pattern: 'zzzzz' } };
        const result = await executeIDETool(call, vfs, mockBackend as any);
        expect(result.success).toBe(true);
        expect(result.result).toContain('No matches');
      });
    });

    describe('run_command', () => {
      it('executes via backend.spawn and returns output', async () => {
        let controller: ReadableStreamDefaultController<string>;
        const stream = new ReadableStream<string>({ start(c) { controller = c; } });
        controller!.enqueue('hello world\n');
        controller!.close();
        mockSpawn.mockResolvedValueOnce({ output: stream, exit: Promise.resolve(0) });

        const call: ToolCall = { name: 'run_command', arguments: { command: 'node', args: ['index.js'] } };
        const result = await executeIDETool(call, vfs, mockBackend as any);
        expect(result.success).toBe(true);
        expect(result.result).toContain('hello world');
      });

      it('returns stderr on failure', async () => {
        let controller: ReadableStreamDefaultController<string>;
        const stream = new ReadableStream<string>({ start(c) { controller = c; } });
        controller!.enqueue('Error: not found\n');
        controller!.close();
        mockSpawn.mockResolvedValueOnce({ output: stream, exit: Promise.resolve(1) });

        const call: ToolCall = { name: 'run_command', arguments: { command: 'node', args: ['bad.js'] } };
        const result = await executeIDETool(call, vfs, mockBackend as any);
        expect(result.result).toContain('Error: not found');
        expect(result.result).toContain('exit code: 1');
      });
    });

    describe('unknown tool', () => {
      it('returns error', async () => {
        const call: ToolCall = { name: 'unknown_tool', arguments: {} };
        const result = await executeIDETool(call, vfs, mockBackend as any);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Unknown tool');
      });
    });
  });
});
