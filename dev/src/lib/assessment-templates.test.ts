import { describe, it, expect } from 'vitest';
import { ASSESSMENT_TEMPLATES, getTemplateById, type AssessmentTemplate } from './assessment-templates';

describe('assessment-templates', () => {
  // ---------------------------------------------------------------------------
  // ASSESSMENT_TEMPLATES constant
  // ---------------------------------------------------------------------------
  describe('ASSESSMENT_TEMPLATES', () => {
    it('has 4 templates', () => {
      expect(ASSESSMENT_TEMPLATES).toHaveLength(4);
    });

    it('each template has a unique id', () => {
      const ids = ASSESSMENT_TEMPLATES.map((t) => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('each template has a non-empty name and description', () => {
      for (const t of ASSESSMENT_TEMPLATES) {
        expect(t.name.length).toBeGreaterThan(0);
        expect(t.description.length).toBeGreaterThan(0);
      }
    });

    it('each template has a positive time limit', () => {
      for (const t of ASSESSMENT_TEMPLATES) {
        expect(t.timeLimitMinutes).toBeGreaterThan(0);
      }
    });

    it('each template has at least 1 challenge title', () => {
      for (const t of ASSESSMENT_TEMPLATES) {
        expect(t.challengeTitles.length).toBeGreaterThan(0);
      }
    });

    it('each template has at least 1 category', () => {
      for (const t of ASSESSMENT_TEMPLATES) {
        expect(t.categories.length).toBeGreaterThan(0);
      }
    });

    it('contains the expected template ids', () => {
      const ids = ASSESSMENT_TEMPLATES.map((t) => t.id);
      expect(ids).toContain('frontend-dev');
      expect(ids).toContain('backend-dev');
      expect(ids).toContain('fullstack');
      expect(ids).toContain('ai-power-user');
    });
  });

  // ---------------------------------------------------------------------------
  // Individual template validation
  // ---------------------------------------------------------------------------
  describe('frontend-dev template', () => {
    it('has a 60-minute time limit', () => {
      const t = getTemplateById('frontend-dev')!;
      expect(t.timeLimitMinutes).toBe(60);
    });

    it('has 5 challenge titles', () => {
      const t = getTemplateById('frontend-dev')!;
      expect(t.challengeTitles).toHaveLength(5);
    });

    it('covers model_selection and prompt_efficiency categories', () => {
      const t = getTemplateById('frontend-dev')!;
      expect(t.categories).toContain('model_selection');
      expect(t.categories).toContain('prompt_efficiency');
    });
  });

  describe('backend-dev template', () => {
    it('has a 90-minute time limit', () => {
      const t = getTemplateById('backend-dev')!;
      expect(t.timeLimitMinutes).toBe(90);
    });

    it('includes data structure challenges', () => {
      const t = getTemplateById('backend-dev')!;
      expect(t.challengeTitles).toContain('LRU Cache');
      expect(t.challengeTitles).toContain('Binary Search Tree');
    });
  });

  describe('fullstack template', () => {
    it('has the longest time limit at 120 minutes', () => {
      const t = getTemplateById('fullstack')!;
      expect(t.timeLimitMinutes).toBe(120);
    });

    it('has the most challenge titles (6)', () => {
      const t = getTemplateById('fullstack')!;
      expect(t.challengeTitles).toHaveLength(6);
    });

    it('covers 3 categories including multi_model_strategy', () => {
      const t = getTemplateById('fullstack')!;
      expect(t.categories).toHaveLength(3);
      expect(t.categories).toContain('multi_model_strategy');
    });
  });

  describe('ai-power-user template', () => {
    it('has a 90-minute time limit', () => {
      const t = getTemplateById('ai-power-user')!;
      expect(t.timeLimitMinutes).toBe(90);
    });

    it('covers 3 categories focused on strategic AI usage', () => {
      const t = getTemplateById('ai-power-user')!;
      expect(t.categories).toHaveLength(3);
      expect(t.categories).toContain('multi_model_strategy');
      expect(t.categories).toContain('model_selection');
      expect(t.categories).toContain('prompt_efficiency');
    });
  });

  // ---------------------------------------------------------------------------
  // getTemplateById
  // ---------------------------------------------------------------------------
  describe('getTemplateById', () => {
    it('finds each template by its id', () => {
      for (const t of ASSESSMENT_TEMPLATES) {
        const found = getTemplateById(t.id);
        expect(found).toBeDefined();
        expect(found).toEqual(t);
      }
    });

    it('returns undefined for an unknown id', () => {
      expect(getTemplateById('devops-engineer')).toBeUndefined();
    });

    it('returns undefined for an empty string', () => {
      expect(getTemplateById('')).toBeUndefined();
    });

    it('is case-sensitive', () => {
      expect(getTemplateById('Frontend-Dev')).toBeUndefined();
      expect(getTemplateById('FRONTEND-DEV')).toBeUndefined();
    });
  });
});
