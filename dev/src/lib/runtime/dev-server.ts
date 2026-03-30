/**
 * Dev server for the Ruwt Runtime.
 *
 * Coordinates esbuild bundling, Service Worker registration, and
 * Cache API population for serving a live preview in an iframe.
 */
import type { VirtualFileSystem } from '@/features/shared-ide/VirtualFileSystem';
import { initialize as initEsbuild, bundle } from './esbuild-bridge';
import { virtualOrigin } from './sw-handler';
import { HOME_DIR } from './constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DevServerOptions {
  port?: number;
}

export interface StartOptions {
  entry?: string;
}

// ---------------------------------------------------------------------------
// DevServer
// ---------------------------------------------------------------------------

export class DevServer {
  private vfs: VirtualFileSystem;
  private port: number;
  private cacheName: string;
  private entryPoint: string | null = null;
  private watchUnsub: (() => void) | null = null;
  private rebuildTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(vfs: VirtualFileSystem, options?: DevServerOptions) {
    this.vfs = vfs;
    this.port = options?.port ?? 3000;
    this.cacheName = `ruwt-preview-${this.port}`;
  }

  /** Get the preview URL for iframe embedding. */
  getPreviewUrl(): string {
    return virtualOrigin(this.port) + '/';
  }

  /** Start the dev server: register SW, bundle, populate cache. */
  async start(options?: StartOptions): Promise<string> {
    this.entryPoint = options?.entry ?? this.detectEntryPoint();

    // Register Service Worker
    await navigator.serviceWorker.register('/sw-runtime.js', {
      scope: '/',
      type: 'module' as any,
    });

    // Initialize esbuild and do initial build
    await initEsbuild();
    await this.buildAndCache();

    return this.getPreviewUrl();
  }

  /** Rebuild: re-bundle and update cache. */
  async rebuild(): Promise<void> {
    await this.buildAndCache();
  }

  /** Stop the dev server: clean up cache. */
  async stop(): Promise<void> {
    if (this.watchUnsub) {
      this.watchUnsub();
      this.watchUnsub = null;
    }
    if (this.rebuildTimer) {
      clearTimeout(this.rebuildTimer);
      this.rebuildTimer = null;
    }
    await caches.delete(this.cacheName);
  }

  /** Watch VFS for changes and auto-rebuild. Returns unsubscribe fn. */
  watch(): () => void {
    const unsub = this.vfs.onChange((path, _type) => {
      // Ignore node_modules and build artifacts
      if (path.includes('node_modules') || path.includes('.ruwt-build')) {
        return;
      }

      // Debounce rebuilds
      if (this.rebuildTimer) clearTimeout(this.rebuildTimer);
      this.rebuildTimer = setTimeout(() => {
        this.rebuild().catch(() => {});
      }, 300);
    });

    this.watchUnsub = unsub;
    return () => {
      unsub();
      this.watchUnsub = null;
      if (this.rebuildTimer) {
        clearTimeout(this.rebuildTimer);
        this.rebuildTimer = null;
      }
    };
  }

  // ── Private ───────────────────────────────────────────────────────────

  private async buildAndCache(): Promise<void> {
    if (!this.entryPoint) return;

    const origin = virtualOrigin(this.port);
    const cache = await caches.open(this.cacheName);
    const result = await bundle(this.entryPoint, this.vfs);

    // Cache the bundled JS
    await cache.put(
      new Request(origin + '/bundle.js'),
      new Response(result.code, {
        headers: { 'Content-Type': 'application/javascript' },
      }),
    );

    // Cache CSS if present
    if (result.css) {
      await cache.put(
        new Request(origin + '/bundle.css'),
        new Response(result.css, {
          headers: { 'Content-Type': 'text/css' },
        }),
      );
    }

    // Generate and cache index.html
    const html = this.generateIndexHtml(!!result.css);
    await cache.put(
      new Request(origin + '/index.html'),
      new Response(html, {
        headers: { 'Content-Type': 'text/html' },
      }),
    );
  }

  private generateIndexHtml(hasCss: boolean): string {
    return [
      '<!DOCTYPE html>',
      '<html><head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width,initial-scale=1">',
      hasCss ? '<link rel="stylesheet" href="/bundle.css">' : '',
      '</head><body>',
      '<div id="root"></div>',
      '<script type="module" src="/bundle.js"></script>',
      '</body></html>',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private detectEntryPoint(): string {
    const candidates = [
      `${HOME_DIR}/index.tsx`,
      `${HOME_DIR}/index.ts`,
      `${HOME_DIR}/index.jsx`,
      `${HOME_DIR}/index.js`,
      `${HOME_DIR}/src/index.tsx`,
      `${HOME_DIR}/src/index.ts`,
      `${HOME_DIR}/src/main.tsx`,
      `${HOME_DIR}/src/main.ts`,
    ];
    for (const c of candidates) {
      if (this.vfs.exists(c)) return c;
    }
    return `${HOME_DIR}/index.js`;
  }
}
