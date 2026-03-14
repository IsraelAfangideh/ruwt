/**
 * Sync test: validates client and server pricing data stay in sync.
 * If this test fails, it means someone updated one side without the other.
 */
import { describe, it, expect } from 'vitest';
import { getAllModels } from '../../src/shared/lib/ai/pricing';
import { getCloudflareModels } from './ai-pricing';

describe('pricing sync (client <-> server)', () => {
  const clientModels = getAllModels();
  const serverModels = getCloudflareModels();

  it('client and server have the same number of models', () => {
    expect(clientModels.length).toBe(serverModels.length);
  });

  it('every client model exists on the server with matching fields', () => {
    const serverById = new Map(serverModels.map((m) => [m.id, m]));

    for (const client of clientModels) {
      const server = serverById.get(client.id);
      expect(server, `server missing model: ${client.id}`).toBeDefined();
      expect(server!.input).toBe(client.input);
      expect(server!.output).toBe(client.output);
      expect(server!.tier).toBe(client.tier);
      expect(server!.displayName).toBe(client.displayName);
    }
  });

  it('every server model exists on the client (no server-only models)', () => {
    const clientIds = new Set(clientModels.map((m) => m.id));

    for (const server of serverModels) {
      expect(clientIds.has(server.id), `client missing model: ${server.id}`).toBe(true);
    }
  });

  it('supportsTools flags match between client and server', () => {
    const serverById = new Map(serverModels.map((m) => [m.id, m]));

    for (const client of clientModels) {
      const server = serverById.get(client.id)!;
      expect(
        !!server.supportsTools,
        `supportsTools mismatch for ${client.id}`
      ).toBe(!!client.supportsTools);
    }
  });

  it('supportsJsonMode flags match between client and server', () => {
    const serverById = new Map(serverModels.map((m) => [m.id, m]));

    for (const client of clientModels) {
      const server = serverById.get(client.id)!;
      expect(
        !!server.supportsJsonMode,
        `supportsJsonMode mismatch for ${client.id}`
      ).toBe(!!client.supportsJsonMode);
    }
  });
});
