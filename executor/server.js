/**
 * Lightweight code execution service — Piston-compatible API.
 * Supports JavaScript (Node 18), TypeScript (tsx), Python 3.
 * Runs on Fly.io as a replacement for the now-defunct public Piston API.
 */
const http = require('http');
const { spawn } = require('child_process');
const { writeFileSync, unlinkSync, mkdtempSync, rmdirSync } = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 8080;

const LANGUAGES = {
  javascript: { cmd: 'node', args: [], ext: '.js' },
  typescript: { cmd: 'tsx', args: [], ext: '.ts' },
  python:     { cmd: 'python3', args: [], ext: '.py' },
  python3:    { cmd: 'python3', args: [], ext: '.py' },
};

function execute(language, code, stdin, timeout) {
  return new Promise((resolve) => {
    const lang = LANGUAGES[language];
    if (!lang) {
      resolve({ stdout: '', stderr: `Unsupported language: ${language}`, code: 1, signal: null });
      return;
    }

    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'exec-'));
    const filePath = path.join(tmpDir, `main${lang.ext}`);
    writeFileSync(filePath, code);

    const args = [...lang.args, filePath];
    const proc = spawn(lang.cmd, args, {
      timeout: timeout || 5000,
      cwd: tmpDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_NO_WARNINGS: '1' },
    });

    let stdout = '';
    let stderr = '';
    let killed = false;

    proc.stdout.on('data', (d) => { stdout += d; });
    proc.stderr.on('data', (d) => { stderr += d; });

    if (stdin) proc.stdin.write(stdin);
    proc.stdin.end();

    const timer = setTimeout(() => {
      killed = true;
      proc.kill('SIGKILL');
    }, timeout || 5000);

    proc.on('close', (code, signal) => {
      clearTimeout(timer);
      try { unlinkSync(filePath); } catch (_) {}
      try { rmdirSync(tmpDir); } catch (_) {}

      if (killed) {
        resolve({ stdout, stderr: stderr + '\nExecution timed out', code: 1, signal: 'SIGKILL' });
      } else {
        resolve({ stdout, stderr, code: code ?? 1, signal: signal || null });
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      try { unlinkSync(filePath); } catch (_) {}
      try { rmdirSync(tmpDir); } catch (_) {}
      resolve({ stdout: '', stderr: err.message, code: 1, signal: null });
    });
  });
}

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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
