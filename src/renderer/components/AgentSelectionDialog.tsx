import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import type { Provider } from '../types';
import openaiLogo from '../../assets/images/openai.png';
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

interface AgentSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (provider: Provider) => void;
  prNumber: number;
}

const providerConfig: Record<Provider, { name: string; logo: string }> = {
  codex: { name: 'Codex', logo: openaiLogo },
  qwen: { name: 'Qwen Code', logo: qwenLogo },
  claude: { name: 'Claude Code', logo: claudeLogo },
  droid: { name: 'Droid', logo: factoryLogo },
  gemini: { name: 'Gemini', logo: geminiLogo },
  cursor: { name: 'Cursor', logo: cursorLogo },
  copilot: { name: 'Copilot', logo: copilotLogo },
  amp: { name: 'Amp', logo: ampLogo },
  opencode: { name: 'OpenCode', logo: opencodeLogo },
  charm: { name: 'Charm', logo: charmLogo },
  auggie: { name: 'Auggie', logo: augmentLogo },
};

const AgentSelectionDialog: React.FC<AgentSelectionDialogProps> = ({
  isOpen,
  onClose,
  onSelect,
  prNumber,
}) => {
  const [selectedProvider, setSelectedProvider] = React.useState<Provider>('codex');

  const providers: Provider[] = [
    'codex',
    'claude',
    'qwen',
    'droid',
    'gemini',
    'cursor',
    'copilot',
    'amp',
    'opencode',
    'charm',
    'auggie',
  ];

  const handleSelect = () => {
    onSelect(selectedProvider);
    onClose();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Select Agent for PR #{prNumber}</AlertDialogTitle>
          <AlertDialogDescription>
            Choose which agent to use for this pull request workspace
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid grid-cols-2 gap-3 py-4 sm:grid-cols-3">
          {providers.map((provider) => {
            const config = providerConfig[provider];
            const isSelected = selectedProvider === provider;
            return (
              <button
                key={provider}
                onClick={() => setSelectedProvider(provider)}
                className={[
                  'flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all',
                  'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isSelected ? 'border-primary bg-primary/10' : 'border-border bg-background',
                ].join(' ')}
              >
                <img src={config.logo} alt={config.name} className="h-12 w-12 object-contain" />
                <span className="text-sm font-medium">{config.name}</span>
              </button>
            );
          })}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleSelect}>Open in Workspace</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default AgentSelectionDialog;
