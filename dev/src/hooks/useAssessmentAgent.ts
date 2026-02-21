/**
 * Hook for streaming AI assessment agent communication.
 * Connects to POST /api/ai/assessment-agent via SSE.
 */
import { useState, useCallback, useRef } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ToolResult {
  tool: string;
  success: boolean;
  result: unknown;
  error?: string;
}

interface UseAssessmentAgentParams {
  assessmentId?: string;
  onToolResult?: (tool: string, result: ToolResult) => void;
}

export function useAssessmentAgent({ assessmentId, onToolResult }: UseAssessmentAgentParams) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: Message = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setStreaming(true);

    abortRef.current = new AbortController();

    try {
      const res = await fetch('/api/ai/assessment-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          assessmentId,
          conversationId,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Request failed' }));
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `Error: ${data.error || 'Something went wrong'}` },
        ]);
        setStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setStreaming(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n');
        buffer = parts.pop() ?? '';

        for (const line of parts) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          try {
            const event = JSON.parse(data);

            switch (event.type) {
              case 'chunk':
                assistantContent += event.content;
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg?.role === 'assistant') {
                    updated[updated.length - 1] = { ...lastMsg, content: assistantContent };
                  } else {
                    updated.push({ role: 'assistant', content: assistantContent });
                  }
                  return updated;
                });
                break;

              case 'thinking':
                // We could display thinking separately, but for now append to content
                break;

              case 'tool_call':
                // Tool call detected — will be followed by tool_result
                break;

              case 'tool_result':
                if (onToolResult) {
                  onToolResult(event.tool, event);
                }
                break;

              case 'done':
                if (event.conversationId) {
                  setConversationId(event.conversationId);
                }
                break;

              case 'error':
                assistantContent += `\n\n_Error: ${event.message}_`;
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg?.role === 'assistant') {
                    updated[updated.length - 1] = { ...lastMsg, content: assistantContent };
                  } else {
                    updated.push({ role: 'assistant', content: assistantContent });
                  }
                  return updated;
                });
                break;
            }
          } catch {
            // Invalid JSON — skip
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Connection lost. Please try again.' },
        ]);
      }
    }

    setStreaming(false);
  }, [messages, assessmentId, conversationId, onToolResult]);

  const clearHistory = useCallback(() => {
    setMessages([]);
    setConversationId(null);
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
  }, []);

  return { messages, sendMessage, streaming, clearHistory, abort, conversationId };
}
