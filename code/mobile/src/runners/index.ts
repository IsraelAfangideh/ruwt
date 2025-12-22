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
  id: string;
  Bubble: React.ComponentType<{ item: Message; onMakeKinder?: (rewriteText: string) => void }>;
  Input: React.ComponentType<InputProps>;
  endpoint: string;
  handleMessage: (text: string, history: Message[], actions: ChatActions) => Promise<void>;
}

const runners: Map<string, RunnerModule> = new Map();

export function registerRunnerModule(module: RunnerModule): void {
  runners.set(module.id, module);
}

export function getRunnerModule(runnerId: string): RunnerModule | null {
  return runners.get(runnerId) || null;
}

// Register the rewrite module
import rewriteModule from './rewrite';
registerRunnerModule(rewriteModule);

