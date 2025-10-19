import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface TerminalState {
  workspaceId: string;
  tabs: Array<{ id: string; label: string }>;
  activeTabId: string;
  isCollapsed: boolean;
}

interface TerminalRegistryContextType {
  getTerminalState: (workspaceId: string) => TerminalState;
  updateTerminalState: (workspaceId: string, state: Partial<TerminalState>) => void;
  getAllWorkspaceIds: () => string[];
}

const TerminalRegistryContext = createContext<TerminalRegistryContextType | null>(null);

export const useTerminalRegistry = () => {
  const context = useContext(TerminalRegistryContext);
  if (!context) {
    throw new Error('useTerminalRegistry must be used within TerminalRegistryProvider');
  }
  return context;
};

interface Props {
  children: ReactNode;
}

export const TerminalRegistryProvider: React.FC<Props> = ({ children }) => {
  // Store terminal states by workspace ID
  const [terminalStates, setTerminalStates] = useState<Map<string, TerminalState>>(new Map());

  const getTerminalState = useCallback(
    (workspaceId: string): TerminalState => {
      const existing = terminalStates.get(workspaceId);
      if (existing) {
        return existing;
      }

      // Create default state for new workspace
      const defaultState: TerminalState = {
        workspaceId,
        tabs: [{ id: '1', label: 'Terminal 1' }],
        activeTabId: '1',
        isCollapsed: false,
      };

      // Store it
      setTerminalStates((prev) => {
        const next = new Map(prev);
        next.set(workspaceId, defaultState);
        return next;
      });

      return defaultState;
    },
    [terminalStates]
  );

  const updateTerminalState = useCallback(
    (workspaceId: string, updates: Partial<TerminalState>) => {
      setTerminalStates((prev) => {
        const next = new Map(prev);
        const current = prev.get(workspaceId);

        if (!current) {
          // If no state exists, create it with updates
          const newState: TerminalState = {
            workspaceId,
            tabs: updates.tabs || [{ id: '1', label: 'Terminal 1' }],
            activeTabId: updates.activeTabId || '1',
            isCollapsed: updates.isCollapsed || false,
          };
          next.set(workspaceId, newState);
        } else {
          // Update existing state
          next.set(workspaceId, { ...current, ...updates });
        }

        return next;
      });
    },
    []
  );

  const getAllWorkspaceIds = useCallback(() => {
    return Array.from(terminalStates.keys());
  }, [terminalStates]);

  return (
    <TerminalRegistryContext.Provider
      value={{
        getTerminalState,
        updateTerminalState,
        getAllWorkspaceIds,
      }}
    >
      {children}
    </TerminalRegistryContext.Provider>
  );
};
