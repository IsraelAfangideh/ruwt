import React from 'react';
import { Message } from '../types/chat';
import { ChatActions } from '../types/runner';

// Input props type (matching BaseInput)
export type InputProps = {
  input: string;
  isLoading: boolean;
  onChangeText: (text: string) => void;
  onSend: () => void;
};

export interface RunnerModule {
  name: string;
  Bubble: React.ComponentType<{ item: Message; onMakeKinder?: (rewriteText: string) => void }>;
  Input: React.ComponentType<InputProps>;
  endpoint: string;
  handleMessage: (text: string, history: Message[], actions: ChatActions) => Promise<void>;
}

const modules: Map<string, RunnerModule> = new Map();

export function registerRunnerModule(module: RunnerModule): void {
  modules.set(module.name, module);
}

export const getRunnerModule = (runnerName: string): RunnerModule | undefined => modules.get(runnerName);

import rewriteModule from './rewrite';
registerRunnerModule(rewriteModule);
