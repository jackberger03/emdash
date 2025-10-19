import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from './ui/resizable';
import { ImperativePanelGroupHandle } from 'react-resizable-panels';
import ChatInterface from './ChatInterface';
import { type Provider } from '../types';

type SplitDirection = 'horizontal' | 'vertical';

interface ChatPaneNode {
  type: 'chat';
  id: string;
  provider?: Provider;
}

interface SplitNode {
  type: 'split';
  direction: SplitDirection;
  children: PaneNode[];
}

type PaneNode = ChatPaneNode | SplitNode;

interface Workspace {
  id: string;
  name: string;
  branch: string;
  path: string;
  status: 'active' | 'idle' | 'running';
  agentId?: string;
  metadata?: any;
}

interface SplitChatPaneProps {
  workspace: Workspace;
  projectName: string;
  className?: string;
  initialProvider?: Provider;
}

// Wrapper component that passes paneId for state isolation
const PaneWrapper: React.FC<{
  workspace: Workspace;
  paneId: string;
  projectName: string;
  provider?: Provider;
  className?: string;
}> = React.memo(
  ({ workspace, paneId, projectName, provider, className }) => {
    return (
      <ChatInterface
        workspace={workspace}
        projectName={projectName}
        className={className}
        initialProvider={provider}
        paneId={paneId}
      />
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison to prevent unnecessary re-renders
    return (
      prevProps.paneId === nextProps.paneId &&
      prevProps.workspace.id === nextProps.workspace.id &&
      prevProps.projectName === nextProps.projectName &&
      prevProps.provider === nextProps.provider &&
      prevProps.className === nextProps.className
    );
  }
);

export const SplitChatPane: React.FC<SplitChatPaneProps> = ({
  workspace,
  projectName,
  className,
  initialProvider,
}) => {
  const [layout, setLayout] = useState<PaneNode>({
    type: 'chat',
    id: `${workspace.id}-chat-0`,
    provider: initialProvider,
  });
  const [focusedPaneId, setFocusedPaneId] = useState<string>(`${workspace.id}-chat-0`);
  const nextIdRef = useRef(1);
  const panelGroupRefs = useRef<Map<string, ImperativePanelGroupHandle>>(new Map());
  const [layoutVersion, setLayoutVersion] = useState(0);

  const generatePaneId = useCallback(() => {
    const id = `${workspace.id}-chat-${nextIdRef.current}`;
    nextIdRef.current += 1;
    return id;
  }, [workspace.id]);

  const splitPane = useCallback(
    (direction: SplitDirection) => {
      const newPaneId = generatePaneId();

      const splitNode = (node: PaneNode, targetId: string, parentSplit?: SplitNode): PaneNode => {
        if (node.type === 'chat') {
          if (node.id === targetId) {
            // Check if parent is a split with the same direction
            if (parentSplit && parentSplit.direction === direction) {
              // We'll handle this at the parent level
              return node;
            }

            // Split this chat pane
            return {
              type: 'split',
              direction,
              children: [
                node,
                {
                  type: 'chat',
                  id: newPaneId,
                  provider: node.provider,
                },
              ],
            };
          }
          return node;
        } else {
          // It's a split node
          // Check if we're splitting a direct child of this split with the same direction
          if (node.direction === direction) {
            const childIndex = node.children.findIndex((child) => {
              if (child.type === 'chat') {
                return child.id === targetId;
              }
              return false;
            });

            if (childIndex !== -1) {
              // Found the target child - insert new pane after it
              const newChildren = [...node.children];
              newChildren.splice(childIndex + 1, 0, {
                type: 'chat',
                id: newPaneId,
                provider: (node.children[childIndex] as ChatPaneNode).provider,
              });
              return {
                ...node,
                children: newChildren,
              };
            }
          }

          // Recurse into children
          return {
            ...node,
            children: node.children.map((child) => splitNode(child, targetId, node)),
          };
        }
      };

      setLayout((prev) => splitNode(prev, focusedPaneId));
      setFocusedPaneId(newPaneId);
      setLayoutVersion((v) => v + 1);
    },
    [focusedPaneId, generatePaneId]
  );

  const closePane = useCallback(() => {
    const removeNode = (node: PaneNode, targetId: string): PaneNode | null => {
      if (node.type === 'chat') {
        // If this is the target, remove it
        return node.id === targetId ? null : node;
      } else {
        // It's a split node, recurse into children
        const newChildren = node.children
          .map((child) => removeNode(child, targetId))
          .filter((child): child is PaneNode => child !== null);

        if (newChildren.length === 0) {
          return null;
        } else if (newChildren.length === 1) {
          // Collapse split if only one child remains
          return newChildren[0];
        } else {
          return {
            ...node,
            children: newChildren,
          };
        }
      }
    };

    setLayout((prev) => {
      const newLayout = removeNode(prev, focusedPaneId);
      if (newLayout === null) {
        // Don't allow removing the last pane, recreate it
        return {
          type: 'chat',
          id: generatePaneId(),
          provider: initialProvider,
        };
      }
      return newLayout;
    });

    // Focus the first available chat pane
    const findFirstChat = (node: PaneNode): string | null => {
      if (node.type === 'chat') {
        return node.id;
      } else {
        for (const child of node.children) {
          const found = findFirstChat(child);
          if (found) return found;
        }
        return null;
      }
    };

    setLayout((prev) => {
      const firstId = findFirstChat(prev);
      if (firstId && firstId !== focusedPaneId) {
        setFocusedPaneId(firstId);
      }
      return prev;
    });

    setLayoutVersion((v) => v + 1);
  }, [focusedPaneId, generatePaneId, initialProvider]);

  const balanceAllPanes = useCallback(() => {
    // Collect all panel group refs and balance them
    const refsToBalance = Array.from(panelGroupRefs.current.values());

    // Balance multiple times to handle nested splits
    const balanceOnce = () => {
      refsToBalance.forEach((groupRef) => {
        try {
          const panelIds = groupRef.getLayout();
          if (panelIds.length > 0) {
            const equalSize = 100 / panelIds.length;
            const layout = new Array(panelIds.length).fill(equalSize);
            groupRef.setLayout(layout);
          }
        } catch (e) {
          console.error('Error balancing panel:', e);
        }
      });
    };

    // Balance repeatedly to handle nested structures
    requestAnimationFrame(() => {
      balanceOnce();
      requestAnimationFrame(() => {
        balanceOnce();
        setTimeout(() => balanceOnce(), 100);
      });
    });
  }, []);

  // Load saved layout on mount
  useEffect(() => {
    const loadSavedLayout = async () => {
      try {
        const result = await (window as any).electronAPI.getWorkspaceLayout(workspace.id);
        if (result.success && result.layout) {
          console.log('[SplitChatPane] Loaded saved layout:', result.layout);
          setLayout(result.layout);

          // Update nextIdRef to be higher than any existing ID
          const findMaxId = (node: PaneNode): number => {
            if (node.type === 'chat') {
              const match = node.id.match(/-chat-(\d+)$/);
              return match ? parseInt(match[1], 10) : 0;
            } else {
              return Math.max(...node.children.map(findMaxId));
            }
          };
          const maxId = findMaxId(result.layout);
          nextIdRef.current = maxId + 1;

          // Find and set first chat pane as focused
          const findFirstChat = (node: PaneNode): string | null => {
            if (node.type === 'chat') return node.id;
            for (const child of node.children) {
              const found = findFirstChat(child);
              if (found) return found;
            }
            return null;
          };
          const firstChatId = findFirstChat(result.layout);
          if (firstChatId) {
            setFocusedPaneId(firstChatId);
          }
        }
      } catch (error) {
        console.error('[SplitChatPane] Failed to load layout:', error);
      }
    };

    loadSavedLayout();
  }, [workspace.id]);

  // Save layout whenever it changes (debounced)
  useEffect(() => {
    const saveTimer = setTimeout(async () => {
      try {
        await (window as any).electronAPI.updateWorkspaceLayout(workspace.id, layout);
        console.log('[SplitChatPane] Saved layout to DB');
      } catch (error) {
        console.error('[SplitChatPane] Failed to save layout:', error);
      }
    }, 1000); // Debounce for 1 second

    return () => clearTimeout(saveTimer);
  }, [layout, workspace.id]);

  // Auto-balance when layout changes
  useEffect(() => {
    if (layoutVersion > 0) {
      // Multiple balance attempts with different timings to handle nested splits
      const timer1 = setTimeout(() => balanceAllPanes(), 10);
      const timer2 = setTimeout(() => balanceAllPanes(), 50);
      const timer3 = setTimeout(() => balanceAllPanes(), 150);
      const timer4 = setTimeout(() => balanceAllPanes(), 300);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
        clearTimeout(timer4);
      };
    }
  }, [layoutVersion, balanceAllPanes]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === 'd' && e.shiftKey) {
          // Cmd+Shift+D: Split vertical
          e.preventDefault();
          splitPane('vertical');
        } else if (e.key === 'd') {
          // Cmd+D: Split horizontal
          e.preventDefault();
          splitPane('horizontal');
        } else if (e.key === 'w') {
          // Cmd+W: Close pane
          e.preventDefault();
          closePane();
        } else if (e.key === '=' || e.key === '+') {
          // Cmd+= or Cmd++: Balance all panes
          e.preventDefault();
          balanceAllPanes();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [splitPane, closePane, balanceAllPanes]);

  const renderNode = (node: PaneNode, parentKey: string = 'root'): React.ReactElement => {
    if (node.type === 'chat') {
      return (
        <div
          key={node.id}
          className={`relative h-full ${focusedPaneId === node.id ? 'ring-2 ring-inset ring-blue-500' : 'ring-1 ring-inset ring-gray-200'}`}
          onClick={() => setFocusedPaneId(node.id)}
        >
          <PaneWrapper
            workspace={workspace}
            paneId={node.id}
            projectName={projectName}
            provider={node.provider}
            className="h-full"
          />
        </div>
      );
    } else {
      // It's a split node
      const groupId = `${parentKey}-split-${node.direction}`;
      const childCount = node.children.length;
      const equalSize = 100 / childCount;

      return (
        <ResizablePanelGroup
          direction={node.direction}
          className="h-full"
          ref={(ref) => {
            if (ref) {
              panelGroupRefs.current.set(groupId, ref);
              // Aggressively balance this group multiple times
              [10, 50, 100, 150, 250].forEach((delay) => {
                setTimeout(() => {
                  try {
                    const currentLayout = ref.getLayout();
                    if (currentLayout.length > 0) {
                      const equalSize = 100 / currentLayout.length;
                      const balancedLayout = new Array(currentLayout.length).fill(equalSize);
                      ref.setLayout(balancedLayout);
                    }
                  } catch (e) {
                    // Ref might be unmounted
                  }
                }, delay);
              });
            } else {
              panelGroupRefs.current.delete(groupId);
            }
          }}
        >
          {node.children.map((child, index) => (
            <React.Fragment key={`${groupId}-panel-${index}`}>
              <ResizablePanel defaultSize={equalSize} minSize={10}>
                {renderNode(child, `${groupId}-child${index}`)}
              </ResizablePanel>
              {index < node.children.length - 1 && (
                <ResizableHandle withHandle className="bg-border hover:bg-blue-500" />
              )}
            </React.Fragment>
          ))}
        </ResizablePanelGroup>
      );
    }
  };

  return (
    <div className={className} style={{ width: '100%', height: '100%' }}>
      {renderNode(layout)}
    </div>
  );
};

export default SplitChatPane;
