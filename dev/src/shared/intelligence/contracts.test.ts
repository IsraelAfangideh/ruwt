import { describe, expect, it } from 'vitest';
import { redactMetadata, telemetryEventSchema } from './contracts';

const event = {
  id: '7c1a2d4e-8ad6-4b90-9c47-16b0e1217d2c', schemaVersion: 1, timestamp: '2026-08-01T10:00:00.000Z',
  orgId: '5d1ac29a-7d23-42d5-b890-586ee309a4a9', integrationSource: 'generic-json', adapterVersion: '1.0.0',
  type: 'model.invoked', redactionStatus: 'not_required', confidence: 'high', metadata: { sourceHash: 'sha256:example' },
} as const;

describe('telemetry contract', () => {
  it('validates versioned bounded events', () => expect(telemetryEventSchema.safeParse(event).success).toBe(true));
  it('redacts sensitive metadata before upload', () => {
    expect(redactMetadata({ apiKey: 'sk-this-must-not-leak', label: 'safe' })).toMatchObject({ apiKey: '[REDACTED]', label: 'safe' });
  });

  it('rejects metadata that could contain unapproved raw content', () => {
    expect(telemetryEventSchema.safeParse({ ...event, metadata: { prompt: 'Do not retain this prompt.' } }).success).toBe(false);
  });
});
