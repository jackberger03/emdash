import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Spinner } from './ui/spinner';
import { Switch } from './ui/switch';
import { X, GitBranch, Settings } from 'lucide-react';
import { ProviderSelector } from './ProviderSelector';
import { type Provider } from '../types';
import { Separator } from './ui/separator';

interface WorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateWorkspace: (name: string, initialPrompt?: string, selectedProvider?: Provider) => void;
  projectName: string;
  defaultBranch: string;
  existingNames?: string[];
}

const WorkspaceModal: React.FC<WorkspaceModalProps> = ({
  isOpen,
  onClose,
  onCreateWorkspace,
  projectName,
  defaultBranch,
  existingNames = [],
}) => {
  const [workspaceName, setWorkspaceName] = useState('');
  const [initialPrompt, setInitialPrompt] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<Provider>('codex-cli');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const normalizedExisting = existingNames.map((n) => n.toLowerCase());

  const validate = (value: string): string | null => {
    const name = value.trim();
    if (!name) return 'Please enter a workspace name.';
    // Allow lowercase letters, numbers, and single hyphens between segments
    // Must start/end with alphanumeric; no spaces; no consecutive hyphens
    const pattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!pattern.test(name)) {
      return 'Use lowercase letters, numbers, and hyphens (no spaces).';
    }
    if (normalizedExisting.includes(name.toLowerCase())) {
      return 'A workspace with this name already exists.';
    }
    if (name.length > 64) {
      return 'Name is too long (max 64 characters).';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    const err = validate(workspaceName);
    if (err) {
      setError(err);
      return;
    }

    setIsCreating(true);
    try {
      await onCreateWorkspace(
        workspaceName.trim(),
        showAdvanced ? initialPrompt.trim() || undefined : undefined,
        showAdvanced ? selectedProvider : undefined
      );
      setWorkspaceName('');
      setInitialPrompt('');
      setSelectedProvider('codex-cli');
      setShowAdvanced(false);
      setError(null);
      onClose();
    } catch (error) {
      console.error('Failed to create workspace:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const onChange = (val: string) => {
    if (!touched) setTouched(true);
    setWorkspaceName(val);
    setError(validate(val));
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.1, ease: 'easeOut' }}
          onClick={onClose}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8, scale: 0.995 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              shouldReduceMotion
                ? { opacity: 1, y: 0, scale: 1 }
                : { opacity: 0, y: 6, scale: 0.995 }
            }
            transition={
              shouldReduceMotion ? { duration: 0 } : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }
            }
            className="w-full max-w-md mx-4 will-change-transform transform-gpu"
          >
            <Card className="w-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle className="text-lg">New workspace</CardTitle>
                  <CardDescription>
                    {projectName} • Branching from origin/{defaultBranch}
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="workspace-name" className="block text-sm font-medium mb-2">
                      What are you working on?
                    </label>
                    <Input
                      id="workspace-name"
                      value={workspaceName}
                      onChange={(e) => onChange(e.target.value)}
                      onBlur={() => setTouched(true)}
                      placeholder="Describe your task..."
                      className="w-full"
                      aria-invalid={touched && !!error}
                      aria-describedby="workspace-name-error"
                      autoFocus
                    />
                    {touched && error && (
                      <p id="workspace-name-error" className="mt-2 text-sm text-destructive">
                        {error}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <GitBranch className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {workspaceName || 'workspace-name'}
                    </span>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Settings className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      <label
                        id="advanced-toggle-label"
                        className="text-sm font-medium text-gray-900 dark:text-gray-100"
                      >
                        Advanced options
                      </label>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch
                        id="advanced-toggle"
                        checked={showAdvanced}
                        onCheckedChange={setShowAdvanced}
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Choose agent and start it immediately with an initial prompt.
                      </p>
                    </div>
                  </div>

                  {showAdvanced && (
                    <>
                      <div>
                        <label htmlFor="provider-selector" className="block text-sm font-medium">
                          AI Provider
                        </label>
                        <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                          Choose coding agent for this workspace.
                        </p>
                        <ProviderSelector
                          value={selectedProvider}
                          onChange={setSelectedProvider}
                          className="w-full"
                        />
                      </div>

                      {(selectedProvider === 'codex' || selectedProvider === 'claude') && (
                        <div>
                          <label htmlFor="initial-prompt" className="block text-sm font-medium">
                            Initial prompt
                          </label>
                          <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                            Optionally, add an initial prompt to help the agent get started.
                          </p>
                          <textarea
                            id="initial-prompt"
                            value={initialPrompt}
                            onChange={(e) => setInitialPrompt(e.target.value)}
                            placeholder={`Add an initial prompt for ${
                              selectedProvider.charAt(0).toUpperCase() + selectedProvider.slice(1)
                            }, outlining your goal and how you want to achieve it.`}
                            className="w-full min-h-[80px] px-3 py-2 text-sm border border-input bg-background rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                            rows={3}
                          />
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={onClose} disabled={isCreating}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={!!validate(workspaceName) || isCreating}
                      className="bg-black text-white hover:bg-gray-800"
                    >
                      {isCreating ? (
                        <>
                          <Spinner size="sm" className="mr-2" />
                          Creating...
                        </>
                      ) : (
                        'Create workspace'
                      )}
                    </Button>
                  </div>
                </form>

                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    emdash runs a <strong>setup script</strong> each time you create a new
                    workspace.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default WorkspaceModal;
