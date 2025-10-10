import React from 'react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectItemText,
} from './ui/select';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import { type Provider } from '../types';
import openaiLogo from '../../assets/images/openai.png';
import claudeLogo from '../../assets/images/claude.png';
import factoryLogo from '../../assets/images/factorydroid.png';
import geminiLogo from '../../assets/images/gemini.png';
import cursorLogo from '../../assets/images/cursorlogo.png';
import copilotLogo from '../../assets/images/ghcopilot.png';
import ampLogo from '../../assets/images/ampcode.png';
import opencodeLogo from '../../assets/images/opencode.png';
import aiderLogo from '../../assets/images/aider.png';

interface ProviderSelectorProps {
  value: Provider;
  onChange: (provider: Provider) => void;
  disabled?: boolean;
  className?: string;
}

const providerConfig = {
  codex: {
    name: 'Codex',
    logo: openaiLogo,
    alt: 'Codex',
  },
  claude: {
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
  copilot: {
    name: 'Copilot',
    logo: copilotLogo,
    alt: 'GitHub Copilot CLI',
  },
  amp: {
    name: 'Amp',
    logo: ampLogo,
    alt: 'Amp CLI',
  },
  opencode: {
    name: 'OpenCode',
    logo: opencodeLogo,
    alt: 'OpenCode CLI',
  },
  aider: {
    name: 'Aider',
    logo: aiderLogo,
    alt: 'Aider CLI',
  },
} as const;

export const ProviderSelector: React.FC<ProviderSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  className = '',
}) => {
  const currentProvider = providerConfig[value];

  return (
    <div className={`relative block min-w-0 w-[12rem] ${className}`}>
      <Select
        value={value}
        onValueChange={(v) => {
          if (!disabled) {
            onChange(v as Provider);
          }
        }}
        disabled={disabled}
      >
        {disabled ? (
          <TooltipProvider delayDuration={250}>
            <Tooltip>
              <TooltipTrigger asChild>
                <SelectTrigger
                  aria-disabled
                  className={`h-9 w-full bg-gray-100 dark:bg-gray-700 border-none ${
                    disabled ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                >
                  <div className="flex w-full items-center gap-2 min-w-0 overflow-hidden">
                    <img
                      src={currentProvider.logo}
                      alt={currentProvider.alt}
                      className="w-4 h-4 shrink-0"
                    />
                    <SelectValue placeholder="Select provider" />
                  </div>
                </SelectTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>Provider is locked for this conversation.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <SelectTrigger className="h-9 w-full bg-gray-100 dark:bg-gray-700 border-none">
            <div className="flex w-full items-center gap-2 min-w-0 overflow-hidden">
              <img
                src={currentProvider.logo}
                alt={currentProvider.alt}
                className="w-4 h-4 shrink-0"
              />
              <SelectValue placeholder="Select provider" />
            </div>
          </SelectTrigger>
        )}
        <SelectContent side="top">
          {Object.entries(providerConfig).map(([key, config]) => (
            <SelectItem key={key} value={key}>
              <div className="flex items-center gap-2">
                <img src={config.logo} alt={config.alt} className="w-4 h-4" />
                <SelectItemText>{config.name}</SelectItemText>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default ProviderSelector;
