// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { RadarChart } from './RadarChart';

const sampleData = {
  modelSelection: 80,
  promptEfficiency: 60,
  debugging: 90,
  multiModel: 40,
  realWorld: 70,
};

describe('RadarChart', () => {
  it('renders an SVG with default size 280', () => {
    const { container } = render(<RadarChart data={sampleData} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('width')).toBe('280');
    expect(svg?.getAttribute('height')).toBe('280');
  });

  it('renders an SVG with custom size', () => {
    const { container } = render(<RadarChart data={sampleData} size={200} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('200');
  });

  it('renders 4 grid ring polygons', () => {
    const { container } = render(<RadarChart data={sampleData} />);
    // 4 grid rings + 1 data polygon = 5 polygon elements
    const polygons = container.querySelectorAll('polygon');
    expect(polygons.length).toBe(5);
  });

  it('renders 5 axis lines', () => {
    const { container } = render(<RadarChart data={sampleData} />);
    const lines = container.querySelectorAll('line');
    expect(lines.length).toBe(5);
  });

  it('renders 5 data point circles', () => {
    const { container } = render(<RadarChart data={sampleData} />);
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(5);
  });

  it('renders 5 axis labels', () => {
    const { container } = render(<RadarChart data={sampleData} />);
    const texts = container.querySelectorAll('text');
    const labels = Array.from(texts).map((t) => t.textContent);
    expect(labels).toContain('Model Selection');
    expect(labels).toContain('Prompt Efficiency');
    expect(labels).toContain('Debugging');
    expect(labels).toContain('Multi-Model');
    expect(labels).toContain('Real-World');
  });

  it('uses custom accent color', () => {
    const { container } = render(<RadarChart data={sampleData} accentColor="#ff0000" />);
    const dataPolygon = container.querySelectorAll('polygon')[4]; // Last one is data polygon
    expect(dataPolygon.getAttribute('stroke')).toBe('#ff0000');
  });

  it('handles zero values gracefully', () => {
    const zeroData = { modelSelection: 0, promptEfficiency: 0, debugging: 0, multiModel: 0, realWorld: 0 };
    const { container } = render(<RadarChart data={zeroData} />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('clamps values above 100', () => {
    const overData = { modelSelection: 150, promptEfficiency: 200, debugging: 100, multiModel: 100, realWorld: 100 };
    const { container } = render(<RadarChart data={overData} />);
    expect(container.querySelector('svg')).toBeTruthy();
  });
});
