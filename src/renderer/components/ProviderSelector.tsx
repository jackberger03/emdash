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
import warpLogo from '../../assets/images/warp.png';

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
  warp: {
    name: 'Warp',
    logo: warpLogo,
    alt: 'Warp CLI',
  },
} as const;

export const ProviderSelector: React.FC<ProviderSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  className = '',
}) => {
  const [isSelectOpen, setIsSelectOpen] = useState(false);

  const currentProvider = providerConfig[value];

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
          <SelectTrigger className="h-9 bg-gray-100 dark:bg-gray-700 border-none">
            <div className="flex items-center gap-2">
              <img
                src={currentProvider.logo}
                alt={currentProvider.alt}
                className="w-4 h-4 shrink-0"
              />
              <SelectValue placeholder="Select provider" />
            </div>
            <ChevronUp
              className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${
                isSelectOpen ? 'rotate-180' : ''
              }`}
            />
          </SelectTrigger>
        )}
        <SelectContent>
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
