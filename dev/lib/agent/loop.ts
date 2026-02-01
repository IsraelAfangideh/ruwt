import { streamText } from 'ai';
import { getOpenAIModel } from '@/lib/ai/providers/openai';
import { getAnthropicModel } from '@/lib/ai/providers/anthropic';
import { getModelPricing, calculateCost } from '@/lib/ai/pricing';
import type { AgentToolName } from './tools';
import { createToolExecutor } from './executor';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AgentConfig {
  model: string;
  maxIterations?: number;
  onToolCall?: (toolName: string, args: unknown) => void;
  onToolResult?: (toolName: string, result: unknown) => void;
  onContent?: (content: string) => void;
  onComplete?: (result: AgentResult) => void;
  onFileChange?: (path: string, content: string) => void;
  onCommandOutput?: (output: string) => void;
  onSubmit?: (entryFile: string) => Promise<{ passed: boolean; output: string }>;
}

export interface AgentResult {
  success: boolean;
  content: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  iterations: number;
  toolCalls: Array<{ toolName: string; args: unknown; result: unknown }>;
}

// Parse tool calls from model response
function parseToolCalls(content: string): Array<{ name: AgentToolName; args: Record<string, unknown> }> | null {
  // Look for JSON tool call format in the response
  const toolCallRegex = /```(?:json)?\s*\{[\s\S]*?"tool":\s*"(\w+)"[\s\S]*?\}\s*```/g;
  const matches = [...content.matchAll(toolCallRegex)];
  
  if (matches.length === 0) return null;
  
  const toolCalls: Array<{ name: AgentToolName; args: Record<string, unknown> }> = [];
  
  for (const match of matches) {
    try {
      const jsonStr = match[0].replace(/```(?:json)?/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      if (parsed.tool && parsed.args) {
        toolCalls.push({ name: parsed.tool as AgentToolName, args: parsed.args });
      }
    } catch {
      // Skip invalid JSON
    }
  }
  
  return toolCalls.length > 0 ? toolCalls : null;
}

export async function runAgentLoop(
  systemPrompt: string,
  userMessage: string,
  config: AgentConfig
): Promise<AgentResult> {
  const {
    model,
    maxIterations = 10,
    onToolCall,
    onToolResult,
    onContent,
    onComplete,
    onFileChange,
    onCommandOutput,
    onSubmit,
  } = config;

  const pricing = getModelPricing(model);
  if (!pricing) {
    throw new Error(`Unknown model: ${model}`);
  }

  // Create tool executor with callbacks
  const executor = createToolExecutor(onFileChange, onCommandOutput, onSubmit);

  // Build messages array
  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let iterations = 0;
  const allToolCalls: Array<{ toolName: string; args: unknown; result: unknown }> = [];
  let finalContent = '';

  // Select the AI model
  const aiModel = pricing.provider === 'openai'
    ? getOpenAIModel(model)
    : getAnthropicModel(model);

  // Agent loop
  while (iterations < maxIterations) {
    iterations++;

    // Call the model
    const result = await streamText({
      model: aiModel,
      messages,
    });

    // Collect response
    let contentBuffer = '';

    for await (const part of result.fullStream) {
      if (part.type === 'text-delta') {
        const text = 'text' in part ? part.text : '';
        contentBuffer += text;
        onContent?.(text);
      }
    }

    // Update token counts
    const usage = await result.usage;
    totalInputTokens += usage?.inputTokens || 0;
    totalOutputTokens += usage?.outputTokens || 0;

    finalContent = contentBuffer;

    // Parse any tool calls from the response
    const toolCalls = parseToolCalls(contentBuffer);
    
    if (!toolCalls) {
      // No tool calls, we're done
      messages.push({ role: 'assistant', content: contentBuffer });
      break;
    }

    // Execute tool calls
    for (const toolCall of toolCalls) {
      onToolCall?.(toolCall.name, toolCall.args);

      let toolResult;
      switch (toolCall.name) {
        case 'createFile':
          toolResult = await executor.createFile(
            (toolCall.args as { path: string; content: string }).path,
            (toolCall.args as { path: string; content: string }).content
          );
          break;
        case 'editFile':
          toolResult = await executor.editFile(
            (toolCall.args as { path: string; oldContent: string; newContent: string }).path,
            (toolCall.args as { path: string; oldContent: string; newContent: string }).oldContent,
            (toolCall.args as { path: string; oldContent: string; newContent: string }).newContent
          );
          break;
        case 'readFile':
          toolResult = await executor.readFile(
            (toolCall.args as { path: string }).path
          );
          break;
        case 'runCommand':
          toolResult = await executor.runCommand(
            (toolCall.args as { command: string }).command
          );
          break;
        case 'submitSolution':
          toolResult = await executor.submitSolution(
            (toolCall.args as { entryFile?: string }).entryFile || 'index.js'
          );
          break;
        default:
          toolResult = { success: false, error: `Unknown tool: ${toolCall.name}` };
      }

      onToolResult?.(toolCall.name, toolResult);
      allToolCalls.push({ toolName: toolCall.name, args: toolCall.args, result: toolResult });

      // If submit was called and passed, we're done
      if (toolCall.name === 'submitSolution' && toolResult.success) {
        const agentResult: AgentResult = {
          success: true,
          content: 'Solution submitted successfully!',
          totalInputTokens,
          totalOutputTokens,
          totalCost: calculateCost(model, totalInputTokens, totalOutputTokens),
          iterations,
          toolCalls: allToolCalls,
        };

        onComplete?.(agentResult);
        return agentResult;
      }

      // Add tool result to messages for next iteration
      messages.push({ role: 'assistant', content: contentBuffer });
      messages.push({ role: 'user', content: `Tool result for ${toolCall.name}: ${JSON.stringify(toolResult)}` });
    }
  }

  const agentResult: AgentResult = {
    success: false,
    content: finalContent || 'Agent completed without submitting a solution.',
    totalInputTokens,
    totalOutputTokens,
    totalCost: calculateCost(model, totalInputTokens, totalOutputTokens),
    iterations,
    toolCalls: allToolCalls,
  };

  onComplete?.(agentResult);
  return agentResult;
}

// Create system prompt for the agent
export function createAgentSystemPrompt(challengeDescription: string, constraints?: {
  maxTokens?: number;
  maxCost?: number;
  wallClockLimit?: number;
}): string {
  let prompt = `You are an AI coding assistant helping to solve a coding challenge.

## Challenge
${challengeDescription}

## Available Tools
To use a tool, output a JSON block in this format:
\`\`\`json
{"tool": "toolName", "args": {...}}
\`\`\`

Available tools:
- createFile: Create or overwrite a file. Args: {path: string, content: string}
- editFile: Edit part of a file. Args: {path: string, oldContent: string, newContent: string}
- readFile: Read a file. Args: {path: string}
- runCommand: Run a shell command. Args: {command: string}
- submitSolution: Submit for testing. Args: {entryFile?: string}

## Instructions
1. Analyze the challenge requirements carefully
2. Write clean, efficient code
3. Test your solution with runCommand before submitting
4. Use submitSolution when you believe your solution is correct
5. Be cost-efficient - minimize unnecessary tool calls

## Project Structure
- index.js: Your main solution file
- test.js: Test file (will be populated by the system)
- package.json: Project configuration
`;

  if (constraints) {
    prompt += '\n## Constraints\n';
    if (constraints.maxTokens) {
      prompt += `- Maximum tokens: ${constraints.maxTokens.toLocaleString()}\n`;
    }
    if (constraints.maxCost) {
      prompt += `- Maximum cost: $${(constraints.maxCost / 10000).toFixed(4)}\n`;
    }
    if (constraints.wallClockLimit) {
      prompt += `- Time limit: ${Math.floor(constraints.wallClockLimit / 60)} minutes\n`;
    }
  }

  return prompt;
}
