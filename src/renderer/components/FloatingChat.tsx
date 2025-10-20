import React, { useState, useEffect } from 'react';
import { X, Minimize2, Grip } from 'lucide-react';
import ChatInterface from './ChatInterface';
import { Workspace } from '../types/chat';
import { ErrorBoundary } from './ErrorBoundary';
import { ThemeProvider } from './ThemeProvider';
import { TerminalRegistryProvider } from '../contexts/TerminalRegistry';

const FloatingChatContent: React.FC = () => {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get initial workspace
    const loadWorkspace = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const result = await window.electronAPI.floatingGetWorkspace();
        console.log('[FloatingChat] Got workspace result:', result);

        if (result.success && result.workspaceId) {
          setWorkspaceId(result.workspaceId);
          // Load workspace data
          const workspaces = await window.electronAPI.getWorkspaces();
          console.log('[FloatingChat] All workspaces:', workspaces);
          const ws = workspaces.find((w: Workspace) => w.id === result.workspaceId);
          console.log('[FloatingChat] Found workspace:', ws);
          if (ws) {
            // Ensure workspace has required fields
            if (!ws.path) {
              throw new Error('Workspace is missing path property');
            }
            setWorkspace(ws);
          } else {
            setError(`Workspace ${result.workspaceId} not found`);
          }
        }
      } catch (error) {
        console.error('Failed to load floating workspace:', error);
        setError(error instanceof Error ? error.message : 'Failed to load workspace');
      } finally {
        setIsLoading(false);
      }
    };

    loadWorkspace();

    // Listen for workspace changes
    const unsubscribe = window.electronAPI.onFloatingWorkspaceChanged?.(async (newWorkspaceId) => {
      try {
        console.log('[FloatingChat] Workspace changed to:', newWorkspaceId);
        setWorkspaceId(newWorkspaceId);
        setError(null);
        // Load workspace data
        const workspaces = await window.electronAPI.getWorkspaces();
        const ws = workspaces.find((w: Workspace) => w.id === newWorkspaceId);
        if (ws) {
          if (!ws.path) {
            throw new Error('Workspace is missing path property');
          }
          setWorkspace(ws);
        } else {
          setError(`Workspace ${newWorkspaceId} not found`);
        }
      } catch (error) {
        console.error('Failed to update workspace:', error);
        setError(error instanceof Error ? error.message : 'Failed to update workspace');
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const handleClose = () => {
    window.electronAPI.floatingToggle();
  };

  const handleMinimize = () => {
    window.electronAPI.floatingToggle();
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-full flex-col overflow-hidden rounded-xl border border-white/10 shadow-2xl backdrop-blur-2xl">
        <div
          className="flex items-center justify-between border-b border-white/10 px-4 py-2 backdrop-blur-xl"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <div className="flex items-center gap-2">
            <Grip className="h-4 w-4 text-foreground/70" />
            <span className="text-sm font-medium text-foreground">Loading...</span>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-sm text-foreground/70">Loading workspace...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen w-full flex-col overflow-hidden rounded-xl border border-white/10 shadow-2xl backdrop-blur-2xl">
        <div
          className="flex items-center justify-between border-b border-white/10 px-4 py-2 backdrop-blur-xl"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <div className="flex items-center gap-2">
            <Grip className="h-4 w-4 text-foreground/70" />
            <span className="text-sm font-medium text-foreground">Error</span>
          </div>
          <div
            className="flex items-center gap-1"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <button onClick={handleClose} className="text-foreground/70 hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="text-center text-destructive">
            <p className="text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex h-screen w-full flex-col overflow-hidden rounded-xl border border-white/10 shadow-2xl backdrop-blur-2xl">
        {/* Title Bar */}
        <div
          className="flex items-center justify-between border-b border-white/10 px-4 py-2 backdrop-blur-xl"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <div className="flex items-center gap-2">
            <Grip className="h-4 w-4 text-foreground/70" />
            <span className="text-sm font-medium text-foreground">Floating Chat</span>
          </div>
          <div
            className="flex items-center gap-1"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <button
              onClick={handleMinimize}
              className="rounded-md p-1 text-foreground/70 hover:bg-white/10 hover:text-foreground"
              title="Minimize"
            >
              <Minimize2 className="h-4 w-4" />
            </button>
            <button
              onClick={handleClose}
              className="rounded-md p-1 text-foreground/70 hover:bg-destructive/80 hover:text-destructive-foreground"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* No workspace selected */}
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="text-center text-foreground/70">
            <p className="text-sm">No workspace selected</p>
            <p className="mt-2 text-xs">Open a workspace and use the hotkey</p>
            <p className="mt-1 text-xs">
              <kbd className="rounded bg-white/10 px-2 py-1 text-xs backdrop-blur-sm">⌘⇧Space</kbd>{' '}
              to toggle
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden rounded-xl border border-white/10 shadow-2xl backdrop-blur-2xl">
      {/* Title Bar */}
      <div
        className="flex items-center justify-between border-b border-white/10 px-4 py-2 backdrop-blur-xl"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-2">
          <Grip className="h-4 w-4 text-foreground/70" />
          <span className="text-sm font-medium text-foreground">{workspace.name}</span>
        </div>
        <div
          className="flex items-center gap-1"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            onClick={handleMinimize}
            className="rounded-md p-1 text-foreground/70 hover:bg-white/10 hover:text-foreground"
            title="Minimize"
          >
            <Minimize2 className="h-4 w-4" />
          </button>
          <button
            onClick={handleClose}
            className="rounded-md p-1 text-foreground/70 hover:bg-destructive/80 hover:text-destructive-foreground"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Chat Interface */}
      <div className="min-h-0 flex-1">
        <ErrorBoundary>
          <ChatInterface
            workspace={workspace}
            projectName={workspace.name}
            className="h-full"
            compact={true}
          />
        </ErrorBoundary>
      </div>
    </div>
  );
};

export const FloatingChat: React.FC = () => {
  return (
    <ThemeProvider>
      <TerminalRegistryProvider>
        <FloatingChatContent />
      </TerminalRegistryProvider>
    </ThemeProvider>
  );
};

export default FloatingChat;
