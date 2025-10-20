import React, { useState } from 'react';
import { Button } from './ui/button';
import { Spinner } from './ui/spinner';
import { useToast } from '../hooks/use-toast';
import { Terminal, Trash2 } from 'lucide-react';

declare const window: Window & {
  electronAPI: any;
};

const TmuxCleanupCard: React.FC = () => {
  const [isCleaning, setIsCleaning] = useState(false);
  const { toast } = useToast();

  const handleCleanup = async () => {
    setIsCleaning(true);
    try {
      const result = await window.electronAPI.ptyCleanAllTmux();

      if (result.success) {
        toast({
          title: 'Tmux Sessions Cleaned',
          description: `Removed ${result.cleaned} tmux session${result.cleaned !== 1 ? 's' : ''}.`,
        });

        if (result.errors.length > 0) {
          console.warn('Tmux cleanup warnings:', result.errors);
        }
      } else {
        toast({
          title: 'Cleanup Failed',
          description: result.errors[0] || 'Failed to clean tmux sessions.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to clean tmux sessions:', error);
      toast({
        title: 'Cleanup Failed',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex items-center gap-2">
        <Terminal className="h-5 w-5 text-primary" />
        <h4 className="font-medium">Terminal Sessions</h4>
      </div>

      <p className="text-sm text-muted-foreground">
        Clean up orphaned tmux sessions created by Emdash terminals. This will remove all
        background terminal sessions that are no longer in use.
      </p>

      <Button
        onClick={handleCleanup}
        disabled={isCleaning}
        variant="outline"
        className="w-full"
        size="sm"
      >
        {isCleaning ? (
          <>
            <Spinner size="sm" className="mr-2" />
            Cleaning...
          </>
        ) : (
          <>
            <Trash2 className="mr-2 h-4 w-4" />
            Clean All Tmux Sessions
          </>
        )}
      </Button>

      <p className="text-xs text-muted-foreground">
        Note: This will not affect active terminal sessions in your current workspaces.
      </p>
    </div>
  );
};

export default TmuxCleanupCard;
