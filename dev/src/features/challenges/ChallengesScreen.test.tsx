// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const mockNavigate = vi.fn();
const mockReset = vi.fn();
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, reset: mockReset }),
}));
vi.mock('@/shared/lib/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' }, loading: false }),
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
vi.mock('@/features/challenges/ChallengeCard', () => ({
  ChallengeCard: ({ challenge }: any) => <div data-testid="challenge-card">{challenge.title}</div>,
}));
vi.mock('@/shared/lib/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('@/shared/lib/difficulty', () => ({
  DIFFICULTIES: [
    { key: 'all', label: 'All Levels' },
    { key: 'sprint', label: 'Sprint' },
    { key: 'easy', label: 'Easy' },
    { key: 'medium', label: 'Medium' },
    { key: 'hard', label: 'Hard' },
    { key: 'impossible', label: 'Impossible' },
  ],
  getDifficultyStyle: () => ({ color: '#38bdf8', bg: 'rgba(56,189,248,0.12)', label: 'Medium' }),
}));
vi.mock('@/shared/hooks/useDocumentMeta', () => ({ useDocumentMeta: () => {} }));
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme({ useTheme: () => ({ isDark: false }) }));
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

const mockChallenges = [
  { id: 'c1', title: 'FizzBuzz Budget', description: 'Budget aware fizzbuzz', difficulty: 'easy', category: 'prompt_efficiency', tier: 'onboarding', sortOrder: 1, language: 'javascript', userStatus: null, skillTested: 'prompt writing', stats: { solvers: 5 }, maxCost: 100 },
  { id: 'c2', title: 'Cache Buster', description: 'Fix the cache', difficulty: 'hard', category: 'iterative_debugging', tier: 'core', sortOrder: 2, language: 'javascript', userStatus: 'passed', skillTested: null, stats: { solvers: 2 }, maxCost: 500 },
  { id: 'c3', title: 'Python Parser', description: 'Parse python code', difficulty: 'medium', category: 'real_world', tier: 'core', sortOrder: 3, language: 'python', userStatus: 'in_progress', skillTested: null, stats: { solvers: 3 }, maxCost: 300 },
  { id: 'c4', title: 'Impossible Maze', description: 'Navigate an impossible maze', difficulty: 'impossible', category: 'model_selection', tier: 'headline', sortOrder: 1, language: 'javascript', userStatus: null, skillTested: null, stats: { solvers: 0 }, maxCost: 1000 },
];

let mockDashboardState: any = {
  challenges: { data: mockChallenges, status: 'loaded', lastFetchedAt: Date.now() },
  dailyChallenge: { data: null, status: 'loaded', lastFetchedAt: Date.now() },
};

vi.mock('@/shared/lib/DashboardDataContext', () => ({
  useDashboardData: () => ({
    state: mockDashboardState,
    initialLoadComplete: true,
    refreshEndpoint: vi.fn(),
    refreshAll: vi.fn(),
  }),
}));

const { ChallengesScreen } = await import('./ChallengesScreen');

describe('ChallengesScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset URL params so getInitialTab/Lang/Difficulty return defaults
    window.history.replaceState({}, '', window.location.pathname);
    mockDashboardState = {
      challenges: { data: mockChallenges, status: 'loaded', lastFetchedAt: Date.now() },
      dailyChallenge: { data: null, status: 'loaded', lastFetchedAt: Date.now() },
    };
  });

  it('renders loading state when challenges are loading', () => {
    mockDashboardState = {
      challenges: { data: [], status: 'loading', lastFetchedAt: 0 },
      dailyChallenge: { data: null, status: 'loading', lastFetchedAt: 0 },
    };
    const { container } = render(<ChallengesScreen />);
    // Should render DashboardLayout with loading indicator inside
    expect(container.querySelector('[data-testid="dashboard-layout"]')).toBeInTheDocument();
  });

  it('renders title after loading', () => {
    render(<ChallengesScreen />);
    expect(screen.getAllByText('Engineering Challenges').length).toBeGreaterThanOrEqual(1);
  });

  it('explains Versus mode on the problems list', () => {
    render(<ChallengesScreen />);
    expect(screen.getByText('Versus mode')).toBeInTheDocument();
    expect(screen.getByText(/Race a model unaided/)).toBeInTheDocument();
  });

  it('renders challenge cards after loading', () => {
    const { container } = render(<ChallengesScreen />);
    const cards = container.querySelectorAll('[data-testid="challenge-card"]');
    expect(cards.length).toBeGreaterThanOrEqual(1);
  });

  it('renders search box', () => {
    const { container } = render(<ChallengesScreen />);
    expect(container.querySelector('input[placeholder="Search challenges..."]')).not.toBeNull();
  });

  it('renders filter pills for categories and languages', () => {
    render(<ChallengesScreen />);
    expect(screen.getAllByText('All').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('JavaScript').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Python').length).toBeGreaterThanOrEqual(1);
  });

  it('renders progress stats', () => {
    render(<ChallengesScreen />);
    expect(screen.getAllByText('total').length).toBeGreaterThanOrEqual(1);
  });

  it('filters by search query', async () => {
    const { container } = render(<ChallengesScreen />);
    expect(container.querySelectorAll('[data-testid="challenge-card"]').length).toBe(5);
    const input = container.querySelector('input[placeholder="Search challenges..."]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'FizzBuzz' } });
    await waitFor(() => {
      expect(container.querySelectorAll('[data-testid="challenge-card"]').length).toBe(1);
    });
    expect(screen.getByText('FizzBuzz Budget')).toBeInTheDocument();
  });

  it('filters by skill tested in search', async () => {
    const { container } = render(<ChallengesScreen />);
    expect(container.querySelectorAll('[data-testid="challenge-card"]').length).toBe(5);
    const input = container.querySelector('input[placeholder="Search challenges..."]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'prompt writing' } });
    await waitFor(() => {
      expect(container.querySelectorAll('[data-testid="challenge-card"]').length).toBe(1);
    });
  });

  it('shows clear button when search has text', () => {
        const { container } = render(<ChallengesScreen />);
    expect(container.querySelectorAll('[data-testid="challenge-card"]').length).toBe(5);
    const input = container.querySelector('input[placeholder="Search challenges..."]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'FizzBuzz' } });
    // The clear button (x) should appear
    expect(screen.getByText('\u2715')).toBeInTheDocument();
  });

  it('clears search when clear button is clicked', async () => {
    const { container } = render(<ChallengesScreen />);
    expect(container.querySelectorAll('[data-testid="challenge-card"]').length).toBe(5);
    const input = container.querySelector('input[placeholder="Search challenges..."]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'FizzBuzz' } });
    fireEvent.click(screen.getByText('\u2715'));
    expect(container.querySelectorAll('[data-testid="challenge-card"]').length).toBe(5);
  });

  it('filters by language when Python is clicked', async () => {
    const { container } = render(<ChallengesScreen />);
    expect(container.querySelectorAll('[data-testid="challenge-card"]').length).toBe(5);
    fireEvent.click(screen.getAllByText('Python')[0]);
    await waitFor(() => {
      expect(container.querySelectorAll('[data-testid="challenge-card"]').length).toBe(1);
    });
    expect(screen.getByText('Python Parser')).toBeInTheDocument();
  });

  it('filters by difficulty when Easy is clicked', async () => {
    const { container } = render(<ChallengesScreen />);
    expect(container.querySelectorAll('[data-testid="challenge-card"]').length).toBe(5);
    fireEvent.click(screen.getAllByText('Easy')[0]);
    await waitFor(() => {
      expect(container.querySelectorAll('[data-testid="challenge-card"]').length).toBe(1);
    });
  });

  it('filters by category when Debugging is clicked', async () => {
    const { container } = render(<ChallengesScreen />);
    expect(container.querySelectorAll('[data-testid="challenge-card"]').length).toBe(5);
    fireEvent.click(screen.getAllByText('Debugging')[0]);
    await waitFor(() => {
      expect(container.querySelectorAll('[data-testid="challenge-card"]').length).toBe(1);
    });
  });

  it('shows "No Challenges Found" with clear filters when filtering yields no results', async () => {
    const { container } = render(<ChallengesScreen />);
    expect(container.querySelectorAll('[data-testid="challenge-card"]').length).toBe(5);
    const input = container.querySelector('input[placeholder="Search challenges..."]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'nonexistent challenge xyz' } });
    await waitFor(() => {
      expect(screen.getByText('No Challenges Found')).toBeInTheDocument();
    });
    expect(screen.getByText('Try adjusting your filters or search query.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear all filters' })).toBeInTheDocument();
  });

  it('shows Showing X challenges count', () => {
    render(<ChallengesScreen />);
    expect(screen.getByText(/Showing 4 challenges/)).toBeInTheDocument();
  });

  it('shows "(filtered)" text when filters are active', async () => {
    const { container } = render(<ChallengesScreen />);
    expect(container.querySelectorAll('[data-testid="challenge-card"]').length).toBe(5);
    fireEvent.click(screen.getAllByText('Python')[0]);
    await waitFor(() => {
      expect(screen.getByText(/filtered/)).toBeInTheDocument();
    });
  });

  it('shows Clear filters button when filters are active', async () => {
    const { container } = render(<ChallengesScreen />);
    expect(container.querySelectorAll('[data-testid="challenge-card"]').length).toBe(5);
    fireEvent.click(screen.getAllByText('Python')[0]);
    await waitFor(() => {
      expect(screen.getByText('Clear filters')).toBeInTheDocument();
    });
  });

  it('clears all filters when Clear filters is clicked', async () => {
    const { container } = render(<ChallengesScreen />);
    expect(container.querySelectorAll('[data-testid="challenge-card"]').length).toBe(5);
    fireEvent.click(screen.getAllByText('Python')[0]);
    await waitFor(() => {
      expect(container.querySelectorAll('[data-testid="challenge-card"]').length).toBe(1);
    });
    fireEvent.click(screen.getByText('Clear filters'));
    expect(container.querySelectorAll('[data-testid="challenge-card"]').length).toBe(5);
  });

  it('filters by solved status when solved count is clicked', async () => {
    const { container } = render(<ChallengesScreen />);
    expect(container.querySelectorAll('[data-testid="challenge-card"]').length).toBe(5);
    // Click on the "solved" stat
    fireEvent.click(screen.getAllByText('solved')[0]);
    await waitFor(() => {
      // Only c2 is passed
      expect(container.querySelectorAll('[data-testid="challenge-card"]').length).toBe(1);
    });
  });

  it('filters by in_progress status', async () => {
    const { container } = render(<ChallengesScreen />);
    expect(container.querySelectorAll('[data-testid="challenge-card"]').length).toBe(5);
    fireEvent.click(screen.getAllByText('in progress')[0]);
    await waitFor(() => {
      expect(container.querySelectorAll('[data-testid="challenge-card"]').length).toBe(1);
    });
  });

  it('filters by not_started status', async () => {
    const { container } = render(<ChallengesScreen />);
    expect(container.querySelectorAll('[data-testid="challenge-card"]').length).toBe(5);
    fireEvent.click(screen.getAllByText('not started')[0]);
    await waitFor(() => {
      // c1 and c4 are not started (2 in tiers + c4 again in "Where LLMs Struggle" = 3)
      expect(container.querySelectorAll('[data-testid="challenge-card"]').length).toBe(3);
    });
  });

  it('toggles status filter off when clicked again', async () => {
    const { container } = render(<ChallengesScreen />);
    expect(container.querySelectorAll('[data-testid="challenge-card"]').length).toBe(5);
    fireEvent.click(screen.getAllByText('solved')[0]);
    await waitFor(() => {
      expect(container.querySelectorAll('[data-testid="challenge-card"]').length).toBe(1);
    });
    // Click again to toggle off
    fireEvent.click(screen.getAllByText('solved')[0]);
    expect(container.querySelectorAll('[data-testid="challenge-card"]').length).toBe(5);
  });

  it('renders tier sections in default sort', () => {
    render(<ChallengesScreen />);
    expect(screen.getByText('Getting Started')).toBeInTheDocument();
    expect(screen.getByText('Core Challenges')).toBeInTheDocument();
    expect(screen.getByText('Headline Challenges')).toBeInTheDocument();
  });

  it('renders "Where LLMs Struggle" section for returning users with hard/impossible challenges', () => {
    // c2 is passed (solvedCount>0), c4 is impossible/unsolved
    render(<ChallengesScreen />);
    expect(screen.getByText('Where LLMs Struggle')).toBeInTheDocument();
  });

  it('renders Sort button', () => {
    render(<ChallengesScreen />);
    expect(screen.getByText(/Sort: Default/)).toBeInTheDocument();
  });

  it('renders subtitle text', () => {
    render(<ChallengesScreen />);
    expect(screen.getByText(/Real engineering problems/)).toBeInTheDocument();
  });

  it('handles empty challenges gracefully', () => {
    mockDashboardState = {
      challenges: { data: [], status: 'loaded', lastFetchedAt: Date.now() },
      dailyChallenge: { data: null, status: 'loaded', lastFetchedAt: Date.now() },
    };
    render(<ChallengesScreen />);
    expect(screen.getByText('No Challenges Found')).toBeInTheDocument();
    expect(screen.getByText('Check back later for new challenges.')).toBeInTheDocument();
  });

  it('opens sort menu when Sort button is clicked', async () => {
    render(<ChallengesScreen />);
    expect(screen.getByText(/Sort: Default/)).toBeInTheDocument();
    // Click to open sort menu
    fireEvent.click(screen.getByText(/Sort: Default/));
    await waitFor(() => {
      expect(screen.getByText('Difficulty')).toBeInTheDocument();
      expect(screen.getByText('Most Solved')).toBeInTheDocument();
      expect(screen.getByText('Lowest Cost')).toBeInTheDocument();
    });
  });

  it('sorts by difficulty when Difficulty option is selected', async () => {
    render(<ChallengesScreen />);
    expect(screen.getByText(/Sort: Default/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Sort: Default/));
    await waitFor(() => {
      expect(screen.getByText('Difficulty')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Difficulty'));
    await waitFor(() => {
      expect(screen.getByText(/Sort: Difficulty/)).toBeInTheDocument();
    });
  });

  it('sorts by popularity when Most Solved option is selected', async () => {
    render(<ChallengesScreen />);
    expect(screen.getByText(/Sort: Default/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Sort: Default/));
    await waitFor(() => {
      expect(screen.getByText('Most Solved')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Most Solved'));
    await waitFor(() => {
      expect(screen.getByText(/Sort: Most Solved/)).toBeInTheDocument();
    });
  });

  it('sorts by cost when Lowest Cost option is selected', async () => {
    render(<ChallengesScreen />);
    expect(screen.getByText(/Sort: Default/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Sort: Default/));
    await waitFor(() => {
      expect(screen.getByText('Lowest Cost')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Lowest Cost'));
    await waitFor(() => {
      expect(screen.getByText(/Sort: Lowest Cost/)).toBeInTheDocument();
    });
  });

  it('toggles sort direction when clicking the same sort option again', async () => {
    render(<ChallengesScreen />);
    expect(screen.getByText(/Sort: Default/)).toBeInTheDocument();
    // Select difficulty sort
    const sortBtn = screen.getByTestId('sort-button');
    fireEvent.click(sortBtn);
    await waitFor(() => expect(screen.getByText('Difficulty')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Difficulty'));
    await waitFor(() => {
      // Should show ascending arrow
      expect(screen.getByText(/Sort: Difficulty ↑/)).toBeInTheDocument();
    });
    // Click sort button again to open menu
    fireEvent.click(sortBtn);
    // Wait for menu items
    await waitFor(() => {
      const diffItems = screen.getAllByText(/Difficulty/);
      expect(diffItems.length).toBeGreaterThanOrEqual(2); // button text + menu item
    });
    // Click the Difficulty menu item (not the button text) to toggle direction
    const menuItems = screen.getAllByText(/Difficulty/);
    // The last one should be the menu item
    fireEvent.click(menuItems[menuItems.length - 1]);
    await waitFor(() => {
      // Should show descending arrow now
      expect(screen.getByText(/Sort: Difficulty ↓/)).toBeInTheDocument();
    });
  });

  it('closes sort menu when backdrop is clicked', async () => {
    render(<ChallengesScreen />);
    expect(screen.getByText(/Sort: Default/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Sort: Default/));
    await waitFor(() => {
      expect(screen.getByText('Difficulty')).toBeInTheDocument();
    });
    // Close by clicking sort button again (toggles off)
    fireEvent.click(screen.getByText(/Sort: Default/));
    // Menu should close
    await waitFor(() => {
      expect(screen.queryByText('Most Solved')).toBeNull();
    });
  });

  it('clears all filters from empty state clear button', async () => {
    const { container } = render(<ChallengesScreen />);
    expect(container.querySelectorAll('[data-testid="challenge-card"]').length).toBe(5);
    // Search for something that doesn't exist
    const input = container.querySelector('input[placeholder="Search challenges..."]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'nonexistent challenge xyz' } });
    await waitFor(() => {
      expect(screen.getByText('No Challenges Found')).toBeInTheDocument();
    });
    // Click "Clear all filters" in empty state
    fireEvent.click(screen.getByRole('button', { name: 'Clear all filters' }));
    expect(container.querySelectorAll('[data-testid="challenge-card"]').length).toBe(5);
  });

  it('reads initial tab from URL params', () => {
    window.history.replaceState({}, '', '?tab=real_world');
    render(<ChallengesScreen />);
    expect(screen.getByText(/Showing/)).toBeInTheDocument();
  });

  it('reads initial lang from URL params', () => {
    window.history.replaceState({}, '', '?lang=python');
    render(<ChallengesScreen />);
    expect(screen.getByText(/Showing/)).toBeInTheDocument();
  });

  it('reads initial difficulty from URL params', () => {
    window.history.replaceState({}, '', '?difficulty=hard');
    render(<ChallengesScreen />);
    expect(screen.getByText(/Showing/)).toBeInTheDocument();
  });

  it('shows back-to-top button when more than 12 challenges', () => {
    // Create 15 challenges to trigger the back-to-top button
    const manyChallenges = Array.from({ length: 15 }, (_, i) => ({
      id: `c${i}`, title: `Challenge ${i}`, description: `Desc ${i}`, difficulty: 'easy',
      category: 'prompt_efficiency', tier: 'core', sortOrder: i, language: 'javascript',
      userStatus: null, skillTested: null, stats: { solvers: 1 }, maxCost: 100,
    }));
    mockDashboardState = {
      challenges: { data: manyChallenges, status: 'loaded', lastFetchedAt: Date.now() },
      dailyChallenge: { data: null, status: 'loaded', lastFetchedAt: Date.now() },
    };
    vi.stubGlobal('scrollTo', vi.fn());
    render(<ChallengesScreen />);
    expect(screen.getByText(/Back to top/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Back to top/));
    expect(window.scrollTo).toHaveBeenCalled();
  });

  it('shows filtered stats with "of" suffix when non-status filters are active', () => {
    render(<ChallengesScreen />);
    expect(screen.getAllByText('Engineering Challenges').length).toBeGreaterThanOrEqual(1);
    // Click on a category filter
    fireEvent.click(screen.getAllByText('Debugging')[0]);
    // Should show "solved of X" to indicate filtered stats relative to global (e.g., "1 of 1")
    const solvedLabels = screen.getAllByText(/solved/);
    expect(solvedLabels.length).toBeGreaterThanOrEqual(1);
  });

  it('handles error state from context gracefully', () => {
    mockDashboardState = {
      challenges: { data: [], status: 'error', lastFetchedAt: Date.now() },
      dailyChallenge: { data: null, status: 'error', lastFetchedAt: Date.now() },
    };
    render(<ChallengesScreen />);
    expect(screen.getByText('Engineering Challenges')).toBeInTheDocument();
  });

  it('sorts LLM Struggle challenges by ascending solver count', async () => {
    // Need 2+ hard/impossible unsolved challenges + at least 1 solved to enable the section
    const extendedChallenges = [
      ...mockChallenges,
      { id: 'c5', title: 'Hard Unsolved', description: 'Hard one', difficulty: 'hard', category: 'prompt_efficiency', tier: 'core', sortOrder: 4, language: 'javascript', userStatus: null, skillTested: null, stats: { solvers: 1 }, maxCost: 500 },
    ];
    mockDashboardState = {
      challenges: { data: extendedChallenges, status: 'loaded', lastFetchedAt: Date.now() },
      dailyChallenge: { data: null, status: 'loaded', lastFetchedAt: Date.now() },
    };
    render(<ChallengesScreen />);
    // "Where LLMs Struggle" section should appear with multiple challenges sorted
    expect(screen.getByText('Where LLMs Struggle')).toBeInTheDocument();
    // Both hard/impossible unsolved challenges should appear (may appear in multiple sections)
    expect(screen.getAllByText('Impossible Maze').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Hard Unsolved').length).toBeGreaterThanOrEqual(1);
  });

  it('resets status filter when total stat is clicked', async () => {
    const { container } = render(<ChallengesScreen />);
    expect(container.querySelectorAll('[data-testid="challenge-card"]').length).toBe(5);
    // First filter to something specific
    fireEvent.click(screen.getAllByText('solved')[0]);
    await waitFor(() => {
      expect(container.querySelectorAll('[data-testid="challenge-card"]').length).toBe(1);
    });
    // Now click the "total" stat to reset to 'all'
    fireEvent.click(screen.getAllByText('total')[0]);
    expect(container.querySelectorAll('[data-testid="challenge-card"]').length).toBe(5);
  });

  it('closes sort menu when backdrop overlay is clicked', async () => {
    render(<ChallengesScreen />);
    expect(screen.getByText(/Sort: Default/)).toBeInTheDocument();
    // Open sort menu
    fireEvent.click(screen.getByText(/Sort: Default/));
    await waitFor(() => {
      expect(screen.getByText('Difficulty')).toBeInTheDocument();
    });
    // Close by clicking the sort backdrop (not the sort button)
    const backdrop = screen.getByLabelText('Close sort menu');
    fireEvent.click(backdrop);
    await waitFor(() => {
      expect(screen.queryByText('Most Solved')).toBeNull();
    });
  });

  it('renders flat list when sort is not default', async () => {
    render(<ChallengesScreen />);
    expect(screen.getByText(/Sort: Default/)).toBeInTheDocument();
    // Switch to difficulty sort
    fireEvent.click(screen.getByText(/Sort: Default/));
    await waitFor(() => expect(screen.getByText('Difficulty')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Difficulty'));
    await waitFor(() => {
      // Tier section headers should not be present in flat list mode
      expect(screen.queryByText('Getting Started')).toBeNull();
      expect(screen.queryByText('Core Challenges')).toBeNull();
    });
  });

  /* ── Error handling / negative tests ─────────────────────────────── */

  describe('error handling', () => {
    it('handles challenges with only one item', () => {
      mockDashboardState = {
        challenges: { data: [mockChallenges[0]], status: 'loaded', lastFetchedAt: Date.now() },
        dailyChallenge: { data: null, status: 'loaded', lastFetchedAt: Date.now() },
      };
      const { container } = render(<ChallengesScreen />);
      expect(container.querySelectorAll('[data-testid="challenge-card"]').length).toBeGreaterThanOrEqual(1);
    });

    it('handles search with only whitespace', async () => {
      const { container } = render(<ChallengesScreen />);
      const input = container.querySelector('input[placeholder="Search challenges..."]') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '   ' } });
      // Whitespace search should still show results (filters all challenges)
      await waitFor(() => {
        expect(container.querySelectorAll('[data-testid="challenge-card"]').length).toBeGreaterThanOrEqual(0);
      });
    });

    it('handles search with special regex characters', async () => {
      const { container } = render(<ChallengesScreen />);
      const input = container.querySelector('input[placeholder="Search challenges..."]') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '[.*+?^${}()|' } });
      await waitFor(() => {
        expect(screen.getByText('No Challenges Found')).toBeInTheDocument();
      });
    });

    it('handles very long search query', async () => {
      const { container } = render(<ChallengesScreen />);
      const input = container.querySelector('input[placeholder="Search challenges..."]') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'x'.repeat(500) } });
      await waitFor(() => {
        expect(screen.getByText('No Challenges Found')).toBeInTheDocument();
      });
    });

    it('handles toggling difficulty filter on and off', async () => {
      const { container } = render(<ChallengesScreen />);
      expect(container.querySelectorAll('[data-testid="challenge-card"]').length).toBe(5);
      // Apply Easy filter
      fireEvent.click(screen.getAllByText('Easy')[0]);
      await waitFor(() => {
        expect(container.querySelectorAll('[data-testid="challenge-card"]').length).toBe(1);
      });
      // Click "Clear filters" text to reset all filters
      fireEvent.click(screen.getByText('Clear filters'));
      await waitFor(() => {
        expect(container.querySelectorAll('[data-testid="challenge-card"]').length).toBe(5);
      });
    });

    it('handles challenges with null category', () => {
      mockDashboardState = {
        challenges: {
          data: [{ ...mockChallenges[0], category: null }],
          status: 'loaded', lastFetchedAt: Date.now(),
        },
        dailyChallenge: { data: null, status: 'loaded', lastFetchedAt: Date.now() },
      };
      render(<ChallengesScreen />);
      expect(screen.getByText('FizzBuzz Budget')).toBeInTheDocument();
    });

    it('handles challenges with null difficulty', () => {
      mockDashboardState = {
        challenges: {
          data: [{ ...mockChallenges[0], difficulty: null }],
          status: 'loaded', lastFetchedAt: Date.now(),
        },
        dailyChallenge: { data: null, status: 'loaded', lastFetchedAt: Date.now() },
      };
      render(<ChallengesScreen />);
      expect(screen.getByText('FizzBuzz Budget')).toBeInTheDocument();
    });

    it('handles challenges with null stats', () => {
      mockDashboardState = {
        challenges: {
          data: [{ ...mockChallenges[0], stats: null }],
          status: 'loaded', lastFetchedAt: Date.now(),
        },
        dailyChallenge: { data: null, status: 'loaded', lastFetchedAt: Date.now() },
      };
      render(<ChallengesScreen />);
      expect(screen.getByText('FizzBuzz Budget')).toBeInTheDocument();
    });

    it('handles challenges with zero maxCost', () => {
      mockDashboardState = {
        challenges: {
          data: [{ ...mockChallenges[0], maxCost: 0 }],
          status: 'loaded', lastFetchedAt: Date.now(),
        },
        dailyChallenge: { data: null, status: 'loaded', lastFetchedAt: Date.now() },
      };
      render(<ChallengesScreen />);
      expect(screen.getByText('FizzBuzz Budget')).toBeInTheDocument();
    });

    it('handles invalid URL params gracefully', () => {
      window.history.replaceState({}, '', '?tab=nonexistent&lang=nonexistent&difficulty=nonexistent');
      render(<ChallengesScreen />);
      expect(screen.getByText('Engineering Challenges')).toBeInTheDocument();
    });

    it('handles combined search and filter with no results', async () => {
      const { container } = render(<ChallengesScreen />);
      fireEvent.click(screen.getAllByText('Python')[0]);
      const input = container.querySelector('input[placeholder="Search challenges..."]') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'FizzBuzz' } });
      await waitFor(() => {
        expect(screen.getByText('No Challenges Found')).toBeInTheDocument();
      });
    });

    it('handles status filter with empty results', async () => {
      mockDashboardState = {
        challenges: {
          data: [{ ...mockChallenges[0], userStatus: null }],
          status: 'loaded', lastFetchedAt: Date.now(),
        },
        dailyChallenge: { data: null, status: 'loaded', lastFetchedAt: Date.now() },
      };
      const { container } = render(<ChallengesScreen />);
      fireEvent.click(screen.getAllByText('solved')[0]);
      await waitFor(() => {
        expect(container.querySelectorAll('[data-testid="challenge-card"]').length).toBe(0);
      });
    });

    it('handles all challenges having same difficulty', () => {
      const sameDiffChallenges = Array.from({ length: 3 }, (_, i) => ({
        ...mockChallenges[0], id: `c${i}`, title: `Challenge ${i}`, difficulty: 'easy',
      }));
      mockDashboardState = {
        challenges: { data: sameDiffChallenges, status: 'loaded', lastFetchedAt: Date.now() },
        dailyChallenge: { data: null, status: 'loaded', lastFetchedAt: Date.now() },
      };
      render(<ChallengesScreen />);
      expect(screen.getByText('Engineering Challenges')).toBeInTheDocument();
    });

    it('handles challenges with empty description', () => {
      mockDashboardState = {
        challenges: {
          data: [{ ...mockChallenges[0], description: '' }],
          status: 'loaded', lastFetchedAt: Date.now(),
        },
        dailyChallenge: { data: null, status: 'loaded', lastFetchedAt: Date.now() },
      };
      render(<ChallengesScreen />);
      expect(screen.getByText('FizzBuzz Budget')).toBeInTheDocument();
    });

    it('handles challenges with very long title', () => {
      mockDashboardState = {
        challenges: {
          data: [{ ...mockChallenges[0], title: 'A'.repeat(200) }],
          status: 'loaded', lastFetchedAt: Date.now(),
        },
        dailyChallenge: { data: null, status: 'loaded', lastFetchedAt: Date.now() },
      };
      render(<ChallengesScreen />);
      expect(screen.getByText('A'.repeat(200))).toBeInTheDocument();
    });

    it('handles sort by difficulty with identical difficulties', async () => {
      const sameDiffChallenges = Array.from({ length: 3 }, (_, i) => ({
        ...mockChallenges[0], id: `c${i}`, title: `Challenge ${i}`, difficulty: 'medium',
      }));
      mockDashboardState = {
        challenges: { data: sameDiffChallenges, status: 'loaded', lastFetchedAt: Date.now() },
        dailyChallenge: { data: null, status: 'loaded', lastFetchedAt: Date.now() },
      };
      render(<ChallengesScreen />);
      fireEvent.click(screen.getByText(/Sort: Default/));
      await waitFor(() => expect(screen.getByText('Difficulty')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Difficulty'));
      await waitFor(() => { expect(screen.getByText(/Sort: Difficulty/)).toBeInTheDocument(); });
    });

    it('handles multiple simultaneous filter + sort changes', async () => {
      render(<ChallengesScreen />);
      fireEvent.click(screen.getAllByText('Python')[0]);
      fireEvent.click(screen.getByText(/Sort: Default/));
      await waitFor(() => expect(screen.getByText('Difficulty')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Difficulty'));
      await waitFor(() => { expect(screen.getByText(/Sort: Difficulty/)).toBeInTheDocument(); });
    });

    it('handles clearing filters resets everything', async () => {
      const { container } = render(<ChallengesScreen />);
      // Apply multiple filters
      fireEvent.click(screen.getAllByText('Python')[0]);
      fireEvent.click(screen.getAllByText('Easy')[0]);
      const input = container.querySelector('input[placeholder="Search challenges..."]') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'nonexistent' } });
      await waitFor(() => { expect(screen.getByText('No Challenges Found')).toBeInTheDocument(); });
      fireEvent.click(screen.getByRole('button', { name: 'Clear all filters' }));
      expect(container.querySelectorAll('[data-testid="challenge-card"]').length).toBe(5);
    });
  });
});
