export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  readMinutes: number;
  tags: string[];
  body: string[];
}

export const blogPosts: BlogPost[] = [
  {
    slug: 'what-is-agentic-observability',
    title: 'What is agentic observability?',
    excerpt:
      'Software teams are shipping agents faster than they can explain what those agents did. Observability closes that gap with evidence, not screenshots.',
    publishedAt: '2026-08-10',
    readMinutes: 4,
    tags: ['foundations', 'market'],
    body: [
      'Agentic observability is the practice of collecting structured evidence about what coding agents do: which models they call, which files they touch, which commands they run, and what outcomes they produce.',
      'Unlike traditional APM, the goal is not to trace every HTTP request inside your product. The goal is to make agent work legible to engineering leaders who need to answer cost, risk, and delivery questions.',
      'ruwt.ai starts with detect-only policies and redaction-first storage. You get attribution and insight without storing raw prompts or source code.',
      'The market is early. Teams that instrument now will have baselines when agent usage scales from experiments to default workflow.',
    ],
  },
  {
    slug: 'detect-only-policies',
    title: 'Why detect-only beats block-by-default',
    excerpt:
      'Blocking agents mid-task creates shadow workflows. Recording violations preserves velocity while you learn where guardrails actually matter.',
    publishedAt: '2026-08-12',
    readMinutes: 3,
    tags: ['policies', 'governance'],
    body: [
      'Most agent platforms default to hard blocks: stop the run, revoke access, escalate immediately. That feels safe, but it trains teams to route around the tool.',
      'Detect-only policies flip the sequence. ruwt.ai records when an agent uses a disallowed model, touches a sensitive path, or skips tests — without stopping the session.',
      'You get a timeline of evidence, not a pile of frustrated engineers. Once patterns are clear, you can decide where enforcement belongs: in the agent, in CI, or in org policy.',
      'This is how mature security teams adopted logging before they adopted blocking. Agent governance will follow the same curve.',
    ],
  },
  {
    slug: 'redaction-by-default',
    title: 'Redaction by default, not as an afterthought',
    excerpt:
      'If your observability stack requires legal review before every rollout, adoption dies. Redaction has to be structural.',
    publishedAt: '2026-08-14',
    readMinutes: 3,
    tags: ['privacy', 'architecture'],
    body: [
      'Agent telemetry is sensitive by nature. Prompts, file paths, and command lines can expose secrets, customer data, or unreleased product details.',
      'ruwt.ai normalizes events into a versioned schema and applies redaction before persistence. Raw prompts are not stored. Paths and commands are classified, not copied verbatim when policy requires minimization.',
      'That design choice makes it realistic to roll out observability org-wide instead of limiting it to a single pilot team with a special exception.',
      'Download the collector, point it at your workflow, and start with local capture. Sync to ruwt.ai only when you are ready to share evidence with a workspace.',
    ],
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug);
}
