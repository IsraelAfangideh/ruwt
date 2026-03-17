/**
 * Cloud Mode backend: implements RuntimeBackend via WebSocket to a Fly Machine bridge.
 *
 * All filesystem and terminal operations are sent as JSON-RPC messages over a single
 * WebSocket connection. The bridge server on the Fly Machine handles the actual I/O.
 */
import type { RuntimeBackend, FileStat, ProcessHandle, TerminalConnection } from './runtime';

/** Timeout for RPC calls (ms). */
const RPC_TIMEOUT = 30_000;

/** Heartbeat interval (ms). */
const HEARTBEAT_INTERVAL = 30_000;

export class CloudBackend implements RuntimeBackend {
  readonly mode = 'cloud' as const;

  private ws: WebSocket;
  private pendingRequests = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  private terminalListeners = new Set<(data: string) => void>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private _connected = false;
  private _connectPromise: Promise<void>;

  constructor(wsUrl: string, token: string) {
    const url = `${wsUrl}${wsUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
    this.ws = new WebSocket(url);

    this._connectPromise = new Promise<void>((resolve, reject) => {
      this.ws.onopen = () => {
        this._connected = true;
        this.startHeartbeat();
        resolve();
      };
      this.ws.onerror = () => {
        /* istanbul ignore next -- @preserve */
        if (!this._connected) reject(new Error('WebSocket connection failed'));
      };
    });

    this.ws.onmessage = this.handleMessage.bind(this);

    this.ws.onclose = () => {
      this._connected = false;
      this.stopHeartbeat();
      // Reject all pending requests
      for (const [id, pending] of this.pendingRequests) {
        pending.reject(new Error('WebSocket closed'));
        this.pendingRequests.delete(id);
      }
    };
  }

  /** Wait for the WebSocket connection to be established. */
  async waitForConnection(): Promise<void> {
    return this._connectPromise;
  }

  /** Whether the WebSocket is currently connected. */
  get connected(): boolean {
    return this._connected;
  }

  /** Disconnect and clean up. */
  disconnect(): void {
    this.stopHeartbeat();
    this._connected = false;
    if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
      this.ws.close();
    }
  }

  // ── Filesystem ────────────────────────────────────────────────────────

  async readFile(path: string): Promise<string> {
    return this.rpc('readFile', { path });
  }

  async writeFile(path: string, content: string): Promise<void> {
    await this.rpc('writeFile', { path, content });
  }

  async readdir(path: string): Promise<string[]> {
    return this.rpc('readdir', { path });
  }

  async mkdir(path: string): Promise<void> {
    await this.rpc('mkdir', { path });
  }

  async rm(path: string): Promise<void> {
    await this.rpc('rm', { path });
  }

  async stat(path: string): Promise<FileStat> {
    return this.rpc('stat', { path });
  }

  // ── Process ───────────────────────────────────────────────────────────

  async spawn(command: string, args: string[] = []): Promise<ProcessHandle> {
    // For Cloud Mode, process execution goes through the terminal.
    // This is a simplified implementation — the bridge could support
    // a dedicated spawn protocol in the future.
    const fullCommand = [command, ...args].join(' ');

    // Create a ReadableStream that captures terminal output
    let outputController: ReadableStreamDefaultController<string> | null = null;
    const output = new ReadableStream<string>({
      start(controller) {
        outputController = controller;
      },
    });

    const listener = (data: string) => {
      outputController?.enqueue(data);
    };
    this.terminalListeners.add(listener);

    // Send the command via terminal
    this.sendTerminal(fullCommand + '\n');

    // Simple exit promise — Cloud Mode doesn't have structured process exit tracking yet
    const exit = new Promise<number>((resolve) => {
      // Resolve after a generous timeout; real implementation would parse shell prompt
      setTimeout(() => {
        this.terminalListeners.delete(listener);
        outputController?.close();
        resolve(0);
      }, 60_000);
    });

    return { output, exit };
  }

  // ── Terminal ──────────────────────────────────────────────────────────

  connectTerminal(onData: (data: string) => void): TerminalConnection {
    this.terminalListeners.add(onData);

    return {
      write: (data: string) => {
        this.sendTerminal(data);
      },
      resize: (cols: number, rows: number) => {
        this.sendJson({ type: 'resize', cols, rows });
      },
      disconnect: () => {
        this.terminalListeners.delete(onData);
      },
    };
  }

  // ── Internal ──────────────────────────────────────────────────────────

  private handleMessage(event: MessageEvent): void {
    let msg: any;
    try {
      msg = JSON.parse(typeof event.data === 'string' ? event.data : event.data.toString());
    } catch {
      return;
    }

    switch (msg.type) {
      case 'fs_response': {
        const pending = this.pendingRequests.get(msg.id);
        if (pending) {
          this.pendingRequests.delete(msg.id);
          if (msg.error) {
            pending.reject(new Error(msg.error));
          } else {
            pending.resolve(msg.result);
          }
        }
        break;
      }
      case 'terminal': {
        for (const listener of this.terminalListeners) {
          listener(msg.data);
        }
        break;
      }
      case 'shell_exit': {
        // Shell exited; notify terminal listeners
        for (const listener of this.terminalListeners) {
          listener('\r\n[Process exited]\r\n');
        }
        break;
      }
      case 'heartbeat': {
        // Heartbeat acknowledged — connection is alive
        break;
      }
    }
  }

  private rpc(op: string, params: Record<string, unknown>): Promise<any> {
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`RPC timeout: ${op}`));
      }, RPC_TIMEOUT);

      this.pendingRequests.set(id, {
        resolve: (v: any) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e: Error) => {
          clearTimeout(timer);
          reject(e);
        },
      });

      this.sendJson({ type: 'fs', id, op, ...params });
    });
  }

  private sendJson(data: unknown): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private sendTerminal(data: string): void {
    this.sendJson({ type: 'terminal', data });
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.sendJson({ type: 'heartbeat' });
    }, HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
