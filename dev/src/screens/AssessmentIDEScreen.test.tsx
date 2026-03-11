// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const { mockState, mockIsMobile } = vi.hoisted(() => ({
  mockState: {
    current: {
      user: { id: 'u1' } as any,
      loading: false,
      loadError: null,
      assessmentId: 'a1',
      status: 'draft',
      title: 'My Assessment',
      description: '',
      timeLimitMinutes: '60',
      dirty: false,
      isEditing: true,
      allChallenges: [],
      selectedChallengeIds: [],
      customChallenges: [],
      orgId: null,
      companyName: '',
      companyLogoUrl: '',
      welcomeMessage: '',
      weights: { modelSelection: '20', promptEfficiency: '20', debugging: '20', strategy: '20', speed: '20' },
      weightSum: 100,
      passThreshold: null,
      inviteLink: null,
      inviteRefreshKey: 0,
      copied: false,
      generatingInvite: false,
      inviteError: null,
      saving: false,
      saveSuccess: false,
      saveError: null,
      activating: false,
      activateError: null,
      confirmActivate: false,
      setTitle: vi.fn(),
      setDescription: vi.fn(),
      setTimeLimitMinutes: vi.fn(),
      setCompanyName: vi.fn(),
      setCompanyLogoUrl: vi.fn(),
      setWelcomeMessage: vi.fn(),
      setWeights: vi.fn(),
      setPassThreshold: vi.fn(),
      setSelectedChallengeIds: vi.fn(),
      setConfirmActivate: vi.fn(),
      handleSave: vi.fn(),
      handleActivate: vi.fn(),
      handleGenerateInvite: vi.fn(),
      toggleChallenge: vi.fn(),
      applyTemplate: vi.fn(),
      copyInviteLink: vi.fn(),
      handleAgentChallengesChanged: vi.fn(),
      handleAgentWeightsChanged: vi.fn(),
      handleAgentBrandingChanged: vi.fn(),
      handleAgentTimeLimitChanged: vi.fn(),
      handleAgentThresholdChanged: vi.fn(),
      handleCustomChallengeCreated: vi.fn(),
      handleAgentAssessmentCreated: vi.fn(),
      handleApproveCustomChallenge: vi.fn(),
      handleDeleteCustomChallenge: vi.fn(),
      handleInvitesSent: vi.fn(),
    },
  },
  mockIsMobile: { current: false },
}));

vi.mock('@/hooks/useAssessmentIDEState', () => ({
  useAssessmentIDEState: () => mockState.current,
}));
vi.mock('@/lib/useIsMobile', () => ({
  useIsMobile: () => mockIsMobile.current,
}));
vi.mock('@/components/ui/ScreenSkeletons', () => ({
  FormSkeleton: () => <div data-testid="skeleton-form" />,
}));
vi.mock('@/components/arena/PanelResizeBar', () => ({
  PanelResizeBar: () => <div data-testid="panel-resize-bar" />,
}));
vi.mock('react-resizable-panels', () => ({
  Group: ({ children, ...props }: any) => <div data-testid="panel-group" {...props}>{children}</div>,
  Panel: ({ children, id, ...props }: any) => <div data-testid={`panel-${id}`} {...props}>{children}</div>,
}));
vi.mock('@/components/assessment-ide/AssessmentIDEHeader', () => ({
  AssessmentIDEHeader: ({ title, status }: any) => (
    <div data-testid="ide-header">
      <span>{title}</span>
      <span>{status}</span>
    </div>
  ),
}));
vi.mock('@/components/assessment-ide/AssessmentActionBar', () => ({
  AssessmentActionBar: ({ onSave, onActivate }: any) => (
    <div data-testid="action-bar">
      <button onClick={onSave}>Save</button>
      <button onClick={onActivate}>Activate</button>
    </div>
  ),
}));
vi.mock('@/components/assessment-ide/AssessmentChatPanel', () => ({
  AssessmentChatPanel: () => <div data-testid="chat-panel">Chat Panel</div>,
}));
vi.mock('@/components/assessment-ide/AssessmentDocumentPanel', () => ({
  AssessmentDocumentPanel: () => <div data-testid="document-panel">Document Panel</div>,
}));
vi.mock('@/theme', () => ({
  useColors: () => ({
    bg: '#fff', text: '#000', textMuted: '#888', accent: '#c9a962', border: '#ccc',
    borderStrong: '#999', card: '#fff', muted: '#f5f5f5', error: '#f00', errorBg: '#fee',
    success: '#0a0', successBg: '#efe', primary: '#000', primaryForeground: '#fff',
    secondary: '#eee', secondaryForeground: '#000', destructive: '#f00',
    textSubtle: '#aaa', bgElevated: '#fafafa', accentBg: '#ffe', bgWarm: '#faf8f5',
  }),
}));
vi.mock('@/theme/tokens', () => ({
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, '2xl': 48 },
  fontSizes: { xs: 12, sm: 14, md: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 30, '4xl': 36 },
  fontFamily: { display: 'serif', body: 'sans-serif' },
  radii: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
}));

const { AssessmentIDEScreen } = await import('./AssessmentIDEScreen');

describe('AssessmentIDEScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsMobile.current = false;
    mockState.current = {
      ...mockState.current,
      user: { id: 'u1' },
      loading: false,
      title: 'My Assessment',
      status: 'draft',
      assessmentId: 'a1',
    };
  });

  it('renders loading skeleton when loading', () => {
    mockState.current = { ...mockState.current, loading: true };
    render(<AssessmentIDEScreen />);
    expect(screen.getByTestId('skeleton-form')).toBeTruthy();
  });

  it('returns null when no user', () => {
    mockState.current = { ...mockState.current, user: null };
    const { container } = render(<AssessmentIDEScreen />);
    expect(container.innerHTML).toBe('');
  });

  it('renders header with title', () => {
    render(<AssessmentIDEScreen />);
    expect(screen.getByTestId('ide-header')).toBeTruthy();
    expect(screen.getByText('My Assessment')).toBeTruthy();
  });

  it('renders action bar', () => {
    render(<AssessmentIDEScreen />);
    expect(screen.getByTestId('action-bar')).toBeTruthy();
  });

  it('calls handleSave when action bar Save is clicked', () => {
    const handleSave = vi.fn();
    mockState.current = { ...mockState.current, handleSave };
    render(<AssessmentIDEScreen />);
    fireEvent.click(screen.getByText('Save'));
    expect(handleSave).toHaveBeenCalled();
  });

  describe('desktop layout', () => {
    it('renders resizable panel group', () => {
      render(<AssessmentIDEScreen />);
      expect(screen.getByTestId('panel-group')).toBeTruthy();
    });

    it('renders chat panel', () => {
      render(<AssessmentIDEScreen />);
      expect(screen.getByTestId('chat-panel')).toBeTruthy();
    });

    it('renders document panel', () => {
      render(<AssessmentIDEScreen />);
      expect(screen.getByTestId('document-panel')).toBeTruthy();
    });

    it('renders resize bar', () => {
      render(<AssessmentIDEScreen />);
      expect(screen.getByTestId('panel-resize-bar')).toBeTruthy();
    });

    it('does not show mobile tab bar', () => {
      render(<AssessmentIDEScreen />);
      expect(screen.queryByText('Chat')).toBeNull();
      expect(screen.queryByText('Document')).toBeNull();
    });
  });

  describe('mobile layout', () => {
    beforeEach(() => {
      mockIsMobile.current = true;
    });

    it('renders mobile tab bar', () => {
      render(<AssessmentIDEScreen />);
      expect(screen.getByText('Chat')).toBeTruthy();
      expect(screen.getByText('Document')).toBeTruthy();
    });

    it('shows chat panel by default', () => {
      render(<AssessmentIDEScreen />);
      expect(screen.getByTestId('chat-panel')).toBeTruthy();
      expect(screen.queryByTestId('document-panel')).toBeNull();
    });

    it('switches to document panel when Document tab is clicked', () => {
      render(<AssessmentIDEScreen />);
      fireEvent.click(screen.getByText('Document'));
      expect(screen.getByTestId('document-panel')).toBeTruthy();
      expect(screen.queryByTestId('chat-panel')).toBeNull();
    });

    it('switches back to chat panel when Chat tab is clicked', () => {
      render(<AssessmentIDEScreen />);
      fireEvent.click(screen.getByText('Document'));
      expect(screen.getByTestId('document-panel')).toBeTruthy();
      fireEvent.click(screen.getByText('Chat'));
      expect(screen.getByTestId('chat-panel')).toBeTruthy();
    });

    it('does not render panel group in mobile', () => {
      render(<AssessmentIDEScreen />);
      expect(screen.queryByTestId('panel-group')).toBeNull();
    });
  });

  describe('keyboard shortcut', () => {
    it('Cmd+L switches to chat tab on mobile', () => {
      mockIsMobile.current = true;
      render(<AssessmentIDEScreen />);
      fireEvent.click(screen.getByText('Document'));
      expect(screen.getByTestId('document-panel')).toBeTruthy();
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', metaKey: true }));
      });
      expect(screen.getByTestId('chat-panel')).toBeTruthy();
    });

    it('Ctrl+L switches to chat tab on mobile', () => {
      mockIsMobile.current = true;
      render(<AssessmentIDEScreen />);
      fireEvent.click(screen.getByText('Document'));
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', ctrlKey: true }));
      });
      expect(screen.getByTestId('chat-panel')).toBeTruthy();
    });
  });

  it('passes status to header', () => {
    mockState.current = { ...mockState.current, status: 'active' };
    render(<AssessmentIDEScreen />);
    expect(screen.getByText('active')).toBeTruthy();
  });
});
