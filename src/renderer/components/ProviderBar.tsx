import React from 'react';
import { type Provider } from '../types';
import { type LinearIssueSummary } from '../types/linear';
import openaiLogo from '../../assets/images/openai.png';
import linearLogo from '../../assets/images/linear.png';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import claudeLogo from '../../assets/images/claude.png';
import factoryLogo from '../../assets/images/factorydroid.png';
import geminiLogo from '../../assets/images/gemini.png';
import cursorLogo from '../../assets/images/cursorlogo.png';
import copilotLogo from '../../assets/images/ghcopilot.png';
import ampLogo from '../../assets/images/ampcode.png';
import opencodeLogo from '../../assets/images/opencode.png';
import aiderLogo from '../../assets/images/aider.png';

type Props = { provider: Provider; linearIssue?: LinearIssueSummary | null };

export const ProviderBar: React.FC<Props> = ({ provider, linearIssue }) => {
  const map = {
    codex: { name: 'Codex', logo: openaiLogo },
    claude: { name: 'Claude Code', logo: claudeLogo },
    droid: { name: 'Droid', logo: factoryLogo },
    gemini: { name: 'Gemini', logo: geminiLogo },
    cursor: { name: 'Cursor', logo: cursorLogo },
    copilot: { name: 'Copilot', logo: copilotLogo },
    amp: { name: 'Amp', logo: ampLogo },
    opencode: { name: 'OpenCode', logo: opencodeLogo },
    aider: { name: 'Aider', logo: aiderLogo },
  } as const;
  const cfg = map[provider] ?? { name: provider, logo: '' };
  return (
    <div className="px-6 pt-4 pb-6">
      <div className="max-w-4xl mx-auto">
        <div className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg">
          <div className="flex items-center px-4 py-3 rounded-md">
            <div className="flex items-center gap-3">
              <TooltipProvider delayDuration={250}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="h-7 inline-flex items-center gap-1.5 px-2 rounded-md bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-700 text-xs text-foreground cursor-default select-none"
                      role="button"
                      aria-disabled
                      title={cfg.name}
                    >
                      {cfg.logo ? (
                        <img
                          src={cfg.logo}
                          alt={cfg.name}
                          title={cfg.name}
                          className="w-3.5 h-3.5 object-contain align-middle flex-shrink-0"
                        />
                      ) : (
                        <div
                          className="w-3.5 h-3.5 rounded-[3px] bg-gray-300 dark:bg-gray-600 text-[9px] text-gray-700 dark:text-gray-200 flex items-center justify-center flex-shrink-0"
                          aria-hidden
                        >
                          {cfg.name.slice(0, 1)}
                        </div>
                      )}
                      <span className="font-medium truncate max-w-[12rem]">{cfg.name}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Provider is locked for this conversation.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {linearIssue ? (
                <TooltipProvider delayDuration={250}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="h-7 inline-flex items-center gap-1.5 px-2 rounded-md bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-700 text-xs text-foreground"
                        title={`${linearIssue.identifier} — ${linearIssue.title || ''}`}
                        onClick={() => {
                          try {
                            if (linearIssue.url)
                              (window as any).electronAPI?.openExternal?.(linearIssue.url);
                          } catch {}
                        }}
                      >
                        <img src={linearLogo} alt="Linear" className="w-3.5 h-3.5" />
                        <span className="font-medium">{linearIssue.identifier}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs bg-white dark:bg-gray-800">
                      <div className="text-xs">
                        <div className="font-medium text-foreground mb-1">
                          {linearIssue.identifier} — {linearIssue.title}
                        </div>
                        <div className="text-muted-foreground space-y-0.5">
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
                            <div className="truncate">
                              <span className="font-medium">URL:</span> {linearIssue.url}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProviderBar;
