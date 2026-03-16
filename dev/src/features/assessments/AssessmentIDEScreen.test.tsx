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

vi.mock('@/features/assessments/useAssessmentIDEState', () => ({
  useAssessmentIDEState: () => mockState.current,
}));
vi.mock('@/shared/lib/useIsMobile', () => ({
  useIsMobile: () => mockIsMobile.current,
}));
vi.mock('@/shared/ui/ScreenSkeletons', () => ({
  FormSkeleton: () => <div data-testid="skeleton-form" />,
}));
vi.mock('@/features/arena/PanelResizeBar', () => ({
  PanelResizeBar: () => <div data-testid="panel-resize-bar" />,
}));
vi.mock('react-resizable-panels', () => ({
  Group: ({ children, ...props }: any) => <div data-testid="panel-group" {...props}>{children}</div>,
  Panel: ({ children, id, ...props }: any) => <div data-testid={`panel-${id}`} {...props}>{children}</div>,
}));
vi.mock('@/features/assessments/AssessmentIDEHeader', () => ({
  AssessmentIDEHeader: ({ title, status }: any) => (
    <div data-testid="ide-header">
      <span>{title}</span>
      <span>{status}</span>
    </div>
  ),
}));
vi.mock('@/features/assessments/AssessmentActionBar', () => ({
  AssessmentActionBar: ({ onSave, onActivate }: any) => (
    <div data-testid="action-bar">
      <button onClick={onSave}>Save</button>
      <button onClick={onActivate}>Activate</button>
    </div>
  ),
}));
vi.mock('@/features/assessments/AssessmentChatPanel', () => ({
  AssessmentChatPanel: () => <div data-testid="chat-panel">Chat Panel</div>,
}));
vi.mock('@/features/assessments/AssessmentDocumentPanel', () => ({
  AssessmentDocumentPanel: () => <div data-testid="document-panel">Document Panel</div>,
}));
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

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
    expect(screen.getByTestId('skeleton-form')).toBeInTheDocument();
  });

  it('returns null when no user', () => {
    mockState.current = { ...mockState.current, user: null };
    const { container } = render(<AssessmentIDEScreen />);
    expect(container.innerHTML).toBe('');
  });

  it('renders header with title', () => {
    render(<AssessmentIDEScreen />);
    expect(screen.getByTestId('ide-header')).toBeInTheDocument();
    expect(screen.getByText('My Assessment')).toBeInTheDocument();
  });

  it('renders action bar', () => {
    render(<AssessmentIDEScreen />);
    expect(screen.getByTestId('action-bar')).toBeInTheDocument();
  });

  it('calls handleSave when action bar Save is clicked', () => {
    const handleSave = vi.fn();
    mockState.current = { ...mockState.current, handleSave };
    render(<AssessmentIDEScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(handleSave).toHaveBeenCalled();
  });

  describe('desktop layout', () => {
    it('renders resizable panel group', () => {
      render(<AssessmentIDEScreen />);
      expect(screen.getByTestId('panel-group')).toBeInTheDocument();
    });

    it('renders chat panel', () => {
      render(<AssessmentIDEScreen />);
      expect(screen.getByTestId('chat-panel')).toBeInTheDocument();
    });

    it('renders document panel', () => {
      render(<AssessmentIDEScreen />);
      expect(screen.getByTestId('document-panel')).toBeInTheDocument();
    });

    it('renders resize bar', () => {
      render(<AssessmentIDEScreen />);
      expect(screen.getByTestId('panel-resize-bar')).toBeInTheDocument();
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
      expect(screen.getByRole('button', { name: 'Chat' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Document' })).toBeInTheDocument();
    });

    it('shows chat panel by default', () => {
      render(<AssessmentIDEScreen />);
      expect(screen.getByTestId('chat-panel')).toBeInTheDocument();
      expect(screen.queryByTestId('document-panel')).toBeNull();
    });

    it('switches to document panel when Document tab is clicked', () => {
      render(<AssessmentIDEScreen />);
      fireEvent.click(screen.getByRole('button', { name: 'Document' }));
      expect(screen.getByTestId('document-panel')).toBeInTheDocument();
      expect(screen.queryByTestId('chat-panel')).toBeNull();
    });

    it('switches back to chat panel when Chat tab is clicked', () => {
      render(<AssessmentIDEScreen />);
      fireEvent.click(screen.getByRole('button', { name: 'Document' }));
      expect(screen.getByTestId('document-panel')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
      expect(screen.getByTestId('chat-panel')).toBeInTheDocument();
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
      fireEvent.click(screen.getByRole('button', { name: 'Document' }));
      expect(screen.getByTestId('document-panel')).toBeInTheDocument();
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', metaKey: true }));
      });
      expect(screen.getByTestId('chat-panel')).toBeInTheDocument();
    });

    it('Ctrl+L switches to chat tab on mobile', () => {
      mockIsMobile.current = true;
      render(<AssessmentIDEScreen />);
      fireEvent.click(screen.getByRole('button', { name: 'Document' }));
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', ctrlKey: true }));
      });
      expect(screen.getByTestId('chat-panel')).toBeInTheDocument();
    });
  });

  it('passes status to header', () => {
    mockState.current = { ...mockState.current, status: 'active' };
    render(<AssessmentIDEScreen />);
    expect(screen.getByText('active')).toBeInTheDocument();
  });
});
