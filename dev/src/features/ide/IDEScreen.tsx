/**
 * IDEScreen: The /ide/new (and /ide/new/:projectId) standalone IDE.
 * Uses WebContainer for a real filesystem, multi-file editing, and terminal.
 * Integrates with project persistence (R2 + D1) for save/load.
 */
import { lazy, Suspense, useState, useRef, useCallback, useEffect } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuthGuard } from '@/shared/hooks/useAuthGuard';
import { useIDELayout } from '@/features/shared-ide/useIDELayout';
import { PanelResizeBar } from '@/features/shared-ide/PanelResizeBar';
import { arena } from '@/shared/theme/colors';
import { fontFamily } from '@/shared/theme/tokens';
import { useDocumentMeta } from '@/shared/hooks/useDocumentMeta';
import { readFile, writeFile } from '@/lib/sandbox/webcontainer';
import { useWebContainer } from './useWebContainer';
import type { SaveStatus } from './useWebContainer';
import { FileTree } from './FileTree';
import { IDETerminal } from './IDETerminal';
import { tabLabel, languageForPath } from './utils';

/* istanbul ignore next -- @preserve */
const MonacoEditor = lazy(() => import('@monaco-editor/react'));

/** Human-readable save status label */
function saveStatusLabel(status: SaveStatus): string {
  switch (status) {
    case 'saving': return 'Saving...';
    case 'saved': return 'Saved';
    case 'error': return 'Save failed';
    default: return '';
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

  const { ready, files, error, saveStatus, markDirty, saveProject } = useWebContainer(projectId);
  useDocumentMeta({ title: `${projectName} — Ruwt IDE` });

  // Open tabs and active tab tracking
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  // Editor content for the active file
  const [editorContent, setEditorContent] = useState<string>('');
  const [editorLanguage, setEditorLanguage] = useState<string>('javascript');

  // Debounce timer for writing back to the WebContainer filesystem
  const writeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track whether the initial auto-open has fired (prevent re-open after user closes all tabs)
  const didAutoOpenRef = useRef(false);

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
      const content = await readFile(path);
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

  // Handle editor content changes — debounced write to WebContainer
  const handleEditorChange = useCallback((value: string | undefined) => {
    const v = value ?? '';
    setEditorContent(v);
    if (!activeTab) return;
    const path = activeTab;
    if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
    writeTimerRef.current = setTimeout(() => {
      writeFile(path, v).catch(/* istanbul ignore next -- @preserve */ () => {});
      markDirty();
    }, 300);
  }, [activeTab, markDirty]);

  // Cleanup write timer on unmount
  useEffect(() => {
    return () => {
      if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
    };
  }, []);

  // Auto-open index.js once WebContainer is ready (only on initial boot)
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

  const statusText = saveStatusLabel(saveStatus);

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
          {statusText && (
            <span
              style={{
                ...saveStatusStyle,
                color: saveStatus === 'error' ? arena.error : arena.textMuted,
              }}
              data-testid="save-status"
            >
              {statusText}
            </span>
          )}
        </div>
        <button onClick={handleSave} style={saveBtnStyle} data-testid="save-btn">
          Save
        </button>
      </div>

      {/* Main content area */}
      <div style={mainStyle}>
        {/* Sidebar — file tree */}
        {!layout.sidebarCollapsed && (
          <div style={sidebarStyle}>
            {ready ? (
              <FileTree
                files={files}
                selectedFile={activeTab}
                onSelectFile={openFile}
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
        )}

        {/* Sidebar resize bar */}
        {!layout.sidebarCollapsed && (
          <PanelResizeBar
            direction="horizontal"
            onDoubleClick={() => layout.setSidebarCollapsed(true)}
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
                {ready ? 'Select a file to start editing' : 'Booting WebContainer...'}
              </div>
            )}
          </div>

          {/* Terminal resize bar */}
          {!layout.bottomCollapsed && (
            <PanelResizeBar
              direction="vertical"
              onDoubleClick={() => layout.setBottomCollapsed(true)}
            />
          )}

          {/* Terminal */}
          {!layout.bottomCollapsed && (
            <div style={terminalWrapperStyle} data-testid="terminal-panel">
              {ready ? (
                <IDETerminal />
              ) : (
                <div style={terminalPlaceholderStyle}>
                  <div style={terminalHeaderPlaceholderStyle}>
                    <span style={terminalTitleStyle}>Terminal</span>
                  </div>
                  <div style={terminalBodyPlaceholderStyle}>
                    <span style={mutedTextStyle}>Waiting for WebContainer...</span>
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

const saveStatusStyle: React.CSSProperties = {
  fontSize: 12,
  fontStyle: 'italic',
};

const saveBtnStyle: React.CSSProperties = {
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

const sidebarStyle: React.CSSProperties = {
  width: 200,
  background: arena.surface,
  borderRight: `1px solid ${arena.border}`,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'auto',
  flexShrink: 0,
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

const editorAreaStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  overflow: 'hidden',
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
