// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mockNavigate = vi.fn();
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, reset: vi.fn(), goBack: vi.fn() }),
}));
let mockAuthReturn: any = { user: { id: 'u1' }, loading: false };
vi.mock('@/shared/hooks/useAuthGuard', () => ({
  useAuthGuard: () => mockAuthReturn,
}));
vi.mock('@/shared/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));
vi.mock('@/shared/ui/Card', () => ({
  Card: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  CardContent: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
  CardDescription: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/shared/ui/Button', () => ({
  Button: ({ children, onPress, ...props }: any) => <button onClick={onPress} {...props}>{children}</button>,
}));
vi.mock('@/shared/hooks/useDocumentMeta', () => ({ useDocumentMeta: () => {} }));
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

const { ProjectListScreen } = await import('./ProjectListScreen');

describe('ProjectListScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthReturn = { user: { id: 'u1' }, loading: false };
  });

  it('renders inside DashboardLayout', () => {
    const { container } = render(<ProjectListScreen />);
    expect(container.querySelector('[data-testid="dashboard-layout"]')).not.toBeNull();
  });

  it('renders "My Projects" title', () => {
    render(<ProjectListScreen />);
    expect(screen.getByText('My Projects')).toBeInTheDocument();
  });

  it('renders "New Project" button', () => {
    render(<ProjectListScreen />);
    expect(screen.getByText('New Project')).toBeInTheDocument();
  });

  it('shows empty state text', () => {
    render(<ProjectListScreen />);
    expect(screen.getByText('No projects yet')).toBeInTheDocument();
    expect(screen.getByText('No projects yet. Create your first project to get started.')).toBeInTheDocument();
  });

  it('navigates to IDE when "New Project" button is clicked', () => {
    render(<ProjectListScreen />);
    fireEvent.click(screen.getByText('New Project'));
    expect(mockNavigate).toHaveBeenCalledWith('IDE');
  });

  it('navigates to IDE when "Create Project" button is clicked', () => {
    render(<ProjectListScreen />);
    fireEvent.click(screen.getByText('Create Project'));
    expect(mockNavigate).toHaveBeenCalledWith('IDE');
  });

  it('renders the code icon in empty state', () => {
    render(<ProjectListScreen />);
    expect(screen.getByText('</>')).toBeInTheDocument();
  });

  it('returns null when loading', () => {
    mockAuthReturn = { user: null, loading: true };
    const { container } = render(<ProjectListScreen />);
    expect(container.querySelector('[data-testid="dashboard-layout"]')).toBeNull();
  });
});
