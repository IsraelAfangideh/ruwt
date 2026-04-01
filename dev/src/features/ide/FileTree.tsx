/**
 * FileTree: renders a file-tree sidebar from project filesystem entries.
 * Supports folder expand/collapse, file-type icons, selected-file highlighting,
 * and optional git status indicators per file.
 */
import { useState, useCallback } from 'react';
import { arena } from '@/shared/theme/colors';
import type { GitFileStatus } from '@/lib/git/browser-git';

export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileEntry[];
}

/** Map of filepath -> git status for display in the file tree */
export type GitStatusMap = Record<string, GitFileStatus>;

interface FileTreeProps {
  files: FileEntry[];
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  /** Optional git status per file path */
  gitStatus?: GitStatusMap;
}

/** Map file extension to a short icon label */
function fileIcon(name: string): string {
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  switch (ext) {
    case 'js': return 'JS';
    case 'ts': return 'TS';
    case 'tsx': return 'TX';
    case 'jsx': return 'JX';
    case 'json': return '{}';
    case 'md': return '#';
    case 'css': return 'CS';
    case 'html': return '<>';
    default: return '··';
  }
}

export function FileTree({ files, selectedFile, onSelectFile, gitStatus }: FileTreeProps) {
  return (
    <div data-testid="file-tree" style={rootStyle}>
      <div style={headerStyle}>
        <span style={titleStyle}>Files</span>
      </div>
      <div style={listStyle}>
        {files.map((entry) => (
          <FileTreeNode
            key={entry.path}
            entry={entry}
            depth={0}
            selectedFile={selectedFile}
            onSelectFile={onSelectFile}
            gitStatus={gitStatus}
          />
        ))}
      </div>
    </div>
  );
}

/** Badge text for git status */
function gitStatusBadge(status: GitFileStatus): string {
  switch (status) {
    case 'modified': return 'M';
    case 'added': return '+';
    case 'deleted': return '-';
    case 'untracked': return '?';
    default: return '';
  }
}

/** Badge color for git status */
function gitStatusColor(status: GitFileStatus): string {
  switch (status) {
    case 'modified': return '#e5c07b';
    case 'added': return '#3fb950';
    case 'deleted': return '#f85149';
    case 'untracked': return '#8b929a';
    default: return '#8b929a';
  }
}

interface FileTreeNodeProps {
  entry: FileEntry;
  depth: number;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  gitStatus?: GitStatusMap;
}

function FileTreeNode({ entry, depth, selectedFile, onSelectFile, gitStatus }: FileTreeNodeProps) {
  const [expanded, setExpanded] = useState(true);

  const handleClick = useCallback(() => {
    if (entry.type === 'directory') {
      setExpanded((prev) => !prev);
    } else {
      onSelectFile(entry.path);
    }
  }, [entry.type, entry.path, onSelectFile]);

  const isSelected = entry.type === 'file' && entry.path === selectedFile;
  const fileGitStatus = gitStatus?.[entry.path];

  return (
    <>
      <button
        onClick={handleClick}
        style={{
          ...itemStyle,
          paddingLeft: 12 + depth * 16,
          background: isSelected ? arena.surfaceHover : 'transparent',
        }}
        data-testid={`file-${entry.path}`}
        aria-expanded={entry.type === 'directory' ? expanded : undefined}
      >
        <span style={iconStyle}>
          {entry.type === 'directory' ? (expanded ? '\u25BE' : '\u25B8') : fileIcon(entry.name)}
        </span>
        <span style={nameStyle}>{entry.name}</span>
        {fileGitStatus && (
          <span
            style={{ ...gitBadgeStyle, color: gitStatusColor(fileGitStatus) }}
            data-testid={`git-badge-${entry.path}`}
          >
            {gitStatusBadge(fileGitStatus)}
          </span>
        )}
      </button>
      {entry.type === 'directory' && expanded && entry.children?.map((child) => (
        <FileTreeNode
          key={child.path}
          entry={child}
          depth={depth + 1}
          selectedFile={selectedFile}
          onSelectFile={onSelectFile}
          gitStatus={gitStatus}
        />
      ))}
    </>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const rootStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  overflow: 'auto',
  height: '100%',
};

const headerStyle: React.CSSProperties = {
  padding: '10px 12px 6px',
  borderBottom: `1px solid ${arena.border}`,
};

const titleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: arena.textMuted,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};

const listStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
};

const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '5px 12px',
  border: 'none',
  width: '100%',
  textAlign: 'left',
  cursor: 'pointer',
  color: arena.text,
  fontSize: 13,
};

const iconStyle: React.CSSProperties = {
  fontSize: 11,
  color: arena.textMuted,
  width: 20,
  textAlign: 'center',
  flexShrink: 0,
};

const nameStyle: React.CSSProperties = {
  fontSize: 13,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  flex: 1,
};

const gitBadgeStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  flexShrink: 0,
  marginLeft: 4,
};
