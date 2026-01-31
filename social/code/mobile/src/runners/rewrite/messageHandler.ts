import { RewriteChatResponse } from '@ruwt/shared';
import { Message } from '../../types/chat';
import { ChatActions, ToneSettings } from '../../types/runner';
import { REWRITE_MODULE_ENDPOINT } from './config';
import { mockFetch } from '../../services/mockApi';
import { getAnonymousUserId, getClientMeta } from '../../services/anonymousUserId';

export async function handleMessage(
  text: string,
  history: Message[],
  actions: ChatActions,
  tone: ToneSettings
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
    const anonymousUserId = await getAnonymousUserId();
    const clientMeta = getClientMeta();
    const response = await mockFetch(REWRITE_MODULE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        userId: 'user_1', // Hardcoded for prototype
        history: historyForApi,
        anonymousUserId,
        clientMeta,
        tone,
      })
    });

    // Check if response is an error
    if (!response.ok) {
      let errorMessage = 'Failed to send message';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        // If JSON parsing fails, use default message
      }
      actions.triggerError(errorMessage);
      return;
    }

    const data: RewriteChatResponse = await response.json();

    if (data.isBlocked) {
      // 1. Add Explanation Bubble
      if (data.explanation) {
        actions.addMessage({
          id: Date.now().toString() + '_exp',
          text: data.explanation,
          sender: 'runner'
        });
      }

      // 2. Add Actionable Rewrite Bubble
      if (data.proposedRewrite) {
        actions.addMessage({
          id: Date.now().toString() + '_rewrite',
          text: data.proposedRewrite,
          sender: 'runner',
          isActionable: true,
        });
      }
    } else {
      // Message approved by AI - show as actionable so user can confirm
      actions.addMessage({
        id: Date.now().toString() + '_approved',
        text: data.text,
        sender: 'runner',
        isActionable: true,
      });
    }
  } catch (error) {
    console.error(error);
    actions.triggerError('Failed to send message');
  } finally {
    actions.setLoading(false);
  }
}

