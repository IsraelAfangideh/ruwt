import RewriteBubble from './RewriteBubble';
import RewriteInput from './RewriteInput';
import { handleMessage } from './messageHandler';
import { REWRITE_MODULE_NAME, REWRITE_MODULE_ENDPOINT } from './config';
import { type RunnerModule } from '../index';

export const rewriteModule: RunnerModule = {
  name: REWRITE_MODULE_NAME,
  Bubble: RewriteBubble,
  Input: RewriteInput,
  endpoint: REWRITE_MODULE_ENDPOINT,
  handleMessage,
};

export default rewriteModule;

