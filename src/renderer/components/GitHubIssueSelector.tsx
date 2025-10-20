import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectItemText, SelectTrigger } from './ui/select';
import { Search } from 'lucide-react';
import githubLogo from '../../assets/images/github.png';
import { type GitHubIssueSummary } from '../types/github';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { Spinner } from './ui/spinner';

interface GitHubIssueSelectorProps {
  selectedIssue: GitHubIssueSummary | null;
  onIssueChange: (issue: GitHubIssueSummary | null) => void;
  isOpen?: boolean;
  className?: string;
  projectPath?: string;
}

export const GitHubIssueSelector: React.FC<GitHubIssueSelectorProps> = ({
  selectedIssue,
  onIssueChange,
  isOpen = false,
  className = '',
  projectPath,
}) => {
  const [availableIssues, setAvailableIssues] = useState<GitHubIssueSummary[]>([]);
  const [isLoadingIssues, setIsLoadingIssues] = useState(false);
  const [issueListError, setIssueListError] = useState<string | null>(null);
  const [hasRequestedIssues, setHasRequestedIssues] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<GitHubIssueSummary[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const isMountedRef = useRef(true);
  // Only render a subset of issues initially; load more on scroll
  const [visibleCount, setVisibleCount] = useState(10);

  const canListGitHub =
    typeof window !== 'undefined' && !!window.electronAPI?.githubGetIssues && !!projectPath;
  const issuesLoaded = availableIssues.length > 0;

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setAvailableIssues([]);
      setHasRequestedIssues(false);
      setIssueListError(null);
      setIsLoadingIssues(false);
      setSearchTerm('');
      setSearchResults([]);
      setIsSearching(false);
      onIssueChange(null);
      setVisibleCount(10);
    }
  }, [isOpen, onIssueChange]);

  const loadGitHubIssues = useCallback(async () => {
    if (!canListGitHub || !projectPath) {
      return;
    }

    const api = window.electronAPI;
    if (!api?.githubGetIssues) {
      setAvailableIssues([]);
      setIssueListError('GitHub issue list unavailable in this build.');
      setHasRequestedIssues(true);
      return;
    }

    setIsLoadingIssues(true);
    try {
      // Fetch a generous set from GitHub; UI renders 10 initially
      const result = await api.githubGetIssues({ projectPath, limit: 50 });
      if (!isMountedRef.current) return;
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to load GitHub issues.');
      }
      setAvailableIssues(result.issues ?? []);
      setIssueListError(null);
    } catch (error) {
      if (!isMountedRef.current) return;
      setAvailableIssues([]);
      setIssueListError(error instanceof Error ? error.message : 'Failed to load GitHub issues.');
    } finally {
      if (!isMountedRef.current) return;
      setIsLoadingIssues(false);
      setHasRequestedIssues(true);
    }
  }, [canListGitHub, projectPath]);

  useEffect(() => {
    if (!isOpen || !canListGitHub) {
      return;
    }
    if (isLoadingIssues || hasRequestedIssues) {
      return;
    }
    loadGitHubIssues();
  }, [isOpen, canListGitHub, isLoadingIssues, hasRequestedIssues, loadGitHubIssues]);

  const searchIssues = useCallback(
    async (term: string) => {
      if (!term.trim() || !projectPath) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      const api = window.electronAPI;
      if (!api?.githubSearchIssues) {
        return;
      }

      setIsSearching(true);
      try {
        const result = await api.githubSearchIssues({
          projectPath,
          searchTerm: term.trim(),
          limit: 20,
        });
        if (!isMountedRef.current) return;
        if (result?.success) {
          setSearchResults(result.issues ?? []);
        } else {
          setSearchResults([]);
        }
      } catch (error) {
        if (!isMountedRef.current) return;
        setSearchResults([]);
      } finally {
        if (!isMountedRef.current) return;
        setIsSearching(false);
      }
    },
    [projectPath]
  );

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchIssues(searchTerm);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, searchIssues]);

  // Combine search results and available issues
  const displayIssues = useMemo(() => {
    if (searchTerm.trim()) {
      return searchResults;
    }
    return availableIssues;
  }, [searchTerm, searchResults, availableIssues]);

  // Reset how many are visible when the search term changes
  useEffect(() => {
    setVisibleCount(10);
  }, [searchTerm]);

  const showIssues = useMemo(
    () => displayIssues.slice(0, Math.max(10, visibleCount)),
    [displayIssues, visibleCount]
  );

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 16;
      if (nearBottom && showIssues.length < displayIssues.length) {
        setVisibleCount((prev) => Math.min(prev + 10, displayIssues.length));
      }
    },
    [displayIssues.length, showIssues.length]
  );

  const handleIssueSelect = (issueNumber: string) => {
    const issue = displayIssues.find((issue) => String(issue.number) === issueNumber) ?? null;
    onIssueChange(issue);
  };

  const issueHelperText = (() => {
    if (!canListGitHub || !projectPath) {
      return 'Project path is required to browse GitHub issues.';
    }
    if (hasRequestedIssues && !isLoadingIssues && !issuesLoaded && !issueListError) {
      return 'No GitHub issues available.';
    }
    return null;
  })();

  const issuePlaceholder = isLoadingIssues
    ? 'Loading…'
    : issueListError
      ? 'Connect to GitHub'
      : 'Select a GitHub issue';

  if (!canListGitHub || !projectPath) {
    return (
      <div className={className}>
        <Input value="" placeholder="GitHub integration unavailable" disabled />
        <p className="mt-2 text-xs text-muted-foreground">
          Project path is required to browse GitHub issues.
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <Select
        value={selectedIssue ? String(selectedIssue.number) : undefined}
        onValueChange={handleIssueSelect}
        disabled={isLoadingIssues || !!issueListError || !issuesLoaded}
      >
        <SelectTrigger className="h-9 w-full border-none bg-gray-100 dark:bg-gray-700">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-left text-foreground">
            {selectedIssue ? (
              <>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 dark:border-gray-700 dark:bg-gray-800">
                  <img src={githubLogo} alt="GitHub" className="h-3.5 w-3.5" />
                  <span className="text-[11px] font-medium text-foreground">
                    #{selectedIssue.number}
                  </span>
                </span>
                {selectedIssue.title ? (
                  <>
                    <span className="shrink-0 text-foreground">-</span>
                    <span className="truncate">{selectedIssue.title}</span>
                  </>
                ) : null}
              </>
            ) : (
              <>
                <img src={githubLogo} alt="GitHub" className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{issuePlaceholder}</span>
              </>
            )}
          </div>
        </SelectTrigger>
        <SelectContent side="top">
          <div className="relative px-3 py-2">
            <Search className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by title, number, label, or assignee..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-7 w-full border-none bg-transparent pl-9 pr-3 focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
          <Separator />
          <div className="max-h-80 overflow-y-auto" onScroll={handleScroll}>
            {showIssues.length > 0 ? (
              showIssues.map((issue) => (
                <SelectItem key={issue.id || issue.number} value={String(issue.number)}>
                  <SelectItemText>
                    <span className="gap- 2 flex min-w-0 items-center">
                      <span className="items- center inline-flex shrink-0 gap-1.5 rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 dark:border-gray-700 dark:bg-gray-800">
                        <img src={githubLogo} alt="GitHub" className="h-3.5 w-3.5" />
                        <span className="text-[11px] font-medium text-foreground">
                          #{issue.number}
                        </span>
                      </span>
                      {issue.title ? (
                        <>
                          <span className="text-muted- foreground ml-2 truncate">
                            {issue.title}
                          </span>
                        </>
                      ) : null}
                    </span>
                  </SelectItemText>
                </SelectItem>
              ))
            ) : searchTerm.trim() ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                {isSearching ? (
                  <div className="flex items-center gap-2">
                    <Spinner size="sm" />
                    <span>Searching</span>
                  </div>
                ) : (
                  `No issues found for "${searchTerm}"`
                )}
              </div>
            ) : (
              <div className="px-3 py-2 text-sm text-muted-foreground">No issues available</div>
            )}
          </div>
        </SelectContent>
      </Select>
      {issueListError ? (
        <div className="mt-2 rounded-md border border-border bg-muted/40 p-2">
          <div className="flex items-center gap-2">
            <Badge className="inline-flex items-center gap-1.5">
              <img src={githubLogo} alt="GitHub" className="h-3.5 w-3.5" />
              <span>Connect GitHub</span>
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Authenticate with GitHub CLI to browse and attach issues here.
          </p>
        </div>
      ) : null}
      {issueHelperText ? (
        <p className="mt-2 text-xs text-muted-foreground">{issueHelperText}</p>
      ) : null}
    </div>
  );
};

export default GitHubIssueSelector;
