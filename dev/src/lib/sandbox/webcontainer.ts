import { WebContainer } from '@webcontainer/api';
import type { FileSystemTree } from '@webcontainer/api';

// stackblitz.com/headless 404s — use the working corp-production endpoint
(globalThis as any).WEBCONTAINER_API_IFRAME_URL = 'https://w-corp-production.stackblitz.io';

let instance: WebContainer | null = null;
let booting: Promise<WebContainer> | null = null;

const BOOT_TIMEOUT_MS = 30_000;

/** Get or boot the singleton WebContainer instance */
export async function getWebContainer(): Promise<WebContainer> {
  if (instance) return instance;
  if (booting) return booting;
  booting = Promise.race([
    WebContainer.boot(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('WebContainer boot timed out — check your network connection and try refreshing.')), BOOT_TIMEOUT_MS),
    ),
  ]);
  instance = await booting;
  booting = null;
  return instance;
}

/** Mount a file tree into the WebContainer */
export async function mountFiles(files: FileSystemTree): Promise<void> {
  const container = await getWebContainer();
  await container.mount(files);
}

/** Write a single file */
export async function writeFile(path: string, contents: string): Promise<void> {
  const container = await getWebContainer();
  await container.fs.writeFile(path, contents);
}

/** Read a single file */
export async function readFile(path: string): Promise<string> {
  const container = await getWebContainer();
  return await container.fs.readFile(path, 'utf-8');
}

/** Delete a file */
export async function deleteFile(path: string): Promise<void> {
  const container = await getWebContainer();
  await container.fs.rm(path);
}

/** List directory contents */
export async function listFiles(path: string = '.'): Promise<string[]> {
  const container = await getWebContainer();
  return await container.fs.readdir(path);
}

/** Create a directory */
export async function mkdir(path: string): Promise<void> {
  const container = await getWebContainer();
  await container.fs.mkdir(path, { recursive: true });
}

/** Spawn a process and return output stream + exit promise */
export async function spawn(command: string, args: string[] = []): Promise<{
  output: ReadableStream<string>;
  exit: Promise<number>;
}> {
  const container = await getWebContainer();
  const process = await container.spawn(command, args);
  return {
    output: process.output,
    exit: process.exit,
  };
}

/** Get a writable stream for process input (for terminal) */
export async function spawnWithInput(command: string, args: string[] = []): Promise<{
  output: ReadableStream<string>;
  input: WritableStream<string>;
  exit: Promise<number>;
}> {
  const container = await getWebContainer();
  const process = await container.spawn(command, args);
  return {
    output: process.output,
    input: process.input,
    exit: process.exit,
  };
}

/** Create starter files for a new project */
export function createStarterFiles(starterCode?: string): FileSystemTree {
  return {
    'package.json': {
      file: {
        contents: JSON.stringify({
          name: 'ruwt-project',
          version: '1.0.0',
          type: 'module',
          scripts: {
            start: 'node index.js',
            test: 'node test.js',
          },
        }, null, 2),
      },
    },
    'index.js': {
      file: {
        contents: starterCode || '// Welcome to Ruwt IDE\n// Start coding or clone a repo\n\nconsole.log(\'Hello, world!\');\n',
      },
    },
  };
}

/** Teardown -- only needed for testing */
export function _resetForTesting(): void {
  instance = null;
  booting = null;
}
