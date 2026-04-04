/**
 * TakeHomeScreen: IDE for take-home assessments.
 * Route: /ide/takehome/:sessionId
 *
 * Layout: instructions sidebar (left), editor + terminal (right).
 * Records AI telemetry on every chat interaction.
 * Submit button collects files and POSTs to the submit endpoint.
 */
import { Suspense, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuthGuard } from '@/shared/hooks/useAuthGuard';
import { useIDELayout } from '@/features/shared-ide/hooks/useIDELayout';
import { arena } from '@/shared/theme/colors';
import { fontFamily } from '@/shared/theme/tokens';
import { useDocumentMeta } from '@/shared/hooks/useDocumentMeta';
import { useRuntime } from './useRuntime';
import { FileTree } from './FileTree';
import { IDETerminal } from './IDETerminal';
import { tabLabel, languageForPath, buildGitStatusMap } from './utils';
import { useSessionRecorder } from './useSessionRecorder';
import { TelemetryDisclosure } from './TelemetryDisclosure';
import * as browserGit from '@/lib/git/browser-git';
import type { GitStatusEntry } from '@/lib/git/browser-git';
import { LazyMonacoEditor as MonacoEditor } from '@/features/shared-ide/lib/LazyMonacoEditor';

/** Format seconds as MM:SS or HH:MM:SS */
function formatTime(seconds: number): string {
  if (seconds <= 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${String(h).padStart(2, '0')}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

interface OpenTab {
  path: string;
  label: string;
}

interface SessionDetails {
  repoUrl: string | null;
  instructions: string | null;
  timeLimit: number;
  allowedModels: string[] | null;
  companyName: string;
}

export function TakeHomeScreen() {
  const { user, loading } = useAuthGuard();
  const navigation = useNavigation();
  const route = useRoute();
  const layout = useIDELayout('takehome-layout-prefs');

  const sessionId = (route.params as { sessionId: string })?.sessionId;

  const [sessionDetails, setSessionDetails] = useState<SessionDetails | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [showInstructions, setShowInstructions] = useState(true);
  const [disclosureAccepted, setDisclosureAccepted] = useState(false);

  const { ready, files, error, refreshFiles, collectFiles, backend } = useRuntime();
  const recorder = useSessionRecorder(sessionId ?? '');
  useDocumentMeta({ title: 'Take-Home Assessment — Ruwt IDE' });

  // Open tabs and active tab tracking
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState<string>('');
  const [editorLanguage, setEditorLanguage] = useState<string>('javascript');

  const writeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didAutoOpenRef = useRef(false);
  const expiresAtRef = useRef<number | null>(null);
  const editorContentRef = useRef(editorContent);
  editorContentRef.current = editorContent;

  // Git integration state for take-home
  const [cloneProgress, setCloneProgress] = useState<string | null>(null);
  const [cloneFailed, setCloneFailed] = useState(false);
  const [gitStatusEntries, setGitStatusEntries] = useState<GitStatusEntry[]>([]);
  const cloneAttemptedRef = useRef(false);

  // Fetch session details on mount
  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/assess/${sessionId}`)
      .then((res) => res.ok ? res.json() : Promise.reject(new Error('Failed to load session')))
      .then((data: any) => {
        // The session endpoint returns session, assessment info
        // For take-home we also need the assessment details
        // Use the takehome-specific data structure
        const details: SessionDetails = {
          repoUrl: data.assessment?.repoUrl ?? null,
          instructions: data.assessment?.instructions ?? null,
          timeLimit: data.assessment?.timeLimit ?? 0,
          allowedModels: null,
          companyName: data.assessment?.companyName ?? 'the hiring company',
        };
        if (data.assessment?.allowedModels) {
          try { details.allowedModels = JSON.parse(data.assessment.allowedModels); } catch { /* ignore */ }
        }
        if (data.session?.expiresAt) {
          expiresAtRef.current = new Date(data.session.expiresAt).getTime();
        }
        if (data.session?.status === 'completed') {
          setSubmitted(true);
        }
        if (data.session?.disclosureAccepted) {
          setDisclosureAccepted(true);
        }
        setSessionDetails(details);
        setSessionLoading(false);
      })
      .catch((err) => {
        setSessionError(err.message);
        setSessionLoading(false);
      });
  }, [sessionId]);

  /** Shared clone logic — used by both initial clone and retry. */
  const doClone = useCallback((repoUrl: string) => {
    cloneAttemptedRef.current = true;
    setCloneFailed(false);
    setCloneProgress('Cloning repository...');
    browserGit.clone(backend, repoUrl, '.', {
      onProgress: (phase, loaded, total) => {
        setCloneProgress(`${phase}: ${loaded}${total ? `/${total}` : ''}`);
      },
    })
      .then(async () => {
        setCloneProgress(null);
        await refreshFiles();
        try {
          const entries = await browserGit.status(backend, '.');
          setGitStatusEntries(entries);
        } catch {
          // Not a git repo after clone? Ignore
        }
      })
      .catch(/* istanbul ignore next -- @preserve */ () => {
        setCloneProgress('Clone failed');
        setCloneFailed(true);
        cloneAttemptedRef.current = false; // allow retry
      });
  }, [refreshFiles, backend]);

  // Clone repo when session is loaded and runtime is ready
  useEffect(() => {
    if (!ready || !sessionDetails?.repoUrl || cloneAttemptedRef.current) return;
    doClone(sessionDetails.repoUrl);
  }, [ready, sessionDetails, doClone]);

  /** Retry clone after a failure. */
  const handleRetryClone = useCallback(() => {
    if (!sessionDetails?.repoUrl || !ready) return;
    doClone(sessionDetails.repoUrl);
  }, [ready, sessionDetails, doClone]);

  // Build git status map for file tree (memoized)
  const gitStatusMap = useMemo(() => buildGitStatusMap(gitStatusEntries), [gitStatusEntries]);

  // Timer countdown
  useEffect(() => {
    if (!expiresAtRef.current) return;
    const tick = () => {
      const remaining = Math.max(0, Math.round((expiresAtRef.current! - Date.now()) / 1000));
      setTimeRemaining(remaining);
      if (remaining <= 0) {
        clearInterval(intervalId);
      }
    };
    tick();
    const intervalId = setInterval(tick, 1000);
    return () => clearInterval(intervalId);
  }, [sessionDetails]);

  // Load file content
  const loadFileContent = useCallback(async (path: string) => {
    const prevTab = activeTab;
    setActiveTab(path);
    setEditorLanguage(languageForPath(path));
    if (disclosureAccepted && prevTab && prevTab !== path) {
      recorder.recordTabSwitch(prevTab, path);
    }
    try {
      const content = await backend.readFile(path);
      setEditorContent(content);
    } catch {
      setEditorContent('// Could not read file');
    }
  }, [activeTab, disclosureAccepted, recorder]);

  const openFile = useCallback(async (path: string) => {
    setOpenTabs((prev) => {
      if (prev.some((t) => t.path === path)) return prev;
      return [...prev, { path, label: tabLabel(path) }];
    });
    if (disclosureAccepted) {
      recorder.recordFileOpen(path);
    }
    await loadFileContent(path);
  }, [loadFileContent, disclosureAccepted, recorder]);

  const switchTab = loadFileContent;

  const closeTab = useCallback((path: string) => {
    if (disclosureAccepted) {
      recorder.recordFileClose(path);
    }
    setOpenTabs((prev) => {
      const next = prev.filter((t) => t.path !== path);
      if (path === activeTab) {
        const fallback = next.length > 0 ? next[next.length - 1].path : null;
        if (fallback) {
          queueMicrotask(() => loadFileContent(fallback));
        } else {
          setActiveTab(null);
          setEditorContent('');
        }
      }
      return next;
    });
  }, [activeTab, loadFileContent, disclosureAccepted, recorder]);

  const handleEditorChange = useCallback((value: string | undefined) => {
    const v = value ?? '';
    setEditorContent(v);
    if (!activeTab) return;
    const path = activeTab;
    if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
    writeTimerRef.current = setTimeout(() => {
      backend.writeFile(path, v).catch(/* istanbul ignore next -- @preserve */ () => {});
      // Fire-and-forget telemetry for file changes
      if (sessionId) {
        fetch('/api/assess/takehome/telemetry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            eventType: 'file_change',
            data: { file: path },
          }),
        }).catch(/* istanbul ignore next -- @preserve */ () => {});
      }
    }, 300);
  }, [activeTab, sessionId]);

  // Cleanup write timer on unmount
  useEffect(() => {
    return () => {
      if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
    };
  }, []);

  // Content snapshot every 5 seconds for the active file
  useEffect(() => {
    if (!disclosureAccepted || !activeTab) return;
    const interval = setInterval(() => {
      recorder.snapshotContent(activeTab, editorContentRef.current);
    }, 5000);
    return () => clearInterval(interval);
  }, [disclosureAccepted, activeTab, recorder]);

  // Window focus/blur tracking
  useEffect(() => {
    if (!disclosureAccepted) return;
    const onFocus = () => recorder.recordFocus(true);
    const onBlur = () => recorder.recordFocus(false);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, [disclosureAccepted, recorder]);

  // Auto-open index.js once runtime is ready
  useEffect(() => {
    if (ready && !didAutoOpenRef.current && openTabs.length === 0 && files.length > 0) {
      didAutoOpenRef.current = true;
      const indexFile = files.find((f) => f.type === 'file' && f.name === 'index.js');
      if (indexFile) {
        openFile(indexFile.path);
      }
    }
  }, [ready, files, openTabs.length, openFile]);

  // Submit handler
  const handleSubmit = useCallback(async () => {
    if (!sessionId || submitting || submitted) return;
    setSubmitting(true);
    try {
      // Flush remaining replay events before submitting
      await recorder.flush().catch(/* istanbul ignore next -- @preserve */ () => {});
      const allFiles = await collectFiles();
      const res = await fetch('/api/assess/takehome/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, files: allFiles }),
      });
      if (res.ok) {
        const data = await res.json() as { shareToken: string };
        setSubmitted(true);
        navigation.navigate('AssessmentResults', { shareToken: data.shareToken });
      }
    } catch {
      // submit error — stay on page
    } finally {
      setSubmitting(false);
    }
  }, [sessionId, submitting, submitted, collectFiles, navigation, recorder]);

  if (loading || !user) return null;

  if (sessionLoading) {
    return (
      <div style={rootStyle}>
        <div style={centerStyle} data-testid="takehome-loading">
          <span style={mutedTextStyle}>Loading take-home session...</span>
        </div>
      </div>
    );
  }

  if (sessionError) {
    return (
      <div style={rootStyle}>
        <div style={centerStyle} data-testid="takehome-error">
          <span style={errorTextStyle}>{sessionError}</span>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div style={bootScreenStyle} data-testid="takehome-boot-screen">
        <div style={bootSpinnerStyle} />
        <span style={bootTextStyle}>
          {error || 'Initializing IDE...'}
        </span>
      </div>
    );
  }

  // Show disclosure modal if not yet accepted (skip for already-completed sessions)
  if (!disclosureAccepted && !submitted) {
    return (
      <TelemetryDisclosure
        companyName={sessionDetails?.companyName ?? 'the hiring company'}
        sessionId={sessionId}
        onAccept={() => setDisclosureAccepted(true)}
      />
    );
  }

  return (
    <div style={rootStyle} data-testid="takehome-screen">
      {/* Top bar */}
      <div style={topBarStyle}>
        <div style={topBarLeftStyle}>
          <button
            onClick={() => navigation.navigate('Assessments')}
            style={backBtnStyle}
            data-testid="back-btn"
            aria-label="Back to assessments"
          >
            &larr; Back
          </button>
          <span style={projectNameStyle}>Take-Home Assessment</span>
          {timeRemaining !== null && (
            <span
              style={{
                ...timerStyle,
                color: timeRemaining < 300 ? arena.error : arena.accent,
              }}
              data-testid="timer"
            >
              {formatTime(timeRemaining)}
            </span>
          )}
        </div>
        <div style={topBarRightStyle}>
          <button
            onClick={() => setShowInstructions(!showInstructions)}
            style={toggleBtnStyle}
            data-testid="toggle-instructions"
          >
            {showInstructions ? 'Hide Instructions' : 'Show Instructions'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || submitted}
            style={{
              ...submitBtnStyle,
              opacity: (submitting || submitted) ? 0.5 : 1,
            }}
            data-testid="submit-btn"
          >
            {submitted ? 'Submitted' : submitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div style={mainStyle}>
        {/* Instructions sidebar */}
        {showInstructions && (
          <>
            <div style={instructionsSidebarStyle} data-testid="instructions-panel">
              <div style={instructionsHeaderStyle}>
                <span style={instructionsTitleStyle}>Instructions</span>
              </div>
              <div style={instructionsBodyStyle}>
                {sessionDetails?.instructions ? (
                  <pre style={instructionsTextStyle}>{sessionDetails.instructions}</pre>
                ) : (
                  <span style={mutedTextStyle}>No instructions provided.</span>
                )}
              </div>
            </div>
            <div data-testid="resize-handle-horizontal" style={hDividerStyle} />
          </>
        )}

        {/* Editor area */}
        <div style={editorAreaStyle}>
          {/* File tree row */}
          <div style={editorWithSidebarStyle}>
            {!layout.sidebarCollapsed && (
              <>
                <div style={fileTreeSidebarStyle}>
                  {cloneProgress && (
                    <div style={cloneProgressStyle} data-testid="clone-progress">
                      {cloneProgress}
                      {cloneFailed && (
                        <button
                          onClick={handleRetryClone}
                          style={retryBtnStyle}
                          data-testid="clone-retry-btn"
                        >
                          Retry
                        </button>
                      )}
                    </div>
                  )}
                  {ready ? (
                    <FileTree
                      files={files}
                      selectedFile={activeTab}
                      onSelectFile={openFile}
                      gitStatus={Object.keys(gitStatusMap).length > 0 ? gitStatusMap : undefined}
                    />
                  ) : error ? (
                    <div style={statusDivStyle} data-testid="wc-error">
                      <span style={errorTextStyle}>{error}</span>
                    </div>
                  ) : (
                    <div style={statusDivStyle} data-testid="wc-loading">
                      <span style={mutedTextStyle}>Booting...</span>
                    </div>
                  )}
                </div>
                <div data-testid="resize-handle-horizontal" style={hDividerStyle} />
              </>
            )}

            <div style={editorColumnStyle}>
              {/* Tab bar */}
              {openTabs.length > 0 && (
                <div style={tabBarStyle} data-testid="tab-bar">
                  {openTabs.map((tab) => (
                    <div
                      key={tab.path}
                      style={{
                        ...tabStyle,
                        background: tab.path === activeTab ? arena.surfaceHover : 'transparent',
                        borderBottom: tab.path === activeTab ? `2px solid ${arena.accent}` : '2px solid transparent',
                      }}
                      data-testid={`tab-${tab.path}`}
                    >
                      <button
                        onClick={() => switchTab(tab.path)}
                        style={tabLabelBtnStyle}
                        data-testid={`tab-btn-${tab.path}`}
                      >
                        {tab.label}
                      </button>
                      <button
                        onClick={() => closeTab(tab.path)}
                        style={tabCloseBtnStyle}
                        data-testid={`tab-close-${tab.path}`}
                        aria-label={`Close ${tab.label}`}
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Monaco editor */}
              <div style={editorWrapperStyle} data-testid="editor-panel">
                {activeTab ? (
                  <Suspense fallback={<div style={editorFallbackStyle}>Loading editor...</div>}>
                    <MonacoEditor
                      height="100%"
                      language={editorLanguage}
                      theme="vs-dark"
                      value={editorContent}
                      onChange={handleEditorChange}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        fontFamily: fontFamily.mono ?? 'monospace',
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        wordWrap: 'on',
                      }}
                    />
                  </Suspense>
                ) : (
                  <div style={editorFallbackStyle} data-testid="no-file-open">
                    {ready ? 'Select a file to start editing' : 'Booting runtime...'}
                  </div>
                )}
              </div>

              {/* Terminal */}
              {!layout.bottomCollapsed && (
                <>
                  <div
                    data-testid="resize-handle-vertical"
                    onDoubleClick={() => layout.setBottomCollapsed(true)}
                    style={vDividerStyle}
                  />
                  <div style={terminalWrapperStyle} data-testid="terminal-panel">
                    {ready ? (
                      <IDETerminal />
                    ) : (
                      <div style={terminalPlaceholderStyle}>
                        <div style={terminalHeaderPlaceholderStyle}>
                          <span style={terminalTitleStyle}>Terminal</span>
                        </div>
                        <div style={terminalBodyPlaceholderStyle}>
                          <span style={mutedTextStyle}>Waiting for runtime...</span>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Inline styles (arena dark theme) ──────────────────────────────────

const rootStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  width: '100vw',
  background: arena.bg,
  color: arena.text,
  overflow: 'hidden',
};

const centerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 1,
};

const topBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  height: 44,
  padding: '0 12px',
  background: arena.surface,
  borderBottom: `1px solid ${arena.border}`,
  flexShrink: 0,
};

const topBarLeftStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
};

const topBarRightStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const backBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: arena.textMuted,
  cursor: 'pointer',
  fontSize: 13,
  padding: '4px 8px',
  borderRadius: 4,
};

const projectNameStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: arena.text,
};

const timerStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums',
};

const toggleBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: `1px solid ${arena.border}`,
  color: arena.textMuted,
  cursor: 'pointer',
  fontSize: 12,
  padding: '4px 10px',
  borderRadius: 4,
};

const submitBtnStyle: React.CSSProperties = {
  background: arena.accent,
  border: 'none',
  color: arena.bg,
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  padding: '6px 16px',
  borderRadius: 6,
};

const mainStyle: React.CSSProperties = {
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
};

const instructionsSidebarStyle: React.CSSProperties = {
  width: 320,
  background: arena.surface,
  borderRight: `1px solid ${arena.border}`,
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
  overflow: 'hidden',
};

const instructionsHeaderStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderBottom: `1px solid ${arena.border}`,
  background: arena.surface,
};

const instructionsTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: arena.text,
};

const instructionsBodyStyle: React.CSSProperties = {
  flex: 1,
  padding: 12,
  overflow: 'auto',
};

const instructionsTextStyle: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.6,
  color: arena.text,
  whiteSpace: 'pre-wrap',
  fontFamily: 'inherit',
  margin: 0,
};

const editorAreaStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  overflow: 'hidden',
};

const editorWithSidebarStyle: React.CSSProperties = {
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
};

const fileTreeSidebarStyle: React.CSSProperties = {
  width: 180,
  background: arena.surface,
  borderRight: `1px solid ${arena.border}`,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'auto',
  flexShrink: 0,
};

const editorColumnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  overflow: 'hidden',
};

const statusDivStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  padding: 16,
};

const mutedTextStyle: React.CSSProperties = {
  color: arena.textMuted,
  fontSize: 13,
};

const errorTextStyle: React.CSSProperties = {
  color: arena.error,
  fontSize: 13,
};

const tabBarStyle: React.CSSProperties = {
  display: 'flex',
  background: arena.surface,
  borderBottom: `1px solid ${arena.border}`,
  overflow: 'auto',
  flexShrink: 0,
};

const tabStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '0 4px 0 0',
  flexShrink: 0,
};

const tabLabelBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: arena.text,
  cursor: 'pointer',
  fontSize: 12,
  padding: '6px 8px',
  whiteSpace: 'nowrap',
};

const tabCloseBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: arena.textMuted,
  cursor: 'pointer',
  fontSize: 14,
  padding: '2px 4px',
  lineHeight: 1,
  borderRadius: 3,
};

const editorWrapperStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
};

const editorFallbackStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  color: arena.textMuted,
  fontSize: 14,
};

const terminalWrapperStyle: React.CSSProperties = {
  height: 180,
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
};

const terminalPlaceholderStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  background: arena.bg,
};

const terminalHeaderPlaceholderStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderBottom: `1px solid ${arena.border}`,
  background: arena.surface,
};

const terminalTitleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: arena.textMuted,
};

const terminalBodyPlaceholderStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const cloneProgressStyle: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: 11,
  color: arena.accent,
  borderBottom: `1px solid ${arena.border}`,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const retryBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: `1px solid ${arena.accent}`,
  color: arena.accent,
  cursor: 'pointer',
  fontSize: 10,
  padding: '2px 8px',
  borderRadius: 3,
  flexShrink: 0,
};

const hDividerStyle: React.CSSProperties = {
  width: 4,
  cursor: 'col-resize',
  background: arena.surface,
  borderLeft: `1px solid ${arena.border}`,
  borderRight: `1px solid ${arena.border}`,
  flexShrink: 0,
};

const vDividerStyle: React.CSSProperties = {
  height: 4,
  cursor: 'row-resize',
  background: arena.surface,
  borderTop: `1px solid ${arena.border}`,
  borderBottom: `1px solid ${arena.border}`,
  flexShrink: 0,
};

const bootScreenStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100vh',
  width: '100vw',
  background: arena.bg,
  gap: 16,
};

const bootSpinnerStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  border: `3px solid ${arena.border}`,
  borderTopColor: arena.accent,
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
};

const bootTextStyle: React.CSSProperties = {
  color: arena.textMuted,
  fontSize: 14,
};
