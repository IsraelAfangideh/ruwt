/**
 * TaskRunner: Reads tasks from a parsed .ruwt.yml config and shows them in a
 * dropdown. Clicking a task dispatches the command to the terminal.
 *
 * Integrates into the IDE top bar as a dropdown button.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { arena } from '@/shared/theme/colors';
import type { RuwtTask } from '@/lib/config/ruwt-config';

/** Status of a running task. */
export type TaskStatus = 'idle' | 'running' | 'completed' | 'failed';

export interface TaskRunnerProps {
  /** Available tasks from .ruwt.yml */
  tasks: Record<string, RuwtTask>;
  /** Callback to send a command to the terminal */
  onRunCommand: (command: string) => void;
}

export function TaskRunner({ tasks, onRunCommand }: TaskRunnerProps) {
  const [open, setOpen] = useState(false);
  const [runningTask, setRunningTask] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<TaskStatus>('idle');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const taskEntries = Object.entries(tasks);

  // Close dropdown on outside click
  useEffect(() => {
    /* istanbul ignore next -- @preserve */
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Cleanup pending timers on unmount
  useEffect(() => {
    return () => {
      for (const t of timersRef.current) clearTimeout(t);
    };
  }, []);

  const handleRunTask = useCallback((taskKey: string, command: string) => {
    setRunningTask(taskKey);
    setTaskStatus('running');
    setOpen(false);
    onRunCommand(command);
    // Mark completed after a short delay (we can't track real process exit from here)
    const t1 = setTimeout(() => {
      setTaskStatus('completed');
      const t2 = setTimeout(() => {
        setRunningTask(null);
        setTaskStatus('idle');
      }, 2000);
      timersRef.current.push(t2);
    }, 1000);
    timersRef.current.push(t1);
  }, [onRunCommand]);

  if (taskEntries.length === 0) return null;

  return (
    <div ref={dropdownRef} style={containerStyle} data-testid="task-runner">
      <button
        onClick={() => setOpen((prev) => !prev)}
        style={triggerBtnStyle}
        data-testid="task-runner-trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {runningTask && taskStatus === 'running' ? (
          <span data-testid="task-running-label">
            Running: {tasks[runningTask]?.label ?? runningTask}
          </span>
        ) : (
          'Tasks'
        )}
        <span style={caretStyle}>{open ? '\u25B2' : '\u25BC'}</span>
      </button>

      {open && (
        <div style={dropdownStyle} role="listbox" data-testid="task-runner-dropdown">
          {taskEntries.map(([key, task]) => (
            <button
              key={key}
              onClick={() => handleRunTask(key, task.command)}
              style={taskItemStyle}
              role="option"
              data-testid={`task-item-${key}`}
              disabled={taskStatus === 'running'}
            >
              <span style={taskLabelStyle}>{task.label}</span>
              <span style={taskCommandStyle}>{task.command}</span>
            </button>
          ))}
        </div>
      )}

      {taskStatus === 'completed' && runningTask && (
        <span style={statusBadgeStyle} data-testid="task-completed-badge">
          Done
        </span>
      )}
    </div>
  );
}

// ── Inline styles ──────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};

const triggerBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: `1px solid ${arena.border}`,
  color: arena.textMuted,
  cursor: 'pointer',
  fontSize: 12,
  padding: '4px 10px',
  borderRadius: 4,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

const caretStyle: React.CSSProperties = {
  fontSize: 8,
};

const dropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  marginTop: 4,
  minWidth: 280,
  maxHeight: 320,
  overflowY: 'auto',
  background: arena.surface,
  border: `1px solid ${arena.border}`,
  borderRadius: 6,
  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
  zIndex: 100,
};

const taskItemStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  width: '100%',
  padding: '8px 12px',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  textAlign: 'left',
  borderBottom: `1px solid ${arena.border}`,
  color: arena.text,
};

const taskLabelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: arena.text,
};

const taskCommandStyle: React.CSSProperties = {
  fontSize: 11,
  color: arena.textMuted,
  fontFamily: 'monospace',
  marginTop: 2,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: 260,
};

const statusBadgeStyle: React.CSSProperties = {
  fontSize: 10,
  color: arena.success,
  fontWeight: 600,
  padding: '2px 6px',
  borderRadius: 3,
  background: 'rgba(63,185,80,0.12)',
};
