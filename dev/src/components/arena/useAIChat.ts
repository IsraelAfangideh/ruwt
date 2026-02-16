/**
 * Extracted SSE streaming logic for AI chat.
 * Shared by sidebar chat and RuwtTUI.
 */
import { useCallback, useRef } from 'react';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface SSEChunkData {
  type: string;
  content?: string;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  model?: string;
  violation?: string;
  message?: string;
}

export interface MessageMeta {
  model: string;
  cost: number;
  tokens: number;
}

export interface UseAIChatOptions {
  attemptId: string;
  model: string;
  maxTokens?: number;
  onCostUpdate?: (cost: number, inputTokens: number, outputTokens: number) => void;
}

export interface StreamCallbacks {
  onChunk: (content: string) => void;
  onDone: (fullContent: string, meta?: MessageMeta) => void;
  onError: (error: string) => void;
  onConstraint?: (violation: string, message: string) => void;
}

export function useAIChat(options: UseAIChatOptions) {
  const { attemptId, model, maxTokens = 2048, onCostUpdate } = options;
  const abortRef = useRef<AbortController | null>(null);

  const streamChat = useCallback(
    async (messages: ChatMessage[], callbacks: StreamCallbacks) => {
      const { onChunk, onDone, onError, onConstraint } = callbacks;

      // Abort any existing stream
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages, attemptId, maxTokens }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: string; violation?: string };
          if (res.status === 403 && err.violation) {
            onConstraint?.(err.violation, err.error || `Constraint reached: ${err.violation}`);
          } else {
            onError(err.error || res.statusText);
          }
          return;
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let buffer = '';
        let messageMeta: MessageMeta | undefined;

        while (reader) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // Split by newline; keep last part as potentially incomplete line
          const parts = buffer.split('\n');
          buffer = parts.pop() ?? '';

          for (const line of parts) {
            if (!line.startsWith('data: ')) continue;
            try {
              const data: SSEChunkData = JSON.parse(line.slice(6));
              if (data.type === 'chunk' && data.content) {
                fullContent += data.content;
                onChunk(fullContent);
              } else if (data.type === 'done') {
                onCostUpdate?.(data.cost ?? 0, data.inputTokens ?? 0, data.outputTokens ?? 0);
                messageMeta = {
                  model: data.model || model,
                  cost: data.cost ?? 0,
                  tokens: (data.inputTokens ?? 0) + (data.outputTokens ?? 0),
                };
              } else if (data.type === 'error') {
                fullContent += `\n[Error: ${data.message}]`;
              } else if (data.type === 'constraint_warning') {
                fullContent += `\n[Constraint: ${data.message}]`;
              }
            } catch { /* skip malformed SSE */ }
          }
        }

        // Process any remaining buffered line
        if (buffer.startsWith('data: ')) {
          try {
            const data: SSEChunkData = JSON.parse(buffer.slice(6));
            if (data.type === 'chunk' && data.content) {
              fullContent += data.content;
              onChunk(fullContent);
            } else if (data.type === 'done') {
              onCostUpdate?.(data.cost ?? 0, data.inputTokens ?? 0, data.outputTokens ?? 0);
              messageMeta = {
                model: data.model || model,
                cost: data.cost ?? 0,
                tokens: (data.inputTokens ?? 0) + (data.outputTokens ?? 0),
              };
            }
          } catch { /* skip */ }
        }

        onDone(fullContent || '(no response)', messageMeta);
      } catch (e) {
        if ((e as Error).name === 'AbortError') {
          onDone('[interrupted]');
        } else {
          onError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [attemptId, model, maxTokens, onCostUpdate]
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  return { streamChat, abort };
}
