import React from 'react';
import { cn } from '@/lib/utils';
import FileChangesPanel from './FileChangesPanel';
import WorkspaceTerminalPanel from './WorkspaceTerminalPanel';
import { useRightSidebar } from './ui/right-sidebar';
import { type WorkspaceMetadata } from '../types/chat';

export interface RightSidebarWorkspace {
  id: string;
  name: string;
  branch: string;
  path: string;
  status: 'active' | 'idle' | 'running';
  agentId?: string;
  metadata?: WorkspaceMetadata | null;
}

interface RightSidebarProps extends React.HTMLAttributes<HTMLElement> {
  workspace: RightSidebarWorkspace | null;
}

const RightSidebar: React.FC<RightSidebarProps> = ({ workspace, className, ...rest }) => {
  const { collapsed } = useRightSidebar();

  return (
    <aside
      data-state={collapsed ? 'collapsed' : 'open'}
      className={cn(
        'group/right-sidebar relative z-[60] flex h-full w-full min-w-0 flex-shrink-0 flex-col overflow-hidden border-l border-border bg-muted/10 transition-all duration-200 ease-linear',
        'data-[state=collapsed]:pointer-events-none data-[state=collapsed]:border-l-0',
        className
      )}
      aria-hidden={collapsed}
      {...rest}
    >
      <div className="flex h-full w-full min-w-0 flex-col">
        {workspace ? (
          <div className="flex h-full flex-col">
            <FileChangesPanel
              workspaceId={workspace.path}
              workspaceMetadata={workspace.metadata}
              className="min-h-0 flex-1 border-b border-border"
            />
            <WorkspaceTerminalPanel workspace={workspace} className="min-h-0 flex-1" />
          </div>
        ) : (
          <div className="flex h-full flex-col text-sm text-muted-foreground">
            <div className="flex flex-1 flex-col border-b border-border bg-background">
              <div className="border-b border-border bg-gray-50 px-3 py-2 text-sm font-medium text-foreground dark:bg-gray-900">
                <span className="whitespace-nowrap">Changes</span>
              </div>
              <div className="flex flex-1 items-center justify-center px-4 text-center">
                <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                  Select a workspace to review file changes.
                </span>
              </div>
            </div>
            <div className="flex flex-1 flex-col border-t border-border bg-background">
              <div className="border-b border-border bg-gray-50 px-3 py-2 text-sm font-medium text-foreground dark:bg-gray-900">
                <span className="whitespace-nowrap">Terminal</span>
              </div>
              <div className="flex flex-1 items-center justify-center px-4 text-center">
                <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                  Select a workspace to open its terminal.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default RightSidebar;
