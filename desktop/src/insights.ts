import type { TelemetryEvent } from './event-types.js';

export interface Overview {
  activeAgents: number;
  sessions: number;
  events: number;
  totalCostMicros: number;
  firstPassTestRate: number;
  mergedPullRequests: number;
  coverage: number;
}

export interface Insight {
  ruleId: string;
  title: string;
  summary: string;
  confidence: 'high' | 'medium' | 'low';
  coverage: number;
  sampleSize: number;
  recommendation: string;
  limitations: string;
}

const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);
const sessionIds = (events: TelemetryEvent[]) => [...new Set(events.flatMap((event) => (event.sessionId ? [event.sessionId] : [])))];

export function calculateOverview(events: TelemetryEvent[]): Overview {
  const tests = events.filter((event) => event.type === 'test.completed');
  const passed = tests.filter((event) => event.testResult === 'passed');
  const knownFields = events.filter((event) => event.actorId && event.repository && event.agentVendor).length;
  return {
    activeAgents: new Set(events.map((event) => event.agentVendor).filter(Boolean)).size,
    sessions: sessionIds(events).length,
    events: events.length,
    totalCostMicros: events.reduce((sum, event) => sum + (event.estimatedCostMicros ?? 0), 0),
    firstPassTestRate: percent(passed.length, tests.length),
    mergedPullRequests: events.filter((event) => event.type === 'pull_request.merged').length,
    coverage: percent(knownFields, events.length),
  };
}

/** Deterministic rules. No model is involved. */
export function generateInsights(events: TelemetryEvent[]): Insight[] {
  if (!events.length) return [];
  const result: Insight[] = [];
  const overview = calculateOverview(events);
  const completedTests = events.filter((event) => event.type === 'test.completed');
  const modified = events.filter((event) => event.type === 'file.modified');
  const sessionsWithTests = new Set(completedTests.map((event) => event.sessionId).filter(Boolean));
  const costEvents = events.filter((event) => (event.estimatedCostMicros ?? 0) > 0);
  const meanCost = costEvents.reduce((total, event) => total + (event.estimatedCostMicros ?? 0), 0) / Math.max(costEvents.length, 1);
  const highCostFailures = costEvents.filter((event) => event.outcome === 'failure' && (event.estimatedCostMicros ?? 0) > meanCost * 2);
  const sensitive = events.filter((event) => event.fileClassification === 'sensitive' || event.fileClassification === 'credential');
  const unknownActors = events.filter((event) => !event.actorId);
  const outdated = events.filter((event) => /(?:^|\.)0(?:\.|$)|deprecated/i.test(event.adapterVersion));
  const rework = events.filter((event) => event.outcome === 'rework' || event.type === 'incident.created');
  const abandonedLong = events.filter((event) => event.outcome === 'abandoned' && (event.durationMs ?? 0) >= 2_700_000);
  const tools = events.filter((event) => event.type === 'tool.called' || event.type === 'tool.completed');
  const byAgent = new Map<string, TelemetryEvent[]>();
  for (const event of completedTests) {
    if (event.agentVendor) byAgent.set(event.agentVendor, [...(byAgent.get(event.agentVendor) ?? []), event]);
  }

  const add = (insight: Insight, active: boolean) => { if (active) result.push(insight); };
  add({
    ruleId: 'activity_summary',
    title: 'Observed activity on this machine',
    summary: `${overview.sessions} agent session${overview.sessions === 1 ? '' : 's'} produced ${overview.events} redacted events across ${overview.activeAgents || 0} agent${overview.activeAgents === 1 ? '' : 's'}.`,
    confidence: overview.events >= 20 ? 'high' : 'medium',
    coverage: overview.coverage,
    sampleSize: overview.events,
    recommendation: 'Use the other rules below for exceptions. This card is a count, not a judgment.',
    limitations: 'Only approved local session files are visible. Live hooks are not required.',
  }, true);
  add({
    ruleId: 'tool_activity',
    title: 'Tool use is visible',
    summary: `${tools.length} tool events were recorded without storing prompts or file contents.`,
    confidence: 'high',
    coverage: overview.coverage,
    sampleSize: tools.length,
    recommendation: 'Open Activity to inspect vendors, repositories, and redaction state.',
    limitations: 'Tool names are kept. Arguments, diffs, and command text are not.',
  }, tools.length > 0);
  add({
    ruleId: 'high_cost_unsuccessful_sessions',
    title: 'High-cost sessions need review',
    summary: `${highCostFailures.length} failed events cost more than twice the observed average.`,
    confidence: highCostFailures.length >= 5 ? 'high' : 'medium',
    coverage: overview.coverage,
    sampleSize: costEvents.length,
    recommendation: 'Review task framing and model choice before another attempt.',
    limitations: 'Costs are estimates from available adapter metadata.',
  }, highCostFailures.length > 0);
  add({
    ruleId: 'tests_missing_after_change',
    title: 'Agent changes lack observed tests',
    summary: `${modified.filter((event) => !sessionsWithTests.has(event.sessionId)).length} file changes have no completed test in the same session.`,
    confidence: 'medium',
    coverage: overview.coverage,
    sampleSize: modified.length,
    recommendation: 'Add a test step to the affected workflow.',
    limitations: 'Tests run outside supported sources are not visible.',
  }, modified.some((event) => event.sessionId && !sessionsWithTests.has(event.sessionId)));
  add({
    ruleId: 'sensitive_file_access',
    title: 'Sensitive file access occurred',
    summary: `${sensitive.length} events accessed a sensitive file classification.`,
    confidence: 'high',
    coverage: overview.coverage,
    sampleSize: sensitive.length,
    recommendation: 'Review the path policy and adapter access scope.',
    limitations: 'Ruwt stores classifications, not file contents.',
  }, sensitive.length > 0);
  add({
    ruleId: 'missing_actor_attribution',
    title: 'Actor attribution is incomplete',
    summary: `${percent(unknownActors.length, events.length)}% of events have no actor identifier.`,
    confidence: 'high',
    coverage: overview.coverage,
    sampleSize: events.length,
    recommendation: 'Repair desktop sign-in or the affected integration.',
    limitations: 'Pseudonymous actor settings can reduce attribution intentionally.',
  }, unknownActors.length > 0);
  add({
    ruleId: 'outdated_adapter',
    title: 'An adapter needs attention',
    summary: `${outdated.length} events came from an outdated or initial adapter version.`,
    confidence: 'medium',
    coverage: overview.coverage,
    sampleSize: outdated.length,
    recommendation: 'Update the desktop application before using this data for decisions.',
    limitations: 'Version age does not prove data loss.',
  }, outdated.length > 0);
  add({
    ruleId: 'rework_signal',
    title: 'Rework signal detected',
    summary: `${rework.length} events indicate rework or a related incident.`,
    confidence: rework.length >= 3 ? 'medium' : 'low',
    coverage: overview.coverage,
    sampleSize: events.length,
    recommendation: 'Inspect linked activity before changing team process.',
    limitations: 'Ruwt does not infer that the agent caused the rework.',
  }, rework.length > 0);
  add({
    ruleId: 'long_session_abandonment',
    title: 'Long sessions end without an outcome',
    summary: `${abandonedLong.length} sessions ran for at least 45 minutes before abandonment.`,
    confidence: abandonedLong.length >= 3 ? 'medium' : 'low',
    coverage: overview.coverage,
    sampleSize: events.length,
    recommendation: 'Split large tasks into smaller, testable steps.',
    limitations: 'Duration can include time away from the editor.',
  }, abandonedLong.length > 0);
  for (const [agent, agentTests] of byAgent) {
    if (agentTests.length < 5) continue;
    const rate = percent(agentTests.filter((event) => event.testResult === 'passed').length, agentTests.length);
    const others = completedTests.filter((event) => event.agentVendor !== agent);
    const otherRate = percent(others.filter((event) => event.testResult === 'passed').length, others.length);
    if (Math.abs(rate - otherRate) >= 20) {
      add({
        ruleId: 'agent_task_outcome_difference',
        title: `${agent} shows a different test outcome`,
        summary: `${agent} has a ${rate}% observed test pass rate, compared with ${otherRate}% for other recorded agents.`,
        confidence: agentTests.length >= 20 ? 'high' : 'medium',
        coverage: overview.coverage,
        sampleSize: agentTests.length,
        recommendation: 'Compare the tools within the same task category before standardizing.',
        limitations: 'This comparison shows correlation, not causation.',
      }, true);
    }
  }
  return result.slice(0, 12);
}
