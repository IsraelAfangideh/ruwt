import RewriteBubble from './RewriteBubble';
import RewriteInput from './RewriteInput';
import { handleMessage } from './messageHandler';
import { REWRITE_RUNNER_ID, REWRITE_ENDPOINT } from './config';
import { RunnerModule } from '../index';

export const rewriteModule: RunnerModule = {
  id: REWRITE_RUNNER_ID,
  Bubble: RewriteBubble,
  Input: RewriteInput,
  endpoint: REWRITE_ENDPOINT,
  handleMessage,
};

export default rewriteModule;

