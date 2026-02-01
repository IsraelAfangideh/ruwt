import {
  writeFile,
  readFile,
  runCommand,
  type SpawnResult,
} from '@/lib/sandbox/webcontainer';
import type { ToolResult } from './tools';

export interface ToolExecutor {
  createFile: (path: string, content: string) => Promise<ToolResult>;
  editFile: (path: string, oldContent: string, newContent: string) => Promise<ToolResult>;
  readFile: (path: string) => Promise<ToolResult>;
  runCommand: (command: string) => Promise<ToolResult>;
  submitSolution: (entryFile: string) => Promise<ToolResult>;
}

export function createToolExecutor(
  onFileChange?: (path: string, content: string) => void,
  onCommandOutput?: (output: string) => void,
  onSubmit?: (entryFile: string) => Promise<{ passed: boolean; output: string }>
): ToolExecutor {
  return {
    async createFile(path: string, content: string): Promise<ToolResult> {
      try {
        await writeFile(path, content);
        onFileChange?.(path, content);
        return { success: true, output: `Created file: ${path}` };
      } catch (error) {
        return {
          success: false,
          error: `Failed to create file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },

    async editFile(path: string, oldContent: string, newContent: string): Promise<ToolResult> {
      try {
        const currentContent = await readFile(path);
        
        if (!currentContent.includes(oldContent)) {
          return {
            success: false,
            error: `Could not find the specified content in ${path}. Make sure the oldContent matches exactly.`,
          };
        }

        const updatedContent = currentContent.replace(oldContent, newContent);
        await writeFile(path, updatedContent);
        onFileChange?.(path, updatedContent);
        return { success: true, output: `Edited file: ${path}` };
      } catch (error) {
        return {
          success: false,
          error: `Failed to edit file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },

    async readFile(path: string): Promise<ToolResult> {
      try {
        const content = await readFile(path);
        return { success: true, output: content };
      } catch (error) {
        return {
          success: false,
          error: `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },

    async runCommand(command: string): Promise<ToolResult> {
      try {
        const result: SpawnResult = await runCommand(command);
        
        // Collect output
        let output = '';
        const reader = result.output.getReader();
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          output += value;
          onCommandOutput?.(value);
        }

        const exitCode = await result.exit;
        
        if (exitCode !== 0) {
          return {
            success: false,
            error: `Command failed with exit code ${exitCode}\n${output}`,
          };
        }

        return { success: true, output };
      } catch (error) {
        return {
          success: false,
          error: `Failed to run command: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },

    async submitSolution(entryFile: string): Promise<ToolResult> {
      if (!onSubmit) {
        return {
          success: false,
          error: 'Submission handler not configured',
        };
      }

      try {
        const result = await onSubmit(entryFile);
        return {
          success: result.passed,
          output: result.output,
          error: result.passed ? undefined : result.output,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to submit: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  };
}
