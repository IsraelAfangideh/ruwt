import { describe, it, expect } from 'vitest';
import { buildAfiShareSvg } from './og-afi-svg';

describe('buildAfiShareSvg', () => {
  it('generates SVG with correct dimensions and structure', () => {
    const svg = buildAfiShareSvg({
      name: 'Alice',
      score: 650,
      tier: 'advanced',
      certification: null,
      solveCount: 20,
    });
    expect(svg).toContain('width="1200"');
    expect(svg).toContain('height="630"');
    expect(svg).toContain('Alice');
    expect(svg).toContain('650');
    expect(svg).toContain('ADVANCED');
    expect(svg).toContain('20 challenges solved');
    expect(svg).toContain('ruwt.dev');
  });

  it('renders exceptional tier color', () => {
    const svg = buildAfiShareSvg({
      name: 'Bob',
      score: 800,
      tier: 'exceptional',
      certification: 'ai_fluent_expert',
      solveCount: 100,
    });
    expect(svg).toContain('#c9a962');
    expect(svg).toContain('EXCEPTIONAL');
    expect(svg).toContain('AI-Fluent Expert Verified');
    expect(svg).toContain('100 challenges solved');
  });

  it('renders proficient tier color', () => {
    const svg = buildAfiShareSvg({
      name: 'Carol',
      score: 400,
      tier: 'proficient',
      certification: 'ai_fluent_pro',
      solveCount: 50,
    });
    expect(svg).toContain('#8a7d5a');
    expect(svg).toContain('PROFICIENT');
    expect(svg).toContain('AI-Fluent Pro Verified');
  });

  it('renders developing tier color', () => {
    const svg = buildAfiShareSvg({
      name: 'Dave',
      score: 200,
      tier: 'developing',
      certification: 'ai_fluent',
      solveCount: 10,
    });
    expect(svg).toContain('#6b6560');
    expect(svg).toContain('DEVELOPING');
    expect(svg).toContain('AI-Fluent Verified');
  });

  it('renders default tier color for unknown tier', () => {
    const svg = buildAfiShareSvg({
      name: 'Eve',
      score: 50,
      tier: 'novice',
      certification: null,
      solveCount: 2,
    });
    expect(svg).toContain('#4a4540');
    expect(svg).toContain('NOVICE');
    // No certification text when null
    expect(svg).not.toContain('Verified');
  });

  it('handles singular "challenge" for solveCount=1', () => {
    const svg = buildAfiShareSvg({
      name: 'Frank',
      score: 100,
      tier: 'novice',
      certification: null,
      solveCount: 1,
    });
    expect(svg).toContain('1 challenge solved');
    expect(svg).not.toContain('challenges solved');
  });

  it('escapes XML special characters in name', () => {
    const svg = buildAfiShareSvg({
      name: 'A&B<C>"D\'E',
      score: 300,
      tier: 'proficient',
      certification: null,
      solveCount: 5,
    });
    expect(svg).toContain('&amp;');
    expect(svg).toContain('&lt;');
    expect(svg).toContain('&gt;');
    expect(svg).toContain('&quot;');
    expect(svg).toContain('&apos;');
  });

  it('truncates long names to 30 chars with ellipsis', () => {
    const longName = 'A'.repeat(50);
    const svg = buildAfiShareSvg({
      name: longName,
      score: 300,
      tier: 'proficient',
      certification: null,
      solveCount: 5,
    });
    expect(svg).toContain('A'.repeat(30) + '...');
  });

  it('handles unknown certification gracefully', () => {
    const svg = buildAfiShareSvg({
      name: 'Test',
      score: 300,
      tier: 'proficient',
      certification: 'unknown_cert',
      solveCount: 5,
    });
    // Unknown certification returns empty string for certLabel
    expect(svg).not.toContain('Verified');
  });
});
