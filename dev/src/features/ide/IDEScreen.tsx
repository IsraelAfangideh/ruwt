/**
 * IDEScreen: The /ide/new (and future /ide/:projectId) standalone IDE.
 * Uses shared-ide components for layout and panel resizing.
 */
import { lazy, Suspense, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useAuthGuard } from '@/shared/hooks/useAuthGuard';
import { useIDELayout } from '@/features/shared-ide/useIDELayout';
import { PanelResizeBar } from '@/features/shared-ide/PanelResizeBar';
import { arena } from '@/shared/theme/colors';
import { fontFamily } from '@/shared/theme/tokens';
import { useDocumentMeta } from '@/shared/hooks/useDocumentMeta';

/* istanbul ignore next -- @preserve */
const MonacoEditor = lazy(() => import('@monaco-editor/react'));

const STARTER_CODE = `// Welcome to Ruwt IDE
// Start coding or clone a repo

console.log('Hello, world!');
`;

const MOCK_FILES = [
  { name: 'index.js', icon: 'JS' },
  { name: 'package.json', icon: '{}' },
  { name: 'README.md', icon: '#' },
];

export function IDEScreen() {
  const { user, loading } = useAuthGuard();
  const navigation = useNavigation();
  const layout = useIDELayout('ide-layout-prefs');
  const [code, setCode] = useState(STARTER_CODE);
  const [selectedFile, setSelectedFile] = useState('index.js');
  useDocumentMeta({ title: 'Ruwt IDE' });

  if (loading || !user) return null;

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
            ← Back
          </button>
          <span style={projectNameStyle}>Untitled Project</span>
        </div>
        <button style={saveBtnStyle} data-testid="save-btn">
          Save
        </button>
      </div>

      {/* Main content area */}
      <div style={mainStyle}>
        {/* Sidebar — file tree */}
        {!layout.sidebarCollapsed && (
          <div style={sidebarStyle} data-testid="file-tree">
            <div style={sidebarHeaderStyle}>
              <span style={sidebarTitleStyle}>Files</span>
            </div>
            {MOCK_FILES.map((f) => (
              <button
                key={f.name}
                onClick={() => setSelectedFile(f.name)}
                style={{
                  ...fileItemStyle,
                  background: selectedFile === f.name ? arena.surfaceHover : 'transparent',
                }}
                data-testid={`file-${f.name}`}
              >
                <span style={fileIconStyle}>{f.icon}</span>
                <span style={fileNameStyle}>{f.name}</span>
              </button>
            ))}
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
          {/* Monaco editor */}
          <div style={editorWrapperStyle} data-testid="editor-panel">
            <Suspense fallback={<div style={editorFallbackStyle}>Loading editor...</div>}>
              <MonacoEditor
                height="100%"
                language="javascript"
                theme="vs-dark"
                value={code}
                onChange={/* istanbul ignore next -- @preserve */ (v) => setCode(v ?? '')}
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
          </div>

          {/* Terminal resize bar */}
          {!layout.bottomCollapsed && (
            <PanelResizeBar
              direction="vertical"
              onDoubleClick={() => layout.setBottomCollapsed(true)}
            />
          )}

          {/* Terminal placeholder */}
          {!layout.bottomCollapsed && (
            <div style={terminalStyle} data-testid="terminal-panel">
              <div style={terminalHeaderStyle}>
                <span style={terminalTitleStyle}>Terminal</span>
              </div>
              <div style={terminalBodyStyle}>
                <span style={terminalPromptStyle}>$</span>
              </div>
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

const sidebarHeaderStyle: React.CSSProperties = {
  padding: '10px 12px 6px',
  borderBottom: `1px solid ${arena.border}`,
};

const sidebarTitleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: arena.textMuted,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};

const fileItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 12px',
  border: 'none',
  width: '100%',
  textAlign: 'left',
  cursor: 'pointer',
  color: arena.text,
  fontSize: 13,
};

const fileIconStyle: React.CSSProperties = {
  fontSize: 11,
  color: arena.textMuted,
  width: 20,
  textAlign: 'center',
};

const fileNameStyle: React.CSSProperties = {
  fontSize: 13,
};

const editorAreaStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  overflow: 'hidden',
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

const terminalStyle: React.CSSProperties = {
  height: 180,
  background: arena.bg,
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
};

const terminalHeaderStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderBottom: `1px solid ${arena.border}`,
  background: arena.surface,
};

const terminalTitleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: arena.textMuted,
};

const terminalBodyStyle: React.CSSProperties = {
  flex: 1,
  padding: '8px 12px',
  fontFamily: 'monospace',
  fontSize: 13,
  color: arena.text,
};

const terminalPromptStyle: React.CSSProperties = {
  color: arena.accent,
};
