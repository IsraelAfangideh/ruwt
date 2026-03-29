// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Notepad } from './Notepad';

vi.mock('@/shared/theme/colors', () => ({
  arena: {
    bg: '#0d1117',
    text: '#e6edf3',
  },
}));

describe('Notepad', () => {
  it('renders a textarea', () => {
    const { container } = render(<Notepad value="" onChange={vi.fn()} />);
    const textarea = container.querySelector('textarea');
    expect(textarea).toBeTruthy();
  });

  it('displays the provided value', () => {
    const { container } = render(<Notepad value="My notes here" onChange={vi.fn()} />);
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.value).toBe('My notes here');
  });

  it('renders placeholder text', () => {
    render(<Notepad value="" onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText(/Jot down your approach/)).toBeInTheDocument();
  });

  it('calls onChange when text is entered', () => {
    const mockOnChange = vi.fn();
    const { container } = render(<Notepad value="" onChange={mockOnChange} />);
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'new text' } });
    expect(mockOnChange).toHaveBeenCalledWith('new text');
  });

  it('has spellCheck disabled', () => {
    const { container } = render(<Notepad value="" onChange={vi.fn()} />);
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.getAttribute('spellcheck')).toBe('false');
  });
});
