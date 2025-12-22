import { Message } from './chat';

export interface ChatActions {
  addMessage: (message: Message) => void;
  updateLastMessage: (text: string) => void;
  setLoading: (isLoading: boolean) => void;
  triggerError: (error: string) => void;
}

