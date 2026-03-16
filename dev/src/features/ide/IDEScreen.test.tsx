// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockNavigate = vi.fn();
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, reset: vi.fn(), goBack: vi.fn() }),
}));
let mockAuthReturn: any = { user: { id: 'u1' }, loading: false };
vi.mock('@/shared/hooks/useAuthGuard', () => ({
  useAuthGuard: () => mockAuthReturn,
}));
vi.mock('@/shared/hooks/useDocumentMeta', () => ({ useDocumentMeta: () => {} }));
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens({ mono: true }));
vi.mock('@monaco-editor/react', () => ({
  __esModule: true,
  default: ({ value }: any) => <div data-testid="monaco-editor">{value}</div>,
}));
let mockLayoutReturn: any = {
  sidebarCollapsed: false,
  bottomCollapsed: false,
  sidebarPosition: 'left',
  resultsDock: 'bottom',
  activeBottomTab: 'terminal',
  setSidebarCollapsed: vi.fn(),
  setBottomCollapsed: vi.fn(),
  toggleSidebarPosition: vi.fn(),
  setResultsDock: vi.fn(),
  setActiveBottomTab: vi.fn(),
};
vi.mock('@/features/shared-ide/useIDELayout', () => ({
  useIDELayout: () => mockLayoutReturn,
}));
vi.mock('@/features/shared-ide/PanelResizeBar', () => ({
  PanelResizeBar: ({ direction }: any) => <div data-testid={`resize-bar-${direction}`} />,
}));

const { IDEScreen } = await import('./IDEScreen');

describe('IDEScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthReturn = { user: { id: 'u1' }, loading: false };
    mockLayoutReturn = {
      sidebarCollapsed: false,
      bottomCollapsed: false,
      sidebarPosition: 'left',
      resultsDock: 'bottom',
      activeBottomTab: 'terminal',
      setSidebarCollapsed: vi.fn(),
      setBottomCollapsed: vi.fn(),
      toggleSidebarPosition: vi.fn(),
      setResultsDock: vi.fn(),
      setActiveBottomTab: vi.fn(),
    };
  });

  it('renders the top bar with project name', () => {
    render(<IDEScreen />);
    expect(screen.getByText('Untitled Project')).toBeInTheDocument();
  });

  it('renders back button', () => {
    render(<IDEScreen />);
    const backBtn = screen.getByTestId('back-btn');
    expect(backBtn).toBeInTheDocument();
  });

  it('navigates to ProjectList when back button is clicked', () => {
    render(<IDEScreen />);
    fireEvent.click(screen.getByTestId('back-btn'));
    expect(mockNavigate).toHaveBeenCalledWith('ProjectList');
  });

  it('renders save button', () => {
    render(<IDEScreen />);
    expect(screen.getByTestId('save-btn')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('renders file tree with mock files', () => {
    render(<IDEScreen />);
    expect(screen.getByTestId('file-tree')).toBeInTheDocument();
    expect(screen.getByText('index.js')).toBeInTheDocument();
    expect(screen.getByText('package.json')).toBeInTheDocument();
    expect(screen.getByText('README.md')).toBeInTheDocument();
  });

  it('renders Monaco editor with starter code', async () => {
    render(<IDEScreen />);
    const editor = await waitFor(() => screen.getByTestId('monaco-editor'));
    expect(editor).toBeInTheDocument();
    expect(editor.textContent).toContain('Hello, world!');
  });

  it('renders terminal panel', () => {
    render(<IDEScreen />);
    expect(screen.getByTestId('terminal-panel')).toBeInTheDocument();
    expect(screen.getByText('Terminal')).toBeInTheDocument();
  });

  it('renders resize bars', () => {
    render(<IDEScreen />);
    expect(screen.getByTestId('resize-bar-horizontal')).toBeInTheDocument();
    expect(screen.getByTestId('resize-bar-vertical')).toBeInTheDocument();
  });

  it('renders editor panel', () => {
    render(<IDEScreen />);
    expect(screen.getByTestId('editor-panel')).toBeInTheDocument();
  });

  it('allows selecting a file in the file tree', () => {
    render(<IDEScreen />);
    fireEvent.click(screen.getByTestId('file-package.json'));
    // Verify the file item exists and can be clicked
    expect(screen.getByText('package.json')).toBeInTheDocument();
  });

  it('renders "Files" sidebar header', () => {
    render(<IDEScreen />);
    expect(screen.getByText('Files')).toBeInTheDocument();
  });

  it('renders terminal prompt', () => {
    render(<IDEScreen />);
    expect(screen.getByText('$')).toBeInTheDocument();
  });

  it('returns null when loading', () => {
    mockAuthReturn = { user: null, loading: true };
    const { container } = render(<IDEScreen />);
    expect(container.querySelector('[data-testid="editor-panel"]')).toBeNull();
  });

  it('hides sidebar when collapsed', () => {
    mockLayoutReturn = { ...mockLayoutReturn, sidebarCollapsed: true };
    const { container } = render(<IDEScreen />);
    expect(container.querySelector('[data-testid="file-tree"]')).toBeNull();
  });

  it('hides terminal when bottom collapsed', () => {
    mockLayoutReturn = { ...mockLayoutReturn, bottomCollapsed: true };
    const { container } = render(<IDEScreen />);
    expect(container.querySelector('[data-testid="terminal-panel"]')).toBeNull();
  });
});
