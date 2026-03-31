/**
 * useAgentLoop — client-side AI agent loop for the IDE.
 *
 * Orchestrates multi-turn conversations where the model can call tools
 * (read_file, write_file, search_files, etc.) that execute locally
 * against the VirtualFileSystem and RuntimeBackend.
 */
import { useState, useCallback, useRef } from 'react';
import { useAIChat } from './useAIChat';
import type { MessageMeta } from './useAIChat';
import { executeIDETool, getIDEAgentTools } from '../lib/agent-tools';
import type { VirtualFileSystem } from '../VirtualFileSystem';
import type { RuntimeBackend } from '@/lib/sandbox/runtime';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: Array<{ name: string; arguments: string }>;
  meta?: MessageMeta;
}

export interface AgentLoopOptions {
  model: string;
  maxIterations?: number;
  costLimit?: number;
  vfs: VirtualFileSystem;
  backend: RuntimeBackend;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAgentLoop(options: AgentLoopOptions) {
  const { model, maxIterations = 10, vfs, backend } = options;
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [totalCost, setTotalCost] = useState(0);
  const abortedRef = useRef(false);
  const costRef = useRef(0);

  const { streamChat, abort: abortStream } = useAIChat({
    sessionId: 'ide-agent',
    model,
  });

  const tools = getIDEAgentTools();

  const sendMessage = useCallback(async (content: string, systemPrompt: string) => {
    abortedRef.current = false;
    setIsRunning(true);

    const userMsg: AgentMessage = { id: crypto.randomUUID(), role: 'user', content };
    setMessages((prev) => [...prev, userMsg]);

    // Build conversation as chat messages
    const chatMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    // Add existing conversation
    const allMessages = [...messages, userMsg];
    for (const msg of allMessages) {
      if (msg.role === 'tool') {
        chatMessages.push({ role: 'user', content: `[Tool Result] ${msg.content}` });
      } else {
        chatMessages.push({ role: msg.role, content: msg.content });
      }
    }

    let iterations = 0;

    const runIteration = async (iterMessages: typeof chatMessages): Promise<void> => {
      if (abortedRef.current || iterations >= maxIterations) {
        setIsRunning(false);
        return;
      }
      iterations++;

      const state = {
        toolCalls: null as Array<{ name: string; arguments: string }> | null,
        content: '',
        meta: undefined as MessageMeta | undefined,
        error: false,
      };

      await streamChat(iterMessages, {
        onChunk: (content) => { state.content = content; },
        onDone: (fullContent, meta) => {
          state.content = fullContent;
          state.meta = meta;
          if (meta?.cost) {
            costRef.current += meta.cost;
            setTotalCost(costRef.current);
          }
        },
        onError: (error) => {
          state.error = true;
          setMessages((prev) => [...prev, {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `Error: ${error}`,
          }]);
        },
        onToolCalls: (calls) => {
          state.toolCalls = calls;
        },
        tools,
      });

      if (state.error || abortedRef.current) {
        setIsRunning(false);
        return;
      }

      // If model produced tool calls, execute them and continue
      if (state.toolCalls && state.toolCalls.length > 0) {
        const calls = state.toolCalls;
        const assistantMsg: AgentMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: state.content || '(calling tools...)',
          toolCalls: calls,
          meta: state.meta,
        };
        setMessages((prev) => [...prev, assistantMsg]);

        const toolResults: AgentMessage[] = [];
        for (const call of calls) {
          let args: Record<string, unknown>;
          try {
            args = JSON.parse(call.arguments);
          } catch {
            args = {};
          }

          const result = await executeIDETool({ name: call.name, arguments: args }, vfs, backend);
          const toolMsg: AgentMessage = {
            id: crypto.randomUUID(),
            role: 'tool',
            content: result.success ? result.result : `Error: ${result.error ?? 'Unknown error'}`,
          };
          toolResults.push(toolMsg);
        }

        setMessages((prev) => [...prev, ...toolResults]);

        // Build next iteration messages
        const nextMessages = [
          ...iterMessages,
          { role: 'assistant' as const, content: state.content || '' },
          ...toolResults.map((tr) => ({
            role: 'user' as const,
            content: `[Tool Result] ${tr.content}`,
          })),
        ];

        await runIteration(nextMessages);
        return;
      }

      // No tool calls — model is done
      if (state.content) {
        setMessages((prev) => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: state.content,
          meta: state.meta,
        }]);
      }

      setIsRunning(false);
    };

    await runIteration(chatMessages);
  }, [messages, model, maxIterations, vfs, backend, streamChat, tools]);

  const abort = useCallback(() => {
    abortedRef.current = true;
    abortStream();
    setIsRunning(false);
  }, [abortStream]);

  return { messages, isRunning, totalCost, sendMessage, abort };
}
