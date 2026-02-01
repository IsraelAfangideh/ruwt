'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface FileNode {
  name: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  path: string;
}

interface FileTreeProps {
  files: FileNode[];
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  onCreateFile?: (path: string) => void;
  onDeleteFile?: (path: string) => void;
}

function FileIcon({ type, name }: { type: 'file' | 'directory'; name: string }) {
  if (type === 'directory') {
    return (
      <svg
        className="w-4 h-4 text-yellow-500"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
      </svg>
    );
  }

  // File icons based on extension
  const ext = name.split('.').pop();
  const iconColors: Record<string, string> = {
    js: 'text-yellow-400',
    ts: 'text-blue-400',
    tsx: 'text-blue-400',
    jsx: 'text-blue-400',
    json: 'text-yellow-300',
    md: 'text-gray-400',
    css: 'text-pink-400',
    html: 'text-orange-400',
  };

  return (
    <svg
      className={cn('w-4 h-4', iconColors[ext || ''] || 'text-gray-400')}
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path
        fillRule="evenodd"
        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function FileTreeNode({
  node,
  depth,
  selectedFile,
  onSelectFile,
}: {
  node: FileNode;
  depth: number;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(depth < 2);

  const handleClick = () => {
    if (node.type === 'directory') {
      setIsExpanded(!isExpanded);
    } else {
      onSelectFile(node.path);
    }
  };

  return (
    <div>
      <button
        onClick={handleClick}
        className={cn(
          'flex items-center gap-2 w-full px-2 py-1 text-sm hover:bg-muted rounded-sm',
          selectedFile === node.path && 'bg-muted'
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {node.type === 'directory' && (
          <svg
            className={cn('w-3 h-3 transition-transform', isExpanded && 'rotate-90')}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
        )}
        <FileIcon type={node.type} name={node.name} />
        <span className="truncate">{node.name}</span>
      </button>

      {node.type === 'directory' && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedFile={selectedFile}
              onSelectFile={onSelectFile}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileTree({
  files,
  selectedFile,
  onSelectFile,
  onCreateFile,
}: FileTreeProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-sm font-medium">Files</span>
        {onCreateFile && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => {
              const name = prompt('File name:');
              if (name) {
                onCreateFile(name);
              }
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </Button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {files.map((file) => (
          <FileTreeNode
            key={file.path}
            node={file}
            depth={0}
            selectedFile={selectedFile}
            onSelectFile={onSelectFile}
          />
        ))}
      </div>
    </div>
  );
}

// Utility to convert flat file list to tree structure
export function buildFileTree(paths: string[]): FileNode[] {
  const root: FileNode[] = [];

  for (const path of paths) {
    const parts = path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const currentPath = parts.slice(0, i + 1).join('/');
      const isFile = i === parts.length - 1;

      let node = current.find((n) => n.name === name);

      if (!node) {
        node = {
          name,
          type: isFile ? 'file' : 'directory',
          path: currentPath,
          children: isFile ? undefined : [],
        };
        current.push(node);
      }

      if (!isFile && node.children) {
        current = node.children;
      }
    }
  }

  // Sort: directories first, then alphabetically
  const sortNodes = (nodes: FileNode[]): FileNode[] => {
    return nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    }).map((node) => ({
      ...node,
      children: node.children ? sortNodes(node.children) : undefined,
    }));
  };

  return sortNodes(root);
}
