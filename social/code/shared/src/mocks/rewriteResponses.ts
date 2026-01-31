import { RewriteChatResponse } from '../index';

/**
 * Mock response for a blocked message (message that needs rewriting)
 */
export const MOCK_BLOCKED_RESPONSE: RewriteChatResponse = {
  text: `[EXPLANATION]
This feels a bit sharp. Let's add some warmth to it.
[REWRITE]
I am feeling a bit overwhelmed right now, can we talk later?
[END]`,
  isBlocked: true,
  explanation: 'This feels a bit sharp. Let\'s add some warmth to it.',
  proposedRewrite: 'I am feeling a bit overwhelmed right now, can we talk later?',
};

/**
 * Mock response for an already kind message (still blocked but with encouragement)
 */
export const MOCK_BLOCKED_KIND_RESPONSE: RewriteChatResponse = {
  text: `[EXPLANATION]
This is beautiful! But let's make it absolute poetry.
[REWRITE]
I cherish you deeply, and my heart overflows with gratitude for having you in my life.
[END]`,
  isBlocked: true,
  explanation: 'This is beautiful! But let\'s make it absolute poetry.',
  proposedRewrite: 'I cherish you deeply, and my heart overflows with gratitude for having you in my life.',
};

/**
 * Mock response for an approved message (message passes without blocking)
 */
export const MOCK_APPROVED_RESPONSE: RewriteChatResponse = {
  text: 'I appreciate your patience and understanding.',
  isBlocked: false,
};

/**
 * Mock error response
 */
export const MOCK_ERROR_RESPONSE: RewriteChatResponse = {
  text: 'An error occurred while processing your message.',
  isBlocked: false,
};


