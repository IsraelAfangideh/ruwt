import RespondBubble from './RespondBubble';
import RespondInput from './RespondInput';
import { handleMessage } from './messageHandler';
import { RESPOND_MODULE_NAME, RESPOND_MODULE_ENDPOINT } from './config';
import { type RunnerModule } from '../index';

export const respondModule: RunnerModule = {
  name: RESPOND_MODULE_NAME,
  Bubble: RespondBubble,
  Input: RespondInput,
  endpoint: RESPOND_MODULE_ENDPOINT,
  handleMessage,
};

export default respondModule;
