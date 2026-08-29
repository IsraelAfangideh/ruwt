// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HoldToPeek } from './HoldToPeek';

describe('HoldToPeek', () => {
  it('hides the trace until held', () => {
    render(<HoldToPeek thinking="secret plan" />);
    expect(screen.queryByTestId('peek-trace')).toBeNull();
    fireEvent.pointerDown(screen.getByTestId('hold-to-peek'));
    expect(screen.getByTestId('peek-trace').textContent).toContain('secret plan');
    fireEvent.pointerUp(screen.getByTestId('hold-to-peek'));
    expect(screen.queryByTestId('peek-trace')).toBeNull();
  });

  it('hides on pointer leave', () => {
    render(<HoldToPeek thinking="leave me" />);
    fireEvent.pointerDown(screen.getByTestId('hold-to-peek'));
    expect(screen.getByTestId('peek-trace')).toBeInTheDocument();
    fireEvent.pointerLeave(screen.getByTestId('hold-to-peek'));
    expect(screen.queryByTestId('peek-trace')).toBeNull();
  });

  it('stays open after the match when locked', () => {
    render(<HoldToPeek thinking="full trace" lockedOpen />);
    expect(screen.getByTestId('peek-trace').textContent).toContain('full trace');
  });

  it('opens on Space and closes on keyup', () => {
    render(<HoldToPeek thinking="kbd" />);
    const btn = screen.getByTestId('hold-to-peek');
    fireEvent.keyDown(btn, { key: ' ' });
    expect(screen.getByTestId('peek-trace')).toBeInTheDocument();
    fireEvent.keyUp(btn, { key: ' ' });
    expect(screen.queryByTestId('peek-trace')).toBeNull();
  });
});
