import type { TelemetryEvent } from '../../../src/shared/intelligence/contracts.js';

export interface StoredPolicy {
  id: string;
  ruleType: string;
  severity: string;
  configuration: string;
  enabled: number;
}

export interface PolicyMatch { policyId: string; severity: string; evidence: Record<string, string | number | boolean>; }

export function evaluatePolicies(event: TelemetryEvent, policies: StoredPolicy[]): PolicyMatch[] {
  return policies.flatMap((policy) => {
    if (!policy.enabled) return [];
    const config = JSON.parse(policy.configuration || '{}') as Record<string, unknown>;
    const values = Array.isArray(config.values) ? config.values.map(String) : [];
    const match = (matched: boolean, evidence: PolicyMatch['evidence']) => matched ? [{ policyId: policy.id, severity: policy.severity, evidence }] : [];
    switch (policy.ruleType) {
      case 'blocked_model': return match(!!event.modelName && values.includes(event.modelName), { model: event.modelName ?? '' });
      case 'unapproved_agent': return match(!!event.agentVendor && values.length > 0 && !values.includes(event.agentVendor), { agent: event.agentVendor ?? '' });
      case 'sensitive_file': return match(['sensitive', 'credential'].includes(event.fileClassification ?? ''), { classification: event.fileClassification ?? '' });
      case 'dangerous_command': return match(!!event.commandClassification && values.includes(event.commandClassification), { commandClass: event.commandClassification ?? '' });
      case 'max_session_cost': return match(typeof config.maxMicros === 'number' && (event.estimatedCostMicros ?? 0) > config.maxMicros, { costMicros: event.estimatedCostMicros ?? 0 });
      case 'test_required': return match(event.type === 'file.modified' && event.testResult === 'not_run', { eventType: event.type });
      case 'unknown_provider': return match(event.type === 'model.invoked' && !event.modelProvider, { eventType: event.type });
      default: return [];
    }
  });
}
