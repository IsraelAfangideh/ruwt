/**
 * Build the system prompt and native tools for the Assessment Builder AI agent.
 * The agent helps hiring managers create assessments by analyzing job descriptions,
 * recommending challenges, setting weights, and generating custom challenges.
 *
 * Tools are defined as Cloudflare Workers AI native function calling format
 * (passed in the API request body, not embedded in the prompt).
 */

import type { ToolDefinition } from '../ai-stream';

interface CatalogEntry {
  id: string;
  title: string;
  difficulty: string;
  category: string;
  skillTested: string | null;
  language: string;
  tags: string | null;
}

interface AssessmentState {
  title: string;
  description: string | null;
  timeLimit: number;
  selectedChallengeIds: string[];
  weights: Record<string, number>;
  companyName?: string | null;
  welcomeMessage?: string | null;
}

interface CustomChallengeEntry {
  id: string;
  title: string;
  difficulty: string;
  category: string;
  status: string;
}

/**
 * Returns the 8 tools the assessment agent can use, in Cloudflare native format.
 */
export function getAssessmentAgentTools(): ToolDefinition[] {
  return [
    {
      name: 'search_challenges',
      description: 'Search the challenge catalog by criteria. Returns matching challenges.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Free-text search query' },
          category: { type: 'string', description: 'Filter by category (e.g. model_selection, prompt_efficiency, iterative_debugging, backend_api, frontend, data_engineering, devops)' },
          difficulty: { type: 'string', description: 'Filter by difficulty: easy, medium, or hard' },
          language: { type: 'string', description: 'Filter by language: javascript, typescript, or python' },
        },
        required: [],
      },
    },
    {
      name: 'select_challenges',
      description: 'Add challenges to the current assessment by their IDs.',
      parameters: {
        type: 'object',
        properties: {
          challengeIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of challenge IDs to add',
          },
        },
        required: ['challengeIds'],
      },
    },
    {
      name: 'remove_challenges',
      description: 'Remove challenges from the current assessment by their IDs.',
      parameters: {
        type: 'object',
        properties: {
          challengeIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of challenge IDs to remove',
          },
        },
        required: ['challengeIds'],
      },
    },
    {
      name: 'set_weights',
      description: 'Set the scoring dimension weights for the assessment. Values must sum to 100.',
      parameters: {
        type: 'object',
        properties: {
          modelSelection: { type: 'number', description: 'Weight for model selection dimension (0-100)' },
          promptEfficiency: { type: 'number', description: 'Weight for prompt efficiency dimension (0-100)' },
          debugging: { type: 'number', description: 'Weight for debugging dimension (0-100)' },
          strategy: { type: 'number', description: 'Weight for strategy dimension (0-100)' },
          speed: { type: 'number', description: 'Weight for speed dimension (0-100)' },
        },
        required: ['modelSelection', 'promptEfficiency', 'debugging', 'strategy', 'speed'],
      },
    },
    {
      name: 'set_time_limit',
      description: 'Set the assessment time limit in minutes (5-240).',
      parameters: {
        type: 'object',
        properties: {
          minutes: { type: 'number', description: 'Time limit in minutes' },
        },
        required: ['minutes'],
      },
    },
    {
      name: 'set_branding',
      description: 'Set assessment metadata: title, description, company name, welcome message.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Assessment title' },
          description: { type: 'string', description: 'Assessment description' },
          companyName: { type: 'string', description: 'Company name for branding' },
          welcomeMessage: { type: 'string', description: 'Welcome message shown to candidates' },
        },
        required: [],
      },
    },
    {
      name: 'create_custom_challenge',
      description: 'Generate a custom challenge. Saved as draft for hiring manager review before use.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Challenge title' },
          description: { type: 'string', description: 'Full description in markdown (requirements, constraints, example I/O)' },
          difficulty: { type: 'string', description: 'easy, medium, or hard' },
          category: { type: 'string', description: 'practice, model_selection, prompt_efficiency, iterative_debugging, backend_api, frontend, data_engineering, or devops' },
          skillTested: { type: 'string', description: 'One-line summary of the skill tested' },
          language: { type: 'string', description: 'javascript, typescript, or python' },
          starterCode: { type: 'string', description: 'Code template with TODOs for the candidate' },
          testCases: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                input: { type: 'string' },
                expectedOutput: { type: 'string' },
              },
            },
            description: 'Visible test cases',
          },
          hiddenTestCases: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                input: { type: 'string' },
                expectedOutput: { type: 'string' },
              },
            },
            description: 'Hidden test cases (edge cases)',
          },
          testHarness: { type: 'string', description: 'Code that wraps the solution, runs tests, prints PASS/FAIL per case' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Tags for categorization' },
        },
        required: ['title', 'description', 'difficulty', 'category', 'language', 'starterCode', 'testCases', 'testHarness'],
      },
    },
    {
      name: 'set_pass_threshold',
      description: 'Configure automatic pass/fail grading thresholds.',
      parameters: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', description: 'Enable auto-grading' },
          mode: { type: 'string', description: 'all_dimensions or weighted_average' },
          minOverall: { type: 'number', description: 'Minimum overall weighted average (0-100)' },
          dimensions: {
            type: 'object',
            properties: {
              modelSelection: { type: 'number' },
              promptEfficiency: { type: 'number' },
              debugging: { type: 'number' },
              strategy: { type: 'number' },
              speed: { type: 'number' },
            },
            description: 'Per-dimension minimum scores (0-100)',
          },
        },
        required: ['enabled', 'mode'],
      },
    },
  ];
}

export function buildAssessmentAgentPrompt(params: {
  challengeCatalog: CatalogEntry[];
  currentAssessment: AssessmentState | null;
  orgCustomChallenges: CustomChallengeEntry[];
}): string {
  const { challengeCatalog, currentAssessment, orgCustomChallenges } = params;

  // Build challenge catalog summary
  const catalogLines = challengeCatalog.map((ch) => {
    let tags = '';
    if (ch.tags) {
      try { tags = JSON.parse(ch.tags).join(', '); } catch { /* malformed tags — skip */ }
    }
    return `- [${ch.id}] "${ch.title}" | ${ch.difficulty} | ${ch.category} | ${ch.language} | skill: ${ch.skillTested || 'general'} | tags: ${tags}`;
  });

  const assessmentState = currentAssessment
    ? [
        `Title: ${currentAssessment.title || '(not set)'}`,
        `Description: ${currentAssessment.description || '(not set)'}`,
        `Time Limit: ${Math.floor(currentAssessment.timeLimit / 60)} minutes`,
        `Selected Challenges (${currentAssessment.selectedChallengeIds.length}): ${currentAssessment.selectedChallengeIds.join(', ') || '(none)'}`,
        `Weights: ${JSON.stringify(currentAssessment.weights)}`,
        `Company: ${currentAssessment.companyName || '(not set)'}`,
        `Welcome Message: ${currentAssessment.welcomeMessage || '(not set)'}`,
      ].join('\n')
    : 'No assessment created yet.';

  const customChallengeLines = orgCustomChallenges.length > 0
    ? orgCustomChallenges.map((ch) => `- [${ch.id}] "${ch.title}" | ${ch.difficulty} | ${ch.category} | status: ${ch.status}`)
    : ['(none)'];

  return `You are the Ruwt Assessment Builder AI. You help hiring managers create effective AI-efficiency assessments for evaluating engineering candidates.

Ruwt is unique: it measures HOW candidates use AI tools, not just whether they get the right answer. Assessments track model selection strategy, prompt efficiency, debugging approach, cost management, and speed.

You have tools available to search challenges, select/remove challenges, set weights, set time limits, set branding, create custom challenges, and configure pass/fail thresholds. Use them to take actions. Always explain your reasoning before calling tools.

## Challenge Catalog (${catalogLines.length} challenges)

${catalogLines.join('\n')}

## Your Organization's Custom Challenges

${customChallengeLines.join('\n')}

## Current Assessment State

${assessmentState}

## Guidelines

### Analyzing Job Descriptions
- Extract: required skills, seniority level, tech stack, focus areas
- Map skills to challenge categories (frontend → frontend challenges, API design → backend_api, etc.)
- Consider the "AI fluency" angle — which categories matter most for this role?

### Role-Based Recommendations
- **Junior / Entry-Level**: 3–4 easy/medium challenges, weight debugging and prompt efficiency higher (candidates learning to use AI effectively)
- **Mid-Level**: 4–5 mixed challenges, balanced weights
- **Senior / Staff**: 5–6 medium/hard challenges, weight strategy and model selection higher (expect sophisticated AI tool use)
- **AI/ML Engineer**: Include multi_model_strategy challenges, weight model selection 30%+
- **Frontend**: Include frontend category challenges, consider prompt efficiency for UI work
- **Backend**: Include backend_api and data_engineering, weight debugging higher
- **Full Stack**: Mix of frontend + backend + general

### Time Limits
- 3 challenges: 30–45 minutes
- 4–5 challenges: 45–75 minutes
- 6+ challenges: 75–120 minutes
- Hard challenges need more time per challenge

### Custom Challenges
- Make them non-trivial and reflective of real engineering work
- Test cases should be thorough: include edge cases in hiddenTestCases
- The test harness should:
  1. Import/call the candidate's function
  2. Run each test case
  3. Print "PASS" or "FAIL" for each
  4. Be language-appropriate (JavaScript: Node.js, Python: standard lib)
- Starter code should have clear TODOs and function signatures
- Difficulty should match the role level

### Communication Style
- Be helpful and proactive — suggest improvements
- Explain WHY you're recommending specific challenges or weights
- If the job description is vague, ask clarifying questions before building
- Keep responses concise but informative

### CRITICAL: Tool Usage Rules
1. You MUST use tools to take actions. Never just describe what you would do — actually call the tools.
2. Challenge IDs are listed in the catalog above in [square brackets]. You MUST use these exact IDs when calling select_challenges. NEVER invent IDs like "frontend_1" or "backend_challenge_2".
3. Weights MUST sum to exactly 100. Example: modelSelection=25, promptEfficiency=25, debugging=20, strategy=15, speed=15.
4. When building an assessment, ALWAYS call ALL of these tools in sequence:
   - set_branding (title + description)
   - select_challenges (with real IDs from the catalog above)
   - set_weights (values summing to 100)
   - set_time_limit (appropriate minutes)
5. Do NOT use search_challenges unless the user asks to search. The full catalog is already listed above — pick challenge IDs directly from it.
6. Do NOT call the same tool twice with the same or similar parameters.
7. A complete assessment needs: a title, selected challenges, score weights summing to 100, and a time limit.`;

}
