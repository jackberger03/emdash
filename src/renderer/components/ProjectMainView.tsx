import React, { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { GitBranch, Plus, Loader2, RefreshCw, Trash, ChevronDown, Server } from 'lucide-react';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList } from './ui/breadcrumb';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { usePrStatus } from '../hooks/usePrStatus';
import { usePullRequests, type PullRequestSummary } from '../hooks/usePullRequests';
import { useWorkspaceChanges } from '../hooks/useWorkspaceChanges';
import { ChangesBadge } from './WorkspaceChanges';
import { Spinner } from './ui/spinner';
import WorkspaceDeleteButton from './WorkspaceDeleteButton';
import AgentSelectionDialog from './AgentSelectionDialog';
import GitHubDetailModal from './GitHubDetailModal';
import SSHConfigModal from './SSHConfigModal';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import type { Provider } from '../types';
import { type Workspace, type WorkspaceMetadata } from '../types/chat';
import ProjectDeleteButton from './ProjectDeleteButton';

interface Project {
  id: string;
  name: string;
  path: string;
  gitInfo: {
    isGitRepo: boolean;
    remote?: string;
    branch?: string;
  };
  githubInfo?: {
    repository: string;
    connected: boolean;
  };
  sshInfo?: {
    enabled: boolean;
    host: string;
    user: string;
    remotePath: string;
    port?: number;
    keyPath?: string;
  };
  workspaces?: Workspace[];
}

function StatusBadge({ status }: { status: Workspace['status'] }) {
  return (
    <Badge variant="secondary" className="capitalize">
      {status}
    </Badge>
  );
}

function WorkspaceRow({
  ws,
  active,
  onClick,
  onDelete,
}: {
  ws: Workspace;
  active: boolean;
  onClick: () => void;
  onDelete: () => void | Promise<void>;
}) {
  const [isRunning, setIsRunning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  // Don't fetch PR status for workspaces that were created from PRs
  const shouldFetchPrStatus = !ws.metadata?.pullRequest;
  const { pr } = usePrStatus(ws.path, shouldFetchPrStatus);
  const { totalAdditions, totalDeletions, isLoading } = useWorkspaceChanges(ws.path, ws.id);

  useEffect(() => {
    (async () => {
      try {
        const status = await (window as any).electronAPI.codexGetAgentStatus(ws.id);
        if (status?.success && status.agent) {
          setIsRunning(status.agent.status === 'running');
        }
      } catch {}
    })();

    const offOut = (window as any).electronAPI.onCodexStreamOutput((data: any) => {
      if (data.workspaceId === ws.id) setIsRunning(true);
    });
    const offComplete = (window as any).electronAPI.onCodexStreamComplete((data: any) => {
      if (data.workspaceId === ws.id) setIsRunning(false);
    });
    const offErr = (window as any).electronAPI.onCodexStreamError((data: any) => {
      if (data.workspaceId === ws.id) setIsRunning(false);
    });
    return () => {
      offOut?.();
      offComplete?.();
      offErr?.();
    };
  }, [ws.id]);

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      className={[
        'group flex items-start justify-between gap-3 rounded-2xl',
        'bg-white/40 backdrop-blur-xl dark:bg-white/5',
        'border border-white/20 dark:border-white/10',
        'px-5 py-4 transition-all duration-300',
        'hover:bg-white/60 hover:shadow-lg hover:shadow-black/5 dark:hover:bg-white/10 dark:hover:shadow-black/20',
        'hover:-translate-y-0.5 hover:scale-[1.01]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        active ? 'shadow-lg shadow-primary/10 ring-2 ring-primary/50' : '',
      ].join(' ')}
    >
      <div className="min-w-0">
        <div className="text-base font-medium leading-tight tracking-tight">{ws.name}</div>
        <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          {isRunning || ws.status === 'running' ? <Spinner size="sm" className="size-3" /> : null}
          <GitBranch className="size-3" />
          <span className="max-w-[24rem] truncate font-mono" title={`origin/${ws.branch}`}>
            origin/{ws.branch}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {!isLoading && (totalAdditions > 0 || totalDeletions > 0) ? (
          <ChangesBadge additions={totalAdditions} deletions={totalDeletions} />
        ) : pr && !ws.metadata?.pullRequest ? (
          <span
            className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
            title={`${pr.title || 'Pull Request'} (#${pr.number})`}
          >
            {pr.isDraft ? 'draft' : pr.state.toLowerCase()}
          </span>
        ) : null}
        {ws.agentId && <Badge variant="outline">agent</Badge>}

        <WorkspaceDeleteButton
          workspaceName={ws.name}
          onConfirm={async () => {
            try {
              setIsDeleting(true);
              await onDelete();
            } finally {
              // If deletion succeeds, this row will unmount; if it fails, revert spinner
              setIsDeleting(false);
            }
          }}
          isDeleting={isDeleting}
          aria-label={`Delete workspace ${ws.name}`}
          className="inline-flex items-center justify-center rounded p-2 text-muted-foreground hover:bg-transparent hover:text-destructive focus-visible:ring-0"
        />
      </div>
    </div>
  );
}

interface ProjectMainViewProps {
  project: Project;
  onCreateWorkspace: () => void;
  activeWorkspace: Workspace | null;
  onSelectWorkspace: (workspace: Workspace) => void;
  onDeleteWorkspace: (project: Project, workspace: Workspace) => void | Promise<void>;
  onDeleteProject: (project: Project) => void | Promise<void>;
  isCreatingWorkspace?: boolean;
  onCheckoutPullRequest: (
    pr: PullRequestSummary,
    provider: Provider
  ) => Promise<{ success: boolean; error?: string }>;
}

// Calculate contrast color for label text
const getContrastColor = (hexColor: string): string => {
  // Convert hex to RGB
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return black for light backgrounds, white for dark backgrounds
  return luminance > 0.5 ? '#000000' : '#ffffff';
};

const ProjectMainView: React.FC<ProjectMainViewProps> = ({
  project,
  onCreateWorkspace,
  activeWorkspace,
  onSelectWorkspace,
  onDeleteWorkspace,
  onDeleteProject,
  isCreatingWorkspace = false,
  onCheckoutPullRequest,
}) => {
  const [activeTab, setActiveTab] = useState('workspaces');
  const canLoadGitHub = Boolean(project.githubInfo?.connected && project.gitInfo?.isGitRepo);

  // Pull Requests state
  const {
    prs,
    loading: prsLoading,
    error: prsError,
    refresh: refreshPrs,
  } = usePullRequests(
    canLoadGitHub && activeTab === 'pull-requests' ? project.path : undefined,
    canLoadGitHub && activeTab === 'pull-requests'
  );
  const [checkoutPrNumber, setCheckoutPrNumber] = useState<number | null>(null);
  const [selectedPr, setSelectedPr] = useState<PullRequestSummary | null>(null);
  const [showAgentDialog, setShowAgentDialog] = useState(false);

  // Issues state
  const [issues, setIssues] = useState<any[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [issuesError, setIssuesError] = useState<string | null>(null);

  // Detail modal state
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailModalType, setDetailModalType] = useState<'issue' | 'pr'>('issue');
  const [detailModalNumber, setDetailModalNumber] = useState<number>(0);

  // SSH modal state
  const [showSSHModal, setShowSSHModal] = useState(false);

  // Load GitHub issues
  const loadIssues = async () => {
    if (!canLoadGitHub) return;

    setIssuesLoading(true);
    setIssuesError(null);

    try {
      const api = (window as any).electronAPI;
      if (!api?.githubGetIssues) {
        throw new Error('GitHub issues API not available');
      }

      const result = await api.githubGetIssues({ projectPath: project.path, limit: 50 });

      if (!result?.success) {
        throw new Error(result?.error || 'Failed to load GitHub issues');
      }

      setIssues(result.issues ?? []);
    } catch (error) {
      setIssuesError(error instanceof Error ? error.message : 'Failed to load issues');
    } finally {
      setIssuesLoading(false);
    }
  };

  // Load issues when tab becomes active
  useEffect(() => {
    if (activeTab === 'issues' && canLoadGitHub) {
      loadIssues();
    }
  }, [activeTab, canLoadGitHub, project.path]);

  const handleOpenAgentDialog = (pr: PullRequestSummary) => {
    setSelectedPr(pr);
    setShowAgentDialog(true);
  };

  const handleAgentSelected = async (provider: Provider) => {
    if (!selectedPr) return;

    setCheckoutPrNumber(selectedPr.number);
    setShowAgentDialog(false);

    try {
      const result = await onCheckoutPullRequest(selectedPr, provider);
      if (result.success) {
        // Success toast is handled by parent
      }
    } finally {
      setCheckoutPrNumber(null);
      setSelectedPr(null);
    }
  };

  const handleSSHSave = async (config: {
    enabled: boolean;
    host: string;
    user: string;
    remotePath: string;
    port?: number;
    keyPath?: string;
  }) => {
    // Update project with SSH configuration
    const api = (window as any).electronAPI;
    const updatedProject = {
      ...project,
      sshInfo: config,
    };
    await api.saveProject(updatedProject);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto max-w-6xl space-y-8 p-6">
          <div className="mb-8 space-y-2">
            <header className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-semibold tracking-tight">{project.name}</h1>
                  <div className="flex items-center gap-2 rounded-full bg-muted p-1">
                    <button
                      onClick={() => setActiveTab('workspaces')}
                      className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                        activeTab === 'workspaces'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Workspaces
                    </button>
                    <button
                      onClick={() => setActiveTab('issues')}
                      className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                        activeTab === 'issues'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Issues
                    </button>
                    <button
                      onClick={() => setActiveTab('pull-requests')}
                      className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                        activeTab === 'pull-requests'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Pull Requests
                    </button>
                  </div>
                </div>

                <Breadcrumb className="text-muted-foreground">
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink className="text-muted-foreground">
                        {project.path}
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    {project.gitInfo.branch && (
                      <BreadcrumbItem>
                        <Badge variant="secondary" className="gap-1">
                          <GitBranch className="size-3" />
                          origin/{project.gitInfo.branch}
                        </Badge>
                      </BreadcrumbItem>
                    )}
                    <BreadcrumbItem>
                      <button
                        onClick={() => setShowSSHModal(true)}
                        className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium transition-all hover:bg-muted/80"
                      >
                        <Server className="size-3" />
                        {project.sshInfo?.enabled ? (
                          <span className="text-green-600 dark:text-green-400">
                            SSH: {project.sshInfo.user}@{project.sshInfo.host}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Configure SSH</span>
                        )}
                      </button>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
              <ProjectDeleteButton
                projectName={project.name}
                onConfirm={() => onDeleteProject(project)}
                className="inline-flex items-center justify-center rounded p-2 text-muted-foreground hover:text-destructive"
              />
            </header>
            <Separator className="my-2" />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="max-w-4xl">
            <div className="hidden">
              <TabsList>
                <TabsTrigger value="workspaces">Workspaces</TabsTrigger>
                <TabsTrigger value="issues">Issues</TabsTrigger>
                <TabsTrigger value="pull-requests">Pull Requests</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="workspaces" className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-start gap-3">
                  <h2 className="text-lg font-semibold">Workspaces</h2>
                  <button
                    onClick={onCreateWorkspace}
                    disabled={isCreatingWorkspace}
                    aria-busy={isCreatingWorkspace}
                    className="flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary backdrop-blur-sm transition-all hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isCreatingWorkspace ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Creating…
                      </>
                    ) : (
                      <>
                        <Plus className="size-4" />
                        Create workspace
                      </>
                    )}
                  </button>
                </div>
                <div className="flex flex-col gap-3">
                  {(project.workspaces ?? []).map((ws) => (
                    <WorkspaceRow
                      key={ws.id}
                      ws={ws}
                      active={activeWorkspace?.id === ws.id}
                      onClick={() => onSelectWorkspace(ws)}
                      onDelete={() => onDeleteWorkspace(project, ws)}
                    />
                  ))}
                </div>
              </div>

              {(!project.workspaces || project.workspaces.length === 0) && (
                <Alert>
                  <AlertTitle>What's a workspace?</AlertTitle>
                  <AlertDescription className="flex items-center justify-between gap-4">
                    <p className="text-sm text-muted-foreground">
                      Each workspace is an isolated copy and branch of your repo (Git-tracked files
                      only).
                    </p>
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value="issues" className="space-y-6">
              {canLoadGitHub ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-start gap-3">
                    <h2 className="text-lg font-semibold">Issues</h2>
                    <button
                      onClick={() => loadIssues()}
                      disabled={issuesLoading}
                      className="flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary backdrop-blur-sm transition-all hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <RefreshCw className={`size-4 ${issuesLoading ? 'animate-spin' : ''}`} />
                      Refresh
                    </button>
                  </div>

                  <div className="space-y-3">
                    {issuesError && (
                      <Alert variant="destructive">
                        <AlertTitle>Failed to load issues</AlertTitle>
                        <AlertDescription>{issuesError}</AlertDescription>
                      </Alert>
                    )}

                    {issuesLoading && !issues.length && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />
                        Loading issues...
                      </div>
                    )}

                    {!issuesLoading && !issuesError && issues.length === 0 && (
                      <Alert>
                        <AlertTitle>No open issues</AlertTitle>
                        <AlertDescription>
                          There are no open issues for this repository.
                        </AlertDescription>
                      </Alert>
                    )}

                    {issues.length > 0 && (
                      <div className="flex flex-col gap-3">
                        {issues.map((issue) => (
                          <div
                            key={issue.id}
                            className="flex cursor-pointer items-start justify-between gap-3 rounded-2xl border border-white/20 bg-white/40 px-5 py-4 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.01] hover:bg-white/60 hover:shadow-lg hover:shadow-black/5 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 dark:hover:shadow-black/20"
                            onClick={() => {
                              setDetailModalType('issue');
                              setDetailModalNumber(issue.number);
                              setShowDetailModal(true);
                            }}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-base font-medium leading-tight">
                                  #{issue.number}
                                </span>
                                <span className="text-base font-medium leading-tight tracking-tight">
                                  {issue.title}
                                </span>
                                {issue.state === 'closed' && (
                                  <Badge variant="secondary" className="text-xs">
                                    closed
                                  </Badge>
                                )}
                              </div>
                              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                {issue.labels && issue.labels.length > 0 && (
                                  <div className="flex items-center gap-1">
                                    {issue.labels.slice(0, 3).map((label: any, idx: number) => {
                                      const hexColor = label.color ? `#${label.color}` : '#6b7280';
                                      return (
                                        <span
                                          key={idx}
                                          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                                          style={{
                                            backgroundColor: `${hexColor}20`,
                                            color: hexColor,
                                          }}
                                        >
                                          {label.name}
                                        </span>
                                      );
                                    })}
                                    {issue.labels.length > 3 && (
                                      <span className="text-[10px]">
                                        +{issue.labels.length - 3} more
                                      </span>
                                    )}
                                  </div>
                                )}
                                {issue.assignee?.login && (
                                  <>
                                    <span>•</span>
                                    <span>assigned to {issue.assignee.login}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <Alert>
                  <AlertTitle>GitHub not connected</AlertTitle>
                  <AlertDescription>Connect to GitHub to view and manage issues.</AlertDescription>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value="pull-requests" className="space-y-6">
              {canLoadGitHub ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-start gap-3">
                    <h2 className="text-lg font-semibold">Pull Requests</h2>
                    <button
                      onClick={() => refreshPrs()}
                      disabled={prsLoading}
                      className="flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary backdrop-blur-sm transition-all hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <RefreshCw className={`size-4 ${prsLoading ? 'animate-spin' : ''}`} />
                      Refresh
                    </button>
                  </div>

                  <div className="space-y-3">
                    {prsError && (
                      <Alert variant="destructive">
                        <AlertTitle>Failed to load pull requests</AlertTitle>
                        <AlertDescription>{prsError}</AlertDescription>
                      </Alert>
                    )}

                    {prsLoading && !prs.length && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />
                        Loading pull requests...
                      </div>
                    )}

                    {!prsLoading && !prsError && prs.length === 0 && (
                      <Alert>
                        <AlertTitle>No open pull requests</AlertTitle>
                        <AlertDescription>
                          There are no open pull requests for this repository.
                        </AlertDescription>
                      </Alert>
                    )}

                    {prs.length > 0 && (
                      <div className="flex flex-col gap-3">
                        {prs.map((pr) => {
                          const isCheckingOut = checkoutPrNumber === pr.number;
                          return (
                            <div
                              key={pr.number}
                              className="flex cursor-pointer items-start justify-between gap-3 rounded-2xl border border-white/20 bg-white/40 px-5 py-4 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.01] hover:bg-white/60 hover:shadow-lg hover:shadow-black/5 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 dark:hover:shadow-black/20"
                              onClick={() => {
                                setDetailModalType('pr');
                                setDetailModalNumber(pr.number);
                                setShowDetailModal(true);
                              }}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-base font-medium leading-tight">
                                    #{pr.number}
                                  </span>
                                  <span className="text-base font-medium leading-tight tracking-tight">
                                    {pr.title}
                                  </span>
                                  {pr.isDraft && (
                                    <Badge variant="secondary" className="text-xs">
                                      draft
                                    </Badge>
                                  )}
                                </div>
                                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                  <GitBranch className="size-3" />
                                  <span className="font-mono">{pr.headRefName}</span>
                                  <span>→</span>
                                  <span className="font-mono">{pr.baseRefName}</span>
                                  {pr.authorLogin && (
                                    <>
                                      <span>•</span>
                                      <span>by {pr.authorLogin}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenAgentDialog(pr);
                                  }}
                                  disabled={isCheckingOut}
                                  className="flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary backdrop-blur-sm transition-all hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {isCheckingOut ? (
                                    <>
                                      <Loader2 className="size-4 animate-spin" />
                                      Checking out...
                                    </>
                                  ) : (
                                    'Open in Workspace'
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <Alert>
                  <AlertTitle>GitHub not connected</AlertTitle>
                  <AlertDescription>
                    Connect to GitHub to view and manage pull requests.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>
          </Tabs>

          <AgentSelectionDialog
            isOpen={showAgentDialog}
            onClose={() => {
              setShowAgentDialog(false);
              setSelectedPr(null);
            }}
            onSelect={handleAgentSelected}
            prNumber={selectedPr?.number ?? 0}
          />

          <GitHubDetailModal
            isOpen={showDetailModal}
            onClose={() => setShowDetailModal(false)}
            projectPath={project.path}
            type={detailModalType}
            number={detailModalNumber}
            onRefresh={() => {
              if (detailModalType === 'issue') {
                loadIssues();
              } else {
                refreshPrs();
              }
            }}
          />

          <SSHConfigModal
            isOpen={showSSHModal}
            onClose={() => setShowSSHModal(false)}
            onSave={handleSSHSave}
            initialConfig={project.sshInfo}
          />
        </div>
      </div>
    </div>
  );
};

export default ProjectMainView;
