import React, { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Spinner } from './ui/spinner';
import { useToast } from '../hooks/use-toast';
import { useCreatePR } from '../hooks/useCreatePR';
import ChangesDiffModal from './ChangesDiffModal';
import { useFileChanges } from '../hooks/useFileChanges';
import { usePrStatus } from '../hooks/usePrStatus';
import PrStatusSkeleton from './ui/pr-status-skeleton';
import FileTypeIcon from './ui/file-type-icon';
import {
  Plus,
  Minus,
  Undo2,
  RefreshCw,
  Check,
  Upload,
  Download,
  ArrowUpDown,
  GitBranch,
} from 'lucide-react';

interface FileChangesPanelProps {
  workspaceId: string;
  className?: string;
  workspaceMetadata?: any; // Workspace metadata including PR info
}

const FileChangesPanelComponent: React.FC<FileChangesPanelProps> = ({
  workspaceId,
  className,
  workspaceMetadata,
}) => {
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | undefined>(undefined);
  const [stagingFiles, setStagingFiles] = useState<Set<string>>(new Set());
  const [unstagingFiles, setUnstagingFiles] = useState<Set<string>>(new Set());
  const [revertingFiles, setRevertingFiles] = useState<Set<string>>(new Set());
  const [commitMessage, setCommitMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isStaging, setIsStaging] = useState(false);
  const [isUnstaging, setIsUnstaging] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { isCreating: isCreatingPR, createPR } = useCreatePR();

  // Extract PR base branch from metadata for PR workspaces
  const prBaseBranch =
    workspaceMetadata?.pullRequest?.baseRefName ||
    (workspaceMetadata?.pullRequest ? 'main' : undefined);
  const isPRWorkspace = !!workspaceMetadata?.pullRequest;

  const { fileChanges, refreshChanges } = useFileChanges(workspaceId, prBaseBranch);
  const { toast } = useToast();
  const hasChanges = fileChanges.length > 0;
  const hasStagedChanges = fileChanges.some((change) => change.isStaged);
  const { pr, loading: prLoading, refresh: refreshPr } = usePrStatus(workspaceId);
  const [branchAhead, setBranchAhead] = useState<number | null>(null);
  const [branchBehind, setBranchBehind] = useState<number | null>(null);
  const [branchStatusLoading, setBranchStatusLoading] = useState<boolean>(false);

  // Check branch status - now checks always to detect unpushed commits
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!workspaceId) {
        setBranchAhead(null);
        setBranchBehind(null);
        return;
      }
      setBranchStatusLoading(true);
      try {
        const res = await window.electronAPI.getBranchStatus({ workspacePath: workspaceId });
        if (!cancelled) {
          setBranchAhead(res?.success ? (res?.ahead ?? 0) : 0);
          setBranchBehind(res?.success ? (res?.behind ?? 0) : 0);
        }
      } catch {
        if (!cancelled) {
          setBranchAhead(0);
          setBranchBehind(0);
        }
      } finally {
        if (!cancelled) setBranchStatusLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, hasChanges]);

  const handleStageFile = async (filePath: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent opening diff modal
    setStagingFiles((prev) => new Set(prev).add(filePath));

    try {
      const result = await window.electronAPI.stageFile({
        workspacePath: workspaceId,
        filePath,
      });

      if (result.success) {
        await refreshChanges();
      } else {
        toast({
          title: 'Stage Failed',
          description: result.error || 'Failed to stage file.',
          variant: 'destructive',
        });
      }
    } catch (_error) {
      toast({
        title: 'Stage Failed',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setStagingFiles((prev) => {
        const newSet = new Set(prev);
        newSet.delete(filePath);
        return newSet;
      });
    }
  };

  const handleUnstageFile = async (filePath: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent opening diff modal
    setUnstagingFiles((prev) => new Set(prev).add(filePath));

    try {
      const result = await window.electronAPI.revertFile({
        workspacePath: workspaceId,
        filePath,
      });

      if (result.success) {
        await refreshChanges();
      } else {
        toast({
          title: 'Unstage Failed',
          description: result.error || 'Failed to unstage file.',
          variant: 'destructive',
        });
      }
    } catch (_error) {
      toast({
        title: 'Unstage Failed',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setUnstagingFiles((prev) => {
        const newSet = new Set(prev);
        newSet.delete(filePath);
        return newSet;
      });
    }
  };

  const handleRevertFile = async (filePath: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent opening diff modal

    // Check if file is staged - if so, we need to unstage first then revert
    const fileChange = fileChanges.find((f) => f.path === filePath);
    const isFileStaged = fileChange?.isStaged || false;

    setRevertingFiles((prev) => new Set(prev).add(filePath));

    try {
      // If staged, unstage first
      if (isFileStaged) {
        const unstageResult = await window.electronAPI.revertFile({
          workspacePath: workspaceId,
          filePath,
        });
        if (!unstageResult.success) {
          toast({
            title: 'Revert Failed',
            description: unstageResult.error || 'Failed to unstage file before reverting.',
            variant: 'destructive',
          });
          return;
        }
      }

      // Now revert the changes
      const result = await window.electronAPI.revertFile({
        workspacePath: workspaceId,
        filePath,
      });

      if (result.success) {
        toast({
          title: 'File Reverted',
          description: `${filePath} changes have been discarded.`,
        });
        await refreshChanges();
      } else {
        toast({
          title: 'Revert Failed',
          description: result.error || 'Failed to revert file.',
          variant: 'destructive',
        });
      }
    } catch (_error) {
      toast({
        title: 'Revert Failed',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setRevertingFiles((prev) => {
        const newSet = new Set(prev);
        newSet.delete(filePath);
        return newSet;
      });
    }
  };

  const handleStageAll = async () => {
    setIsStaging(true);
    try {
      const result = await window.electronAPI.stageAll({ workspacePath: workspaceId });
      if (result.success) {
        await refreshChanges();
        toast({
          title: 'All Files Staged',
          description: 'All changes have been staged successfully.',
        });
      } else {
        toast({
          title: 'Stage All Failed',
          description: result.error || 'Failed to stage all files.',
          variant: 'destructive',
        });
      }
    } catch (_error) {
      toast({
        title: 'Stage All Failed',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsStaging(false);
    }
  };

  const handleUnstageAll = async () => {
    setIsUnstaging(true);
    try {
      const result = await window.electronAPI.unstageAll({ workspacePath: workspaceId });
      if (result.success) {
        await refreshChanges();
        toast({
          title: 'All Files Unstaged',
          description: 'All staged changes have been unstaged.',
        });
      } else {
        toast({
          title: 'Unstage All Failed',
          description: result.error || 'Failed to unstage all files.',
          variant: 'destructive',
        });
      }
    } catch (_error) {
      toast({
        title: 'Unstage All Failed',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsUnstaging(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshChanges();
      await refreshPr();
    } catch (_error) {
      // Silent fail
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      toast({
        title: 'Commit Message Required',
        description: 'Please enter a commit message.',
        variant: 'destructive',
      });
      return;
    }

    if (!hasStagedChanges) {
      toast({
        title: 'No Staged Changes',
        description: 'Please stage some files before committing.',
        variant: 'destructive',
      });
      return;
    }

    setIsCommitting(true);
    try {
      const result = await window.electronAPI.gitCommit({
        workspacePath: workspaceId,
        message: commitMessage.trim(),
      });

      if (result.success) {
        toast({
          title: 'Committed',
          description: `Changes committed with message: "${commitMessage.trim()}"`,
        });
        setCommitMessage('');
        await refreshChanges();
        // Refresh branch status to show unpushed commits
        try {
          setBranchStatusLoading(true);
          const bs = await window.electronAPI.getBranchStatus({ workspacePath: workspaceId });
          setBranchAhead(bs?.success ? (bs?.ahead ?? 0) : 0);
          setBranchBehind(bs?.success ? (bs?.behind ?? 0) : 0);
        } catch {
          setBranchAhead(0);
          setBranchBehind(0);
        } finally {
          setBranchStatusLoading(false);
        }
      } else {
        toast({
          title: 'Commit Failed',
          description: result.error || 'Failed to commit changes.',
          variant: 'destructive',
        });
      }
    } catch (_error) {
      toast({
        title: 'Commit Failed',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsCommitting(false);
    }
  };

  const handlePush = async () => {
    setIsPushing(true);
    try {
      const result = await window.electronAPI.gitPush({ workspacePath: workspaceId });

      if (result.success) {
        toast({
          title: 'Pushed',
          description: `Changes pushed to ${result.branch || 'remote'}`,
        });
        await refreshChanges();
        try {
          await refreshPr();
        } catch {}
        // Refresh branch status to clear the "ahead" count
        try {
          setBranchStatusLoading(true);
          const bs = await window.electronAPI.getBranchStatus({ workspacePath: workspaceId });
          setBranchAhead(bs?.success ? (bs?.ahead ?? 0) : 0);
          setBranchBehind(bs?.success ? (bs?.behind ?? 0) : 0);
        } catch {
          setBranchAhead(0);
          setBranchBehind(0);
        } finally {
          setBranchStatusLoading(false);
        }
      } else {
        toast({
          title: 'Push Failed',
          description: result.error || 'Failed to push changes.',
          variant: 'destructive',
        });
      }
    } catch (_error) {
      toast({
        title: 'Push Failed',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsPushing(false);
    }
  };

  const handlePull = async () => {
    setIsPulling(true);
    try {
      const result = await window.electronAPI.gitPull({ workspacePath: workspaceId });

      if (result.success) {
        toast({
          title: 'Pulled',
          description: 'Changes pulled from remote successfully.',
        });
        await refreshChanges();
      } else {
        toast({
          title: 'Pull Failed',
          description: result.error || 'Failed to pull changes.',
          variant: 'destructive',
        });
      }
    } catch (_error) {
      toast({
        title: 'Pull Failed',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsPulling(false);
    }
  };

  const handleSync = async () => {
    if (hasStagedChanges && !commitMessage.trim()) {
      toast({
        title: 'Commit Message Required',
        description: 'Please enter a commit message before syncing.',
        variant: 'destructive',
      });
      return;
    }

    setIsSyncing(true);
    try {
      const result = await window.electronAPI.gitSync({
        workspacePath: workspaceId,
        commitMessage: hasStagedChanges ? commitMessage.trim() : undefined,
      });

      if (result.success) {
        toast({
          title: 'Synced',
          description: `Changes synced to ${result.branch || 'remote'}`,
        });
        setCommitMessage('');
        await refreshChanges();
        try {
          await refreshPr();
        } catch {}
        // Refresh branch status after sync
        try {
          setBranchStatusLoading(true);
          const bs = await window.electronAPI.getBranchStatus({ workspacePath: workspaceId });
          setBranchAhead(bs?.success ? (bs?.ahead ?? 0) : 0);
          setBranchBehind(bs?.success ? (bs?.behind ?? 0) : 0);
        } catch {
          setBranchAhead(0);
          setBranchBehind(0);
        } finally {
          setBranchStatusLoading(false);
        }
      } else {
        toast({
          title: 'Sync Failed',
          description: result.error || 'Failed to sync changes.',
          variant: 'destructive',
        });
      }
    } catch (_error) {
      toast({
        title: 'Sync Failed',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCommitAndPush = async () => {
    if (!commitMessage.trim()) {
      toast({
        title: 'Commit Message Required',
        description: 'Please enter a commit message.',
        variant: 'destructive',
      });
      return;
    }

    if (!hasStagedChanges) {
      toast({
        title: 'No Staged Changes',
        description: 'Please stage some files before committing.',
        variant: 'destructive',
      });
      return;
    }

    setIsCommitting(true);
    try {
      const result = await window.electronAPI.gitCommitAndPush({
        workspacePath: workspaceId,
        commitMessage: commitMessage.trim(),
        createBranchIfOnDefault: true,
        branchPrefix: 'feature',
      });

      if (result.success) {
        toast({
          title: 'Committed and Pushed',
          description: `Changes committed with message: "${commitMessage.trim()}"`,
        });
        setCommitMessage(''); // Clear the input
        await refreshChanges();
        try {
          await refreshPr();
        } catch {}
        // Proactively load branch status so the Create PR button appears immediately
        try {
          setBranchStatusLoading(true);
          const bs = await window.electronAPI.getBranchStatus({ workspacePath: workspaceId });
          setBranchAhead(bs?.success ? (bs?.ahead ?? 0) : 0);
        } catch {
          setBranchAhead(0);
        } finally {
          setBranchStatusLoading(false);
        }
      } else {
        toast({
          title: 'Commit Failed',
          description: result.error || 'Failed to commit and push changes.',
          variant: 'destructive',
        });
      }
    } catch (_error) {
      toast({
        title: 'Commit Failed',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsCommitting(false);
    }
  };

  const renderPath = (p: string) => {
    const last = p.lastIndexOf('/');
    const dir = last >= 0 ? p.slice(0, last + 1) : '';
    const base = last >= 0 ? p.slice(last + 1) : p;
    return (
      <span className="truncate">
        {dir && <span className="text-gray-500 dark:text-gray-400">{dir}</span>}
        <span className="font-medium text-gray-900 dark:text-gray-100">{base}</span>
      </span>
    );
  };

  const stagedChanges = fileChanges.filter((f) => f.isStaged);
  const unstagedChanges = fileChanges.filter((f) => !f.isStaged);

  const totalChanges = fileChanges.reduce(
    (acc, change) => ({
      additions: acc.additions + change.additions,
      deletions: acc.deletions + change.deletions,
    }),
    { additions: 0, deletions: 0 }
  );

  const renderFileList = (files: typeof fileChanges, isStaged: boolean) => (
    <>
      {files.map((change, index) => (
        <div
          key={index}
          className={`flex cursor-pointer items-center justify-between border-b border-gray-100 px-4 py-2.5 last:border-b-0 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900/40`}
          onClick={() => {
            setSelectedPath(change.path);
            setShowDiffModal(true);
          }}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="inline-flex h-4 w-4 items-center justify-center text-gray-500">
              <FileTypeIcon
                path={change.path}
                type={change.status === 'deleted' ? 'file' : 'file'}
                size={14}
              />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">{renderPath(change.path)}</div>
            </div>
          </div>
          <div className="ml-3 flex items-center gap-2">
            {change.additions > 0 && (
              <span className="rounded bg-green-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-green-900/30 dark:text-emerald-300">
                +{change.additions}
              </span>
            )}
            {change.deletions > 0 && (
              <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
                -{change.deletions}
              </span>
            )}
            <div className="flex items-center gap-1">
              {!isStaged ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-gray-500 hover:bg-gray-50 hover:text-gray-600 dark:hover:bg-gray-900/20 dark:hover:text-gray-400"
                  onClick={(e) => handleStageFile(change.path, e)}
                  disabled={stagingFiles.has(change.path)}
                  title="Stage file for commit"
                >
                  {stagingFiles.has(change.path) ? (
                    <Spinner size="sm" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-gray-500 hover:bg-gray-50 hover:text-gray-600 dark:hover:bg-gray-900/20 dark:hover:text-gray-400"
                  onClick={(e) => handleUnstageFile(change.path, e)}
                  disabled={unstagingFiles.has(change.path)}
                  title="Unstage file"
                >
                  {unstagingFiles.has(change.path) ? (
                    <Spinner size="sm" />
                  ) : (
                    <Minus className="h-3 w-3" />
                  )}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-gray-500 hover:bg-gray-50 hover:text-gray-600 dark:hover:bg-gray-900/20 dark:hover:text-gray-400"
                onClick={(e) => handleRevertFile(change.path, e)}
                disabled={revertingFiles.has(change.path)}
                title="Discard changes to file"
              >
                {revertingFiles.has(change.path) ? (
                  <Spinner size="sm" />
                ) : (
                  <Undo2 className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>
        </div>
      ))}
    </>
  );

  return (
    <div className={`flex h-full flex-col bg-white shadow-sm dark:bg-gray-800 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Source Control
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh"
          >
            {isRefreshing ? (
              <Spinner size="sm" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 text-gray-500" />
            )}
          </Button>
        </div>
      </div>

      {/* Commit Controls - show when there are staged changes OR unpushed commits */}
      {(hasStagedChanges || (branchAhead !== null && branchAhead > 0)) && (
        <div className="border-b border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
          {hasStagedChanges ? (
            <>
              <Input
                placeholder="Commit message..."
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                className="mb-2 h-8 text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) {
                    e.preventDefault();
                    handleCommit();
                  }
                }}
              />
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 flex-1 text-xs"
                  onClick={handleCommit}
                  disabled={isCommitting || !commitMessage.trim()}
                  title="Commit (Ctrl+Enter)"
                >
                  {isCommitting ? (
                    <Spinner size="sm" />
                  ) : (
                    <>
                      <Check className="mr-1 h-3 w-3" />
                      Commit
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={handleSync}
                  disabled={isSyncing || !commitMessage.trim()}
                  title="Commit and Sync (pull + push)"
                >
                  {isSyncing ? <Spinner size="sm" /> : <ArrowUpDown className="h-3 w-3" />}
                </Button>
              </div>
            </>
          ) : (
            // Show sync status when commits are ahead
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {branchAhead} commit{branchAhead !== 1 ? 's' : ''} ahead
                {branchBehind !== null && branchBehind > 0 && <>, {branchBehind} behind</>}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 flex-1 text-xs"
              onClick={handlePull}
              disabled={isPulling}
              title="Pull from remote"
            >
              {isPulling ? (
                <Spinner size="sm" />
              ) : (
                <>
                  <Download className="mr-1 h-3 w-3" />
                  Pull
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 flex-1 text-xs"
              onClick={handlePush}
              disabled={isPushing}
              title="Push to remote"
            >
              {isPushing ? (
                <Spinner size="sm" />
              ) : (
                <>
                  <Upload className="mr-1 h-3 w-3" />
                  Push
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={handleSync}
              disabled={isSyncing}
              title="Sync (pull + push)"
            >
              {isSyncing ? <Spinner size="sm" /> : <ArrowUpDown className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      )}

      {/* PR Status */}
      {!hasChanges && (
        <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">No changes</span>
            {prLoading ? (
              <PrStatusSkeleton />
            ) : pr ? (
              <button
                type="button"
                onClick={() => window.electronAPI?.openExternal?.(pr.url)}
                className="cursor-pointer rounded border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                title={pr.title || 'Pull Request'}
              >
                PR {pr.isDraft ? 'draft' : pr.state.toLowerCase()}
              </button>
            ) : !isPRWorkspace &&
              (branchStatusLoading || (branchAhead !== null && branchAhead > 0)) ? (
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs"
                disabled={isCreatingPR || branchStatusLoading}
                onClick={async () => {
                  await createPR({
                    workspacePath: workspaceId,
                    onSuccess: async () => {
                      await refreshChanges();
                      try {
                        await refreshPr();
                      } catch {}
                    },
                  });
                }}
              >
                {isCreatingPR || branchStatusLoading ? <Spinner size="sm" /> : 'Create PR'}
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {/* File Lists */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Staged Changes */}
        {stagedChanges.length > 0 && (
          <div>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-1.5 dark:border-gray-700 dark:bg-gray-900">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400">
                Staged Changes ({stagedChanges.length})
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-2 text-xs"
                onClick={handleUnstageAll}
                disabled={isUnstaging}
                title="Unstage all files"
              >
                {isUnstaging ? <Spinner size="sm" /> : 'Unstage All'}
              </Button>
            </div>
            {renderFileList(stagedChanges, true)}
          </div>
        )}

        {/* Unstaged Changes */}
        {unstagedChanges.length > 0 && (
          <div>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-1.5 dark:border-gray-700 dark:bg-gray-900">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400">
                Changes ({unstagedChanges.length})
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-2 text-xs"
                onClick={handleStageAll}
                disabled={isStaging}
                title="Stage all files"
              >
                {isStaging ? <Spinner size="sm" /> : 'Stage All'}
              </Button>
            </div>
            {renderFileList(unstagedChanges, false)}
          </div>
        )}
      </div>
      {showDiffModal && (
        <ChangesDiffModal
          open={showDiffModal}
          onClose={() => setShowDiffModal(false)}
          workspacePath={workspaceId}
          files={fileChanges}
          initialFile={selectedPath}
        />
      )}
    </div>
  );
};
export const FileChangesPanel = React.memo(FileChangesPanelComponent);

export default FileChangesPanel;
