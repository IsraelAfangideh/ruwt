import { RespondChatResponse } from '@ruwt/shared';
import { Message } from '../../types/chat';
import { ChatActions, ToneSettings } from '../../types/runner';
import { RESPOND_MODULE_ENDPOINT } from './config';
import { mockFetch } from '../../services/mockApi';
import { getAnonymousUserId, getClientMeta } from '../../services/anonymousUserId';

export async function handleMessage(
  text: string,
  history: Message[],
  actions: ChatActions,
  tone: ToneSettings
): Promise<void> {
  if (!text.trim()) return;

  const historyForApi = history
    .filter(m => !m.isSystem && !m.isActionable)
    .map(m => ({
      role: m.sender === 'user' ? 'user' as const : 'model' as const,
      parts: [{ text: m.text }]
    }));

  actions.setLoading(true);

  try {
    const anonymousUserId = await getAnonymousUserId();
    const clientMeta = getClientMeta();
    const response = await mockFetch(RESPOND_MODULE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        userId: 'user_1',
        history: historyForApi,
        anonymousUserId,
        clientMeta,
        tone,
      })
    });

    if (!response.ok) {
      let errorMessage = 'Failed to send message';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        // Ignore JSON parse errors
      }
      actions.triggerError(errorMessage);
      return;
    }

    const data: RespondChatResponse = await response.json();

    if (data.isBlocked) {
      if (data.explanation) {
        actions.addMessage({
          id: Date.now().toString() + '_exp',
          text: data.explanation,
          sender: 'runner'
        });
      }

      if (data.proposedResponse) {
        actions.addMessage({
          id: Date.now().toString() + '_respond',
          text: data.proposedResponse,
          sender: 'runner',
          isActionable: true,
        });
      }
    } else {
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
