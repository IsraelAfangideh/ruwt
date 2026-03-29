/**
 * SSE streaming for Cloudflare AI models via /api/ai/chat.
 * Supports separate thinking (reasoning) and content (answer) phases.
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
  displayName?: string;
  violation?: string;
  message?: string;
}

export interface MessageMeta {
  model: string;
  cost: number;
  tokens: number;
}

export interface UseAIChatOptions {
  sessionId: string;
  model: string;
  maxTokens?: number;
  onCostUpdate?: (cost: number, inputTokens: number, outputTokens: number) => void;
}

export interface StreamCallbacks {
  onChunk: (content: string) => void;
  onThinking?: (thinkingContent: string) => void;
  onThinkingDone?: () => void;
  onDone: (fullContent: string, meta?: MessageMeta) => void;
  onError: (error: string) => void;
  onConstraint?: (violation: string, message: string) => void;
  onModelUnavailable?: (modelId: string, displayName: string, message: string) => void;
  userMessage?: string;
  codeSnapshot?: string;
}

const EMPTY_RESPONSE_MSG = 'The model returned an empty response. It may be temporarily overloaded — try again or switch to a different model.';

export function useAIChat(options: UseAIChatOptions) {
  const { sessionId, model, maxTokens = 2048, onCostUpdate } = options;
  const abortRef = useRef<AbortController | null>(null);

  const streamChat = useCallback(
    async (messages: ChatMessage[], callbacks: StreamCallbacks) => {
      const { onChunk, onThinking, onThinkingDone, onDone, onError, onConstraint, onModelUnavailable, userMessage, codeSnapshot } = callbacks;

      // Abort any existing stream
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      let fullContent = '';
      let fullThinking = '';
      let errorReceived = false;

      try {
        // All models go to /api/ai/chat (unified SSE endpoint)
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages, attemptId: sessionId, maxTokens, userMessage, codeSnapshot }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as {
            error?: string; violation?: string; required?: number;
            available?: number; message?: string; resetsAt?: string;
          };
          if (res.status === 403 && err.violation) {
            onConstraint?.(err.violation, err.error || `Constraint reached: ${err.violation}`);
          } else if (res.status === 402) {
            onError(`Insufficient credits. Need ${err.required} but have ${err.available}.`);
          } else if (res.status === 429 && err.resetsAt) {
            onError(err.message || 'Daily limit reached. Try again later.');
          } else {
            onError(err.error || res.statusText);
          }
          return;
        }

        // SSE streaming (single path for all models)
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let messageMeta: MessageMeta | undefined;

        const processSSEEvent = (data: SSEChunkData) => {
          if (data.type === 'chunk' && data.content != null) {
            // Use != null (not truthiness) to allow numeric 0 and boolean false
            const text = String(data.content);
            fullContent += text;
            onChunk(fullContent);
          } else if (data.type === 'thinking' && data.content != null) {
            const text = String(data.content);
            fullThinking += text;
            onThinking?.(fullThinking);
          } else if (data.type === 'thinking_done') {
            onThinkingDone?.();
          } else if (data.type === 'done') {
            onCostUpdate?.(data.cost ?? 0, data.inputTokens ?? 0, data.outputTokens ?? 0);
            messageMeta = {
              model: data.model || model,
              cost: data.cost ?? 0,
              tokens: (data.inputTokens ?? 0) + (data.outputTokens ?? 0),
            };
          } else if (data.type === 'model_unavailable') {
            /* istanbul ignore next -- @preserve */
            onModelUnavailable?.(data.model || '', data.displayName || data.model || '', data.message || 'Model unavailable');
          } else if (data.type === 'error') {
            errorReceived = true;
            onError(data.message || 'Unknown error');
          } else {
            /* istanbul ignore next -- @preserve */
            if (data.type === 'constraint_warning') {
              onConstraint?.(data.violation || 'unknown', data.message || 'Constraint reached');
            }
          }
        };

        while (reader) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // Split by newline; keep last part as potentially incomplete line
          const parts = buffer.split('\n');
          /* istanbul ignore next -- @preserve */
          buffer = parts.pop() ?? '';

          for (const line of parts) {
            if (!line.startsWith('data: ')) continue;
            try {
              processSSEEvent(JSON.parse(line.slice(6)));
            } catch { /* skip malformed SSE */ }
          }
        }

        // Process any remaining buffered line
        if (buffer.startsWith('data: ')) {
          try {
            processSSEEvent(JSON.parse(buffer.slice(6)));
          } catch { /* skip */ }
        }

        if (!errorReceived) {
          onDone(fullContent || fullThinking || EMPTY_RESPONSE_MSG, messageMeta);
        }
      } catch (e) {
        if ((e as Error).name === 'AbortError') {
          onDone(fullContent || '[interrupted]');
        } else {
          onError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [sessionId, model, maxTokens, onCostUpdate]
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  return { streamChat, abort };
}
