import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Loader2, X, ExternalLink, MessageSquare } from 'lucide-react';
import githubLogo from '../../assets/images/github.png';

interface GitHubDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectPath: string;
  type: 'issue' | 'pr';
  number: number;
  onRefresh?: () => void;
}

export const GitHubDetailModal: React.FC<GitHubDetailModalProps> = ({
  isOpen,
  onClose,
  projectPath,
  type,
  number,
  onRefresh,
}) => {
  const [detail, setDetail] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState('');
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadDetails();
    } else {
      setDetail(null);
      setCommentBody('');
      setError(null);
    }
  }, [isOpen, number, type, projectPath]);

  const loadDetails = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const api = (window as any).electronAPI;
      let result;

      if (type === 'issue') {
        result = await api.githubGetIssue({ projectPath, issueNumber: number });
      } else {
        result = await api.githubGetPR({ projectPath, prNumber: number });
      }

      if (!result?.success) {
        throw new Error(result?.error || `Failed to load ${type}`);
      }

      setDetail(type === 'issue' ? result.issue : result.pr);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to load ${type}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!commentBody.trim()) return;

    setIsAddingComment(true);
    try {
      const api = (window as any).electronAPI;
      let result;

      if (type === 'issue') {
        result = await api.githubAddIssueComment({
          projectPath,
          issueNumber: number,
          body: commentBody.trim(),
        });
      } else {
        result = await api.githubAddPRComment({
          projectPath,
          prNumber: number,
          body: commentBody.trim(),
        });
      }

      if (!result?.success) {
        throw new Error(result?.error || 'Failed to add comment');
      }

      setCommentBody('');
      await loadDetails();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add comment');
    } finally {
      setIsAddingComment(false);
    }
  };

  const handleCloseOrReopen = async () => {
    if (!detail) return;

    const isCurrentlyClosed = detail.state === 'closed' || detail.state === 'CLOSED';
    setIsClosing(true);

    try {
      const api = (window as any).electronAPI;
      let result;

      if (isCurrentlyClosed) {
        result = await api.githubReopenIssue({ projectPath, issueNumber: number });
      } else {
        result = await api.githubCloseIssue({ projectPath, issueNumber: number });
      }

      if (!result?.success) {
        throw new Error(
          result?.error || `Failed to ${isCurrentlyClosed ? 'reopen' : 'close'} issue`
        );
      }

      await loadDetails();
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update issue');
    } finally {
      setIsClosing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative mx-4 flex max-h-[90vh] w-full max-w-4xl flex-col rounded-lg bg-background shadow-lg">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border p-6">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <img src={githubLogo} alt="GitHub" className="mt-1 h-6 w-6 shrink-0" />
            <div className="min-w-0 flex-1">
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading...</span>
                </div>
              ) : detail ? (
                <>
                  <h2 className="text-xl font-semibold">
                    {detail.title} <span className="text-muted-foreground">#{number}</span>
                  </h2>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge
                      variant={
                        detail.state === 'open' || detail.state === 'OPEN' ? 'default' : 'secondary'
                      }
                    >
                      {detail.state}
                    </Badge>
                    {type === 'pr' && detail.isDraft && <Badge variant="outline">Draft</Badge>}
                    {detail.author?.login && (
                      <span className="text-sm text-muted-foreground">
                        by {detail.author.login}
                      </span>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : detail ? (
            <div className="space-y-6">
              {/* Labels */}
              {detail.labels && detail.labels.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {detail.labels.map((label: any, idx: number) => (
                    <span
                      key={idx}
                      className="rounded-full px-2 py-0.5 text-xs"
                      style={{
                        backgroundColor: label.color ? `#${label.color}` : '#gray',
                        color: '#fff',
                      }}
                    >
                      {label.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Body */}
              {detail.body && (
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="whitespace-pre-wrap text-sm">{detail.body}</div>
                </div>
              )}

              {/* PR Stats */}
              {type === 'pr' && (
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>
                    <span className="font-medium text-green-600">+{detail.additions}</span>{' '}
                    additions
                  </span>
                  <span>
                    <span className="font-medium text-red-600">-{detail.deletions}</span> deletions
                  </span>
                  <span>{detail.changedFiles} files changed</span>
                </div>
              )}

              <Separator />

              {/* Comments */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  <h3 className="font-semibold">Comments ({detail.comments?.length || 0})</h3>
                </div>

                {detail.comments && detail.comments.length > 0 ? (
                  <div className="space-y-3">
                    {detail.comments.map((comment: any, idx: number) => (
                      <div key={idx} className="rounded-lg border border-border bg-background p-4">
                        <div className="mb-2 flex items-center gap-2 text-sm">
                          <span className="font-medium">{comment.author?.login || 'Unknown'}</span>
                          {comment.createdAt && (
                            <span className="text-muted-foreground">
                              {new Date(comment.createdAt).toLocaleString()}
                            </span>
                          )}
                        </div>
                        <div className="whitespace-pre-wrap text-sm">{comment.body}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No comments yet</p>
                )}

                {/* Add Comment */}
                <div className="space-y-3 rounded-lg border border-border p-4">
                  <textarea
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    placeholder="Write a comment..."
                    className="min-h-[100px] w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <Button
                    onClick={handleAddComment}
                    disabled={!commentBody.trim() || isAddingComment}
                    size="sm"
                  >
                    {isAddingComment ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      'Add Comment'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {detail && (
          <div className="flex items-center justify-between border-t border-border p-6">
            <div className="flex items-center gap-2">
              {type === 'issue' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCloseOrReopen}
                  disabled={isClosing}
                >
                  {isClosing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {detail.state === 'closed' ? 'Reopening...' : 'Closing...'}
                    </>
                  ) : detail.state === 'closed' ? (
                    'Reopen Issue'
                  ) : (
                    'Close Issue'
                  )}
                </Button>
              )}
              {detail.url && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    (window as any).electronAPI?.openExternal?.(detail.url);
                  }}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View on GitHub
                </Button>
              )}
            </div>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default GitHubDetailModal;
