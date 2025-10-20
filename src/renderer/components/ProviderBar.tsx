import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, ChevronDown, Terminal } from 'lucide-react';
import { type Provider } from '../types';
import { type LinearIssueSummary } from '../types/linear';
import { type GitHubIssueSummary } from '../types/github';
import { TerminalPane } from './TerminalPane';
import openaiLogo from '../../assets/images/openai.png';
import linearLogo from '../../assets/images/linear.png';
import githubLogo from '../../assets/images/github.png';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import claudeLogo from '../../assets/images/claude.png';
import factoryLogo from '../../assets/images/factorydroid.png';
import geminiLogo from '../../assets/images/gemini.png';
import cursorLogo from '../../assets/images/cursorlogo.png';
import copilotLogo from '../../assets/images/ghcopilot.png';
import ampLogo from '../../assets/images/ampcode.png';
import opencodeLogo from '../../assets/images/opencode.png';
import charmLogo from '../../assets/images/charm.png';
import qwenLogo from '../../assets/images/qwen.png';
import augmentLogo from '../../assets/images/augmentcode.png';
import { useTheme } from './ThemeProvider';

type Props = {
  provider: Provider;
  linearIssue?: LinearIssueSummary | null;
  githubIssue?: GitHubIssueSummary | null;
  onProviderChange?: (provider: Provider) => void;
  allowChange?: boolean;
  workspaceId?: string;
  workspacePath?: string;
  theme?: 'dark' | 'light';
  branch?: string;
};

export const ProviderBar: React.FC<Props> = ({
  provider,
  linearIssue,
  githubIssue,
  onProviderChange,
  allowChange = true,
  workspaceId,
  workspacePath,
  theme = 'dark',
  branch,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { effectiveTheme } = useTheme();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDropdown]);

  const map = {
    qwen: { name: 'Qwen Code', logo: qwenLogo },
    codex: { name: 'Codex', logo: openaiLogo },
    claude: { name: 'Claude Code', logo: claudeLogo },
    droid: { name: 'Droid', logo: factoryLogo },
    gemini: { name: 'Gemini', logo: geminiLogo },
    cursor: { name: 'Cursor', logo: cursorLogo },
    copilot: { name: 'Copilot', logo: copilotLogo },
    amp: { name: 'Amp', logo: ampLogo },
    opencode: { name: 'OpenCode', logo: opencodeLogo },
    charm: { name: 'Charm', logo: charmLogo },
    auggie: { name: 'Auggie', logo: augmentLogo },
  } as const;

  const allProviders: Provider[] = [
    'qwen',
    'codex',
    'claude',
    'droid',
    'gemini',
    'cursor',
    'copilot',
    'amp',
    'opencode',
    'charm',
    'auggie',
  ];

  const cfg = map[provider] ?? { name: provider, logo: '' };

  // Extract folder name from path
  const folderName = workspacePath
    ? workspacePath.split('/').filter(Boolean).pop() || workspacePath
    : '';

  const handleProviderSelect = (newProvider: Provider) => {
    setShowDropdown(false);
    if (onProviderChange && newProvider !== provider) {
      onProviderChange(newProvider);
    }
  };

  return (
    <div className="px-6 pb-6 pt-4">
      <div className="mx-auto max-w-4xl">
        <div
          ref={dropdownRef}
          className={`relative rounded-md border border-border bg-card shadow-lg transition-all duration-200 ${
            showTerminal ? 'h-64' : ''
          }`}
        >
          {/* Terminal Section - Always mounted but hidden when not visible to preserve state and keep PTY running */}
          {workspaceId && workspacePath && (
            <div
              className={`h-48 overflow-hidden border-b border-border p-3 ${
                showTerminal ? 'block' : 'hidden'
              }`}
            >
              <TerminalPane
                id={`${workspaceId}-provider-terminal`}
                cwd={workspacePath}
                variant={effectiveTheme === 'light' ? 'light' : 'dark'}
                className="h-full w-full"
                rows={10}
                keepAlive={true}
                themeOverride={
                  effectiveTheme === 'lightsout'
                    ? {
                        background: '#0a0a0a',
                        foreground: '#f2f2f2',
                        cursor: '#f2f2f2',
                        selectionBackground: '#f2f2f233',
                        // Lights out - very dark with white text
                        black: '#0a0a0a',
                        red: '#f2f2f2',
                        green: '#f2f2f2',
                        yellow: '#f2f2f2',
                        blue: '#f2f2f2',
                        magenta: '#f2f2f2',
                        cyan: '#f2f2f2',
                        white: '#f2f2f2',
                        brightBlack: '#f2f2f2',
                        brightRed: '#f2f2f2',
                        brightGreen: '#f2f2f2',
                        brightYellow: '#f2f2f2',
                        brightBlue: '#f2f2f2',
                        brightMagenta: '#f2f2f2',
                        brightCyan: '#f2f2f2',
                        brightWhite: '#f2f2f2',
                      }
                    : effectiveTheme === 'dark'
                      ? {
                          background: '#374151',
                          foreground: '#ffffff',
                          cursor: '#ffffff',
                          selectionBackground: '#ffffff33',
                          // Lighter gray background to contrast with card padding
                          black: '#374151',
                          red: '#ffffff',
                          green: '#ffffff',
                          yellow: '#ffffff',
                          blue: '#ffffff',
                          magenta: '#ffffff',
                          cyan: '#ffffff',
                          white: '#ffffff',
                          brightBlack: '#ffffff',
                          brightRed: '#ffffff',
                          brightGreen: '#ffffff',
                          brightYellow: '#ffffff',
                          brightBlue: '#ffffff',
                          brightMagenta: '#ffffff',
                          brightCyan: '#ffffff',
                          brightWhite: '#ffffff',
                        }
                      : undefined
                }
              />
            </div>
          )}

          <div className="flex items-center justify-between rounded-md px-4 py-3">
            <div className="flex items-center gap-3">
              <TooltipProvider delayDuration={250}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className={`inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-secondary px-2 text-xs text-foreground ${
                        allowChange && onProviderChange
                          ? 'cursor-pointer hover:bg-secondary/80'
                          : 'cursor-default'
                      }`}
                      onClick={() =>
                        allowChange && onProviderChange && setShowDropdown(!showDropdown)
                      }
                      disabled={!allowChange || !onProviderChange}
                      title={cfg.name}
                    >
                      {cfg.logo ? (
                        <img
                          src={cfg.logo}
                          alt={cfg.name}
                          title={cfg.name}
                          className="h-3.5 w-3.5 flex-shrink-0 rounded-sm object-contain align-middle"
                        />
                      ) : (
                        <div
                          className="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-[3px] bg-gray-300 text-[9px] text-gray-700 dark:bg-gray-600 dark:text-gray-200"
                          aria-hidden
                        >
                          {cfg.name.slice(0, 1)}
                        </div>
                      )}
                      <span className="max-w-[12rem] truncate font-medium">{cfg.name}</span>
                      {allowChange && onProviderChange && (
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {allowChange && onProviderChange
                        ? 'Click to switch provider'
                        : 'Provider is locked for this conversation.'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {showDropdown && allowChange && onProviderChange && (
                <div className="absolute bottom-full left-0 z-50 mb-1 w-48 rounded-md border border-border bg-card shadow-lg">
                  <div className="max-h-64 overflow-y-auto p-1">
                    {allProviders.map((p) => {
                      const providerConfig = map[p];
                      return (
                        <button
                          key={p}
                          type="button"
                          className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-muted ${
                            p === provider ? 'bg-muted' : ''
                          }`}
                          onClick={() => handleProviderSelect(p)}
                        >
                          {providerConfig.logo && (
                            <img
                              src={providerConfig.logo}
                              alt={providerConfig.name}
                              className="h-4 w-4 rounded object-contain"
                            />
                          )}
                          <span className="flex-1">{providerConfig.name}</span>
                          {p === provider && (
                            <span className="text-xs text-muted-foreground">✓</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {linearIssue ? (
                <TooltipProvider delayDuration={250}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-gray-200 bg-gray-100 px-2 text-xs text-foreground dark:border-gray-700 dark:bg-gray-700"
                        title={`${linearIssue.identifier} — ${linearIssue.title || ''}`}
                        onClick={() => {
                          try {
                            if (linearIssue.url)
                              (window as any).electronAPI?.openExternal?.(linearIssue.url);
                          } catch {}
                        }}
                      >
                        <img src={linearLogo} alt="Linear" className="h-3.5 w-3.5" />
                        <span className="font-medium">{linearIssue.identifier}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="bottom"
                      className="max-w-sm bg-white text-foreground dark:bg-gray-900 dark:text-foreground"
                    >
                      <div className="text-xs">
                        <div className="mb-1.5 flex min-w-0 items-center gap-2">
                          <span className="inline-flex shrink-0 items-center gap-1.5 rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 dark:border-gray-700 dark:bg-gray-800">
                            <img src={linearLogo} alt="Linear" className="h-3.5 w-3.5" />
                            <span className="text-[11px] font-medium text-foreground">
                              {linearIssue.identifier}
                            </span>
                          </span>
                          {linearIssue.title ? (
                            <span className="truncate text-foreground">{linearIssue.title}</span>
                          ) : null}
                        </div>
                        <div className="space-y-0.5 text-muted-foreground">
                          {linearIssue.state?.name ? (
                            <div>
                              <span className="font-medium">State:</span> {linearIssue.state?.name}
                            </div>
                          ) : null}
                          {linearIssue.assignee?.displayName || linearIssue.assignee?.name ? (
                            <div>
                              <span className="font-medium">Assignee:</span>{' '}
                              {linearIssue.assignee?.displayName || linearIssue.assignee?.name}
                            </div>
                          ) : null}
                          {linearIssue.team?.key ? (
                            <div>
                              <span className="font-medium">Team:</span> {linearIssue.team?.key}
                            </div>
                          ) : null}
                          {linearIssue.project?.name ? (
                            <div>
                              <span className="font-medium">Project:</span>{' '}
                              {linearIssue.project?.name}
                            </div>
                          ) : null}
                          {linearIssue.url ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium">Ticket:</span>
                              <a
                                href={linearIssue.url}
                                target="_blank"
                                rel="noreferrer"
                                title="Open in Linear"
                                className="inline-flex items-center rounded p-0.5 text-muted-foreground hover:text-foreground"
                                onClick={(e) => {
                                  e.preventDefault();
                                  try {
                                    (window as any).electronAPI?.openExternal?.(linearIssue.url!);
                                  } catch {}
                                }}
                              >
                                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                                <span className="sr-only">Open in Linear</span>
                              </a>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : null}

              {githubIssue ? (
                <TooltipProvider delayDuration={250}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-gray-200 bg-gray-100 px-2 text-xs text-foreground dark:border-gray-700 dark:bg-gray-700"
                        title={`#${githubIssue.number} — ${githubIssue.title || ''}`}
                        onClick={() => {
                          try {
                            if (githubIssue.url)
                              (window as any).electronAPI?.openExternal?.(githubIssue.url);
                          } catch {}
                        }}
                      >
                        <img src={githubLogo} alt="GitHub" className="h-3.5 w-3.5" />
                        <span className="font-medium">#{githubIssue.number}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="bottom"
                      className="max-w-sm bg-white text-foreground dark:bg-gray-900 dark:text-foreground"
                    >
                      <div className="text-xs">
                        <div className="mb-1.5 flex min-w-0 items-center gap-2">
                          <span className="inline-flex shrink-0 items-center gap-1.5 rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 dark:border-gray-700 dark:bg-gray-800">
                            <img src={githubLogo} alt="GitHub" className="h-3.5 w-3.5" />
                            <span className="text-[11px] font-medium text-foreground">
                              #{githubIssue.number}
                            </span>
                          </span>
                          {githubIssue.title ? (
                            <span className="truncate text-foreground">{githubIssue.title}</span>
                          ) : null}
                        </div>
                        <div className="space-y-0.5 text-muted-foreground">
                          {githubIssue.state ? (
                            <div>
                              <span className="font-medium">State:</span> {githubIssue.state}
                            </div>
                          ) : null}
                          {githubIssue.assignee?.login ? (
                            <div>
                              <span className="font-medium">Assignee:</span>{' '}
                              {githubIssue.assignee?.login}
                            </div>
                          ) : null}
                          {githubIssue.labels && githubIssue.labels.length > 0 ? (
                            <div>
                              <span className="font-medium">Labels:</span>{' '}
                              {githubIssue.labels.map((l) => l.name).join(', ')}
                            </div>
                          ) : null}
                          {githubIssue.milestone?.title ? (
                            <div>
                              <span className="font-medium">Milestone:</span>{' '}
                              {githubIssue.milestone?.title}
                            </div>
                          ) : null}
                          {githubIssue.url ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium">Issue:</span>
                              <a
                                href={githubIssue.url}
                                target="_blank"
                                rel="noreferrer"
                                title="Open on GitHub"
                                className="inline-flex items-center rounded p-0.5 text-muted-foreground hover:text-foreground"
                                onClick={(e) => {
                                  e.preventDefault();
                                  try {
                                    (window as any).electronAPI?.openExternal?.(githubIssue.url!);
                                  } catch {}
                                }}
                              >
                                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                                <span className="sr-only">Open on GitHub</span>
                              </a>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : null}
            </div>

            {/* Right side - Folder/Branch Info + Terminal Button */}
            <div className="flex items-center gap-3">
              {/* Folder and Branch Info */}
              {(folderName || branch) && (
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  {folderName && (
                    <span className="max-w-[200px] truncate font-medium" title={folderName}>
                      {folderName}
                    </span>
                  )}
                  {folderName && branch && <span className="flex-shrink-0">•</span>}
                  {branch && (
                    <span className="flex items-center gap-1">
                      <svg
                        className="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                        />
                      </svg>
                      <span className="font-medium">{branch}</span>
                    </span>
                  )}
                </div>
              )}

              {/* Terminal Toggle Button */}
              {workspaceId && workspacePath && (
                <TooltipProvider delayDuration={250}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs transition-colors ${
                          showTerminal
                            ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-950 dark:text-blue-300'
                            : 'border-border bg-secondary text-secondary-foreground hover:bg-secondary/80'
                        }`}
                        onClick={() => setShowTerminal(!showTerminal)}
                        title={showTerminal ? 'Hide Terminal' : 'Show Terminal'}
                      >
                        <Terminal className="h-3.5 w-3.5" />
                        <span className="font-medium">Terminal</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{showTerminal ? 'Hide Terminal' : 'Show Terminal'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProviderBar;
