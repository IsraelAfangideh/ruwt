import { describe, expect, it } from 'vitest';
import { generateInsights } from './analytics';
import type { TelemetryEvent } from '../../../src/shared/intelligence/contracts';

const base: TelemetryEvent = {
  id: '7c1a2d4e-8ad6-4b90-9c47-16b0e1217d2c', schemaVersion: 1, timestamp: '2026-08-01T10:00:00.000Z',
  orgId: '5d1ac29a-7d23-42d5-b890-586ee309a4a9', integrationSource: 'generic-json', adapterVersion: '1.0.0',
  type: 'model.invoked', redactionStatus: 'not_required', confidence: 'high', metadata: {},
};

describe('insight rules', () => {
  it('produces explainable insights from events', () => {
    const insights = generateInsights([
      { ...base, id: '0c44f07d-97e3-4e48-88df-3e4c2b9c78c5', outcome: 'failure', estimatedCostMicros: 500 },
      { ...base, id: '852b5e5f-a6a4-46ae-a24f-d4e7e68ef75f', outcome: 'failure', estimatedCostMicros: 30_000, fileClassification: 'sensitive' },
      { ...base, id: 'a7ddcd9f-3d35-4704-946d-42e23bd2bf17', type: 'file.modified', sessionId: 's-1', estimatedCostMicros: 500 },
    ]);
    expect(insights.map((insight) => insight.ruleId)).toEqual(expect.arrayContaining(['high_cost_unsuccessful_sessions', 'sensitive_file_access', 'tests_missing_after_change', 'missing_actor_attribution']));
  });
});
