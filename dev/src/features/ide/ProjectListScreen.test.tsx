// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

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
  Button: ({ children, onPress, disabled, testID, ...props }: any) => (
    <button onClick={onPress} disabled={disabled} data-testid={testID} {...props}>{children}</button>
  ),
}));
vi.mock('@/shared/hooks/useDocumentMeta', () => ({ useDocumentMeta: () => {} }));
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const { ProjectListScreen } = await import('./ProjectListScreen');

describe('ProjectListScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthReturn = { user: { id: 'u1' }, loading: false };
    // Default: empty project list
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ projects: [] }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders inside DashboardLayout', async () => {
    const { container } = render(<ProjectListScreen />);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="dashboard-layout"]')).not.toBeNull();
    });
  });

  it('renders "My Projects" title', async () => {
    render(<ProjectListScreen />);
    await waitFor(() => {
      expect(screen.getByText('My Projects')).toBeInTheDocument();
    });
  });

  it('renders "New Project" button', async () => {
    render(<ProjectListScreen />);
    await waitFor(() => {
      expect(screen.getByText('New Project')).toBeInTheDocument();
    });
  });

  it('shows empty state text when no projects', async () => {
    render(<ProjectListScreen />);
    await waitFor(() => {
      expect(screen.getByText('No projects yet')).toBeInTheDocument();
    });
    expect(screen.getByText('No projects yet. Create your first project to get started.')).toBeInTheDocument();
  });

  it('navigates to IDE when "New Project" button is clicked', async () => {
    render(<ProjectListScreen />);
    await waitFor(() => {
      expect(screen.getByText('New Project')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('New Project'));
    expect(mockNavigate).toHaveBeenCalledWith('IDE');
  });

  it('navigates to IDE when "Create Project" button is clicked', async () => {
    render(<ProjectListScreen />);
    await waitFor(() => {
      expect(screen.getByText('Create Project')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Create Project'));
    expect(mockNavigate).toHaveBeenCalledWith('IDE');
  });

  it('renders the code icon in empty state', async () => {
    render(<ProjectListScreen />);
    await waitFor(() => {
      expect(screen.getByText('</>')).toBeInTheDocument();
    });
  });

  it('returns null when loading', () => {
    mockAuthReturn = { user: null, loading: true };
    const { container } = render(<ProjectListScreen />);
    expect(container.querySelector('[data-testid="dashboard-layout"]')).toBeNull();
  });

  it('renders project cards when projects exist', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        projects: [
          { id: 'p1', name: 'My App', fileCount: 5, lastOpenedAt: new Date().toISOString(), createdAt: '2024-01-01' },
          { id: 'p2', name: 'Other', fileCount: 0, lastOpenedAt: null, createdAt: '2024-01-01' },
        ],
      }),
    });

    render(<ProjectListScreen />);
    await waitFor(() => {
      expect(screen.getByText('My App')).toBeInTheDocument();
    });
    expect(screen.getByText('Other')).toBeInTheDocument();
    expect(screen.getByTestId('project-card-p1')).toBeInTheDocument();
    expect(screen.getByTestId('project-card-p2')).toBeInTheDocument();
  });

  it('navigates to IDE with projectId when clicking a project card', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        projects: [
          { id: 'p1', name: 'My App', fileCount: 3, lastOpenedAt: null, createdAt: '2024-01-01' },
        ],
      }),
    });

    render(<ProjectListScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('project-card-p1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('project-card-p1'));
    expect(mockNavigate).toHaveBeenCalledWith('IDE', { projectId: 'p1' });
  });

  it('deletes a project when delete button is clicked', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          projects: [
            { id: 'p1', name: 'Delete Me', fileCount: 1, lastOpenedAt: null, createdAt: '2024-01-01' },
          ],
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ok: true }) });

    render(<ProjectListScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('delete-project-p1')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('delete-project-p1'));
    });

    // Wait for the project to disappear
    await waitFor(() => {
      expect(screen.queryByTestId('project-card-p1')).not.toBeInTheDocument();
    });
  });

  it('shows error state when fetch fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    render(<ProjectListScreen />);
    await waitFor(() => {
      expect(screen.getByText('Failed to load projects')).toBeInTheDocument();
    });
  });

  it('retries fetch when retry button is clicked', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ projects: [] }),
      });

    render(<ProjectListScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('retry-btn')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('retry-btn'));
    });

    await waitFor(() => {
      expect(screen.getByText('No projects yet')).toBeInTheDocument();
    });
  });

  it('shows file count and relative date for projects', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        projects: [
          { id: 'p1', name: 'Test', fileCount: 7, lastOpenedAt: new Date().toISOString(), createdAt: '2024-01-01' },
        ],
      }),
    });

    render(<ProjectListScreen />);
    await waitFor(() => {
      expect(screen.getByText(/7 files/)).toBeInTheDocument();
    });
  });

  it('handles project with null fileCount', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        projects: [
          { id: 'p1', name: 'Test', fileCount: null, lastOpenedAt: null, createdAt: '2024-01-01' },
        ],
      }),
    });

    render(<ProjectListScreen />);
    await waitFor(() => {
      expect(screen.getByText(/0 files/)).toBeInTheDocument();
    });
  });

  it('handles delete failure gracefully', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          projects: [
            { id: 'p1', name: 'Keep Me', fileCount: 1, lastOpenedAt: null, createdAt: '2024-01-01' },
          ],
        }),
      })
      .mockRejectedValueOnce(new Error('delete failed'));

    render(<ProjectListScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('delete-project-p1')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('delete-project-p1'));
    });

    // Project should still be visible since delete failed
    await waitFor(() => {
      expect(screen.getByTestId('project-card-p1')).toBeInTheDocument();
    });
  });
});
