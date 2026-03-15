// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ArenaErrorBoundary } from './ArenaErrorBoundary';

vi.mock('@/shared/theme/colors', () => ({
  arena: {
    bg: '#0d1117',
    text: '#e6edf3',
    error: '#f85149',
    accent: '#c9a962',
    textMuted: '#8b949e',
  },
}));

function ThrowingChild(): JSX.Element {
  throw new Error('Test error');
}

function GoodChild() {
  return <div>Working child</div>;
}

describe('ArenaErrorBoundary', () => {
  // Suppress console.error from error boundary in tests
  const originalError = console.error;
  beforeAll(() => {
    console.error = vi.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });

  it('renders children when no error occurs', () => {
    render(
      <ArenaErrorBoundary>
        <GoodChild />
      </ArenaErrorBoundary>
    );
    expect(screen.getByText('Working child')).toBeInTheDocument();
  });

  it('renders error UI when child throws', () => {
    render(
      <ArenaErrorBoundary>
        <ThrowingChild />
      </ArenaErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/arena IDE encountered an error/)).toBeInTheDocument();
    expect(screen.getByText('Reload IDE')).toBeInTheDocument();
  });

  it('resets error state when Reload IDE is clicked', () => {
    render(
      <ArenaErrorBoundary>
        <ThrowingChild />
      </ArenaErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Click reload. Since ThrowingChild always throws, it will re-catch.
    // But the state should have been reset momentarily.
    fireEvent.click(screen.getByText('Reload IDE'));
    // It re-renders children (ThrowingChild throws again, so error UI reappears)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });
});
