// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/shared/theme/colors', () => ({
  arena: {
    bg: '#0d1117',
    surface: '#161b22',
    surfaceHover: '#1c2128',
    border: 'rgba(240,246,252,0.1)',
    text: '#e6edf3',
    textMuted: '#8b929a',
    accent: '#c9a962',
    error: '#f85149',
  },
}));

import { FileTree, type FileEntry } from './FileTree';

const mockFiles: FileEntry[] = [
  {
    name: 'src',
    path: 'src',
    type: 'directory',
    children: [
      { name: 'index.ts', path: 'src/index.ts', type: 'file' },
      { name: 'utils.js', path: 'src/utils.js', type: 'file' },
    ],
  },
  { name: 'index.js', path: 'index.js', type: 'file' },
  { name: 'package.json', path: 'package.json', type: 'file' },
  { name: 'README.md', path: 'README.md', type: 'file' },
  { name: 'style.css', path: 'style.css', type: 'file' },
  { name: 'page.html', path: 'page.html', type: 'file' },
  { name: 'app.tsx', path: 'app.tsx', type: 'file' },
  { name: 'comp.jsx', path: 'comp.jsx', type: 'file' },
  { name: 'data', path: 'data', type: 'file' },
];

describe('FileTree', () => {
  it('renders file tree container with header', () => {
    render(
      <FileTree files={mockFiles} selectedFile={null} onSelectFile={vi.fn()} />
    );
    expect(screen.getByTestId('file-tree')).toBeInTheDocument();
    expect(screen.getByText('Files')).toBeInTheDocument();
  });

  it('renders top-level files and directories', () => {
    render(
      <FileTree files={mockFiles} selectedFile={null} onSelectFile={vi.fn()} />
    );
    expect(screen.getByText('src')).toBeInTheDocument();
    expect(screen.getByText('index.js')).toBeInTheDocument();
    expect(screen.getByText('package.json')).toBeInTheDocument();
    expect(screen.getByText('README.md')).toBeInTheDocument();
  });

  it('renders nested children when directory is expanded', () => {
    render(
      <FileTree files={mockFiles} selectedFile={null} onSelectFile={vi.fn()} />
    );
    // By default directories are expanded
    expect(screen.getByText('index.ts')).toBeInTheDocument();
    expect(screen.getByText('utils.js')).toBeInTheDocument();
  });

  it('calls onSelectFile when a file is clicked', () => {
    const onSelectFile = vi.fn();
    render(
      <FileTree files={mockFiles} selectedFile={null} onSelectFile={onSelectFile} />
    );
    fireEvent.click(screen.getByTestId('file-index.js'));
    expect(onSelectFile).toHaveBeenCalledWith('index.js');
  });

  it('calls onSelectFile for nested file click', () => {
    const onSelectFile = vi.fn();
    render(
      <FileTree files={mockFiles} selectedFile={null} onSelectFile={onSelectFile} />
    );
    fireEvent.click(screen.getByTestId('file-src/index.ts'));
    expect(onSelectFile).toHaveBeenCalledWith('src/index.ts');
  });

  it('highlights the selected file', () => {
    render(
      <FileTree files={mockFiles} selectedFile="index.js" onSelectFile={vi.fn()} />
    );
    const btn = screen.getByTestId('file-index.js');
    // surfaceHover background indicates selection (browser normalises to rgb)
    expect(btn.style.background).toContain('28, 33, 40');
  });

  it('collapses directory when clicked', () => {
    render(
      <FileTree files={mockFiles} selectedFile={null} onSelectFile={vi.fn()} />
    );
    // Children are visible initially
    expect(screen.getByText('index.ts')).toBeInTheDocument();

    // Click the directory to collapse
    fireEvent.click(screen.getByTestId('file-src'));

    // Children should now be hidden
    expect(screen.queryByText('index.ts')).toBeNull();
  });

  it('re-expands directory when clicked again', () => {
    render(
      <FileTree files={mockFiles} selectedFile={null} onSelectFile={vi.fn()} />
    );
    // Collapse
    fireEvent.click(screen.getByTestId('file-src'));
    expect(screen.queryByText('index.ts')).toBeNull();

    // Re-expand
    fireEvent.click(screen.getByTestId('file-src'));
    expect(screen.getByText('index.ts')).toBeInTheDocument();
  });

  it('does not call onSelectFile when a directory is clicked', () => {
    const onSelectFile = vi.fn();
    render(
      <FileTree files={mockFiles} selectedFile={null} onSelectFile={onSelectFile} />
    );
    fireEvent.click(screen.getByTestId('file-src'));
    expect(onSelectFile).not.toHaveBeenCalled();
  });

  it('shows correct icons for different file types', () => {
    render(
      <FileTree files={mockFiles} selectedFile={null} onSelectFile={vi.fn()} />
    );
    // JS icon
    const jsBtn = screen.getByTestId('file-index.js');
    expect(jsBtn.textContent).toContain('JS');
    // JSON icon
    const jsonBtn = screen.getByTestId('file-package.json');
    expect(jsonBtn.textContent).toContain('{}');
    // Markdown icon
    const mdBtn = screen.getByTestId('file-README.md');
    expect(mdBtn.textContent).toContain('#');
    // TS icon
    const tsBtn = screen.getByTestId('file-src/index.ts');
    expect(tsBtn.textContent).toContain('TS');
    // CSS icon
    const cssBtn = screen.getByTestId('file-style.css');
    expect(cssBtn.textContent).toContain('CS');
    // HTML icon
    const htmlBtn = screen.getByTestId('file-page.html');
    expect(htmlBtn.textContent).toContain('<>');
    // TSX icon
    const tsxBtn = screen.getByTestId('file-app.tsx');
    expect(tsxBtn.textContent).toContain('TX');
    // JSX icon
    const jsxBtn = screen.getByTestId('file-comp.jsx');
    expect(jsxBtn.textContent).toContain('JX');
    // No extension — fallback icon
    const noExtBtn = screen.getByTestId('file-data');
    expect(noExtBtn.textContent).toContain('··');
  });

  it('renders empty tree without errors', () => {
    const { container } = render(
      <FileTree files={[]} selectedFile={null} onSelectFile={vi.fn()} />
    );
    expect(container.firstChild).toBeTruthy();
    expect(screen.getByText('Files')).toBeInTheDocument();
  });

  it('sets aria-expanded on directory nodes', () => {
    render(
      <FileTree files={mockFiles} selectedFile={null} onSelectFile={vi.fn()} />
    );
    const dirBtn = screen.getByTestId('file-src');
    expect(dirBtn.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(dirBtn);
    expect(dirBtn.getAttribute('aria-expanded')).toBe('false');
  });

  it('does not set aria-expanded on file nodes', () => {
    render(
      <FileTree files={mockFiles} selectedFile={null} onSelectFile={vi.fn()} />
    );
    const fileBtn = screen.getByTestId('file-index.js');
    expect(fileBtn.getAttribute('aria-expanded')).toBeNull();
  });

  // ── Git status badge tests ───────────────────────────────────────

  it('shows git status badges when gitStatus is provided', () => {
    const gitStatus = {
      'index.js': 'modified' as const,
      'src/index.ts': 'added' as const,
      'style.css': 'deleted' as const,
      'data': 'untracked' as const,
    };
    render(
      <FileTree files={mockFiles} selectedFile={null} onSelectFile={vi.fn()} gitStatus={gitStatus} />
    );
    // Modified file shows M badge
    expect(screen.getByTestId('git-badge-index.js')).toBeInTheDocument();
    expect(screen.getByTestId('git-badge-index.js').textContent).toBe('M');

    // Added file shows + badge
    expect(screen.getByTestId('git-badge-src/index.ts')).toBeInTheDocument();
    expect(screen.getByTestId('git-badge-src/index.ts').textContent).toBe('+');

    // Deleted file shows - badge
    expect(screen.getByTestId('git-badge-style.css')).toBeInTheDocument();
    expect(screen.getByTestId('git-badge-style.css').textContent).toBe('-');

    // Untracked file shows ? badge
    expect(screen.getByTestId('git-badge-data')).toBeInTheDocument();
    expect(screen.getByTestId('git-badge-data').textContent).toBe('?');
  });

  it('does not show git badges when gitStatus is undefined', () => {
    render(
      <FileTree files={mockFiles} selectedFile={null} onSelectFile={vi.fn()} />
    );
    expect(screen.queryByTestId('git-badge-index.js')).toBeNull();
  });

  it('does not show git badge for files not in gitStatus map', () => {
    const gitStatus = { 'index.js': 'modified' as const };
    render(
      <FileTree files={mockFiles} selectedFile={null} onSelectFile={vi.fn()} gitStatus={gitStatus} />
    );
    // index.js has badge
    expect(screen.getByTestId('git-badge-index.js')).toBeInTheDocument();
    // package.json does not
    expect(screen.queryByTestId('git-badge-package.json')).toBeNull();
  });

  it('passes gitStatus to nested children', () => {
    const gitStatus = { 'src/utils.js': 'modified' as const };
    render(
      <FileTree files={mockFiles} selectedFile={null} onSelectFile={vi.fn()} gitStatus={gitStatus} />
    );
    expect(screen.getByTestId('git-badge-src/utils.js')).toBeInTheDocument();
    expect(screen.getByTestId('git-badge-src/utils.js').textContent).toBe('M');
  });
});
