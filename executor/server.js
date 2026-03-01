/**
 * Lightweight code execution service — Piston-compatible API.
 * Supports JavaScript (Node 18), TypeScript (tsx), Python 3.
 * Runs on Fly.io as a replacement for the now-defunct public Piston API.
 */
const http = require('http');
const { spawn, execSync } = require('child_process');
const { writeFileSync, unlinkSync, mkdtempSync, rmSync, chownSync } = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 8080;
const EXECUTOR_SECRET = process.env.EXECUTOR_SECRET || '';
const MAX_OUTPUT = 1024 * 1024; // 1MB cap on stdout/stderr

// Warn at startup if EXECUTOR_SECRET is not configured
if (!EXECUTOR_SECRET) {
  console.warn('WARNING: EXECUTOR_SECRET is not set — authentication is disabled. Set it in production.');
}

// Resolve non-root user IDs for process isolation
let EXEC_UID, EXEC_GID;
try {
  EXEC_UID = parseInt(execSync('id -u executor').toString().trim());
  EXEC_GID = parseInt(execSync('id -g executor').toString().trim());
} catch (_) {
  // executor user may not exist in dev; fall back to current user
  EXEC_UID = undefined;
  EXEC_GID = undefined;
}

const LANGUAGES = {
  javascript: { cmd: 'node', args: ['--max-old-space-size=256'], ext: '.js' },
  typescript: { cmd: 'tsx', args: ['--max-old-space-size=256'], ext: '.ts' },
  python:     { cmd: 'python3', args: [], ext: '.py' },
  python3:    { cmd: 'python3', args: [], ext: '.py' },
};

// Python memory limit preamble — sets 256MB virtual memory limit
const PYTHON_MEMORY_PREAMBLE = `import resource as __resource
try:
    __resource.setrlimit(__resource.RLIMIT_AS, (256 * 1024 * 1024, 256 * 1024 * 1024))
except (ValueError, __resource.error):
    pass
`;

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://ruwt.dev',
  'https://ruwt-dev.pages.dev',
  'http://localhost:5173',
];

function getCorsOrigin(req) {
  const origin = req.headers.origin || '';
  return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
}

function execute(language, code, stdin, timeout) {
  return new Promise((resolve) => {
    const lang = LANGUAGES[language];
    if (!lang) {
      resolve({ stdout: '', stderr: `Unsupported language: ${language}`, code: 1, signal: null, executionTimeMs: 0 });
      return;
    }

    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'exec-'));

    // Prepend Python memory limit preamble
    const finalCode = (language === 'python' || language === 'python3')
      ? PYTHON_MEMORY_PREAMBLE + code
      : code;

    const filePath = path.join(tmpDir, `main${lang.ext}`);
    writeFileSync(filePath, finalCode);

    // Make temp dir and file accessible to non-root executor user
    if (EXEC_UID !== undefined) {
      chownSync(tmpDir, EXEC_UID, EXEC_GID);
      chownSync(filePath, EXEC_UID, EXEC_GID);
    }

    const args = [...lang.args, filePath];
    const spawnOpts = {
      timeout: timeout || 5000,
      cwd: tmpDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: true, // Create process group for reliable cleanup
      // Minimal safe env — no secrets leaked to user code
      env: {
        PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
        HOME: tmpDir,
        TMPDIR: tmpDir,
        NODE_NO_WARNINGS: '1',
        PYTHONDONTWRITEBYTECODE: '1',
      },
    };

    // Run as non-root executor user if available
    if (EXEC_UID !== undefined) {
      spawnOpts.uid = EXEC_UID;
      spawnOpts.gid = EXEC_GID;
    }

    const startTime = Date.now();
    const proc = spawn(lang.cmd, args, spawnOpts);

    let stdout = '';
    let stderr = '';
    let killed = false;
    let stdoutTruncated = false;
    let stderrTruncated = false;

    proc.stdout.on('data', (d) => {
      if (stdout.length < MAX_OUTPUT) {
        stdout += d;
        if (stdout.length > MAX_OUTPUT) {
          stdout = stdout.slice(0, MAX_OUTPUT);
          stdoutTruncated = true;
        }
      }
    });
    proc.stderr.on('data', (d) => {
      if (stderr.length < MAX_OUTPUT) {
        stderr += d;
        if (stderr.length > MAX_OUTPUT) {
          stderr = stderr.slice(0, MAX_OUTPUT);
          stderrTruncated = true;
        }
      }
    });

    if (stdin) proc.stdin.write(stdin);
    proc.stdin.end();

    const effectiveTimeout = timeout || 5000;
    const timer = setTimeout(() => {
      killed = true;
      // Kill entire process group (handles child processes / forks)
      try { process.kill(-proc.pid, 'SIGKILL'); } catch (_) {}
    }, effectiveTimeout);

    proc.on('close', (code, signal) => {
      clearTimeout(timer);
      const executionTimeMs = Date.now() - startTime;

      // Clean up temp dir (handles nested directories from user code)
      try { rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}

      if (stdoutTruncated) stdout += '\n[Output truncated — limit is 1MB. Reduce output to see full results.]';
      if (stderrTruncated) stderr += '\n[Output truncated — limit is 1MB. Reduce output to see full results.]';

      // Detect Python MemoryError
      if (stderr.includes('MemoryError') || stderr.includes('Cannot allocate memory')) {
        stderr += '\n[Memory limit exceeded (256MB)]';
      }

      if (killed) {
        resolve({
          stdout,
          stderr: stderr + `\n[Execution timed out after ${effectiveTimeout}ms]`,
          code: 1,
          signal: 'SIGKILL',
          executionTimeMs,
        });
      } else {
        resolve({ stdout, stderr, code: code ?? 1, signal: signal || null, executionTimeMs });
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      const executionTimeMs = Date.now() - startTime;
      // Kill entire process group on error too
      try { process.kill(-proc.pid, 'SIGKILL'); } catch (_) {}
      try { rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
      resolve({ stdout: '', stderr: err.message, code: 1, signal: null, executionTimeMs });
    });
  });
}

const server = http.createServer(async (req, res) => {
  // CORS — restricted to known origins
  const corsOrigin = getCorsOrigin(req);
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Executor-Secret');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', languages: Object.keys(LANGUAGES) }));
    return;
  }

  // Piston-compatible execute endpoint
  if (req.method === 'POST' && (req.url === '/api/v2/piston/execute' || req.url === '/execute')) {
    // Shared secret authentication (conditional — only enforced if secret is configured)
    if (EXECUTOR_SECRET) {
      const clientSecret = req.headers['x-executor-secret'] || '';
      if (clientSecret !== EXECUTOR_SECRET) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Forbidden' }));
        return;
      }
    }

    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const code = (data.files || [])[0]?.content || '';
        const language = data.language || 'javascript';
        const stdin = data.stdin || '';
        const timeout = data.run_timeout || 5000;

        const result = await execute(language, code, stdin, timeout);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          language,
          version: data.version || '*',
          run: {
            stdout: result.stdout,
            stderr: result.stderr,
            code: result.code,
            signal: result.signal,
            output: result.stdout + result.stderr,
          },
          executionTimeMs: result.executionTimeMs,
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'not found' }));
});

server.listen(PORT, () => {
  console.log(`Executor running on port ${PORT}`);
});
