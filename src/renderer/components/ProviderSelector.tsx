import React, { useState } from 'react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectItemText,
} from './ui/select';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import { ChevronUp } from 'lucide-react';
import { type Provider } from '../types';
import openaiLogo from '../../assets/images/openai.png';
import claudeLogo from '../../assets/images/claude.png';
import factoryLogo from '../../assets/images/factorydroid.png';
import geminiLogo from '../../assets/images/gemini.png';
import cursorLogo from '../../assets/images/cursorlogo.png';

interface ProviderSelectorProps {
  value: Provider;
  onChange: (provider: Provider) => void;
  disabled?: boolean;
  className?: string;
}

type ProviderConfig = { name: string; logo: string; alt: string };

const providerConfig: Partial<Record<Provider, ProviderConfig>> = {
  codex: {
    name: 'Codex',
    logo: openaiLogo,
    alt: 'Codex',
  },
  'codex-cli': {
    name: 'Codex',
    logo: openaiLogo,
    alt: 'Codex',
  },
  claude: {
    name: 'Claude Code (Legacy)',
    logo: claudeLogo,
    alt: 'Claude Code',
  },
  'claude-cli': {
    name: 'Claude Code',
    logo: claudeLogo,
    alt: 'Claude Code',
  },
  droid: {
    name: 'Droid',
    logo: factoryLogo,
    alt: 'Factory Droid',
  },
  gemini: {
    name: 'Gemini',
    logo: geminiLogo,
    alt: 'Gemini CLI',
  },
  cursor: {
    name: 'Cursor',
    logo: cursorLogo,
    alt: 'Cursor CLI',
  },
} as const;

function displayNameFor(p: Provider): string {
  switch (p) {
    case 'codex-cli':
      return 'Codex Code';
    case 'claude-cli':
      return 'Claude Code';
    case 'warp':
      return 'Warp';
    case 'droid':
      return 'Droid';
    case 'gemini':
      return 'Gemini';
    case 'cursor':
      return 'Cursor';
    case 'codex':
      return 'Codex (Legacy)';
    case 'claude':
      return 'Claude Code (Legacy)';
    default:
      return String(p);
  }
}

export const ProviderSelector: React.FC<ProviderSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  className = '',
}) => {
  const [isSelectOpen, setIsSelectOpen] = useState(false);

  const currentProvider: ProviderConfig =
    providerConfig[value] || ({
      name: displayNameFor(value),
      logo: openaiLogo,
      alt: displayNameFor(value),
    } as ProviderConfig);

  return (
    <div className={`relative inline-block w-[12rem] ${className}`}>
      <Select
        value={value}
        onValueChange={(v) => {
          if (!disabled) {
            onChange(v as Provider);
          }
        }}
        onOpenChange={setIsSelectOpen}
        disabled={disabled}
      >
        {disabled ? (
          <TooltipProvider delayDuration={250}>
            <Tooltip>
              <TooltipTrigger asChild>
                <SelectTrigger
                  aria-disabled
                  className={`h-9 bg-gray-100 dark:bg-gray-700 border-none ${
                    disabled ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <img
                      src={currentProvider.logo}
                      alt={currentProvider.alt}
                      className="w-4 h-4 shrink-0"
                    />
                    <span className="text-sm">{currentProvider?.name ?? 'Select provider'}</span>
                  </div>
                </SelectTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>Provider is locked for this conversation.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <SelectTrigger className="h-9 bg-gray-100 dark:bg-gray-700 border-none">
            <div className="flex items-center gap-2">
              <img
                src={currentProvider.logo}
                alt={currentProvider.alt}
                className="w-4 h-4 shrink-0"
              />
              <span className="text-sm">{currentProvider?.name ?? 'Select provider'}</span>
            </div>
            <ChevronUp
              className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${
                isSelectOpen ? 'rotate-180' : ''
              }`}
            />
          </SelectTrigger>
        )}
        <SelectContent>
          {Object.entries(providerConfig)
            // Hide legacy chat-stream providers from selection, but keep them renderable if already selected
            .filter(([key, cfg]) => key !== 'codex' && key !== 'claude' && !!cfg)
            .map(([key, cfg]) => {
              const config = cfg as ProviderConfig;
              return (
            <SelectItem key={key} value={key}>
              <div className="flex items-center gap-2">
                <img src={config.logo} alt={config.alt} className="w-4 h-4" />
                <SelectItemText>{config.name}</SelectItemText>
              </div>
            </SelectItem>
            );
            })}
        </SelectContent>
      </Select>
    </div>
  );
};

export default ProviderSelector;
