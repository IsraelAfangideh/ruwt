import { z } from 'zod';

// Tool schemas
export const createFileSchema = z.object({
  path: z.string().describe('The file path relative to the project root'),
  content: z.string().describe('The content to write to the file'),
});

export const editFileSchema = z.object({
  path: z.string().describe('The file path to edit'),
  oldContent: z.string().describe('The exact content to find and replace'),
  newContent: z.string().describe('The new content to replace with'),
});

export const readFileSchema = z.object({
  path: z.string().describe('The file path to read'),
});

export const runCommandSchema = z.object({
  command: z.string().describe('The shell command to execute'),
});

export const submitSolutionSchema = z.object({
  entryFile: z.string().default('index.js').describe('The main entry file to test'),
});

// Tool result types
export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
}

// Tool definitions for AI models
export const agentTools = {
  createFile: {
    description: 'Create a new file or overwrite an existing file with the given content',
    parameters: createFileSchema,
  },
  editFile: {
    description: 'Edit a file by replacing specific content. Use this for targeted changes.',
    parameters: editFileSchema,
  },
  readFile: {
    description: 'Read the contents of a file',
    parameters: readFileSchema,
  },
  runCommand: {
    description: 'Run a shell command in the project directory. Use for npm install, running tests, etc.',
    parameters: runCommandSchema,
  },
  submitSolution: {
    description: 'Submit the current solution for evaluation. Only use when you believe the solution is complete.',
    parameters: submitSolutionSchema,
  },
};

export type AgentToolName = keyof typeof agentTools;
export type AgentToolCall = {
  toolName: AgentToolName;
  args: unknown;
};
