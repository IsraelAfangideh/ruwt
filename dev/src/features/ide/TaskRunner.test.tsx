// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

vi.mock('@/shared/theme/colors', () => ({
  arena: {
    bg: '#0d1117',
    surface: '#161b22',
    surfaceHover: '#1c2128',
    border: 'rgba(240,246,252,0.1)',
    text: '#e6edf3',
    textMuted: '#8b929a',
    accent: '#c9a962',
    accentBg: 'rgba(201,169,98,0.12)',
    success: '#3fb950',
    error: '#f85149',
  },
}));

const { TaskRunner } = await import('./TaskRunner');

const sampleTasks = {
  test: { command: 'cd dev && npx vitest run', label: 'Run all tests' },
  typecheck: { command: 'cd dev && npx tsc --noEmit', label: 'TypeScript check' },
  dev: { command: 'cd dev && npm run dev', label: 'Start dev server' },
};

describe('TaskRunner', () => {
  const onRunCommand = vi.fn<(command: string) => void>();

  beforeEach(() => {
    vi.useFakeTimers();
    onRunCommand.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders trigger button with "Tasks" label', () => {
    render(<TaskRunner tasks={sampleTasks} onRunCommand={onRunCommand} />);
    expect(screen.getByTestId('task-runner-trigger')).toBeInTheDocument();
    expect(screen.getByText('Tasks')).toBeInTheDocument();
  });

  it('returns null when tasks is empty', () => {
    const { container } = render(<TaskRunner tasks={{}} onRunCommand={onRunCommand} />);
    expect(container.querySelector('[data-testid="task-runner"]')).toBeNull();
  });

  it('toggles dropdown open and closed on click', () => {
    render(<TaskRunner tasks={sampleTasks} onRunCommand={onRunCommand} />);

    // Initially closed
    expect(screen.queryByTestId('task-runner-dropdown')).toBeNull();

    // Open
    fireEvent.click(screen.getByTestId('task-runner-trigger'));
    expect(screen.getByTestId('task-runner-dropdown')).toBeInTheDocument();

    // Close
    fireEvent.click(screen.getByTestId('task-runner-trigger'));
    expect(screen.queryByTestId('task-runner-dropdown')).toBeNull();
  });

  it('shows all tasks in the dropdown', () => {
    render(<TaskRunner tasks={sampleTasks} onRunCommand={onRunCommand} />);
    fireEvent.click(screen.getByTestId('task-runner-trigger'));

    expect(screen.getByTestId('task-item-test')).toBeInTheDocument();
    expect(screen.getByTestId('task-item-typecheck')).toBeInTheDocument();
    expect(screen.getByTestId('task-item-dev')).toBeInTheDocument();
    expect(screen.getByText('Run all tests')).toBeInTheDocument();
    expect(screen.getByText('TypeScript check')).toBeInTheDocument();
    expect(screen.getByText('Start dev server')).toBeInTheDocument();
  });

  it('shows task commands in the dropdown', () => {
    render(<TaskRunner tasks={sampleTasks} onRunCommand={onRunCommand} />);
    fireEvent.click(screen.getByTestId('task-runner-trigger'));

    expect(screen.getByText('cd dev && npx vitest run')).toBeInTheDocument();
  });

  it('runs a task when clicked and calls onRunCommand', () => {
    render(<TaskRunner tasks={sampleTasks} onRunCommand={onRunCommand} />);
    fireEvent.click(screen.getByTestId('task-runner-trigger'));
    fireEvent.click(screen.getByTestId('task-item-test'));

    expect(onRunCommand).toHaveBeenCalledWith('cd dev && npx vitest run');
  });

  it('closes dropdown after running a task', () => {
    render(<TaskRunner tasks={sampleTasks} onRunCommand={onRunCommand} />);
    fireEvent.click(screen.getByTestId('task-runner-trigger'));
    fireEvent.click(screen.getByTestId('task-item-test'));

    expect(screen.queryByTestId('task-runner-dropdown')).toBeNull();
  });

  it('shows running label while task is in progress', () => {
    render(<TaskRunner tasks={sampleTasks} onRunCommand={onRunCommand} />);
    fireEvent.click(screen.getByTestId('task-runner-trigger'));
    fireEvent.click(screen.getByTestId('task-item-test'));

    expect(screen.getByTestId('task-running-label')).toBeInTheDocument();
    expect(screen.getByText('Running: Run all tests')).toBeInTheDocument();
  });

  it('shows completed badge after task finishes', () => {
    render(<TaskRunner tasks={sampleTasks} onRunCommand={onRunCommand} />);
    fireEvent.click(screen.getByTestId('task-runner-trigger'));
    fireEvent.click(screen.getByTestId('task-item-test'));

    // Advance past the 1s running timer
    act(() => { vi.advanceTimersByTime(1100); });

    expect(screen.getByTestId('task-completed-badge')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('resets to idle after completed badge disappears', () => {
    render(<TaskRunner tasks={sampleTasks} onRunCommand={onRunCommand} />);
    fireEvent.click(screen.getByTestId('task-runner-trigger'));
    fireEvent.click(screen.getByTestId('task-item-test'));

    // Advance past running + completed timers (1s + 2s)
    act(() => { vi.advanceTimersByTime(3100); });

    // Should be back to "Tasks" label
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.queryByTestId('task-completed-badge')).toBeNull();
    expect(screen.queryByTestId('task-running-label')).toBeNull();
  });

  it('disables task items while a task is running', () => {
    render(<TaskRunner tasks={sampleTasks} onRunCommand={onRunCommand} />);

    // Run a task
    fireEvent.click(screen.getByTestId('task-runner-trigger'));
    fireEvent.click(screen.getByTestId('task-item-test'));

    // Re-open dropdown — items should be disabled
    fireEvent.click(screen.getByTestId('task-runner-trigger'));
    expect(screen.getByTestId('task-item-typecheck')).toBeDisabled();
  });

  it('sets aria-expanded correctly on trigger button', () => {
    render(<TaskRunner tasks={sampleTasks} onRunCommand={onRunCommand} />);
    const trigger = screen.getByTestId('task-runner-trigger');

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('has listbox role on dropdown', () => {
    render(<TaskRunner tasks={sampleTasks} onRunCommand={onRunCommand} />);
    fireEvent.click(screen.getByTestId('task-runner-trigger'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('has option role on task items', () => {
    render(<TaskRunner tasks={sampleTasks} onRunCommand={onRunCommand} />);
    fireEvent.click(screen.getByTestId('task-runner-trigger'));
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('closes dropdown when clicking outside', () => {
    render(
      <div data-testid="outside">
        <TaskRunner tasks={sampleTasks} onRunCommand={onRunCommand} />
      </div>,
    );
    fireEvent.click(screen.getByTestId('task-runner-trigger'));
    expect(screen.getByTestId('task-runner-dropdown')).toBeInTheDocument();

    // Click outside
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByTestId('task-runner-dropdown')).toBeNull();
  });
});
