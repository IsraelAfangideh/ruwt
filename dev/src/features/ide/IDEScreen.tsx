/**
 * IDEScreen: The /ide/new (and /ide/new/:projectId) standalone IDE.
 * Uses Ruwt Runtime (VirtualFS + QuickJS + esbuild-wasm) for filesystem, editing, and terminal.
 * Integrates with project persistence (R2 + D1) for save/load.
 * Supports git operations via isomorphic-git (clone, commit, push).
 */
import { lazy, Suspense, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuthGuard } from '@/shared/hooks/useAuthGuard';
import { useIDELayout } from '@/features/shared-ide/hooks/useIDELayout';
import { arena } from '@/shared/theme/colors';
import { fontFamily } from '@/shared/theme/tokens';
import { useDocumentMeta } from '@/shared/hooks/useDocumentMeta';
import { useRuntime } from './useRuntime';
import type { SaveStatus } from './useRuntime';
import {
  rootStyle, topBarStyle, topBarLeftStyle, backBtnStyle, projectNameStyle,
  topBarRightStyle, cloneRepoBtnStyle, saveBtnStyle,
  mainStyle, sidebarStyle, sidebarTabBarStyle, sidebarTabBtnStyle,
  statusDivStyle, mutedTextStyle, errorTextStyle, editorAreaStyle,
  tabBarStyle, tabStyle, tabLabelBtnStyle, tabCloseBtnStyle,
  editorWrapperStyle, editorFallbackStyle, terminalWrapperStyle,
  terminalPlaceholderStyle, terminalHeaderPlaceholderStyle, terminalTitleStyle,
  terminalBodyPlaceholderStyle, hDividerStyle, vDividerStyle,
  bootScreenStyle, bootSpinnerStyle, bootTextStyle,
} from './ide-styles';
import { FileTree } from './FileTree';
import { IDETerminal } from './IDETerminal';
import { CloneDialog } from './CloneDialog';
import { GitPanel } from './GitPanel';
import { TaskRunner } from './TaskRunner';
import { tabLabel, languageForPath, GIT_TOKEN_KEY, buildGitStatusMap } from './utils';
import { parseRuwtConfig } from '@/lib/config/ruwt-config';
import type { RuwtConfig } from '@/lib/config/ruwt-config';
import * as browserGit from '@/lib/git/browser-git';
import type { GitStatusEntry, GitLogEntry } from '@/lib/git/browser-git';
import '@/features/shared-ide/lib/monaco-init';

/* istanbul ignore next -- @preserve */
const MonacoEditor = lazy(() => import('@monaco-editor/react'));

/** Human-readable save status label */
function saveButtonLabel(status: SaveStatus): string {
  switch (status) {
    case 'saving': return 'Saving...';
    case 'saved': return 'Saved';
    case 'error': return 'Save failed';
    default: return 'Save';
  }
}

interface OpenTab {
  path: string;
  label: string;
}

export function IDEScreen() {
  const { user, loading } = useAuthGuard();
  const navigation = useNavigation();
  const route = useRoute();
  const layout = useIDELayout('ide-layout-prefs');

  // Extract projectId from route params
  const routeProjectId = (route.params as { projectId?: string } | undefined)?.projectId;

  const [projectId, setProjectId] = useState<string | undefined>(routeProjectId);
  const [projectName, setProjectName] = useState('Untitled Project');

  const { ready, files, error, refreshFiles, saveStatus, markDirty, saveProject, backend } = useRuntime(projectId);
  useDocumentMeta({ title: `${projectName} — Ruwt IDE` });

  // Open tabs and active tab tracking
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  // Editor content for the active file
  const [editorContent, setEditorContent] = useState<string>('');
  const [editorLanguage, setEditorLanguage] = useState<string>('javascript');

  // Debounce timer for writing back to the runtime filesystem
  const writeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track whether the initial auto-open has fired (prevent re-open after user closes all tabs)
  const didAutoOpenRef = useRef(false);

  // .ruwt.yml config (loaded from project root when ready)
  const [ruwtConfig, setRuwtConfig] = useState<RuwtConfig | null>(null);

  // Git integration state
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'files' | 'git'>('files');
  const [gitStatusEntries, setGitStatusEntries] = useState<GitStatusEntry[]>([]);
  const [gitLogEntries, setGitLogEntries] = useState<GitLogEntry[]>([]);
  const [gitBranch, setGitBranch] = useState<string | null>(null);
  const gitTokenRef = useRef<string | null>(
    /* istanbul ignore next -- @preserve */
    typeof window !== 'undefined' ? localStorage.getItem(GIT_TOKEN_KEY) : null,
  );

  // Load project metadata if we have a projectId
  useEffect(() => {
    if (!routeProjectId) return;
    fetch(`/api/projects/${routeProjectId}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data: any) => {
        if (data?.project) {
          setProjectName(data.project.name ?? 'Untitled Project');
        }
      })
      .catch(/* istanbul ignore next -- @preserve */ () => {});
  }, [routeProjectId]);

  // Load a file into the editor (shared by openFile and switchTab)
  const loadFileContent = useCallback(async (path: string) => {
    setActiveTab(path);
    setEditorLanguage(languageForPath(path));
    try {
      const content = await backend.readFile(path);
      setEditorContent(content);
    } catch {
      setEditorContent('// Could not read file');
    }
  }, []);

  // Open a file: add to tabs if not already open, then load it
  const openFile = useCallback(async (path: string) => {
    setOpenTabs((prev) => {
      if (prev.some((t) => t.path === path)) return prev;
      return [...prev, { path, label: tabLabel(path) }];
    });
    await loadFileContent(path);
  }, [loadFileContent]);

  // switchTab is just loadFileContent (tab already exists)
  const switchTab = loadFileContent;

  // Close a tab
  const closeTab = useCallback((path: string) => {
    setOpenTabs((prev) => {
      const next = prev.filter((t) => t.path !== path);
      if (path === activeTab) {
        const fallback = next.length > 0 ? next[next.length - 1].path : null;
        if (fallback) {
          // Defer the file load to avoid side effects inside the updater
          queueMicrotask(() => loadFileContent(fallback));
        } else {
          setActiveTab(null);
          setEditorContent('');
        }
      }
      return next;
    });
  }, [activeTab, loadFileContent]);

  // Handle editor content changes — debounced write to runtime
  const handleEditorChange = useCallback((value: string | undefined) => {
    const v = value ?? '';
    setEditorContent(v);
    if (!activeTab) return;
    const path = activeTab;
    if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
    writeTimerRef.current = setTimeout(() => {
      backend.writeFile(path, v).catch(/* istanbul ignore next -- @preserve */ () => {});
      markDirty();
    }, 300);
  }, [activeTab, markDirty]);

  // Cleanup write timer on unmount
  useEffect(() => {
    return () => {
      if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
    };
  }, []);

  // Auto-open index.js once runtime is ready (only on initial boot)
  useEffect(() => {
    if (ready && !didAutoOpenRef.current && openTabs.length === 0 && files.length > 0) {
      didAutoOpenRef.current = true;
      // Find index.js in the top-level files
      const indexFile = files.find((f) => f.type === 'file' && f.name === 'index.js');
      if (indexFile) {
        openFile(indexFile.path);
      }
    }
  }, [ready, files, openTabs.length, openFile]);

  // ── Git helpers ─────────────────────────────────────────────────────

  /** Refresh git status, branch, and log from the working directory. */
  const refreshGitStatus = useCallback(async () => {
    try {
      const [branch, entries, commits] = await Promise.all([
        browserGit.currentBranch(backend, '.'),
        browserGit.status(backend, '.'),
        browserGit.log(backend, '.', 5),
      ]);
      setGitBranch(branch);
      setGitStatusEntries(entries);
      setGitLogEntries(commits);
    } catch {
      // Not a git repo or git error — clear state
      setGitStatusEntries([]);
      setGitLogEntries([]);
      setGitBranch(null);
    }
  }, []);

  /** Handle clone: clone repo, refresh file tree, check git status. */
  const handleClone = useCallback(async (url: string, token?: string) => {
    await browserGit.clone(backend, url, '.', { token });
    await Promise.all([refreshFiles(), refreshGitStatus()]);
  }, [refreshFiles, refreshGitStatus]);

  /** Stage a file */
  const handleGitStage = useCallback((filepath: string) => {
    browserGit.add(backend, '.', filepath)
      .then(refreshGitStatus)
      .catch(/* istanbul ignore next -- @preserve */ () => {});
  }, [refreshGitStatus]);

  /** Unstage a file (remove from the index via git.remove) */
  const handleGitUnstage = useCallback((filepath: string) => {
    browserGit.unstage(backend, '.', filepath)
      .then(refreshGitStatus)
      .catch(/* istanbul ignore next -- @preserve */ () => {});
  }, [refreshGitStatus]);

  /** Commit staged changes */
  const handleGitCommit = useCallback((message: string) => {
    const author = { name: user?.email ?? 'Ruwt User', email: user?.email ?? 'user@ruwt.dev' };
    browserGit.commit(backend, '.', message, author)
      .then(() => refreshGitStatus())
      .catch(/* istanbul ignore next -- @preserve */ () => {});
  }, [user, refreshGitStatus]);

  /** Push to remote */
  const handleGitPush = useCallback(() => {
    const token = gitTokenRef.current ?? undefined;
    browserGit.push(backend, '.', { token })
      .catch(/* istanbul ignore next -- @preserve */ () => {});
  }, []);

  // Derive isGitRepo from gitBranch (no separate state needed)
  const isGitRepo = gitBranch !== null;

  // Build git status map for the file tree (memoized)
  const gitStatusMap = useMemo(() => buildGitStatusMap(gitStatusEntries), [gitStatusEntries]);

  // Check git status when runtime is ready
  useEffect(() => {
    if (ready) {
      refreshGitStatus();
    }
  }, [ready, refreshGitStatus]);

  // Load .ruwt.yml config when runtime is ready
  useEffect(() => {
    if (!ready) return;
    backend.readFile('.ruwt.yml')
      .then((content) => {
        try {
          const config = parseRuwtConfig(content);
          setRuwtConfig(config);
        } catch {
          // Invalid config — silently ignore
        }
      })
      .catch(() => {
        // No .ruwt.yml found — that's fine
      });
  }, [ready]);

  /** Run a task command — currently a no-op placeholder until terminal command dispatch is wired up. */
  const handleRunCommand = useCallback((_command: string) => {
    // TODO: wire to IDETerminal's shell input when terminal exposes a write API
  }, []);

  // Handle manual save
  const handleSave = useCallback(async () => {
    // If no project yet, create one first
    let pid = projectId;
    if (!pid) {
      try {
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: projectName }),
        });
        if (res.ok) {
          const data = await res.json() as { project: { id: string; name: string } };
          pid = data.project.id;
          setProjectId(pid);
        }
      } catch {
        return;
      }
    }
    if (pid) {
      await saveProject(pid);
    }
  }, [projectId, projectName, saveProject]);

  if (loading || !user) return null;

  if (!ready) {
    return (
      <div style={bootScreenStyle} data-testid="ide-boot-screen">
        <div style={bootSpinnerStyle} />
        <span style={bootTextStyle}>
          {error || 'Initializing IDE...'}
        </span>
      </div>
    );
  }

  const buttonLabel = saveButtonLabel(saveStatus);

  return (
    <div style={rootStyle}>
      {/* Top bar */}
      <div style={topBarStyle}>
        <div style={topBarLeftStyle}>
          <button
            onClick={() => navigation.navigate('ProjectList' as never)}
            style={backBtnStyle}
            data-testid="back-btn"
            aria-label="Back to projects"
          >
            &larr; Back
          </button>
          <span style={projectNameStyle}>{projectName}</span>
        </div>
        <div style={topBarRightStyle}>
          {ruwtConfig?.tasks && Object.keys(ruwtConfig.tasks).length > 0 && (
            <TaskRunner tasks={ruwtConfig.tasks} onRunCommand={handleRunCommand} />
          )}
          <button
            onClick={() => setShowCloneDialog(true)}
            style={cloneRepoBtnStyle}
            data-testid="clone-repo-btn"
          >
            Clone Repo
          </button>
          <button
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            style={{
              ...saveBtnStyle,
              ...(saveStatus === 'saved' ? { background: '#2ea043', cursor: 'default' } : {}),
              ...(saveStatus === 'error' ? { background: arena.error } : {}),
              ...(saveStatus === 'saving' ? { opacity: 0.7, cursor: 'wait' } : {}),
            }}
            data-testid="save-btn"
          >
            {buttonLabel}
          </button>
        </div>
      </div>

      {/* Clone dialog */}
      <CloneDialog
        open={showCloneDialog}
        onClose={() => setShowCloneDialog(false)}
        onClone={handleClone}
      />

      {/* Main content area */}
      <div style={mainStyle}>
        {/* Sidebar — file tree / git panel */}
        {!layout.sidebarCollapsed && (
          <div style={sidebarStyle}>
            {ready ? (
              <>
                {/* Sidebar tab switcher */}
                {isGitRepo && (
                  <div style={sidebarTabBarStyle} data-testid="sidebar-tab-bar">
                    <button
                      onClick={() => setSidebarTab('files')}
                      style={{
                        ...sidebarTabBtnStyle,
                        borderBottom: sidebarTab === 'files'
                          ? `2px solid ${arena.accent}`
                          : '2px solid transparent',
                        color: sidebarTab === 'files' ? arena.text : arena.textMuted,
                      }}
                      data-testid="sidebar-tab-files"
                    >
                      Files
                    </button>
                    <button
                      onClick={() => setSidebarTab('git')}
                      style={{
                        ...sidebarTabBtnStyle,
                        borderBottom: sidebarTab === 'git'
                          ? `2px solid ${arena.accent}`
                          : '2px solid transparent',
                        color: sidebarTab === 'git' ? arena.text : arena.textMuted,
                      }}
                      data-testid="sidebar-tab-git"
                    >
                      Git
                    </button>
                  </div>
                )}

                {sidebarTab === 'files' ? (
                  <FileTree
                    files={files}
                    selectedFile={activeTab}
                    onSelectFile={openFile}
                    gitStatus={isGitRepo ? gitStatusMap : undefined}
                  />
                ) : (
                  <GitPanel
                    branch={gitBranch}
                    statusEntries={gitStatusEntries}
                    logEntries={gitLogEntries}
                    hasToken={!!gitTokenRef.current}
                    onStage={handleGitStage}
                    onUnstage={handleGitUnstage}
                    onCommit={handleGitCommit}
                    onPush={handleGitPush}
                    onRefresh={refreshGitStatus}
                  />
                )}
              </>
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
        )}

        {/* Sidebar resize bar */}
        {!layout.sidebarCollapsed && (
          <div
            data-testid="resize-handle-horizontal"
            onDoubleClick={() => layout.setSidebarCollapsed(true)}
            style={hDividerStyle}
          />
        )}

        {/* Editor + terminal vertical split */}
        <div style={editorAreaStyle}>
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

          {/* Terminal resize bar */}
          {!layout.bottomCollapsed && (
            <div
              data-testid="resize-handle-vertical"
              onDoubleClick={() => layout.setBottomCollapsed(true)}
              style={vDividerStyle}
            />
          )}

          {/* Terminal */}
          {!layout.bottomCollapsed && (
            <div style={terminalWrapperStyle} data-testid="terminal-panel">
              {ready ? (
                <IDETerminal backend={backend} />
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
          )}
        </div>
      </div>
    </div>
  );
}
