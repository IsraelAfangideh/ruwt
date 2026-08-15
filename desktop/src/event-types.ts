export type EventType =
  | 'session.started' | 'session.ended' | 'prompt.submitted' | 'model.invoked'
  | 'tool.called' | 'tool.completed' | 'file.read' | 'file.modified'
  | 'command.executed' | 'test.started' | 'test.completed' | 'git.commit.created'
  | 'pull_request.opened' | 'pull_request.reviewed' | 'pull_request.merged'
  | 'deployment.completed' | 'incident.created' | 'policy.violation_detected';

export interface TelemetryEvent {
  id: string;
  schemaVersion: 1;
  timestamp: string;
  orgId: string;
  actorId?: string;
  sessionId?: string;
  correlationId?: string;
  integrationSource: string;
  adapterVersion: string;
  desktopInstallationId?: string;
  type: EventType;
  agentVendor?: string;
  agentVersion?: string;
  modelProvider?: string;
  modelName?: string;
  repository?: string;
  branch?: string;
  toolName?: string;
  fileClassification?: string;
  commandClassification?: string;
  estimatedCostMicros?: number;
  durationMs?: number;
  outcome?: 'success' | 'failure' | 'abandoned' | 'unknown' | 'rework';
  testResult?: 'passed' | 'failed' | 'not_run' | 'unknown';
  redactionStatus: 'not_required' | 'redacted' | 'withheld';
  confidence: 'high' | 'medium' | 'low';
  metadata: Record<string, string | number | boolean | Array<string | number | boolean>>;
}
