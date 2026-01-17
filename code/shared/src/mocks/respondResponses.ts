import { RespondChatResponse } from '../index';

/**
 * Mock response for Respond runner
 */
export const MOCK_RESPOND_RESPONSE: RespondChatResponse = {
  text: '{"explanation":"Keep it brief and warm.","response":"Thanks for the update. I will review this today and get back to you."}',
  isBlocked: true,
  explanation: 'Keep it brief and warm.',
  proposedResponse: 'Thanks for the update. I will review this today and get back to you.',
};

/**
 * Mock error response
 */
export const MOCK_RESPOND_ERROR_RESPONSE: RespondChatResponse = {
  text: 'An error occurred while processing your message.',
  isBlocked: false,
};
