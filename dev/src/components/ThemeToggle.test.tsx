// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeToggle } from './ThemeToggle';

const mockSetMode = vi.fn();
let mockMode = 'dark';

vi.mock('@/theme', () => ({
  useTheme: () => ({
    mode: mockMode,
    setMode: mockSetMode,
    colors: {
      primary: '#000', primaryForeground: '#fff', text: '#000',
      borderStrong: '#ccc', secondary: '#eee', secondaryForeground: '#333',
      accent: '#c9a962',
    },
    isDark: mockMode === 'dark',
  }),
  useColors: () => ({
    primary: '#000', primaryForeground: '#fff', text: '#000',
    borderStrong: '#ccc', secondary: '#eee', secondaryForeground: '#333',
    accent: '#c9a962',
  }),
}));

describe('ThemeToggle', () => {
  it('renders sun icon when in dark mode', () => {
    mockMode = 'dark';
    render(<ThemeToggle />);
    // The sun symbol is shown in dark mode
    expect(screen.getByText('\u2600')).toBeTruthy();
  });

  it('renders moon icon when in light mode', () => {
    mockMode = 'light';
    render(<ThemeToggle />);
    // The moon symbol is shown in light mode
    expect(screen.getByText('\u263D')).toBeTruthy();
  });

  it('calls setMode with light when toggling from dark', () => {
    mockMode = 'dark';
    mockSetMode.mockClear();
    render(<ThemeToggle />);
    fireEvent.click(screen.getByText('\u2600'));
    expect(mockSetMode).toHaveBeenCalledWith('light');
  });

  it('calls setMode with dark when toggling from light', () => {
    mockMode = 'light';
    mockSetMode.mockClear();
    render(<ThemeToggle />);
    fireEvent.click(screen.getByText('\u263D'));
    expect(mockSetMode).toHaveBeenCalledWith('dark');
  });
});
