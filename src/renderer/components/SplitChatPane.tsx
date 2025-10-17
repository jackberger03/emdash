import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from './ui/resizable';
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
}> = ({ workspace, paneId, projectName, provider, className }) => {
  return (
    <ChatInterface
      workspace={workspace}
      projectName={projectName}
      className={className}
      initialProvider={provider}
      paneId={paneId}
    />
  );
};

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

  const generatePaneId = useCallback(() => {
    const id = `${workspace.id}-chat-${nextIdRef.current}`;
    nextIdRef.current += 1;
    return id;
  }, [workspace.id]);

  const splitPane = useCallback(
    (direction: SplitDirection) => {
      const newPaneId = generatePaneId();

      const splitNode = (node: PaneNode, targetId: string): PaneNode => {
        if (node.type === 'chat') {
          if (node.id === targetId) {
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
          // It's a split node, recurse into children
          return {
            ...node,
            children: node.children.map((child) => splitNode(child, targetId)),
          };
        }
      };

      setLayout((prev) => splitNode(prev, focusedPaneId));
      setFocusedPaneId(newPaneId);
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
  }, [focusedPaneId, generatePaneId, initialProvider]);

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
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [splitPane, closePane]);

  const renderNode = (node: PaneNode): React.ReactElement => {
    if (node.type === 'chat') {
      return (
        <div
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
      return (
        <ResizablePanelGroup direction={node.direction} className="h-full">
          {node.children.map((child, index) => (
            <React.Fragment key={index}>
              <ResizablePanel defaultSize={100 / node.children.length} minSize={10}>
                {renderNode(child)}
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
