import { useState, useEffect } from 'react';

export interface FileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  isStaged: boolean;
  diff?: string;
}

export function useFileChanges(workspacePath: string, prBaseBranch?: string) {
  const [fileChanges, setFileChanges] = useState<FileChange[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFileChanges = async (isInitialLoad = false) => {
      if (!workspacePath) return;

      if (isInitialLoad) {
        setIsLoading(true);
        setError(null);
      }

      try {
        // For PR workspaces, get diff between PR branch and base branch
        // Otherwise, get regular working directory changes
        const result = prBaseBranch
          ? await window.electronAPI.getPRBranchChanges({ workspacePath, baseBranch: prBaseBranch })
          : await window.electronAPI.getGitStatus(workspacePath);

        if (result?.success && result.changes && result.changes.length > 0) {
          const changes: FileChange[] = result.changes.map(
            (change: {
              path: string;
              status: string;
              additions: number;
              deletions: number;
              isStaged: boolean;
              diff?: string;
            }) => ({
              path: change.path,
              status: change.status as 'added' | 'modified' | 'deleted' | 'renamed',
              additions: change.additions || 0,
              deletions: change.deletions || 0,
              isStaged: change.isStaged || false,
              diff: change.diff,
            })
          );
          setFileChanges(changes);
        } else {
          setFileChanges([]);
        }
      } catch (err) {
        console.error('Failed to fetch file changes:', err);
        if (isInitialLoad) {
          setError('Failed to load file changes');
        }
        // No changes on error - set empty array
        setFileChanges([]);
      } finally {
        if (isInitialLoad) {
          setIsLoading(false);
        }
      }
    };

    // Initial load with loading state
    fetchFileChanges(true);

    const interval = setInterval(() => fetchFileChanges(false), 5000);

    return () => clearInterval(interval);
  }, [workspacePath, prBaseBranch]);

  const refreshChanges = async () => {
    setIsLoading(true);
    try {
      const result = prBaseBranch
        ? await window.electronAPI.getPRBranchChanges({ workspacePath, baseBranch: prBaseBranch })
        : await window.electronAPI.getGitStatus(workspacePath);
      if (result?.success && result.changes && result.changes.length > 0) {
        const changes: FileChange[] = result.changes.map(
          (change: {
            path: string;
            status: string;
            additions: number;
            deletions: number;
            isStaged: boolean;
            diff?: string;
          }) => ({
            path: change.path,
            status: change.status as 'added' | 'modified' | 'deleted' | 'renamed',
            additions: change.additions || 0,
            deletions: change.deletions || 0,
            isStaged: change.isStaged || false,
            diff: change.diff,
          })
        );
        setFileChanges(changes);
      } else {
        setFileChanges([]);
      }
    } catch (err) {
      console.error('Failed to refresh file changes:', err);
      setFileChanges([]);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    fileChanges,
    isLoading,
    error,
    refreshChanges,
  };
}
