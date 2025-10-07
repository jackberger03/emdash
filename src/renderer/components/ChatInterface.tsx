import React, { useEffect, useRef, useState } from 'react';
import { useToast } from '../hooks/use-toast';
import ChatInput from './ChatInput';
import { TerminalPane } from './TerminalPane';
import { TerminalModeBanner } from './TerminalModeBanner';
import { WorkspaceNotice } from './WorkspaceNotice';
import { providerMeta } from '../providers/meta';
import MessageList from './MessageList';
import useCodexStream from '../hooks/useCodexStream';
import useClaudeStream from '../hooks/useClaudeStream';
import { type Provider } from '../types';
import { buildAttachmentsSection } from '../lib/attachments';
import { Workspace, Message } from '../types/chat';

declare const window: Window & {
  electronAPI: {
    codexCheckInstallation: () => Promise<{
      success: boolean;
      isInstalled?: boolean;
      error?: string;
    }>;
    codexCreateAgent: (
      workspaceId: string,
      worktreePath: string
    ) => Promise<{ success: boolean; agent?: any; error?: string }>;
    saveMessage: (message: any) => Promise<{ success: boolean; error?: string }>;
  };
};

interface Props {
  workspace: Workspace;
  projectName: string;
  className?: string;
  initialProvider?: Provider;
}

const ChatInterface: React.FC<Props> = ({ workspace, projectName, className, initialProvider }) => {
  const { toast } = useToast();
  const [inputValue, setInputValue] = useState('');
  const [isCodexInstalled, setIsCodexInstalled] = useState<boolean | null>(null);
  const [isClaudeInstalled, setIsClaudeInstalled] = useState<boolean | null>(null);
  const [claudeInstructions, setClaudeInstructions] = useState<string | null>(null);
  const [agentCreated, setAgentCreated] = useState(false);
  const [provider, setProvider] = useState<Provider>(initialProvider || 'codex');
  const [lockedProvider, setLockedProvider] = useState<Provider | null>(null);
  const [hasDroidActivity, setHasDroidActivity] = useState(false);
  const [hasGeminiActivity, setHasGeminiActivity] = useState(false);
  const [hasCursorActivity, setHasCursorActivity] = useState(false);
  const initializedConversationRef = useRef<string | null>(null);

  const codexStream = useCodexStream({
    workspaceId: workspace.id,
    workspacePath: workspace.path,
  });

  const claudeStream = useClaudeStream(
    provider === 'claude' ? { workspaceId: workspace.id, workspacePath: workspace.path } : null
  );
  const activeStream = provider === 'codex' ? codexStream : claudeStream;

  useEffect(() => {
    initializedConversationRef.current = null;
  }, [workspace.id]);

  // On workspace change, restore last-selected provider.
  // If a locked provider exists, prefer locked.
  // If initialProvider is provided, use it with remap to CLI variants.
  useEffect(() => {
    try {
      const lastKey = `provider:last:${workspace.id}`;
      const lockedKey = `provider:locked:${workspace.id}`;
      const last = window.localStorage.getItem(lastKey) as Provider | null;
      const locked = window.localStorage.getItem(lockedKey) as Provider | null;

      setLockedProvider(locked);
      setHasDroidActivity(locked === 'droid');
      setHasGeminiActivity(locked === 'gemini');
      setHasCursorActivity(locked === 'cursor');

      // Remap legacy chat-stream providers to CLI variants by default
      const remap = (p: Provider | null): Provider | null => {
        if (p === 'codex') return 'codex-cli';
        if (p === 'claude') return 'claude-cli';
        return p;
      };

      // Priority: initialProvider (remapped) > locked (remapped) > last (remapped) > default (codex-cli)
      if (initialProvider) {
        setProvider(remap(initialProvider) || 'codex-cli');
      } else if (locked === 'droid') {
        setProvider('droid');
      } else if (last === 'droid') {
        setProvider('droid');
      } else if (locked === 'gemini') {
        setProvider('gemini');
      } else if (last === 'gemini') {
        setProvider('gemini');
      } else if (locked === 'cursor') {
        setProvider('cursor');
      } else if (last === 'cursor') {
        setProvider('cursor');
      } else if (locked) {
        setProvider(remap(locked) || 'codex-cli');
      } else if (last) {
        setProvider(remap(last) || 'codex-cli');
      } else {
        setProvider('codex-cli');
      }
    } catch {
      setProvider((initialProvider && (initialProvider === 'codex' ? 'codex-cli' : initialProvider === 'claude' ? 'claude-cli' : initialProvider)) || 'codex-cli');
    }
  }, [workspace.id, initialProvider]);

  // Persist current + last-selected provider per workspace
  useEffect(() => {
    try {
      window.localStorage.setItem(`provider:last:${workspace.id}`, provider);
      window.localStorage.setItem(`provider:current:${workspace.id}`, provider);
    } catch {}
  }, [provider, workspace.id]);

  // When a chat becomes locked (first user message sent), persist the provider
  useEffect(() => {
    try {
      const userLocked =
        (provider === 'codex' || provider === 'claude') &&
        activeStream.messages &&
        activeStream.messages.some((m) => m.sender === 'user');

      if (userLocked) {
        window.localStorage.setItem(`provider:locked:${workspace.id}`, provider);
        setLockedProvider(provider);
      }
    } catch {}
  }, [
    provider,
    workspace.id,
    activeStream.messages,
    hasDroidActivity,
    hasGeminiActivity,
    hasCursorActivity,
  ]);

  // Check Claude Code installation when selected
  useEffect(() => {
    let cancelled = false;
    if (provider !== 'claude') {
      setIsClaudeInstalled(null);
      setClaudeInstructions(null);
      return;
    }
    (async () => {
      try {
        const res = await (window as any).electronAPI.agentCheckInstallation?.('claude');
        if (cancelled) return;
        if (res?.success) {
          setIsClaudeInstalled(!!res.isInstalled);
          if (!res.isInstalled) {
            const inst = await (window as any).electronAPI.agentGetInstallationInstructions?.(
              'claude'
            );
            setClaudeInstructions(
              inst?.instructions ||
                'Install: npm install -g @anthropic-ai/claude-code\nThen run: claude and use /login'
            );
          } else {
            setClaudeInstructions(null);
          }
        } else {
          setIsClaudeInstalled(false);
        }
      } catch {
        setIsClaudeInstalled(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [provider, workspace.id]);

  // When switching providers, ensure other streams are stopped
  useEffect(() => {
    (async () => {
      try {
        if (provider !== 'codex') await (window as any).electronAPI.codexStopStream?.(workspace.id);
        if (provider !== 'claude')
          await (window as any).electronAPI.agentStopStream?.({
            providerId: 'claude',
            workspaceId: workspace.id,
          });
      } catch {}
    })();
  }, [provider, workspace.id]);

  useEffect(() => {
    if (!codexStream.isReady) return;

    const convoId = codexStream.conversationId;
    if (!convoId) return;
    if (initializedConversationRef.current === convoId) return;

    initializedConversationRef.current = convoId;

    // Check if we need to add a welcome message
    // This runs when messages are loaded but could be empty or contain initial prompt
    const checkForWelcomeMessage = async () => {
      if (codexStream.messages.length === 0) {
        // Check database directly for any existing messages to see if there's an initial prompt
        try {
          const messagesResult = await window.electronAPI.getMessages(convoId);
          if (messagesResult.success && messagesResult.messages) {
            const hasInitialPrompt = messagesResult.messages.some((msg: any) => {
              try {
                const metadata = JSON.parse(msg.metadata || '{}');
                return metadata.isInitialPrompt;
              } catch {
                return false;
              }
            });

            // Only add welcome message if there's no initial prompt and no messages at all
            if (!hasInitialPrompt && messagesResult.messages.length === 0) {
              const welcomeMessage: Message = {
                id: `welcome-${Date.now()}`,
                content: `Hello! You're working in workspace **${workspace.name}**. What can the agent do for you?`,
                sender: 'agent',
                timestamp: new Date(),
              };

              await window.electronAPI.saveMessage({
                id: welcomeMessage.id,
                conversationId: convoId,
                content: welcomeMessage.content,
                sender: welcomeMessage.sender,
                metadata: JSON.stringify({ isWelcome: true }),
              });

              codexStream.appendMessage(welcomeMessage);
            }
          }
        } catch (error) {
          console.error('Failed to check for welcome message:', error);
        }
      }
    };

    checkForWelcomeMessage();
  }, [
    codexStream.isReady,
    codexStream.conversationId,
    codexStream.messages.length,
    codexStream.appendMessage,
    workspace.name,
  ]);

  useEffect(() => {
    const initializeCodex = async () => {
      try {
        const installResult = await window.electronAPI.codexCheckInstallation();
        if (installResult.success) {
          setIsCodexInstalled(installResult.isInstalled ?? false);

          if (installResult.isInstalled) {
            const agentResult = await window.electronAPI.codexCreateAgent(
              workspace.id,
              workspace.path
            );
            if (agentResult.success) {
              setAgentCreated(true);
              console.log('Codex agent created for workspace:', workspace.name);
            } else {
              console.error('Failed to create Codex agent:', agentResult.error);
              toast({
                title: 'Error',
                description: 'Failed to create Codex agent. Please try again.',
                variant: 'destructive',
              });
            }
          }
        } else {
          console.error('Failed to check Codex installation:', installResult.error);
        }
      } catch (error) {
        console.error('Error initializing Codex:', error);
      }
    };

    initializeCodex();
  }, [workspace.id, workspace.path, workspace.name, toast]);

  // Basic Claude installer check (optional UX). We'll rely on user to install as needed.
  // We still gate sending by agentCreated (workspace+conversation ready).

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    // Terminal-only providers: write into PTY instead of chat stream
    const isTerminalOnly =
      provider === 'droid' ||
      provider === 'gemini' ||
      provider === 'cursor' ||
      (provider as any) === 'warp' ||
      provider === 'codex-cli' ||
      provider === 'claude-cli';

    if (isTerminalOnly) {
      const ptyId =
        provider === 'droid'
          ? `droid-main-${workspace.id}`
          : provider === 'gemini'
            ? `gemini-main-${workspace.id}`
            : provider === 'cursor'
              ? `cursor-main-${workspace.id}`
              : (provider as any) === 'warp'
                ? `warp-main-${workspace.id}`
                : provider === 'codex-cli'
                  ? `codex-cli-main-${workspace.id}`
                  : `claude-cli-main-${workspace.id}`;

      try {
        // Send command into PTY: write text, then explicit CR to execute immediately
        const send = (d:string)=> (window as any).electronAPI.ptyInput({ id: ptyId, data: d });
        if (provider === 'claude-cli') {
          // Claude CLI: bracketed paste + single Enter (no double Enter)
          send('\x1b[200~' + inputValue + '\x1b[201~');
          send('\r');
        } else if (provider === 'codex-cli') {
          send('\x1b[200~' + inputValue + '\x1b[201~');
          send('\r');
        } else {
          send(inputValue);
          send('\r');
        }
        // Synthesize an Enter event for activity tracking
        window.dispatchEvent(
          new CustomEvent('pty:user-enter', { detail: { id: ptyId, ts: Date.now() } })
        );
        // Lock provider for this workspace
        window.localStorage.setItem(`provider:locked:${workspace.id}`, provider);
        setLockedProvider(provider);
      } catch (e) {
        console.error('Failed to write to PTY:', e);
      }
      setInputValue('');
      return;
    }

    if (provider === 'claude' && isClaudeInstalled === false) {
      toast({
        title: 'Claude Code not installed',
        description: 'Install Claude Code CLI and login first. See instructions below.',
        variant: 'destructive',
      });
      return;
    }

    const activeConversationId =
      provider === 'codex' ? codexStream.conversationId : claudeStream.conversationId;
    if (!activeConversationId) return;

    const attachmentsSection = await buildAttachmentsSection(workspace.path, inputValue, {
      maxFiles: 6,
      maxBytesPerFile: 200 * 1024,
    });

    const result =
      provider === 'codex'
        ? await codexStream.send(inputValue, attachmentsSection)
        : await claudeStream.send(inputValue, attachmentsSection);
    if (!result.success) {
      if (result.error && result.error !== 'stream-in-progress') {
        toast({
          title: 'Communication Error',
          description: 'Failed to start Codex stream. Please try again.',
          variant: 'destructive',
        });
      }
      return;
    }

    setInputValue('');
  };

  const handleCancelStream = async () => {
    if (!codexStream.isStreaming && !claudeStream.isStreaming) return;
    const result = provider === 'codex' ? await codexStream.cancel() : await claudeStream.cancel();
    if (!result.success) {
      toast({
        title: 'Cancel Failed',
        description: 'Unable to stop Codex stream. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const streamingOutputForList =
    activeStream.isStreaming || activeStream.streamingOutput ? activeStream.streamingOutput : null;
  // Allow switching providers freely while in Droid mode
  const providerLocked = lockedProvider !== null;

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-gray-800 ${className}`}>
      {provider === 'droid' || provider === 'gemini' || provider === 'cursor' || provider === 'codex-cli' || provider === 'claude-cli' ? (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-6 pt-4">
            <div className="max-w-4xl mx-auto">
              <TerminalModeBanner
                provider={provider as any}
                onOpenExternal={(url) => window.electronAPI.openExternal(url)}
              />
            </div>
          </div>
          <div className="px-6 mt-2">
            <div className="max-w-4xl mx-auto">
              <WorkspaceNotice workspaceName={workspace.name} />
            </div>
          </div>
          <div className="flex-1 min-h-0 px-6 mt-4">
            <div className="max-w-4xl mx-auto h-full rounded-md overflow-hidden">
              {provider === 'droid' ? (
                <TerminalPane
                  id={`droid-main-${workspace.id}`}
                  cwd={workspace.path}
                  shell={providerMeta.droid.cli}
                  keepAlive={true}
                  onActivity={() => {
                    try {
                      setHasDroidActivity(true);
                    } catch {}
                  }}
                  variant="light"
                  className="h-full w-full"
                />
              ) : provider === 'gemini' ? (
                <TerminalPane
                  id={`gemini-main-${workspace.id}`}
                  cwd={workspace.path}
                  shell={providerMeta.gemini.cli}
                  keepAlive={true}
                  onActivity={() => {
                    try {
                      setHasGeminiActivity(true);
                    } catch {}
                  }}
                  variant="light"
                  className="h-full w-full"
                />
              ) : provider === 'codex-cli' ? (
                <TerminalPane
                  id={`codex-cli-main-${workspace.id}`}
                  cwd={workspace.path}
                  shell={providerMeta['codex-cli']?.cli}
                  keepAlive={true}
                  logSession={false}
                  onActivity={() => {
                    try {
                      /* no-op lock on activity; lock occurs on first send */
                    } catch {}
                  }}
                  variant="light"
                  className="h-full w-full"
                />
              ) : provider === 'claude-cli' ? (
                <TerminalPane
                  id={`claude-cli-main-${workspace.id}`}
                  cwd={workspace.path}
                  shell={providerMeta['claude-cli']?.cli}
                  keepAlive={true}
                  logSession={false}
                  onActivity={() => {
                    try {
                      /* no-op lock on activity; lock occurs on first send */
                    } catch {}
                  }}
                  variant="light"
                  className="h-full w-full"
                />
              ) : (
                <TerminalPane
                  id={`cursor-main-${workspace.id}`}
                  cwd={workspace.path}
                  shell={providerMeta.cursor.cli}
                  keepAlive={true}
                  onActivity={() => {
                    try {
                      setHasCursorActivity(true);
                    } catch {}
                  }}
                  variant="light"
                  className="h-full w-full"
                />
              )}
            </div>
          </div>
        </div>
      ) : codexStream.isLoading ? (
        <div
          className="flex-1 overflow-y-auto px-6 pt-6 pb-2"
          style={{
            maskImage: 'linear-gradient(to bottom, black 0%, black 93%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 93%, transparent 100%)',
          }}
        >
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-500 dark:text-gray-400 text-sm font-sans">
                Loading conversation...
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {provider === 'claude' && isClaudeInstalled === false ? (
            <div className="px-6 pt-4">
              <div className="max-w-4xl mx-auto">
                <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 p-3 text-sm whitespace-pre-wrap">
                  {claudeInstructions ||
                    'Install Claude Code: npm install -g @anthropic-ai/claude-code\nThen run: claude and use /login'}
                </div>
              </div>
            </div>
          ) : null}
          <MessageList
            messages={activeStream.messages}
            streamingOutput={streamingOutputForList}
            isStreaming={activeStream.isStreaming}
            awaitingThinking={
              provider === 'codex' ? codexStream.awaitingThinking : claudeStream.awaitingThinking
            }
            providerId={provider === 'codex' ? 'codex' : 'claude'}
          />
        </>
      )}

      <ChatInput
        value={inputValue}
        onChange={setInputValue}
        onSend={handleSendMessage}
        onCancel={handleCancelStream}
        isLoading={
          provider === 'droid' || provider === 'gemini' || provider === 'cursor' || provider === 'codex-cli' || provider === 'claude-cli'
            ? false
            : activeStream.isStreaming
        }
        loadingSeconds={
          provider === 'droid' || provider === 'gemini' || provider === 'cursor' || provider === 'codex-cli' || provider === 'claude-cli'
            ? 0
            : activeStream.seconds
        }
        isCodexInstalled={isCodexInstalled}
        agentCreated={agentCreated}
        workspacePath={workspace.path}
        provider={provider}
        onProviderChange={(p) => setProvider(p)}
        selectDisabled={providerLocked}
        disabled={provider === 'claude' && isClaudeInstalled === false}
      />
    </div>
  );
};

export default ChatInterface;
