const WebSocket = require('ws');
const http = require('http');
const pty = require('node-pty');
const fs = require('fs').promises;
const path = require('path');

const PORT = process.env.PORT || 8080;
const AUTH_TOKEN = process.env.BRIDGE_TOKEN;
const WORKSPACE = process.env.WORKSPACE || '/home/dev/workspace';

const server = http.createServer((req, res) => {
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
  // Auth check
  const token = new URL(req.url, 'http://localhost').searchParams.get('token');
  if (AUTH_TOKEN && token !== AUTH_TOKEN) {
    ws.close(4401, 'Unauthorized');
    return;
  }

  resetIdleTimer();

  // Spawn PTY
  const shell = pty.spawn('bash', [], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: WORKSPACE,
    env: { ...process.env, HOME: '/home/dev', USER: 'dev' },
  });

  // Terminal -> WebSocket
  shell.onData((data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'terminal', data }));
    }
  });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      switch (msg.type) {
        case 'terminal':
          shell.write(msg.data);
          break;
        case 'resize':
          shell.resize(msg.cols, msg.rows);
          break;
        case 'fs':
          handleFsOp(msg, ws);
          break;
        case 'heartbeat':
          ws.send(JSON.stringify({ type: 'heartbeat', ts: Date.now() }));
          break;
      }
    } catch {
      // ignore malformed messages
    }
  });

  ws.on('close', () => {
    shell.kill();
    if (wss.clients.size === 0) resetIdleTimer();
  });

  shell.onExit(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'shell_exit' }));
    }
  });
});

// File system operations via WebSocket
async function handleFsOp(msg, ws) {
  const id = msg.id;
  try {
    const fullPath = path.resolve(WORKSPACE, msg.path || '.');
    // Security: prevent path traversal outside workspace
    if (!fullPath.startsWith(WORKSPACE)) {
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

// Idle detection: stop machine after 15min of no connections
let idleTimer;
function resetIdleTimer() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    console.log('No connections for 15 minutes, stopping machine...');
    process.exit(0); // Fly will stop the machine
  }, 15 * 60 * 1000);
}

resetIdleTimer();
server.listen(PORT, () => console.log(`Bridge listening on :${PORT}`));

// Export for testing
module.exports = { server, wss, handleFsOp, resetIdleTimer };
