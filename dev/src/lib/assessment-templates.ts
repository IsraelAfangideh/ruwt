/**
 * Assessment templates for quick setup.
 * Challenge IDs reference the seeded challenges in D1.
 */

export interface AssessmentTemplate {
  id: string;
  name: string;
  description: string;
  timeLimitMinutes: number;
  challengeTitles: string[]; // Match by title since IDs are UUIDs
  categories: string[];
}

export const ASSESSMENT_TEMPLATES: AssessmentTemplate[] = [
  {
    id: 'frontend-dev',
    name: 'Frontend Developer',
    description: 'Tests DOM manipulation, event handling, and UI-focused AI usage. Mix of model selection and prompt efficiency.',
    timeLimitMinutes: 60,
    challengeTitles: [
      'String Formatter',
      'Event Emitter',
      'Debounce & Throttle',
      'Template Engine',
      'URL Parser',
    ],
    categories: ['model_selection', 'prompt_efficiency'],
  },
  {
    id: 'backend-dev',
    name: 'Backend Developer',
    description: 'Tests data structures, algorithms, and API design. Emphasis on iterative debugging and model selection.',
    timeLimitMinutes: 90,
    challengeTitles: [
      'Data Pipeline',
      'LRU Cache',
      'Binary Search Tree',
      'CSV Parser',
      'Graph Shortest Path',
    ],
    categories: ['model_selection', 'iterative_debugging'],
  },
  {
    id: 'fullstack',
    name: 'Full Stack Developer',
    description: 'Broad assessment covering all skill dimensions. Tests model switching strategy and debugging skills.',
    timeLimitMinutes: 120,
    challengeTitles: [
      'Fullstack CRUD',
      'Merge Sort',
      'API Client Generator',
      'Fix Failing Tests',
      'Markdown Parser',
      'Broken Middleware',
    ],
    categories: ['multi_model_strategy', 'prompt_efficiency', 'iterative_debugging'],
  },
  {
    id: 'ai-power-user',
    name: 'AI Power User',
    description: 'Advanced assessment focusing on strategic AI usage. Tests cost optimization and multi-model strategy.',
    timeLimitMinutes: 90,
    challengeTitles: [
      'Code Review & Fix',
      'Optimize Naive Solution',
      'Test Then Implement',
      'FizzBuzz Budget',
      'Mini Reactive System',
    ],
    categories: ['multi_model_strategy', 'model_selection', 'prompt_efficiency'],
  },
];

export function getTemplateById(id: string): AssessmentTemplate | undefined {
  return ASSESSMENT_TEMPLATES.find((t) => t.id === id);
}
