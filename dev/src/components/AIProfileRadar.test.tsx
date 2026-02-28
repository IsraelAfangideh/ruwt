// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { AIProfileRadar, type AIProfile } from './AIProfileRadar';

vi.mock('react-native', () => ({
  View: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  StyleSheet: { create: (s: any) => s },
}));

vi.mock('@/theme', () => ({
  useColors: () => ({
    border: '#ccc',
    accent: '#c9a962',
    textMuted: '#888',
  }),
}));

vi.mock('@/theme/tokens', () => ({
  fontFamily: { body: 'sans-serif', display: 'serif' },
}));

const fullProfile: AIProfile = {
  modelSelection: 80,
  promptEfficiency: 60,
  debugging: 90,
  strategy: 40,
  speed: 70,
};

describe('AIProfileRadar', () => {
  it('renders an SVG element with the default size', () => {
    const { container } = render(<AIProfileRadar profile={fullProfile} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('width')).toBe('280');
    expect(svg?.getAttribute('height')).toBe('280');
  });

  it('renders an SVG element with a custom size', () => {
    const { container } = render(<AIProfileRadar profile={fullProfile} size={200} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('200');
  });

  it('renders all 5 axis labels with their values', () => {
    const { container } = render(<AIProfileRadar profile={fullProfile} />);
    const texts = container.querySelectorAll('text');
    const labels = Array.from(texts).map((t) => t.textContent);
    expect(labels).toContain('Model Selection (80)');
    expect(labels).toContain('Prompt Efficiency (60)');
    expect(labels).toContain('Debugging (90)');
    expect(labels).toContain('Strategy (40)');
    expect(labels).toContain('Speed (70)');
  });

  it('renders 4 grid rings', () => {
    const { container } = render(<AIProfileRadar profile={fullProfile} />);
    // Grid rings + data polygon path = 5 total <path> elements
    const paths = container.querySelectorAll('path');
    expect(paths.length).toBe(5); // 4 rings + 1 data polygon
  });

  it('renders 5 axis lines', () => {
    const { container } = render(<AIProfileRadar profile={fullProfile} />);
    const lines = container.querySelectorAll('line');
    expect(lines.length).toBe(5);
  });

  it('renders 5 data point circles', () => {
    const { container } = render(<AIProfileRadar profile={fullProfile} />);
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(5);
  });

  it('renders with all-zero profile without crashing', () => {
    const zeroProfile: AIProfile = {
      modelSelection: 0,
      promptEfficiency: 0,
      debugging: 0,
      strategy: 0,
      speed: 0,
    };
    const { container } = render(<AIProfileRadar profile={zeroProfile} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('renders with all-100 profile without crashing', () => {
    const maxProfile: AIProfile = {
      modelSelection: 100,
      promptEfficiency: 100,
      debugging: 100,
      strategy: 100,
      speed: 100,
    };
    const { container } = render(<AIProfileRadar profile={maxProfile} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });
});
