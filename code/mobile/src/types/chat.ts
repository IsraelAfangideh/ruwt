export type Message = {
  id: string;
  text: string;
  sender: 'user' | 'runner';
  isSystem?: boolean; 
  // New fields for actionable bubbles
  isActionable?: boolean; // Is this a "Proposed Rewrite" bubble?
  onAction?: (action: 'send' | 'copy' | 'kinder') => void;
};

export type BlockedState = {
  originalText: string;
  proposedRewrite: string;
  explanation: string;
};
