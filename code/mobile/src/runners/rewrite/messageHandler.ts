import { RewriteChatResponse } from '@ruwt/shared';
import { Message } from '../../types/chat';
import { ChatActions } from '../../types/runner';
import { REWRITE_ENDPOINT } from './config';

export async function handleMessage(
  text: string,
  history: Message[],
  actions: ChatActions
): Promise<void> {
  if (!text.trim()) return;

  // Filter out system instructions from history so AI doesn't see "User said: make it kinder" as a literal message to deliver
  const historyForApi = history
    .filter(m => !m.isSystem && !m.isActionable) // Don't include previous 'action' bubbles in history context
    .map(m => ({
      role: m.sender === 'user' ? 'user' as const : 'model' as const,
      parts: [{ text: m.text }]
    }));

  actions.setLoading(true);

  try {
    const response = await fetch(REWRITE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        userId: 'user_1', // Hardcoded for prototype
        history: historyForApi
      })
    });

    const data: RewriteChatResponse = await response.json();

    if (data.isBlocked) {
      // 1. Add Explanation Bubble
      if (data.explanation) {
        actions.addMessage({
          id: Date.now().toString() + '_exp',
          text: data.explanation || "This feels sharp.",
          sender: 'runner'
        });
      }

      // 2. Add Actionable Rewrite Bubble
      if (data.proposedRewrite) {
        const rewriteText = data.proposedRewrite;
        
        actions.addMessage({
          id: Date.now().toString() + '_rewrite',
          text: rewriteText,
          sender: 'runner',
          isActionable: true,
          onAction: (action: 'send' | 'copy' | 'kinder') => {
            // Actions are handled by ChatScreen via onMakeKinder callback
            // This onAction is kept for compatibility but the actual logic is in ChatScreen
          }
        });
      }
    } else {
      // Message approved by AI - show as actionable so user can confirm
      // Use the text from response, or fallback to original text
      const approvedText = data.text || text;
      actions.addMessage({
        id: Date.now().toString() + '_approved',
        text: approvedText,
        sender: 'runner',
        isActionable: true,
        onAction: (action: 'send' | 'copy' | 'kinder') => {
          // Actions are handled by ChatScreen via onMakeKinder callback
          // This onAction is kept for compatibility but the actual logic is in ChatScreen
        }
      });
    }
  } catch (error) {
    console.error(error);
    actions.triggerError('Failed to send message');
  } finally {
    actions.setLoading(false);
  }
}

