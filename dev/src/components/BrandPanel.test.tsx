// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrandPanel } from './BrandPanel';

describe('BrandPanel', () => {
  it('renders the Ruwt logo text', () => {
    render(<BrandPanel />);
    expect(screen.getByText('Ruwt')).toBeTruthy();
  });

  it('renders the tagline', () => {
    render(<BrandPanel />);
    expect(screen.getByText(/Prove you can use AI/)).toBeTruthy();
    expect(screen.getByText('better than anyone')).toBeTruthy();
  });

  it('renders all three feature items', () => {
    render(<BrandPanel />);
    expect(screen.getByText('60+ real-world challenges')).toBeTruthy();
    expect(screen.getByText('15 AI models across 5 tiers')).toBeTruthy();
    expect(screen.getByText('50,000 free credits to start')).toBeTruthy();
  });

  it('renders checkmark icons for each feature', () => {
    render(<BrandPanel />);
    const checks = screen.getAllByText('\u2713');
    expect(checks.length).toBe(3);
  });
});
