/**
 * Runner Module System
 * 
 * Each runner provides its own Bubble and Input components.
 * ChatScreen uses these dynamically based on the selected runner.
 */
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

// Bubble props - each runner's Bubble component receives these from ChatScreen
export type BubbleProps = {
  item: Message;
  isCopied?: boolean;
  // Runner-specific callbacks (Rewrite uses onMakeKinder, others might differ)
  onMakeKinder?: (rewriteText: string) => void;
  // User message interaction
  onUserLongPress?: (item: Message) => void;
  isSelected?: boolean;
  onRepeat?: () => void;
  onCopy?: () => void;
  onDismiss?: () => void;
};

export interface RunnerModule {
  name: string;
  Bubble: React.ComponentType<BubbleProps>;
  Input: React.ComponentType<InputProps>;
  endpoint: string;
  handleMessage: (text: string, history: Message[], actions: ChatActions) => Promise<void>;
}

const modules: Map<string, RunnerModule> = new Map();

export function registerRunnerModule(module: RunnerModule): void {
  modules.set(module.name, module);
}

export const getRunnerModule = (runnerName: string): RunnerModule | undefined => modules.get(runnerName);

// Register all runners
import rewriteModule from './rewrite';
registerRunnerModule(rewriteModule);
