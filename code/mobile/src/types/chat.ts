export type Message = {
  id: string;
  text: string;
  sender: 'user' | 'runner';
  isSystem?: boolean; 
};

export type BlockedState = {
  originalText: string;
  proposedRewrite: string;
  explanation: string;
};

