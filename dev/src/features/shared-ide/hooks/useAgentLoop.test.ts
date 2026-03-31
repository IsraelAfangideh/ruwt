// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock useAIChat
const mockStreamChat = vi.fn();
vi.mock('./useAIChat', () => ({
  useAIChat: () => ({
    streamChat: mockStreamChat,
    abort: vi.fn(),
  }),
}));

// Mock agent tools
const mockExecute = vi.fn().mockResolvedValue({ tool: 'read_file', success: true, result: 'file content' });
vi.mock('../lib/agent-tools', () => ({
  executeIDETool: (...args: unknown[]) => mockExecute(...args),
  getIDEAgentTools: () => [{ name: 'read_file', description: 'Read file', parameters: { type: 'object', properties: {} } }],
}));

vi.mock('@/shared/theme/colors', () => ({
  arena: { bg: '#000', text: '#fff', textMuted: '#888', accent: '#c9a962', border: '#333', error: '#f00', surface: '#111', surfaceHover: '#222' },
}));

import { useAgentLoop } from './useAgentLoop';
import { VirtualFileSystem } from '../VirtualFileSystem';

describe('useAgentLoop', () => {
  let vfs: VirtualFileSystem;
  const mockBackend = {
    mode: 'browser' as const,
    readFile: vi.fn(),
    writeFile: vi.fn(),
    readdir: vi.fn(),
    mkdir: vi.fn(),
    rm: vi.fn(),
    stat: vi.fn(),
    spawn: vi.fn(),
    connectTerminal: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vfs = new VirtualFileSystem('javascript', '');
    // Default: streamChat calls onDone immediately with text response
    mockStreamChat.mockImplementation((_msgs: any, callbacks: any) => {
      callbacks.onChunk('Hello, I can help!');
      callbacks.onDone('Hello, I can help!', { model: 'test', cost: 10, tokens: 100 });
      return Promise.resolve();
    });
  });

  it('initializes with empty messages and isRunning=false', () => {
    const { result } = renderHook(() => useAgentLoop({
      model: 'test-model',
      vfs,
      backend: mockBackend as any,
    }));
    expect(result.current.messages).toEqual([]);
    expect(result.current.isRunning).toBe(false);
    expect(result.current.totalCost).toBe(0);
  });

  it('sendMessage adds user message and starts streaming', async () => {
    const { result } = renderHook(() => useAgentLoop({
      model: 'test-model',
      vfs,
      backend: mockBackend as any,
    }));

    await act(async () => {
      await result.current.sendMessage('Fix the bug', 'You are an agent');
    });

    expect(result.current.messages.length).toBeGreaterThanOrEqual(2); // user + assistant
    expect(result.current.messages[0].role).toBe('user');
    expect(result.current.messages[0].content).toBe('Fix the bug');
  });

  it('handles simple text response (no tool calls)', async () => {
    const { result } = renderHook(() => useAgentLoop({
      model: 'test-model',
      vfs,
      backend: mockBackend as any,
    }));

    await act(async () => {
      await result.current.sendMessage('Hello', 'system prompt');
    });

    const assistantMsg = result.current.messages.find((m) => m.role === 'assistant');
    expect(assistantMsg).toBeDefined();
    expect(assistantMsg!.content).toBe('Hello, I can help!');
    expect(result.current.isRunning).toBe(false);
  });

  it('handles tool_calls and executes tool locally', async () => {
    let callCount = 0;
    mockStreamChat.mockImplementation((_msgs: any, callbacks: any) => {
      callCount++;
      if (callCount === 1) {
        // First call: model wants to call a tool
        callbacks.onToolCalls?.([{ name: 'read_file', arguments: '{"path":"index.js"}' }]);
        callbacks.onDone('', { model: 'test', cost: 5, tokens: 50 });
      } else {
        // Second call: model responds with text after seeing tool result
        callbacks.onChunk('I read the file. Here is the fix.');
        callbacks.onDone('I read the file. Here is the fix.', { model: 'test', cost: 5, tokens: 50 });
      }
      return Promise.resolve();
    });

    const { result } = renderHook(() => useAgentLoop({
      model: 'test-model',
      vfs,
      backend: mockBackend as any,
    }));

    await act(async () => {
      await result.current.sendMessage('Read index.js', 'system prompt');
    });

    expect(mockExecute).toHaveBeenCalled();
    expect(mockStreamChat).toHaveBeenCalledTimes(2);
  });

  it('stops after maxIterations reached', async () => {
    mockStreamChat.mockImplementation((_msgs: any, callbacks: any) => {
      callbacks.onToolCalls?.([{ name: 'read_file', arguments: '{"path":"x.js"}' }]);
      callbacks.onDone('', { model: 'test', cost: 1, tokens: 10 });
      return Promise.resolve();
    });

    const { result } = renderHook(() => useAgentLoop({
      model: 'test-model',
      maxIterations: 3,
      vfs,
      backend: mockBackend as any,
    }));

    await act(async () => {
      await result.current.sendMessage('Loop test', 'system prompt');
    });

    // Should have stopped after 3 iterations
    expect(mockStreamChat.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it('tracks cumulative cost', async () => {
    const { result } = renderHook(() => useAgentLoop({
      model: 'test-model',
      vfs,
      backend: mockBackend as any,
    }));

    await act(async () => {
      await result.current.sendMessage('Test', 'system');
    });

    expect(result.current.totalCost).toBe(10);
  });

  it('handles stream error gracefully', async () => {
    mockStreamChat.mockImplementation((_msgs: any, callbacks: any) => {
      callbacks.onError('Model unavailable');
      return Promise.resolve();
    });

    const { result } = renderHook(() => useAgentLoop({
      model: 'test-model',
      vfs,
      backend: mockBackend as any,
    }));

    await act(async () => {
      await result.current.sendMessage('Test', 'system');
    });

    expect(result.current.isRunning).toBe(false);
    const errorMsg = result.current.messages.find((m) => m.content.includes('Model unavailable'));
    expect(errorMsg).toBeDefined();
  });

  it('abort() stops the loop', () => {
    const { result } = renderHook(() => useAgentLoop({
      model: 'test-model',
      vfs,
      backend: mockBackend as any,
    }));

    expect(() => result.current.abort()).not.toThrow();
  });
});
