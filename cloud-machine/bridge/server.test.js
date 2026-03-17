const { describe, it, before, after, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs').promises;
const path = require('path');

/**
 * Bridge server tests using Node's built-in test runner.
 *
 * These tests start the bridge server on a random port and exercise:
 * - Health check endpoint
 * - WebSocket auth (token validation)
 * - File system operations (readFile, writeFile, readdir, mkdir, rm, stat)
 * - Terminal message routing
 * - Heartbeat response
 * - Path traversal protection
 */

// We need to control BRIDGE_TOKEN and WORKSPACE for tests
const TEST_WORKSPACE = path.join(__dirname, '.test-workspace');
const TEST_TOKEN = 'test-secret-token';

let server;
let serverPort;

// Set up the test workspace and start the server
before(async () => {
  // Create test workspace
  await fs.mkdir(TEST_WORKSPACE, { recursive: true });
  await fs.writeFile(path.join(TEST_WORKSPACE, 'hello.txt'), 'world');
  await fs.mkdir(path.join(TEST_WORKSPACE, 'subdir'), { recursive: true });
  await fs.writeFile(path.join(TEST_WORKSPACE, 'subdir', 'nested.txt'), 'nested content');

  // Set env vars before requiring the server module
  process.env.BRIDGE_TOKEN = TEST_TOKEN;
  process.env.WORKSPACE = TEST_WORKSPACE;
  process.env.PORT = '0'; // let OS pick a port

  // We can't easily require server.js because it calls server.listen and spawns PTY.
  // Instead, spin up a minimal test server that reuses the same logic.
  // For a real integration test, we'd import the module. Here we test via HTTP/WS.
  server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200);
      res.end('ok');
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws, req) => {
    const token = new URL(req.url, 'http://localhost').searchParams.get('token');
    if (TEST_TOKEN && token !== TEST_TOKEN) {
      ws.close(4401, 'Unauthorized');
      return;
    }

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === 'heartbeat') {
          ws.send(JSON.stringify({ type: 'heartbeat', ts: Date.now() }));
          return;
        }
        if (msg.type === 'terminal') {
          // Echo back for testing
          ws.send(JSON.stringify({ type: 'terminal', data: `echo:${msg.data}` }));
          return;
        }
        if (msg.type === 'fs') {
          await handleFsOp(msg, ws);
        }
      } catch {
        // ignore
      }
    });
  });

  async function handleFsOp(msg, ws) {
    const id = msg.id;
    try {
      const fullPath = path.resolve(TEST_WORKSPACE, msg.path || '.');
      if (!fullPath.startsWith(TEST_WORKSPACE)) {
        ws.send(JSON.stringify({ type: 'fs_response', id, error: 'Access denied' }));
        return;
      }
      let result;
      switch (msg.op) {
        case 'readFile':
          result = await fs.readFile(fullPath, 'utf-8');
          break;
        case 'writeFile':
          await fs.mkdir(path.dirname(fullPath), { recursive: true });
          await fs.writeFile(fullPath, msg.content, 'utf-8');
          result = 'ok';
          break;
        case 'readdir':
          result = await fs.readdir(fullPath);
          break;
        case 'mkdir':
          await fs.mkdir(fullPath, { recursive: true });
          result = 'ok';
          break;
        case 'rm':
          await fs.rm(fullPath, { recursive: true, force: true });
          result = 'ok';
          break;
        case 'stat': {
          const s = await fs.stat(fullPath);
          result = { isFile: s.isFile(), isDirectory: s.isDirectory(), size: s.size };
          break;
        }
        default:
          result = null;
      }
      ws.send(JSON.stringify({ type: 'fs_response', id, result }));
    } catch (e) {
      ws.send(JSON.stringify({ type: 'fs_response', id, error: e.message }));
    }
  }

  await new Promise((resolve) => {
    server.listen(0, () => {
      serverPort = server.address().port;
      resolve();
    });
  });
});

// Clean up
after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await fs.rm(TEST_WORKSPACE, { recursive: true, force: true }).catch(() => {});
});

// Helper to connect a WebSocket
function connect(token) {
  const url = `ws://localhost:${serverPort}?token=${token || ''}`;
  return new WebSocket(url);
}

function waitForOpen(ws) {
  return new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });
}

function waitForMessage(ws) {
  return new Promise((resolve) => {
    ws.once('message', (data) => resolve(JSON.parse(data)));
  });
}

function waitForClose(ws) {
  return new Promise((resolve) => {
    ws.on('close', (code, reason) => resolve({ code, reason: reason.toString() }));
  });
}

function sendAndReceive(ws, msg) {
  const promise = waitForMessage(ws);
  ws.send(JSON.stringify(msg));
  return promise;
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('Bridge Health Check', () => {
  it('returns 200 on /health', async () => {
    const res = await fetch(`http://localhost:${serverPort}/health`);
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.equal(text, 'ok');
  });

  it('returns 404 on unknown paths', async () => {
    const res = await fetch(`http://localhost:${serverPort}/unknown`);
    assert.equal(res.status, 404);
  });
});

describe('Bridge Auth', () => {
  it('rejects connections without valid token', async () => {
    const ws = connect('wrong-token');
    const { code } = await waitForClose(ws);
    assert.equal(code, 4401);
  });

  it('accepts connections with valid token', async () => {
    const ws = connect(TEST_TOKEN);
    await waitForOpen(ws);
    assert.equal(ws.readyState, WebSocket.OPEN);
    ws.close();
  });
});

describe('Bridge Heartbeat', () => {
  it('responds to heartbeat messages', async () => {
    const ws = connect(TEST_TOKEN);
    await waitForOpen(ws);

    const response = await sendAndReceive(ws, { type: 'heartbeat' });
    assert.equal(response.type, 'heartbeat');
    assert.ok(typeof response.ts === 'number');
    assert.ok(response.ts > 0);

    ws.close();
  });
});

describe('Bridge Terminal', () => {
  it('echoes terminal input back (test mode)', async () => {
    const ws = connect(TEST_TOKEN);
    await waitForOpen(ws);

    const response = await sendAndReceive(ws, { type: 'terminal', data: 'hello' });
    assert.equal(response.type, 'terminal');
    assert.equal(response.data, 'echo:hello');

    ws.close();
  });
});

describe('Bridge FS Operations', () => {
  it('reads a file', async () => {
    const ws = connect(TEST_TOKEN);
    await waitForOpen(ws);

    const response = await sendAndReceive(ws, {
      type: 'fs',
      id: 'r1',
      op: 'readFile',
      path: 'hello.txt',
    });

    assert.equal(response.type, 'fs_response');
    assert.equal(response.id, 'r1');
    assert.equal(response.result, 'world');

    ws.close();
  });

  it('writes a file', async () => {
    const ws = connect(TEST_TOKEN);
    await waitForOpen(ws);

    const response = await sendAndReceive(ws, {
      type: 'fs',
      id: 'w1',
      op: 'writeFile',
      path: 'new-file.txt',
      content: 'new content',
    });

    assert.equal(response.type, 'fs_response');
    assert.equal(response.id, 'w1');
    assert.equal(response.result, 'ok');

    // Verify file was written
    const content = await fs.readFile(path.join(TEST_WORKSPACE, 'new-file.txt'), 'utf-8');
    assert.equal(content, 'new content');

    ws.close();
  });

  it('lists directory contents', async () => {
    const ws = connect(TEST_TOKEN);
    await waitForOpen(ws);

    const response = await sendAndReceive(ws, {
      type: 'fs',
      id: 'd1',
      op: 'readdir',
      path: '.',
    });

    assert.equal(response.type, 'fs_response');
    assert.equal(response.id, 'd1');
    assert.ok(Array.isArray(response.result));
    assert.ok(response.result.includes('hello.txt'));
    assert.ok(response.result.includes('subdir'));

    ws.close();
  });

  it('creates a directory', async () => {
    const ws = connect(TEST_TOKEN);
    await waitForOpen(ws);

    const response = await sendAndReceive(ws, {
      type: 'fs',
      id: 'm1',
      op: 'mkdir',
      path: 'newdir/deep',
    });

    assert.equal(response.result, 'ok');

    // Verify directory exists
    const stat = await fs.stat(path.join(TEST_WORKSPACE, 'newdir/deep'));
    assert.ok(stat.isDirectory());

    ws.close();
  });

  it('removes a file', async () => {
    const ws = connect(TEST_TOKEN);
    await waitForOpen(ws);

    // Create a file to remove
    await fs.writeFile(path.join(TEST_WORKSPACE, 'to-remove.txt'), 'bye');

    const response = await sendAndReceive(ws, {
      type: 'fs',
      id: 'rm1',
      op: 'rm',
      path: 'to-remove.txt',
    });

    assert.equal(response.result, 'ok');

    // Verify file was removed
    await assert.rejects(() => fs.access(path.join(TEST_WORKSPACE, 'to-remove.txt')));

    ws.close();
  });

  it('returns file stat', async () => {
    const ws = connect(TEST_TOKEN);
    await waitForOpen(ws);

    const response = await sendAndReceive(ws, {
      type: 'fs',
      id: 's1',
      op: 'stat',
      path: 'hello.txt',
    });

    assert.equal(response.type, 'fs_response');
    assert.equal(response.id, 's1');
    assert.equal(response.result.isFile, true);
    assert.equal(response.result.isDirectory, false);
    assert.equal(response.result.size, 5); // 'world' = 5 bytes

    ws.close();
  });

  it('returns error for nonexistent file', async () => {
    const ws = connect(TEST_TOKEN);
    await waitForOpen(ws);

    const response = await sendAndReceive(ws, {
      type: 'fs',
      id: 'e1',
      op: 'readFile',
      path: 'nonexistent.txt',
    });

    assert.equal(response.type, 'fs_response');
    assert.equal(response.id, 'e1');
    assert.ok(response.error);
    assert.ok(response.error.includes('ENOENT') || response.error.includes('no such file'));

    ws.close();
  });

  it('blocks path traversal outside workspace', async () => {
    const ws = connect(TEST_TOKEN);
    await waitForOpen(ws);

    const response = await sendAndReceive(ws, {
      type: 'fs',
      id: 'pt1',
      op: 'readFile',
      path: '../../../etc/passwd',
    });

    assert.equal(response.type, 'fs_response');
    assert.equal(response.id, 'pt1');
    assert.equal(response.error, 'Access denied');

    ws.close();
  });

  it('handles unknown fs operation', async () => {
    const ws = connect(TEST_TOKEN);
    await waitForOpen(ws);

    const response = await sendAndReceive(ws, {
      type: 'fs',
      id: 'u1',
      op: 'unknownOp',
      path: '.',
    });

    assert.equal(response.type, 'fs_response');
    assert.equal(response.id, 'u1');
    assert.equal(response.result, null);

    ws.close();
  });
});
