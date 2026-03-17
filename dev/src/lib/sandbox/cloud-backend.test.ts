import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock WebSocket
// ---------------------------------------------------------------------------

type WSHandler = (event: { data: string }) => void;

interface MockWS {
  url: string;
  readyState: number;
  onopen: (() => void) | null;
  onclose: (() => void) | null;
  onerror: ((e: unknown) => void) | null;
  onmessage: WSHandler | null;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  simulateOpen: () => void;
  simulateMessage: (data: unknown) => void;
  simulateClose: () => void;
}

let mockWsInstance: MockWS;
const constructorSpy = vi.fn();

class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onmessage: WSHandler | null = null;
  send = vi.fn();
  close = vi.fn();

  constructor(url: string) {
    constructorSpy(url);
    this.url = url;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    const instance = this as unknown as MockWS;
    instance.simulateOpen = function () {
      self.readyState = 1;
      self.onopen?.();
    };
    instance.simulateMessage = function (data: unknown) {
      self.onmessage?.({ data: JSON.stringify(data) });
    };
    instance.simulateClose = function () {
      self.readyState = 3;
      self.onclose?.();
    };
    mockWsInstance = instance;
  }
}

vi.stubGlobal('WebSocket', MockWebSocket);

import { CloudBackend } from './cloud-backend';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CloudBackend', () => {
  let backend: CloudBackend;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Mock crypto.randomUUID
    let uuidCounter = 0;
    vi.stubGlobal('crypto', {
      randomUUID: () => `uuid-${++uuidCounter}`,
    });

    backend = new CloudBackend('wss://ruwt-cloud.fly.dev', 'test-token');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('has mode "cloud"', () => {
    expect(backend.mode).toBe('cloud');
  });

  it('constructs WebSocket with token in URL', () => {
    expect(constructorSpy).toHaveBeenCalledWith(
      'wss://ruwt-cloud.fly.dev?token=test-token',
    );
  });

  it('appends token with & when URL already has query params', () => {
    constructorSpy.mockClear();
    new CloudBackend('wss://ruwt-cloud.fly.dev?foo=bar', 'my-token');
    expect(constructorSpy).toHaveBeenCalledWith(
      'wss://ruwt-cloud.fly.dev?foo=bar&token=my-token',
    );
  });

  describe('waitForConnection', () => {
    it('resolves when WebSocket opens', async () => {
      const promise = backend.waitForConnection();
      mockWsInstance.simulateOpen();
      await expect(promise).resolves.toBeUndefined();
      expect(backend.connected).toBe(true);
    });
  });

  describe('disconnect', () => {
    it('closes the WebSocket', () => {
      mockWsInstance.simulateOpen();
      backend.disconnect();
      expect(mockWsInstance.close).toHaveBeenCalled();
      expect(backend.connected).toBe(false);
    });
  });

  describe('readFile', () => {
    it('sends fs RPC and resolves with result', async () => {
      mockWsInstance.simulateOpen();

      const promise = backend.readFile('index.js');

      // Find the fs message (skip heartbeat)
      const fsCalls = mockWsInstance.send.mock.calls.filter((c: string[]) => {
        try { return JSON.parse(c[0]).type === 'fs'; } catch { return false; }
      });
      expect(fsCalls.length).toBe(1);
      const sentMsg = JSON.parse(fsCalls[0][0]);
      expect(sentMsg.op).toBe('readFile');
      expect(sentMsg.path).toBe('index.js');

      mockWsInstance.simulateMessage({
        type: 'fs_response',
        id: sentMsg.id,
        result: 'file content',
      });

      await expect(promise).resolves.toBe('file content');
    });

    it('rejects when response has error', async () => {
      mockWsInstance.simulateOpen();

      const promise = backend.readFile('missing.js');

      const fsCalls = mockWsInstance.send.mock.calls.filter((c: string[]) => {
        try { return JSON.parse(c[0]).type === 'fs'; } catch { return false; }
      });
      const sentMsg = JSON.parse(fsCalls[0][0]);
      mockWsInstance.simulateMessage({
        type: 'fs_response',
        id: sentMsg.id,
        error: 'ENOENT',
      });

      await expect(promise).rejects.toThrow('ENOENT');
    });

    it('rejects on RPC timeout', async () => {
      mockWsInstance.simulateOpen();

      const promise = backend.readFile('slow.js');
      vi.advanceTimersByTime(31_000);

      await expect(promise).rejects.toThrow('RPC timeout');
    });
  });

  describe('writeFile', () => {
    it('sends writeFile RPC', async () => {
      mockWsInstance.simulateOpen();

      const promise = backend.writeFile('index.js', 'new code');

      const fsCalls = mockWsInstance.send.mock.calls.filter((c: string[]) => {
        try { return JSON.parse(c[0]).type === 'fs'; } catch { return false; }
      });
      const sentMsg = JSON.parse(fsCalls[0][0]);
      expect(sentMsg.op).toBe('writeFile');
      expect(sentMsg.content).toBe('new code');

      mockWsInstance.simulateMessage({ type: 'fs_response', id: sentMsg.id, result: 'ok' });
      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe('readdir', () => {
    it('sends readdir RPC', async () => {
      mockWsInstance.simulateOpen();

      const promise = backend.readdir('.');

      const fsCalls = mockWsInstance.send.mock.calls.filter((c: string[]) => {
        try { return JSON.parse(c[0]).type === 'fs'; } catch { return false; }
      });
      const sentMsg = JSON.parse(fsCalls[0][0]);
      expect(sentMsg.op).toBe('readdir');

      mockWsInstance.simulateMessage({ type: 'fs_response', id: sentMsg.id, result: ['a.js', 'b.js'] });
      await expect(promise).resolves.toEqual(['a.js', 'b.js']);
    });
  });

  describe('mkdir', () => {
    it('sends mkdir RPC', async () => {
      mockWsInstance.simulateOpen();

      const promise = backend.mkdir('src/lib');

      const fsCalls = mockWsInstance.send.mock.calls.filter((c: string[]) => {
        try { return JSON.parse(c[0]).type === 'fs'; } catch { return false; }
      });
      const sentMsg = JSON.parse(fsCalls[0][0]);
      expect(sentMsg.op).toBe('mkdir');

      mockWsInstance.simulateMessage({ type: 'fs_response', id: sentMsg.id, result: 'ok' });
      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe('rm', () => {
    it('sends rm RPC', async () => {
      mockWsInstance.simulateOpen();

      const promise = backend.rm('old.js');

      const fsCalls = mockWsInstance.send.mock.calls.filter((c: string[]) => {
        try { return JSON.parse(c[0]).type === 'fs'; } catch { return false; }
      });
      const sentMsg = JSON.parse(fsCalls[0][0]);
      expect(sentMsg.op).toBe('rm');

      mockWsInstance.simulateMessage({ type: 'fs_response', id: sentMsg.id, result: 'ok' });
      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe('stat', () => {
    it('sends stat RPC', async () => {
      mockWsInstance.simulateOpen();

      const promise = backend.stat('index.js');

      const fsCalls = mockWsInstance.send.mock.calls.filter((c: string[]) => {
        try { return JSON.parse(c[0]).type === 'fs'; } catch { return false; }
      });
      const sentMsg = JSON.parse(fsCalls[0][0]);
      expect(sentMsg.op).toBe('stat');

      mockWsInstance.simulateMessage({
        type: 'fs_response',
        id: sentMsg.id,
        result: { isFile: true, isDirectory: false, size: 42 },
      });

      const result = await promise;
      expect(result.isFile).toBe(true);
      expect(result.size).toBe(42);
    });
  });

  describe('connectTerminal', () => {
    it('returns a terminal connection', () => {
      mockWsInstance.simulateOpen();
      const onData = vi.fn();
      const conn = backend.connectTerminal(onData);

      expect(typeof conn.write).toBe('function');
      expect(typeof conn.resize).toBe('function');
      expect(typeof conn.disconnect).toBe('function');
    });

    it('routes terminal messages to onData callback', () => {
      mockWsInstance.simulateOpen();
      const onData = vi.fn();
      backend.connectTerminal(onData);

      mockWsInstance.simulateMessage({ type: 'terminal', data: 'hello' });
      expect(onData).toHaveBeenCalledWith('hello');
    });

    it('sends terminal input via WebSocket', () => {
      mockWsInstance.simulateOpen();
      const onData = vi.fn();
      const conn = backend.connectTerminal(onData);

      conn.write('ls\n');

      const termMsg = mockWsInstance.send.mock.calls.find((c: string[]) => {
        try { return JSON.parse(c[0]).type === 'terminal'; } catch { return false; }
      });
      expect(termMsg).toBeDefined();
      expect(JSON.parse(termMsg![0]).data).toBe('ls\n');
    });

    it('sends resize messages', () => {
      mockWsInstance.simulateOpen();
      const onData = vi.fn();
      const conn = backend.connectTerminal(onData);

      conn.resize(120, 40);

      const resizeMsg = mockWsInstance.send.mock.calls.find((c: string[]) => {
        try { return JSON.parse(c[0]).type === 'resize'; } catch { return false; }
      });
      expect(resizeMsg).toBeDefined();
      const parsed = JSON.parse(resizeMsg![0]);
      expect(parsed.cols).toBe(120);
      expect(parsed.rows).toBe(40);
    });

    it('disconnect removes the listener', () => {
      mockWsInstance.simulateOpen();
      const onData = vi.fn();
      const conn = backend.connectTerminal(onData);

      conn.disconnect();
      mockWsInstance.simulateMessage({ type: 'terminal', data: 'after disconnect' });
      expect(onData).not.toHaveBeenCalled();
    });

    it('routes shell_exit to listeners', () => {
      mockWsInstance.simulateOpen();
      const onData = vi.fn();
      backend.connectTerminal(onData);

      mockWsInstance.simulateMessage({ type: 'shell_exit' });
      expect(onData).toHaveBeenCalledWith('\r\n[Process exited]\r\n');
    });
  });

  describe('heartbeat', () => {
    it('sends heartbeat messages at interval after connection', () => {
      mockWsInstance.simulateOpen();

      vi.advanceTimersByTime(30_000);

      const heartbeatMsgs = mockWsInstance.send.mock.calls.filter((c: string[]) => {
        try { return JSON.parse(c[0]).type === 'heartbeat'; } catch { return false; }
      });
      expect(heartbeatMsgs.length).toBeGreaterThanOrEqual(1);
    });

    it('handles heartbeat response without error', () => {
      mockWsInstance.simulateOpen();
      expect(() => {
        mockWsInstance.simulateMessage({ type: 'heartbeat', ts: Date.now() });
      }).not.toThrow();
    });
  });

  describe('WebSocket close', () => {
    it('rejects pending requests when WebSocket closes', async () => {
      mockWsInstance.simulateOpen();

      const promise = backend.readFile('index.js');
      mockWsInstance.simulateClose();

      await expect(promise).rejects.toThrow('WebSocket closed');
    });

    it('sets connected to false on close', () => {
      mockWsInstance.simulateOpen();
      expect(backend.connected).toBe(true);

      mockWsInstance.simulateClose();
      expect(backend.connected).toBe(false);
    });
  });

  describe('spawn', () => {
    it('sends command through terminal', async () => {
      mockWsInstance.simulateOpen();

      backend.spawn('npm', ['test']);

      const termMsg = mockWsInstance.send.mock.calls.find((c: string[]) => {
        try {
          const msg = JSON.parse(c[0]);
          return msg.type === 'terminal' && msg.data.includes('npm test');
        } catch {
          return false;
        }
      });
      expect(termMsg).toBeDefined();
    });
  });

  describe('malformed messages', () => {
    it('handles non-JSON messages gracefully', () => {
      mockWsInstance.simulateOpen();
      expect(() => {
        mockWsInstance.onmessage?.({ data: 'not json' });
      }).not.toThrow();
    });

    it('handles fs_response for unknown request ID', () => {
      mockWsInstance.simulateOpen();
      expect(() => {
        mockWsInstance.simulateMessage({
          type: 'fs_response',
          id: 'unknown-id',
          result: 'ok',
        });
      }).not.toThrow();
    });
  });
});
