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
}

const ChatInterface: React.FC<Props> = ({ workspace, projectName, className }) => {
  const { toast } = useToast();
  const [inputValue, setInputValue] = useState('');
  const [isCodexInstalled, setIsCodexInstalled] = useState<boolean | null>(null);
  const [isClaudeInstalled, setIsClaudeInstalled] = useState<boolean | null>(null);
  const [claudeInstructions, setClaudeInstructions] = useState<string | null>(null);
  const [agentCreated, setAgentCreated] = useState(false);
  const [provider, setProvider] = useState<'codex' | 'claude' | 'droid' | 'gemini' | 'cursor' | 'warp'>(
    'codex'
  );
  const [lockedProvider, setLockedProvider] = useState<
    'codex' | 'claude' | 'droid' | 'gemini' | 'cursor' | 'warp' | null
  >(null);
  const [hasDroidActivity, setHasDroidActivity] = useState(false);
  const [hasGeminiActivity, setHasGeminiActivity] = useState(false);
  const [hasCursorActivity, setHasCursorActivity] = useState(false);
  const [hasWarpActivity, setHasWarpActivity] = useState(false);
  const [warpAvailable, setWarpAvailable] = useState<boolean | null>(null);
  const [warpCommand, setWarpCommand] = useState<string | null>(null);
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

  // On workspace change, restore last-selected provider (including Droid).
  // If a locked provider exists (including Droid), prefer locked.
  useEffect(() => {
    try {
      const lastKey = `provider:last:${workspace.id}`;
      const lockedKey = `provider:locked:${workspace.id}`;
      const last = window.localStorage.getItem(lastKey) as
        | 'codex'
        | 'claude'
        | 'droid'
        | 'gemini'
        | 'cursor'
        | 'warp'
        | null;
      const locked = window.localStorage.getItem(lockedKey) as
        | 'codex'
        | 'claude'
        | 'droid'
        | 'gemini'
        | 'cursor'
        | 'warp'
        | null;

      setLockedProvider(locked);
      setHasDroidActivity(locked === 'droid');
      setHasGeminiActivity(locked === 'gemini');
      setHasCursorActivity(locked === 'cursor');
      setHasWarpActivity(locked === 'warp');

      if (locked === 'droid') {
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
      } else if (locked === 'warp') {
        setProvider('warp');
      } else if (last === 'warp') {
        setProvider('warp');
      } else if (locked === 'codex' || locked === 'claude') {
        setProvider(locked);
      } else if (last === 'codex' || last === 'claude') {
        setProvider(last);
      } else {
        setProvider('codex');
      }
    } catch {
      setProvider('codex');
    }
  }, [workspace.id]);

  // Persist last-selected provider per workspace (including Droid)
  useEffect(() => {
    try {
      window.localStorage.setItem(`provider:last:${workspace.id}`, provider);
      window.localStorage.setItem(`provider:current:${workspace.id}`, provider);
    } catch {}
  }, [provider, workspace.id]);

  // Check Warp CLI availability when provider is warp
  useEffect(() => {
    let cancelled = false;
    if (provider !== 'warp') {
      setWarpAvailable(null);
      setWarpCommand(null);
      return;
    }
    (async () => {
      try {
        // Prefer CLI-only binaries first to avoid launching the GUI app
        const res = await (window as any).electronAPI.cliWhich([
          'warp-cli',
          'warp-terminal',
          'warp-cli-preview',
          'warp-terminal-preview',
          'warp',
          'warp-preview',
        ]);
        if (!cancelled) {
          setWarpAvailable(!!res?.found);
          setWarpCommand(res?.found || null);
        }
      } catch {
        if (!cancelled) {
          setWarpAvailable(false);
          setWarpCommand(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [provider]);

  // Auto-run a safe Warp CLI command when Warp mode is selected
  useEffect(() => {
    if (provider !== 'warp') return;
    const id = `warp-main-${workspace.id}`;
    const ranKey = `warp:intro:ran:${workspace.id}`;
    const t = setTimeout(() => {
      try {
        const already = window.localStorage.getItem(ranKey);
        if (!already) {
          if (warpAvailable && warpCommand) {
            // Run a safe help command rather than launching the GUI app
            (window as any).electronAPI.ptyInput({ id, data: `${warpCommand} help\n` });
          } else {
            (window as any).electronAPI.ptyInput({
              id,
              data: 'echo "Warp CLI not found. See docs: https://docs.warp.dev/developers/cli"\n',
            });
          }
          window.localStorage.setItem(ranKey, '1');
        }
      } catch {}
    }, 550);
    return () => clearTimeout(t);
  }, [provider, workspace.id, warpAvailable, warpCommand]);

  // When a chat becomes locked (first user message sent or terminal activity), persist the provider
  useEffect(() => {
    try {
      const userLocked =
        provider !== 'droid' &&
        provider !== 'gemini' &&
        provider !== 'cursor' &&
        provider !== 'warp' &&
        activeStream.messages &&
        activeStream.messages.some((m) => m.sender === 'user');
      const droidLocked = provider === 'droid' && hasDroidActivity;
      const geminiLocked = provider === 'gemini' && hasGeminiActivity;
      const cursorLocked = provider === 'cursor' && hasCursorActivity;
      const warpLocked = provider === 'warp' && hasWarpActivity;

      if (userLocked || droidLocked || geminiLocked || cursorLocked || warpLocked) {
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
    hasWarpActivity,
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

    if (codexStream.messages.length === 0) {
      const welcomeMessage: Message = {
        id: `welcome-${Date.now()}`,
        content: `Hello! You're working in workspace **${workspace.name}**. What can the agent do for you?`,
        sender: 'agent',
        timestamp: new Date(),
      };

      window.electronAPI
        .saveMessage({
          id: welcomeMessage.id,
          conversationId: convoId,
          content: welcomeMessage.content,
          sender: welcomeMessage.sender,
          metadata: JSON.stringify({ isWelcome: true }),
        })
        .catch((error: unknown) => {
          console.error('Failed to save welcome message:', error);
        })
        .finally(() => {
          codexStream.appendMessage(welcomeMessage);
        });
    }
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
      {provider === 'droid' || provider === 'gemini' || provider === 'cursor' || provider === 'warp' ? (
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
          {provider === 'warp' && warpAvailable === false ? (
            <div className="px-6 mt-2">
              <div className="max-w-4xl mx-auto">
                <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 p-3 text-sm">
                  Warp CLI was not found on your PATH. Install it and then reselect Warp:
                  <div className="mt-2 text-gray-800">
                    - macOS: <code class="px-1 py-0.5 bg-white/60 rounded">brew install --cask warp</code>
                  </div>
                  <div className="text-gray-800">
                    - Standalone CLI (macOS): <code class="px-1 py-0.5 bg-white/60 rounded">brew tap warpdotdev/warp &amp;&amp; brew install --cask warp-cli</code>
                  </div>
                  <div className="text-gray-800">
                    - Linux: install <code class="px-1 py-0.5 bg-white/60 rounded">warp-terminal</code> via your package manager
                  </div>
                  <button
                    type="button"
                    onClick={() => window.electronAPI.openExternal('https://docs.warp.dev/developers/cli')}
                    className="mt-2 underline"
                  >
                    https://docs.warp.dev/developers/cli
                  </button>
                </div>
              </div>
            </div>
          ) : null}
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
                      window.localStorage.setItem(`provider:locked:${workspace.id}`, 'droid');
                      setLockedProvider('droid');
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
                      window.localStorage.setItem(`provider:locked:${workspace.id}`, 'gemini');
                      setLockedProvider('gemini');
                    } catch {}
                  }}
                  variant="light"
                  className="h-full w-full"
                />
              ) : provider === 'warp' ? (
                <TerminalPane
                  id={`warp-main-${workspace.id}`}
                  cwd={workspace.path}
                  shell={undefined}
                  keepAlive={true}
                  onActivity={() => {
                    try {
                      window.localStorage.setItem(`provider:locked:${workspace.id}`, 'warp');
                      setLockedProvider('warp');
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
                      window.localStorage.setItem(`provider:locked:${workspace.id}`, 'cursor');
                      setLockedProvider('cursor');
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
          provider === 'droid' || provider === 'gemini' || provider === 'cursor' || provider === 'warp'
            ? false
            : activeStream.isStreaming
        }
        loadingSeconds={
          provider === 'droid' || provider === 'gemini' || provider === 'cursor' || provider === 'warp'
            ? 0
            : activeStream.seconds
        }
        isCodexInstalled={isCodexInstalled}
        agentCreated={agentCreated}
        workspacePath={workspace.path}
        provider={provider}
        onProviderChange={(p) => setProvider(p)}
        selectDisabled={providerLocked}
        disabled={
          provider === 'droid' ||
          provider === 'gemini' ||
          provider === 'cursor' ||
          provider === 'warp' ||
          (provider === 'claude' && isClaudeInstalled === false)
        }
      />
    </div>
  );
};

export default ChatInterface;
