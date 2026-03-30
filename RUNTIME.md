# Ruwt Runtime

Browser-native JavaScript runtime. Replaces WebContainer. No vendor dependency, no licensing, fully open-source. Runs entirely in the user's browser tab at zero server cost.

## Why

WebContainer (StackBlitz) is proprietary and requires a paid license for production use. Every browser IDE that isn't StackBlitz uses cloud VMs, which cost money per user. Ruwt Runtime is the third option: a self-built browser runtime assembled from existing open-source components, owned entirely by us.

This makes the free tier actually free. Not subsidized, not loss-leading — structurally zero marginal cost.

## Architecture

```
Browser Tab
├── Monaco Editor (exists)
├── xterm.js Terminal (exists)
├── VirtualFileSystem (exists)
├── VirtualShell (exists, extend with `node` and `npm` commands)
│
├── Ruwt Runtime (new)
│   ├── esbuild-wasm          → bundles/transpiles TS/JSX, rewrites imports
│   ├── QuickJS WASM          → executes JS with polyfilled Node.js APIs
│   ├── npm client             → resolves deps, fetches tarballs, extracts to VirtualFS
│   ├── Node.js polyfills      → fs, path, events, stream, buffer, crypto, http, etc.
│   └── Service Worker         → intercepts localhost fetch, serves from VirtualFS
│
├── AI Chat → Cloudflare Workers AI / BYOK (exists)
├── Diff Applier (exists)
└── Project Persistence → R2 + D1 (exists)
```

Implements `RuntimeBackend` interface. The IDE doesn't know what's behind it — same interface as the existing `BrowserBackend` (WebContainer) and `CloudBackend` (Fly Machine). Swap is invisible to every component above the abstraction.

## Components

### esbuild-wasm
Already production-grade. Runs in browser. Handles TypeScript, JSX, ESM bundling. We use it as the transpile/bundle layer before handing code to QuickJS.

Also rewrites bare imports (`import React from 'react'`) in two modes:
- **npm mode**: rewrites to `./node_modules/react/index.js` (resolved by npm client)
- **CDN fallback**: rewrites to `https://esm.sh/react@19` if package not installed

### QuickJS WASM
Lightweight JS engine compiled to WebAssembly. Interpreter, not JIT — ~10-50x slower than V8 for CPU-bound work. Irrelevant for typical web development which is I/O-bound (file reads, network fetches, DOM manipulation).

Runs user code in a sandboxed context with Node.js globals (`require`, `process`, `__dirname`, `module`, `exports`) shimmed to route through our polyfill layer.

### npm client (~1500 lines, new)
Browser-based package manager. Three steps:
1. **Resolve**: fetch `registry.npmjs.org/{pkg}` metadata, walk dependency tree, deduplicate
2. **Fetch**: download tarballs (CORS-friendly from npm registry)
3. **Extract**: decompress with fflate, write to `node_modules/` in VirtualFS

No native addon support (same limitation as WebContainer). No postinstall scripts (security + impossible in browser). Covers ~95% of npm packages.

Cache resolved+fetched packages in IndexedDB. Second `npm install` for the same deps is instant.

### Node.js polyfills
Not invented here — assembled from the webpack/browserify ecosystem:

| Module | Implementation |
|---|---|
| `fs` | VirtualFileSystem (sync + async wrappers) |
| `path` | `path-browserify` |
| `events` | `events` npm package |
| `stream` | `readable-stream` |
| `buffer` | `buffer` npm package |
| `crypto` | WebCrypto API + `crypto-browserify` |
| `http`/`https` | Service Worker interception |
| `process` | `process` npm package |
| `os` | Static returns (linux, x64, 4 cpus) |
| `util` | `util` npm package |
| `url` | Native `URL` API |
| `assert` | `assert` npm package |
| `child_process` | Web Worker bridge (partial — `exec`/`execSync` for known binaries) |
| `worker_threads` | Web Worker mapping |
| `vm` | QuickJS nested context |
| `net`/`tls` | Stubbed — same as WebContainer |

### Service Worker (dev preview)
Intercepts `fetch('http://localhost:*')` → serves files from VirtualFS. User's React app renders in a sandboxed iframe. No real HTTP server needed.

Handles:
- Static file serving (HTML, JS, CSS, images)
- Hot module replacement (esbuild rebuild → postMessage to iframe → reload)
- Multiple ports (3000, 5173, 8080 — all virtual)

### Persistent storage
- **Session**: VirtualFS in memory (fast, lost on tab close)
- **Durable**: OPFS (Origin Private File System) for cross-session persistence without server roundtrip
- **Cloud backup**: R2 snapshots (existing, for cross-device access)

Three layers. Session for speed, OPFS for persistence, R2 for portability.

## What this can't do (Cloud Mode covers it)

- Native addons (Sharp, bcrypt, sqlite3)
- Real TCP/UDP sockets
- Docker
- Languages other than JS/TS (until Pyodide is wired in for Python)
- CPU-heavy workloads where QuickJS speed matters
- Large monorepos (memory limited to browser tab)

All of these are Cloud Mode (Fly Machine, $5/mo). The runtime doesn't need to cover them.

## Build order

Everything below produces a working commit. Each step is independently shippable.

| # | What | Weeks | Outcome |
|---|---|---|---|
| 1 | esbuild-wasm integration + import rewriting | 1 | TS/JSX files transpile and bundle in browser |
| 2 | QuickJS WASM + Node.js polyfill layer | 2 | `node index.js` runs JS with fs/path/events/etc |
| 3 | npm client (resolve, fetch, extract) | 2-3 | `npm install react` works, packages in VirtualFS |
| 4 | Service Worker dev preview | 1 | React app renders in iframe, hot reload |
| 5 | Shell integration (`node`, `npm`, `npx` commands) | 1 | Terminal feels like a real dev environment |
| 6 | Wire into `RuntimeBackend` + replace `BrowserBackend` | 1 | Existing IDE screens work on new runtime |
| 7 | IndexedDB package cache + OPFS persistence | 1 | Fast reinstalls, survive tab close |
| 8 | Compatibility testing (top 100 npm packages) | 2 | Confidence in the long tail |
| **Total** | | **~12 weeks** | **95% WebContainer parity, zero server cost** |

Steps 1-4 are the critical path. After step 4 you have a working demo: write React code → see it render in browser → no server involved. Everything after that is polish and integration.

## How this fits the product

```
Free tier ($0)         → Ruwt Runtime (browser, JS/TS, zero cost to us)
Pro tier ($5/mo)       → Cloud Mode (Fly Machine, any language, Docker)
Assessments ($75-500)  → Ruwt Runtime for candidates (zero cost per candidate)
```

The original TECH_STACK.md strategy is unchanged. Replace "WebContainer" with "Ruwt Runtime" everywhere. Same `RuntimeBackend` interface, same IDE, same AI, same business model.

The completed work (shared-ide extraction, /ide route, R2 persistence, take-home mode, session replay) is unaffected — it sits above the runtime abstraction.

## Open source angle

Ruwt Runtime can be extracted as a standalone package. Any developer building a browser IDE, playground, or educational tool can use it instead of WebContainer. This is distribution:

- npm package: `@ruwt/runtime`
- GitHub repo with docs and examples
- Other projects adopt it → community → contributors → credibility

WebContainer's proprietary nature is a bottleneck for the entire browser IDE ecosystem. An open-source alternative has natural demand.

## Risks

| Risk | Mitigation |
|---|---|
| QuickJS too slow for some workflows | Benchmark early (step 2). If blocking, explore V8 isolates via Cloudflare Workers for heavy execution. Cloud Mode exists as escape hatch. |
| npm compatibility long tail | CDN fallback (esm.sh) for packages that don't work with browser npm client. Two resolution strategies > one. |
| Service Worker registration fails (some browsers/contexts) | Graceful degradation: run code without preview. Preview is a feature, not a requirement. |
| Scope creep into "build all of Node.js" | Hard boundary: if it needs `net`, `tls`, `dgram`, or native addons, it's a Cloud Mode use case. Don't polyfill the impossible. |
| Someone else ships this first | Speed. 12 weeks. The building blocks are commodity — execution speed is the moat. |
