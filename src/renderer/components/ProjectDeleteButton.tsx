import React from 'react';
import { Trash } from 'lucide-react';
import { Spinner } from './ui/spinner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog';

type Props = {
  projectName: string;
  onConfirm: () => void | Promise<void>;
  className?: string;
  'aria-label'?: string;
  isDeleting?: boolean;
};

export const ProjectDeleteButton: React.FC<Props> = ({
  projectName,
  onConfirm,
  className,
  'aria-label': ariaLabel = 'Delete project',
  isDeleting = false,
}) => {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className={
            className ||
            'inline-flex items-center justify-center rounded p-2 text-muted-foreground hover:bg-transparent hover:text-destructive focus-visible:ring-0'
          }
          title="Delete project"
          aria-label={ariaLabel}
          aria-busy={isDeleting}
          disabled={isDeleting}
        >
          {isDeleting ? <Spinner className="h-4 w-4" size="sm" /> : <Trash className="h-4 w-4" />}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="space-y-4">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete project?</AlertDialogTitle>
          <AlertDialogDescription>
            {`This removes "${projectName}" from emdash, including its saved workspaces and conversations. Files on disk are not deleted.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive px-4 py-2 text-destructive-foreground hover:bg-destructive/90"
            onClick={async () => {
              try {
                await onConfirm();
              } catch {}
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ProjectDeleteButton;
