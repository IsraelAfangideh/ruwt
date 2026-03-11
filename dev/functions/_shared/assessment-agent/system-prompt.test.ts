import { describe, it, expect } from 'vitest';
import { getAssessmentAgentTools, buildAssessmentAgentPrompt } from './system-prompt';

// ---------------------------------------------------------------------------
// getAssessmentAgentTools
// ---------------------------------------------------------------------------

describe('getAssessmentAgentTools', () => {
  const tools = getAssessmentAgentTools();

  it('returns exactly 8 tools', () => {
    expect(tools).toHaveLength(8);
  });

  it('every tool has name, description, and parameters fields', () => {
    for (const tool of tools) {
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('parameters');
      expect(typeof tool.name).toBe('string');
      expect(typeof tool.description).toBe('string');
      expect(tool.name.length).toBeGreaterThan(0);
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });

  it('returns all expected tool names', () => {
    const names = tools.map((t) => t.name);
    expect(names).toContain('search_challenges');
    expect(names).toContain('select_challenges');
    expect(names).toContain('remove_challenges');
    expect(names).toContain('set_weights');
    expect(names).toContain('set_time_limit');
    expect(names).toContain('set_branding');
    expect(names).toContain('create_custom_challenge');
    expect(names).toContain('set_pass_threshold');
  });

  it('has no duplicate tool names', () => {
    const names = tools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('every tool parameters block has type "object" and a properties map', () => {
    for (const tool of tools) {
      const params = tool.parameters as Record<string, unknown>;
      expect(params.type).toBe('object');
      expect(params).toHaveProperty('properties');
      expect(typeof params.properties).toBe('object');
    }
  });

  it('search_challenges has optional query, category, difficulty, language params', () => {
    const search = tools.find((t) => t.name === 'search_challenges')!;
    const params = search.parameters as Record<string, unknown>;
    const props = params.properties as Record<string, unknown>;
    expect(props).toHaveProperty('query');
    expect(props).toHaveProperty('category');
    expect(props).toHaveProperty('difficulty');
    expect(props).toHaveProperty('language');
    // All optional (empty required array)
    expect(params.required).toEqual([]);
  });

  it('select_challenges requires challengeIds array', () => {
    const tool = tools.find((t) => t.name === 'select_challenges')!;
    const params = tool.parameters as Record<string, unknown>;
    const props = params.properties as Record<string, unknown>;
    const challengeIds = props.challengeIds as Record<string, unknown>;
    expect(challengeIds.type).toBe('array');
    expect(params.required).toContain('challengeIds');
  });

  it('remove_challenges requires challengeIds array', () => {
    const tool = tools.find((t) => t.name === 'remove_challenges')!;
    const params = tool.parameters as Record<string, unknown>;
    expect(params.required).toContain('challengeIds');
  });

  it('set_weights requires all 5 scoring dimensions', () => {
    const tool = tools.find((t) => t.name === 'set_weights')!;
    const params = tool.parameters as Record<string, unknown>;
    const required = params.required as string[];
    expect(required).toContain('modelSelection');
    expect(required).toContain('promptEfficiency');
    expect(required).toContain('debugging');
    expect(required).toContain('strategy');
    expect(required).toContain('speed');
  });

  it('set_time_limit requires minutes param', () => {
    const tool = tools.find((t) => t.name === 'set_time_limit')!;
    const params = tool.parameters as Record<string, unknown>;
    expect(params.required).toContain('minutes');
  });

  it('set_branding has title, description, companyName, welcomeMessage with no required fields', () => {
    const tool = tools.find((t) => t.name === 'set_branding')!;
    const params = tool.parameters as Record<string, unknown>;
    const props = params.properties as Record<string, unknown>;
    expect(props).toHaveProperty('title');
    expect(props).toHaveProperty('description');
    expect(props).toHaveProperty('companyName');
    expect(props).toHaveProperty('welcomeMessage');
    expect(params.required).toEqual([]);
  });

  it('create_custom_challenge has extensive required fields for safety', () => {
    const tool = tools.find((t) => t.name === 'create_custom_challenge')!;
    const params = tool.parameters as Record<string, unknown>;
    const required = params.required as string[];
    expect(required).toContain('title');
    expect(required).toContain('description');
    expect(required).toContain('difficulty');
    expect(required).toContain('category');
    expect(required).toContain('language');
    expect(required).toContain('starterCode');
    expect(required).toContain('testCases');
    expect(required).toContain('testHarness');
  });

  it('create_custom_challenge supports optional hiddenTestCases and tags arrays', () => {
    const tool = tools.find((t) => t.name === 'create_custom_challenge')!;
    const params = tool.parameters as Record<string, unknown>;
    const props = params.properties as Record<string, unknown>;
    expect(props).toHaveProperty('hiddenTestCases');
    expect(props).toHaveProperty('tags');
    const required = params.required as string[];
    expect(required).not.toContain('hiddenTestCases');
    expect(required).not.toContain('tags');
  });

  it('set_pass_threshold requires enabled and mode, dimensions is optional', () => {
    const tool = tools.find((t) => t.name === 'set_pass_threshold')!;
    const params = tool.parameters as Record<string, unknown>;
    const required = params.required as string[];
    expect(required).toContain('enabled');
    expect(required).toContain('mode');
    expect(required).not.toContain('dimensions');
    expect(required).not.toContain('minOverall');
  });

  it('returns a new array on every call (no shared mutable state)', () => {
    const a = getAssessmentAgentTools();
    const b = getAssessmentAgentTools();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// buildAssessmentAgentPrompt
// ---------------------------------------------------------------------------

describe('buildAssessmentAgentPrompt', () => {
  // ----- Empty / minimal state -----

  it('renders a prompt with an empty catalog and no assessment', () => {
    const prompt = buildAssessmentAgentPrompt({
      challengeCatalog: [],
      currentAssessment: null,
      orgCustomChallenges: [],
    });

    expect(prompt).toContain('## Challenge Catalog (0 challenges)');
    expect(prompt).toContain('No assessment created yet.');
    expect(prompt).toContain('(none)');
  });

  // ----- Catalog rendering -----

  it('lists each catalog challenge with id, title, difficulty, category, language, skill, and tags', () => {
    const prompt = buildAssessmentAgentPrompt({
      challengeCatalog: [
        {
          id: 'ch-001',
          title: 'Fix the Broken Cache',
          difficulty: 'medium',
          category: 'iterative_debugging',
          skillTested: 'cache invalidation',
          language: 'typescript',
          tags: '["cache","debugging"]',
        },
        {
          id: 'ch-002',
          title: 'Optimal Model Router',
          difficulty: 'hard',
          category: 'model_selection',
          skillTested: 'model routing',
          language: 'python',
          tags: '["ai","routing"]',
        },
      ],
      currentAssessment: null,
      orgCustomChallenges: [],
    });

    expect(prompt).toContain('## Challenge Catalog (2 challenges)');
    expect(prompt).toContain('[ch-001] "Fix the Broken Cache" | medium | iterative_debugging | typescript | skill: cache invalidation | tags: cache, debugging');
    expect(prompt).toContain('[ch-002] "Optimal Model Router" | hard | model_selection | python | skill: model routing | tags: ai, routing');
  });

  it('renders "general" when skillTested is null', () => {
    const prompt = buildAssessmentAgentPrompt({
      challengeCatalog: [{
        id: 'ch-010',
        title: 'Warm Up',
        difficulty: 'easy',
        category: 'practice',
        skillTested: null,
        language: 'javascript',
        tags: null,
      }],
      currentAssessment: null,
      orgCustomChallenges: [],
    });

    expect(prompt).toContain('skill: general');
  });

  it('renders empty tags string when tags is null', () => {
    const prompt = buildAssessmentAgentPrompt({
      challengeCatalog: [{
        id: 'ch-010',
        title: 'Warm Up',
        difficulty: 'easy',
        category: 'practice',
        skillTested: 'basics',
        language: 'javascript',
        tags: null,
      }],
      currentAssessment: null,
      orgCustomChallenges: [],
    });

    expect(prompt).toContain('tags: ');
    // Should end after "tags: " with no actual tag values
    expect(prompt).toMatch(/tags: \n|tags: $/m);
  });

  // ----- Assessment state rendering -----

  it('renders current assessment state with all fields populated', () => {
    const prompt = buildAssessmentAgentPrompt({
      challengeCatalog: [],
      currentAssessment: {
        title: 'Senior Backend Assessment',
        description: 'Evaluates backend AI fluency',
        timeLimit: 3600,                   // 60 minutes in seconds
        selectedChallengeIds: ['ch-001', 'ch-002', 'ch-003'],
        weights: { modelSelection: 20, promptEfficiency: 25, debugging: 25, strategy: 20, speed: 10 },
        companyName: 'Acme Corp',
        welcomeMessage: 'Welcome to the Acme assessment!',
      },
      orgCustomChallenges: [],
    });

    expect(prompt).toContain('Title: Senior Backend Assessment');
    expect(prompt).toContain('Description: Evaluates backend AI fluency');
    expect(prompt).toContain('Time Limit: 60 minutes');
    expect(prompt).toContain('Selected Challenges (3): ch-001, ch-002, ch-003');
    expect(prompt).toContain('"modelSelection":20');
    expect(prompt).toContain('Company: Acme Corp');
    expect(prompt).toContain('Welcome Message: Welcome to the Acme assessment!');
  });

  it('shows (not set) for optional assessment fields that are empty/null', () => {
    const prompt = buildAssessmentAgentPrompt({
      challengeCatalog: [],
      currentAssessment: {
        title: '',
        description: null,
        timeLimit: 2700,
        selectedChallengeIds: [],
        weights: {},
        companyName: null,
        welcomeMessage: null,
      },
      orgCustomChallenges: [],
    });

    expect(prompt).toContain('Title: (not set)');
    expect(prompt).toContain('Description: (not set)');
    expect(prompt).toContain('Selected Challenges (0): (none)');
    expect(prompt).toContain('Company: (not set)');
    expect(prompt).toContain('Welcome Message: (not set)');
  });

  it('converts timeLimit from seconds to minutes using Math.floor', () => {
    const prompt = buildAssessmentAgentPrompt({
      challengeCatalog: [],
      currentAssessment: {
        title: 'Test',
        description: null,
        timeLimit: 5400, // 90 minutes
        selectedChallengeIds: [],
        weights: {},
      },
      orgCustomChallenges: [],
    });

    expect(prompt).toContain('Time Limit: 90 minutes');
  });

  it('floors non-round time limits (e.g. 3700s = 61min)', () => {
    const prompt = buildAssessmentAgentPrompt({
      challengeCatalog: [],
      currentAssessment: {
        title: 'Test',
        description: null,
        timeLimit: 3700, // 61.66... minutes, floor to 61
        selectedChallengeIds: [],
        weights: {},
      },
      orgCustomChallenges: [],
    });

    expect(prompt).toContain('Time Limit: 61 minutes');
  });

  // ----- Custom challenges -----

  it('renders org custom challenges when present', () => {
    const prompt = buildAssessmentAgentPrompt({
      challengeCatalog: [],
      currentAssessment: null,
      orgCustomChallenges: [
        { id: 'custom-1', title: 'Internal API Challenge', difficulty: 'hard', category: 'backend_api', status: 'draft' },
        { id: 'custom-2', title: 'React Perf Challenge', difficulty: 'medium', category: 'frontend', status: 'active' },
      ],
    });

    expect(prompt).toContain("## Your Organization's Custom Challenges");
    expect(prompt).toContain('[custom-1] "Internal API Challenge" | hard | backend_api | status: draft');
    expect(prompt).toContain('[custom-2] "React Perf Challenge" | medium | frontend | status: active');
  });

  it('shows (none) when orgCustomChallenges is empty', () => {
    const prompt = buildAssessmentAgentPrompt({
      challengeCatalog: [],
      currentAssessment: null,
      orgCustomChallenges: [],
    });

    expect(prompt).toContain("## Your Organization's Custom Challenges");
    expect(prompt).toContain('(none)');
  });

  // ----- Prompt structure -----

  it('includes the Ruwt identity and purpose statement', () => {
    const prompt = buildAssessmentAgentPrompt({
      challengeCatalog: [],
      currentAssessment: null,
      orgCustomChallenges: [],
    });

    expect(prompt).toContain('You are the Ruwt Assessment Builder AI');
    expect(prompt).toContain('HOW candidates use AI tools');
  });

  it('includes all major prompt sections', () => {
    const prompt = buildAssessmentAgentPrompt({
      challengeCatalog: [],
      currentAssessment: null,
      orgCustomChallenges: [],
    });

    expect(prompt).toContain('## Challenge Catalog');
    expect(prompt).toContain("## Your Organization's Custom Challenges");
    expect(prompt).toContain('## Current Assessment State');
    expect(prompt).toContain('## Guidelines');
    expect(prompt).toContain('### Analyzing Job Descriptions');
    expect(prompt).toContain('### Role-Based Recommendations');
    expect(prompt).toContain('### Time Limits');
    expect(prompt).toContain('### Custom Challenges');
    expect(prompt).toContain('### Communication Style');
    expect(prompt).toContain('### CRITICAL: Tool Usage Rules');
  });

  it('includes role-based recommendation tiers', () => {
    const prompt = buildAssessmentAgentPrompt({
      challengeCatalog: [],
      currentAssessment: null,
      orgCustomChallenges: [],
    });

    expect(prompt).toContain('Junior / Entry-Level');
    expect(prompt).toContain('Mid-Level');
    expect(prompt).toContain('Senior / Staff');
    expect(prompt).toContain('AI/ML Engineer');
    expect(prompt).toContain('Frontend');
    expect(prompt).toContain('Backend');
    expect(prompt).toContain('Full Stack');
  });

  it('mentions tool availability in the prompt text', () => {
    const prompt = buildAssessmentAgentPrompt({
      challengeCatalog: [],
      currentAssessment: null,
      orgCustomChallenges: [],
    });

    expect(prompt).toContain('search challenges');
    expect(prompt).toContain('select/remove challenges');
    expect(prompt).toContain('set weights');
    expect(prompt).toContain('set time limits');
    expect(prompt).toContain('set branding');
    expect(prompt).toContain('create custom challenges');
    expect(prompt).toContain('pass/fail thresholds');
  });

  // ----- Integration: full scenario -----

  it('assembles a complete prompt with catalog, assessment, and custom challenges', () => {
    const prompt = buildAssessmentAgentPrompt({
      challengeCatalog: [
        { id: 'c1', title: 'A', difficulty: 'easy', category: 'practice', skillTested: 'basics', language: 'javascript', tags: '["warmup"]' },
        { id: 'c2', title: 'B', difficulty: 'hard', category: 'backend_api', skillTested: 'api design', language: 'typescript', tags: null },
      ],
      currentAssessment: {
        title: 'Full Stack Assessment',
        description: 'End-to-end evaluation',
        timeLimit: 5400,
        selectedChallengeIds: ['c1'],
        weights: { modelSelection: 20, promptEfficiency: 20, debugging: 20, strategy: 20, speed: 20 },
        companyName: 'StartupCo',
        welcomeMessage: 'Good luck!',
      },
      orgCustomChallenges: [
        { id: 'x1', title: 'Custom Thing', difficulty: 'medium', category: 'devops', status: 'active' },
      ],
    });

    // All sections present and populated
    expect(prompt).toContain('## Challenge Catalog (2 challenges)');
    expect(prompt).toContain('[c1]');
    expect(prompt).toContain('[c2]');
    expect(prompt).toContain('Title: Full Stack Assessment');
    expect(prompt).toContain('Selected Challenges (1): c1');
    expect(prompt).toContain('Company: StartupCo');
    expect(prompt).toContain('[x1] "Custom Thing"');
  });
});
