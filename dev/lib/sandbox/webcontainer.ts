import { WebContainer, type FileSystemTree } from '@webcontainer/api';

let webcontainerInstance: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;

export async function getWebContainer(): Promise<WebContainer> {
  if (webcontainerInstance) {
    return webcontainerInstance;
  }

  if (bootPromise) {
    return bootPromise;
  }

  bootPromise = WebContainer.boot();
  webcontainerInstance = await bootPromise;
  return webcontainerInstance;
}

export async function mountFiles(files: FileSystemTree): Promise<void> {
  const container = await getWebContainer();
  await container.mount(files);
}

export async function writeFile(path: string, content: string): Promise<void> {
  const container = await getWebContainer();
  await container.fs.writeFile(path, content);
}

export async function readFile(path: string): Promise<string> {
  const container = await getWebContainer();
  return await container.fs.readFile(path, 'utf-8');
}

export async function readDir(path: string): Promise<string[]> {
  const container = await getWebContainer();
  return await container.fs.readdir(path);
}

export async function mkdir(path: string): Promise<void> {
  const container = await getWebContainer();
  await container.fs.mkdir(path, { recursive: true });
}

export async function rm(path: string): Promise<void> {
  const container = await getWebContainer();
  await container.fs.rm(path, { recursive: true });
}

export interface SpawnResult {
  exit: Promise<number>;
  output: ReadableStream<string>;
}

export async function spawn(
  command: string,
  args: string[] = [],
  options?: { cwd?: string }
): Promise<SpawnResult> {
  const container = await getWebContainer();
  const process = await container.spawn(command, args, {
    cwd: options?.cwd,
  });

  return {
    exit: process.exit,
    output: process.output,
  };
}

export async function installDependencies(): Promise<SpawnResult> {
  return spawn('npm', ['install']);
}

export async function runCommand(command: string): Promise<SpawnResult> {
  const parts = command.split(' ');
  const cmd = parts[0];
  const args = parts.slice(1);
  return spawn(cmd, args);
}

// Default starter files for a new project
export const DEFAULT_FILES: FileSystemTree = {
  'package.json': {
    file: {
      contents: JSON.stringify(
        {
          name: 'ruwt-challenge',
          type: 'module',
          scripts: {
            start: 'node index.js',
            test: 'node test.js',
          },
        },
        null,
        2
      ),
    },
  },
  'index.js': {
    file: {
      contents: '// Write your solution here\n\nconsole.log("Hello, Ruwt!");\n',
    },
  },
  'test.js': {
    file: {
      contents: '// Test runner will be injected here\n',
    },
  },
};

export function createStarterFiles(starterCode?: string): FileSystemTree {
  if (!starterCode) {
    return DEFAULT_FILES;
  }

  return {
    ...DEFAULT_FILES,
    'index.js': {
      file: {
        contents: starterCode,
      },
    },
  };
}
