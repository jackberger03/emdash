import React, { useState, useEffect } from 'react';
import { X, Minimize2, Grip } from 'lucide-react';
import ChatInterface from './ChatInterface';
import { Workspace } from '../types/chat';

export const FloatingChat: React.FC = () => {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    // Get initial workspace
    const loadWorkspace = async () => {
      try {
        const result = await window.electronAPI.floatingGetWorkspace();
        if (result.success && result.workspaceId) {
          setWorkspaceId(result.workspaceId);
          // Load workspace data
          const workspaces = await window.electronAPI.getWorkspaces();
          const ws = workspaces.find((w: Workspace) => w.id === result.workspaceId);
          if (ws) {
            setWorkspace(ws);
          }
        }
      } catch (error) {
        console.error('Failed to load floating workspace:', error);
      }
    };

    loadWorkspace();

    // Listen for workspace changes
    const unsubscribe = window.electronAPI.onFloatingWorkspaceChanged(async (newWorkspaceId) => {
      setWorkspaceId(newWorkspaceId);
      // Load workspace data
      const workspaces = await window.electronAPI.getWorkspaces();
      const ws = workspaces.find((w: Workspace) => w.id === newWorkspaceId);
      if (ws) {
        setWorkspace(ws);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleClose = () => {
    window.electronAPI.floatingToggle();
  };

  const handleMinimize = () => {
    window.electronAPI.floatingToggle();
  };

  if (!workspace) {
    return (
      <div className="flex h-screen w-full flex-col overflow-hidden rounded-lg border border-border bg-background/95 shadow-2xl backdrop-blur-xl">
        {/* Title Bar */}
        <div
          className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <div className="flex items-center gap-2">
            <Grip className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Floating Chat</span>
          </div>
          <div
            className="flex items-center gap-1"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <button
              onClick={handleMinimize}
              className="rounded-md p-1 hover:bg-muted"
              title="Minimize"
            >
              <Minimize2 className="h-4 w-4" />
            </button>
            <button
              onClick={handleClose}
              className="rounded-md p-1 hover:bg-destructive hover:text-destructive-foreground"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* No workspace selected */}
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="text-center text-muted-foreground">
            <p className="text-sm">No workspace selected</p>
            <p className="mt-2 text-xs">
              Use <kbd className="rounded bg-muted px-2 py-1 text-xs">⌘⇧Space</kbd> to toggle
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden rounded-lg border border-border bg-background/95 shadow-2xl backdrop-blur-xl">
      {/* Title Bar */}
      <div
        className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-2">
          <Grip className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{workspace.name}</span>
        </div>
        <div
          className="flex items-center gap-1"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            onClick={handleMinimize}
            className="rounded-md p-1 hover:bg-muted"
            title="Minimize"
          >
            <Minimize2 className="h-4 w-4" />
          </button>
          <button
            onClick={handleClose}
            className="rounded-md p-1 hover:bg-destructive hover:text-destructive-foreground"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Chat Interface */}
      <div className="min-h-0 flex-1">
        <ChatInterface workspace={workspace} projectName={workspace.name} className="h-full" />
      </div>
    </div>
  );
};

export default FloatingChat;
