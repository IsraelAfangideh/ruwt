/**
 * Browser-based npm client for the Ruwt Runtime.
 *
 * Resolves packages from the npm registry, fetches tarballs,
 * decompresses with fflate, parses tar, and writes files into
 * VirtualFileSystem under node_modules/.
 */
import { gunzipSync } from 'fflate';
import type { VirtualFileSystem } from '@/features/shared-ide/VirtualFileSystem';
import { parseTar } from './tar';
import { HOME_DIR, NODE_MODULES_DIR } from './constants';
import type { PackageCache } from './persistence';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResolvedPackage {
  name: string;
  version: string;
  tarballUrl: string;
  dependencies: Record<string, string>;
}

export interface InstallProgress {
  phase: 'resolve' | 'fetch' | 'extract';
  package: string;
  current: number;
  total: number;
}

type ProgressCallback = (progress: InstallProgress) => void;

// ---------------------------------------------------------------------------
// NpmClient
// ---------------------------------------------------------------------------

export class NpmClient {
  private vfs: VirtualFileSystem;
  private registryUrl: string;
  private metadataCache = new Map<string, any>();
  private progressListeners = new Set<ProgressCallback>();
  private packageCache: PackageCache | null;

  constructor(vfs: VirtualFileSystem, options?: { registry?: string; cache?: PackageCache }) {
    this.vfs = vfs;
    this.registryUrl = options?.registry ?? 'https://registry.npmjs.org';
    this.packageCache = options?.cache ?? null;
  }

  /** Subscribe to installation progress events. Returns unsubscribe fn. */
  onProgress(cb: ProgressCallback): () => void {
    this.progressListeners.add(cb);
    return () => this.progressListeners.delete(cb);
  }

  /** Resolve a single package to its metadata. */
  async resolvePackage(name: string, _range?: string): Promise<ResolvedPackage> {
    const meta = await this.fetchMetadata(name);
    const version = meta['dist-tags']?.latest;
    if (!version || !meta.versions?.[version]) {
      throw new Error(`Could not resolve version for ${name}`);
    }
    const versionMeta = meta.versions[version];
    return {
      name: versionMeta.name,
      version: versionMeta.version,
      tarballUrl: versionMeta.dist.tarball,
      dependencies: versionMeta.dependencies ?? {},
    };
  }

  /** Resolve a package and all its transitive dependencies. */
  async resolveDependencyTree(
    name: string,
    _range?: string,
  ): Promise<ResolvedPackage[]> {
    const resolved: ResolvedPackage[] = [];
    const visited = new Set<string>();
    const queue: string[] = [name];

    while (queue.length > 0) {
      const pkgName = queue.shift()!;
      if (visited.has(pkgName)) continue;
      visited.add(pkgName);

      const pkg = await this.resolvePackage(pkgName);
      resolved.push(pkg);

      for (const depName of Object.keys(pkg.dependencies)) {
        if (!visited.has(depName)) {
          queue.push(depName);
        }
      }
    }

    return resolved;
  }

  /** Fetch a package tarball and extract files into VFS. */
  async fetchAndExtract(pkg: ResolvedPackage): Promise<void> {
    const cacheKey = `${pkg.name}@${pkg.version}`;
    let compressedBuf: ArrayBuffer;

    // Check cache first
    if (this.packageCache) {
      const cached = await this.packageCache.get(cacheKey);
      if (cached) {
        compressedBuf = cached.data;
      } else {
        compressedBuf = await this.fetchTarball(pkg);
        await this.packageCache.set(cacheKey, compressedBuf);
      }
    } else {
      compressedBuf = await this.fetchTarball(pkg);
    }

    let compressed: Uint8Array | null = new Uint8Array(compressedBuf);
    const decompressed = gunzipSync(compressed);
    compressed = null; // allow GC of compressed buffer
    const files = parseTar(decompressed);

    const basePath = NODE_MODULES_DIR + '/' + pkg.name;

    for (const file of files) {
      const filePath = basePath + '/' + file.name;
      this.vfs.writeFile(filePath, file.content);
    }
  }

  private async fetchTarball(pkg: ResolvedPackage): Promise<ArrayBuffer> {
    const response = await fetch(pkg.tarballUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch tarball for ${pkg.name}: ${response.status}`);
    }
    return response.arrayBuffer();
  }

  /** Install one or more packages by name. */
  async install(packages: string[]): Promise<void> {
    // Ensure node_modules exists
    if (!this.vfs.exists(NODE_MODULES_DIR)) {
      this.vfs.mkdir(NODE_MODULES_DIR);
    }

    const allPackages: ResolvedPackage[] = [];
    const seen = new Set<string>();
    for (const name of packages) {
      this.emitProgress({ phase: 'resolve', package: name, current: 0, total: packages.length });
      const tree = await this.resolveDependencyTree(name);
      for (const pkg of tree) {
        if (!seen.has(pkg.name)) {
          seen.add(pkg.name);
          allPackages.push(pkg);
        }
      }
    }

    let current = 0;
    for (const pkg of allPackages) {
      // Skip if already installed
      const pkgJsonPath = NODE_MODULES_DIR + '/' + pkg.name + '/package.json';
      if (this.vfs.exists(pkgJsonPath)) {
        const existing = this.vfs.readFile(pkgJsonPath);
        if (existing) {
          try {
            const parsed = JSON.parse(existing);
            if (parsed.version === pkg.version) {
              current++;
              continue;
            }
          } catch {
            // Invalid JSON — reinstall
          }
        }
      }

      this.emitProgress({
        phase: 'fetch',
        package: pkg.name,
        current: ++current,
        total: allPackages.length,
      });
      await this.fetchAndExtract(pkg);
    }

    this.emitProgress({
      phase: 'extract',
      package: 'done',
      current: allPackages.length,
      total: allPackages.length,
    });
  }

  /** Install dependencies listed in the project's package.json. */
  async installFromPackageJson(): Promise<void> {
    const pkgJsonPath = HOME_DIR + '/package.json';
    const content = this.vfs.readFile(pkgJsonPath);
    if (content === null) {
      throw new Error('package.json not found');
    }

    const pkgJson = JSON.parse(content);
    const deps = pkgJson.dependencies ?? {};
    const names = Object.keys(deps);

    if (names.length === 0) return;

    await this.install(names);
  }

  // ── Private ───────────────────────────────────────────────────────────

  private async fetchMetadata(name: string): Promise<any> {
    if (this.metadataCache.has(name)) {
      return this.metadataCache.get(name);
    }

    const encodedName = name.startsWith('@') ? name.replace('/', '%2F') : name;
    const url = `${this.registryUrl}/${encodedName}`;

    const response = await fetch(url, {
      headers: { Accept: 'application/vnd.npm.install-v1+json' },
    });

    if (!response.ok) {
      throw new Error(`npm registry error for ${name}: ${response.status}`);
    }

    const meta = await response.json();
    this.metadataCache.set(name, meta);
    return meta;
  }

  private emitProgress(progress: InstallProgress): void {
    for (const cb of this.progressListeners) {
      cb(progress);
    }
  }
}
