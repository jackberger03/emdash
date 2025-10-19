import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Command } from 'cmdk';
import {
  Search,
  FolderOpen,
  Home,
  Settings,
  PanelLeft,
  PanelRight,
  GitBranch,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
  Command as CommandIcon,
  Option,
} from 'lucide-react';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  projects?: Array<{
    id: string;
    name: string;
    path: string;
    workspaces?: Array<{
      id: string;
      name: string;
      branch: string;
    }>;
  }>;
  onSelectProject?: (projectId: string) => void;
  onSelectWorkspace?: (projectId: string, workspaceId: string) => void;
  onOpenSettings?: () => void;
  onToggleLeftSidebar?: () => void;
  onToggleRightSidebar?: () => void;
  onGoHome?: () => void;
  onOpenProject?: () => void;
}

type CommandItem = {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  group: string;
  keywords?: string[];
  shortcut?: {
    key: string;
    modifier?: 'cmd' | 'option';
  };
  onSelect: () => void;
};

const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  projects = [],
  onSelectProject,
  onSelectWorkspace,
  onOpenSettings,
  onToggleLeftSidebar,
  onToggleRightSidebar,
  onGoHome,
  onOpenProject,
}) => {
  const [search, setSearch] = useState('');
  const shouldReduceMotion = useReducedMotion();

  // Define keyboard shortcuts for the command palette
  const shortcuts = useMemo(
    () => [
      {
        key: 'Escape',
        handler: () => onClose(),
        description: 'Close command palette',
      },
      {
        key: ',',
        modifier: 'cmd' as const,
        handler: () => {
          onClose();
          if (onOpenSettings) {
            setTimeout(() => onOpenSettings(), 100);
          }
        },
        stopPropagation: true,
        description: 'Open settings',
      },
      {
        key: 'b',
        modifier: 'cmd' as const,
        handler: () => {
          onClose();
          if (onToggleLeftSidebar) {
            setTimeout(() => onToggleLeftSidebar(), 100);
          }
        },
        stopPropagation: true,
        description: 'Toggle left sidebar',
      },
      {
        key: '.',
        modifier: 'cmd' as const,
        handler: () => {
          onClose();
          if (onToggleRightSidebar) {
            setTimeout(() => onToggleRightSidebar(), 100);
          }
        },
        stopPropagation: true,
        description: 'Toggle right sidebar',
      },
    ],
    [onClose, onOpenSettings, onToggleLeftSidebar, onToggleRightSidebar]
  );

  // Use keyboard shortcuts hook
  useKeyboardShortcuts({ enabled: isOpen, shortcuts });

  // Reset search when closed
  useEffect(() => {
    if (!isOpen) {
      setSearch('');
    }
  }, [isOpen]);

  const runCommand = useCallback(
    (command: () => void) => {
      onClose();
      // Small delay to ensure modal closes before action
      setTimeout(() => command(), 50);
    },
    [onClose]
  );

  // Build command items
  const commands = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [];

    // Navigation commands
    if (onGoHome) {
      items.push({
        id: 'nav-home',
        label: 'Go Home',
        description: 'Return to home screen',
        icon: <Home className="h-4 w-4" />,
        group: 'Navigation',
        keywords: ['home', 'start', 'main'],
        onSelect: () => runCommand(onGoHome),
      });
    }

    if (onOpenProject) {
      items.push({
        id: 'nav-open-project',
        label: 'Open Project',
        description: 'Open a new project folder',
        icon: <FolderOpen className="h-4 w-4" />,
        group: 'Navigation',
        keywords: ['open', 'folder', 'project', 'new'],
        onSelect: () => runCommand(onOpenProject),
      });
    }

    // Settings command
    if (onOpenSettings) {
      items.push({
        id: 'nav-settings',
        label: 'Open Settings',
        description: 'Configure application settings',
        icon: <Settings className="h-4 w-4" />,
        group: 'Navigation',
        keywords: ['settings', 'preferences', 'config'],
        shortcut: { key: ',', modifier: 'cmd' },
        onSelect: () => runCommand(onOpenSettings),
      });
    }

    // Toggle commands
    if (onToggleLeftSidebar) {
      items.push({
        id: 'toggle-left',
        label: 'Toggle Left Sidebar',
        description: 'Show/hide project list',
        icon: <PanelLeft className="h-4 w-4" />,
        group: 'Toggles',
        keywords: ['sidebar', 'panel', 'left', 'toggle'],
        shortcut: { key: 'B', modifier: 'cmd' },
        onSelect: () => runCommand(onToggleLeftSidebar),
      });
    }

    if (onToggleRightSidebar) {
      items.push({
        id: 'toggle-right',
        label: 'Toggle Right Sidebar',
        description: 'Show/hide details panel',
        icon: <PanelRight className="h-4 w-4" />,
        group: 'Toggles',
        keywords: ['sidebar', 'panel', 'right', 'toggle'],
        shortcut: { key: '.', modifier: 'cmd' },
        onSelect: () => runCommand(onToggleRightSidebar),
      });
    }

    // Project commands
    projects.forEach((project) => {
      if (onSelectProject) {
        items.push({
          id: `project-${project.id}`,
          label: project.name,
          description: project.path,
          icon: <FolderOpen className="h-4 w-4" />,
          group: 'Projects',
          keywords: ['project', project.name.toLowerCase(), project.path.toLowerCase()],
          onSelect: () => runCommand(() => onSelectProject(project.id)),
        });
      }

      // Workspace commands
      if (project.workspaces && onSelectWorkspace) {
        project.workspaces.forEach((workspace) => {
          items.push({
            id: `workspace-${project.id}-${workspace.id}`,
            label: workspace.name,
            description: `${project.name} • ${workspace.branch}`,
            icon: <GitBranch className="h-4 w-4" />,
            group: 'Workspaces',
            keywords: [
              'workspace',
              workspace.name.toLowerCase(),
              workspace.branch.toLowerCase(),
              project.name.toLowerCase(),
            ],
            onSelect: () => runCommand(() => onSelectWorkspace(project.id, workspace.id)),
          });
        });
      }
    });

    return items;
  }, [
    projects,
    onGoHome,
    onOpenProject,
    onOpenSettings,
    onSelectProject,
    onSelectWorkspace,
    onToggleLeftSidebar,
    onToggleRightSidebar,
    runCommand,
  ]);

  // Group commands
  const groupedCommands = useMemo(() => {
    const groups = new Map<string, CommandItem[]>();
    commands.forEach((cmd) => {
      const group = groups.get(cmd.group) || [];
      group.push(cmd);
      groups.set(cmd.group, group);
    });
    return groups;
  }, [commands]);

  const groupOrder = ['Navigation', 'Toggles', 'Projects', 'Workspaces'];

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
          className="fixed inset-0 z-[130] flex items-start justify-center bg-black/60 pt-[15vh] backdrop-blur-sm"
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.12, ease: 'easeOut' }}
          onClick={onClose}
        >
          <motion.div
            onClick={(event) => event.stopPropagation()}
            initial={shouldReduceMotion ? false : { opacity: 0, y: -8, scale: 0.995 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              shouldReduceMotion
                ? { opacity: 1, y: 0, scale: 1 }
                : { opacity: 0, y: -6, scale: 0.995 }
            }
            transition={
              shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }
            }
            className="mx-4 w-full max-w-2xl overflow-hidden rounded-2xl border border-border/50 bg-background shadow-2xl"
          >
            <Command
              shouldFilter={false}
              className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]]:px-2 [&_[cmdk-group]]:pb-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-3 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-4 [&_[cmdk-item]_svg]:w-4"
            >
              <div className="flex items-center border-b border-border/60 px-4">
                <Search className="mr-3 h-4 w-4 shrink-0 text-muted-foreground" />
                <Command.Input
                  value={search}
                  onValueChange={setSearch}
                  placeholder="Search commands, projects, workspaces..."
                  className="flex h-12 w-full rounded-md bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  autoFocus
                />
              </div>

              <Command.List className="max-h-[400px] overflow-y-auto overflow-x-hidden p-2">
                <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
                  No results found.
                </Command.Empty>

                {groupOrder.map((groupName) => {
                  const groupItems = groupedCommands.get(groupName);
                  if (!groupItems || groupItems.length === 0) return null;

                  return (
                    <Command.Group key={groupName} heading={groupName}>
                      {groupItems.map((item) => (
                        <Command.Item
                          key={item.id}
                          value={`${item.label} ${item.description || ''} ${item.keywords?.join(' ') || ''}`}
                          onSelect={() => item.onSelect()}
                          className="relative flex cursor-pointer select-none items-center gap-3 rounded-lg px-3 py-3 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                            {item.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{item.label}</div>
                            {item.description && (
                              <div className="truncate text-xs text-muted-foreground">
                                {item.description}
                              </div>
                            )}
                          </div>
                          {item.shortcut && (
                            <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                              {item.shortcut.modifier === 'cmd' && (
                                <CommandIcon className="h-3 w-3" />
                              )}
                              {item.shortcut.modifier === 'option' && (
                                <Option className="h-3 w-3" />
                              )}
                              <span className="font-medium">{item.shortcut.key}</span>
                            </div>
                          )}
                        </Command.Item>
                      ))}
                    </Command.Group>
                  );
                })}
              </Command.List>

              <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-4 py-3">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Select</span>
                    <div className="flex items-center gap-1 rounded border border-border/60 bg-background px-1.5 py-0.5">
                      <CornerDownLeft className="h-3 w-3" />
                    </div>
                  </div>
                  <div className="h-4 w-px bg-border/60" />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Close</span>
                    <div className="flex items-center gap-1 rounded border border-border/60 bg-background px-1.5 py-0.5">
                      <span className="text-xs">ESC</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Navigate</span>
                  <div className="flex items-center gap-1 rounded border border-border/60 bg-background px-1.5 py-0.5">
                    <ArrowUp className="h-3 w-3" />
                    <ArrowDown className="h-3 w-3" />
                  </div>
                </div>
              </div>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default CommandPalette;
