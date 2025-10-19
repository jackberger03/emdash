import React, { useCallback, useMemo } from 'react';
import { TerminalPane } from './TerminalPane';
import { Bot, Terminal, Plus, X, ChevronDown, ChevronRight } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useTerminalRegistry } from '../contexts/TerminalRegistry';

interface Workspace {
  id: string;
  name: string;
  branch: string;
  path: string;
  status: 'active' | 'idle' | 'running';
}

interface Props {
  workspace: Workspace | null;
  className?: string;
}

interface TerminalTab {
  id: string;
  label: string;
}

const WorkspaceTerminalPanelComponent: React.FC<Props> = ({ workspace, className }) => {
  const { effectiveTheme } = useTheme();
  const { getTerminalState, updateTerminalState } = useTerminalRegistry();

  // Get state from registry instead of local state
  const terminalState = useMemo(() => {
    if (!workspace) return null;
    return getTerminalState(workspace.id);
  }, [workspace?.id, getTerminalState]);

  const tabs = terminalState?.tabs || [{ id: '1', label: 'Terminal 1' }];
  const activeTabId = terminalState?.activeTabId || '1';
  const isCollapsed = terminalState?.isCollapsed || false;

  const handleAddTab = useCallback(() => {
    if (!workspace) return;
    const newId = Date.now().toString();
    const newTab: TerminalTab = {
      id: newId,
      label: `Terminal ${tabs.length + 1}`,
    };
    updateTerminalState(workspace.id, {
      tabs: [...tabs, newTab],
      activeTabId: newId,
    });
  }, [workspace, tabs, updateTerminalState]);

  const handleCloseTab = useCallback(
    (tabId: string) => {
      if (!workspace || tabs.length === 1) return; // Don't close the last tab

      const tabIndex = tabs.findIndex((t) => t.id === tabId);
      const newTabs = tabs.filter((t) => t.id !== tabId);

      // If closing active tab, switch to adjacent tab
      const newActiveTabId =
        activeTabId === tabId ? newTabs[Math.min(tabIndex, newTabs.length - 1)].id : activeTabId;

      updateTerminalState(workspace.id, {
        tabs: newTabs,
        activeTabId: newActiveTabId,
      });

      // Kill the PTY session for the closed tab
      try {
        window.electronAPI?.ptyKill(`workspace-${workspace.id}-tab-${tabId}`);
      } catch (e) {
        console.error('Error killing PTY for closed tab:', e);
      }
    },
    [workspace, tabs, activeTabId, updateTerminalState]
  );

  const setActiveTab = useCallback(
    (tabId: string) => {
      if (!workspace) return;
      updateTerminalState(workspace.id, { activeTabId: tabId });
    },
    [workspace, updateTerminalState]
  );

  const toggleCollapse = useCallback(() => {
    if (!workspace) return;
    updateTerminalState(workspace.id, { isCollapsed: !isCollapsed });
  }, [workspace, isCollapsed, updateTerminalState]);

  if (!workspace) {
    return (
      <div
        className={`flex h-full flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 ${className}`}
      >
        <Bot className="mb-2 h-8 w-8 text-gray-400" />
        <h3 className="mb-1 text-sm text-gray-600 dark:text-gray-400">No Workspace Selected</h3>
        <p className="text-center text-xs text-gray-500 dark:text-gray-500">
          Select a workspace to view its terminal
        </p>
      </div>
    );
  }

  return (
    <div className={`flex h-full flex-col bg-white dark:bg-gray-800 ${className || ''}`}>
      {/* Header with collapse button, terminal icon, and tabs */}
      <div className="flex items-center border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
        <button
          type="button"
          onClick={toggleCollapse}
          className="flex items-center justify-center rounded p-2 hover:bg-gray-200 dark:hover:bg-gray-700"
          aria-label={isCollapsed ? 'Expand terminal' : 'Collapse terminal'}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          )}
        </button>
        <Terminal className="mx-2 h-4 w-4 flex-shrink-0 text-gray-600 dark:text-gray-400" />

        {/* Tabs inline in header */}
        <div className="flex flex-1 items-center overflow-x-auto">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`group flex items-center gap-1 border-r border-gray-200 px-3 py-2 text-xs dark:border-gray-700 ${
                activeTabId === tab.id
                  ? 'bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100'
                  : 'cursor-pointer text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="select-none">{tab.label}</span>
              {tabs.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCloseTab(tab.id);
                  }}
                  className="rounded p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600"
                  aria-label={`Close ${tab.label}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add tab button */}
        <button
          type="button"
          onClick={handleAddTab}
          className="flex items-center gap-1 border-l border-gray-200 px-3 py-2 text-xs text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
          aria-label="New terminal tab"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>

      {/* Terminal content - always mounted but hidden when collapsed to preserve state */}
      <div
        className={`bw-terminal flex-1 overflow-hidden ${effectiveTheme === 'light' ? 'bg-white' : 'bg-gray-800'} ${
          isCollapsed ? 'hidden' : 'block'
        }`}
      >
        {/* Terminal panes - all tabs stay mounted, only show active one */}
        {(() => {
          let isCharm = false;
          try {
            const p =
              localStorage.getItem(`provider:last:${workspace.id}`) ||
              localStorage.getItem(`provider:locked:${workspace.id}`) ||
              localStorage.getItem(`workspaceProvider:${workspace.id}`);
            isCharm = p === 'charm';
          } catch {}
          return (
            <>
              {tabs.map((tab) => (
                <div
                  key={tab.id}
                  className="h-full w-full"
                  style={{ display: activeTabId === tab.id ? 'block' : 'none' }}
                >
                  <TerminalPane
                    id={`workspace-${workspace.id}-tab-${tab.id}`}
                    cwd={workspace.path}
                    variant={effectiveTheme === 'light' ? 'light' : 'dark'}
                    keepAlive={true}
                    themeOverride={
                        effectiveTheme === 'lightsout'
                          ? {
                              background: '#000000',
                              foreground: '#f2f2f2',
                              cursor: '#f2f2f2',
                              selectionBackground: '#f2f2f233',
                              // Lights out - pure black with white text
                              black: '#000000',
                              red: '#f2f2f2',
                              green: '#f2f2f2',
                              yellow: '#f2f2f2',
                              blue: '#f2f2f2',
                              magenta: '#f2f2f2',
                              cyan: '#f2f2f2',
                              white: '#f2f2f2',
                              brightBlack: '#f2f2f2',
                              brightRed: '#f2f2f2',
                              brightGreen: '#f2f2f2',
                              brightYellow: '#f2f2f2',
                              brightBlue: '#f2f2f2',
                              brightMagenta: '#f2f2f2',
                              brightCyan: '#f2f2f2',
                              brightWhite: '#f2f2f2',
                            }
                          : effectiveTheme === 'dark'
                          ? {
                              background: '#1f2937',
                              foreground: '#ffffff',
                              cursor: '#ffffff',
                              selectionBackground: '#ffffff33',
                              // Keep ANSI backgrounds matching the dark theme background
                              black: '#1f2937',
                              red: '#ffffff',
                              green: '#ffffff',
                              yellow: '#ffffff',
                              blue: '#ffffff',
                              magenta: '#ffffff',
                              cyan: '#ffffff',
                              white: '#ffffff',
                              brightBlack: '#ffffff',
                              brightRed: '#ffffff',
                              brightGreen: '#ffffff',
                              brightYellow: '#ffffff',
                              brightBlue: '#ffffff',
                              brightMagenta: '#ffffff',
                              brightCyan: '#ffffff',
                              brightWhite: '#ffffff',
                            }
                          : {
                              background: '#ffffff',
                              foreground: '#000000',
                              cursor: '#000000',
                              selectionBackground: '#00000033',
                              // Keep ANSI backgrounds white; force all other colors to black
                              black: '#ffffff',
                              red: '#000000',
                              green: '#000000',
                              yellow: '#000000',
                              blue: '#000000',
                              magenta: '#000000',
                              cyan: '#000000',
                              white: '#000000',
                              brightBlack: '#000000',
                              brightRed: '#000000',
                              brightGreen: '#000000',
                              brightYellow: '#000000',
                              brightBlue: '#000000',
                              brightMagenta: '#000000',
                              brightCyan: '#000000',
                              brightWhite: '#000000',
                            }
                      }
                      className="h-full w-full"
                    />
                  </div>
                ))}
              </>
            );
          })()}
      </div>
    </div>
  );
};
export const WorkspaceTerminalPanel = React.memo(WorkspaceTerminalPanelComponent);

export default WorkspaceTerminalPanel;
