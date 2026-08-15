import { homedir } from 'node:os';
import { join } from 'node:path';
import { resolveIngestionUrl } from './config.js';
import { Engine } from './engine.js';
import { NodeFs } from './fs-node.js';
import { LocalService } from './local-service.js';

const storePath = process.env.RUWT_LOCAL_STORE ?? join(homedir(), '.ruwt', 'queue.json');
const service = new LocalService(storePath);
const engine = new Engine(new NodeFs(), storePath, 'none');
const [command, argument] = process.argv.slice(2);

async function main() {
  switch (command) {
    case 'status': console.log(JSON.stringify(await service.status(), null, 2)); break;
    case 'insights': console.log(JSON.stringify(await engine.snapshot(), null, 2)); break;
    case 'collect': console.log(JSON.stringify((await engine.collect()).result, null, 2)); break;
    case 'pause': await service.pause(); console.log('Collection paused.'); break;
    case 'resume': await service.resume(); console.log('Collection resumed.'); break;
    case 'import': if (!argument) throw new Error('Use: ruwt import <file>'); console.log(await service.importJson(argument)); break;
    case 'export': if (!argument) throw new Error('Use: ruwt export <file>'); await service.export(argument); console.log('Local data exported.'); break;
    case 'sync': {
      const endpoint = resolveIngestionUrl();
      const key = process.env.RUWT_INGESTION_KEY;
      if (!key) throw new Error('Set RUWT_INGESTION_KEY before sync. Create one at ruwt.ai → Workspace settings.');
      console.log(await service.sync(endpoint, key));
      break;
    }
    case 'privacy': console.log({ rawPrompts: 'disabled', rawSourceCode: 'disabled', store: storePath }); break;
    case 'doctor': console.log({ localStore: await service.status(), ingestionUrl: resolveIngestionUrl(), lastCollect: (await engine.snapshot()).lastCollect, secureStorage: 'Required before cloud sign-in ships.' }); break;
    case 'logs': console.log('Ruwt stores sanitized retry state in the local queue.'); break;
    case 'integrations': console.log((await engine.snapshot()).lastCollect?.sources ?? 'Run ruwt collect to scan Claude Code, Cursor, and Codex session files.'); break;
    case 'version': console.log('Ruwt CLI 0.1.0'); break;
    default: console.log('Commands: status, insights, collect, doctor, integrations, sync, pause, resume, import, export, privacy, logs, version');
  }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : 'The command failed.'); process.exitCode = 1; });
