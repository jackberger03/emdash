import React, { useMemo, useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import IntegrationRow from './IntegrationRow';
import {
  CliProviderStatus,
  ProviderConfig,
  ClaudeConfig,
  CodexConfig,
  DroidConfig,
  AmpConfig,
} from '../types/connections';
import { Button } from './ui/button';
import codexLogo from '../../assets/images/openai.png';
import claudeLogo from '../../assets/images/claude.png';
import droidLogo from '../../assets/images/factorydroid.png';
import geminiLogo from '../../assets/images/gemini.png';
import cursorLogo from '../../assets/images/cursorlogo.png';
import copilotLogo from '../../assets/images/ghcopilot.png';
import ampLogo from '../../assets/images/ampcode.png';
import opencodeLogo from '../../assets/images/opencode.png';
import charmLogo from '../../assets/images/charm.png';
import augmentLogo from '../../assets/images/augmentcode.png';
import qwenLogo from '../../assets/images/qwen.png';

interface CliProvidersListProps {
  providers: CliProviderStatus[];
  isLoading: boolean;
  error?: string | null;
}

const PROVIDER_CONFIG_KEY = 'emdash.providerConfig';

export const BASE_CLI_PROVIDERS: CliProviderStatus[] = [
  { id: 'codex', name: 'Codex', status: 'missing', docUrl: 'https://github.com/openai/codex' },
  {
    id: 'claude',
    name: 'Claude Code',
    status: 'missing',
    docUrl: 'https://docs.anthropic.com/claude/docs/claude-code',
  },
  {
    id: 'cursor',
    name: 'Cursor',
    status: 'missing',
    docUrl: 'https://cursor.sh',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    status: 'missing',
    docUrl: 'https://github.com/google-gemini/gemini-cli',
  },
  {
    id: 'droid',
    name: 'Droid',
    status: 'missing',
    docUrl: 'https://docs.factory.ai/cli/getting-started/quickstart',
  },
  {
    id: 'amp',
    name: 'Amp',
    status: 'missing',
    docUrl: 'https://ampcode.com/manual#install',
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    status: 'missing',
    docUrl: 'https://opencode.ai/docs/cli/',
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot',
    status: 'missing',
    docUrl: 'https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli',
  },
  {
    id: 'charm',
    name: 'Charm',
    status: 'missing',
    docUrl: 'https://github.com/charmbracelet/crush',
  },
  {
    id: 'auggie',
    name: 'Auggie',
    status: 'missing',
    docUrl: 'https://docs.augmentcode.com/cli/overview',
  },
  {
    id: 'qwen',
    name: 'Qwen Code',
    status: 'missing',
    docUrl: 'https://github.com/QwenLM/qwen-code',
  },
];

const PROVIDER_LOGOS: Record<string, string> = {
  codex: codexLogo,
  claude: claudeLogo,
  droid: droidLogo,
  gemini: geminiLogo,
  cursor: cursorLogo,
  copilot: copilotLogo,
  amp: ampLogo,
  opencode: opencodeLogo,
  charm: charmLogo,
  auggie: augmentLogo,
  qwen: qwenLogo,
};

const renderProviderRow = (
  provider: CliProviderStatus,
  config: ProviderConfig,
  onConfigChange: (
    providerId: string,
    configUpdate: Partial<ClaudeConfig | CodexConfig | DroidConfig | AmpConfig>
  ) => void
) => {
  const logo = PROVIDER_LOGOS[provider.id];

  const handleNameClick =
    provider.docUrl && window?.electronAPI?.openExternal
      ? async () => {
          try {
            await window.electronAPI.openExternal(provider.docUrl!);
          } catch (openError) {
            console.error(`Failed to open ${provider.name} docs:`, openError);
          }
        }
      : undefined;

  const isDetected = provider.status === 'connected';
  const indicatorClass = isDetected ? 'bg-emerald-500' : 'bg-muted-foreground/50';
  const statusLabel = isDetected ? 'Detected' : 'Not detected';

  const renderConfigOptions = () => {
    if (!isDetected) return null;

    // Define which providers support skip permissions
    const supportedProviders = ['claude', 'codex', 'droid', 'amp'];
    if (!supportedProviders.includes(provider.id)) return null;

    const providerConfig = config[provider.id as keyof ProviderConfig] || {};
    const isEnabled = (providerConfig as any)?.skipPermissions || false;

    // Map provider to their specific flag
    const flagMap: Record<string, string> = {
      claude: '--dangerously-skip-permissions',
      codex: '--yolo',
      droid: '--skip-permissions-unsafe',
      amp: '--dangerously-allow-all',
    };

    const flag = flagMap[provider.id] || '';

    return (
      <div className="ml-12 mr-4 py-2">
        <Button
          variant={isEnabled ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            onConfigChange(provider.id, { skipPermissions: !isEnabled } as any);
          }}
          className="h-8 w-full justify-start text-xs"
        >
          {isEnabled ? '✓ ' : ''}Skip Permissions
        </Button>
        <p className="mt-1 text-[10px] text-muted-foreground">
          {isEnabled ? `Enabled: ${flag}` : `Auto-approve all operations (${flag})`}
        </p>
      </div>
    );
  };

  return (
    <div key={provider.id} className="space-y-2">
      <IntegrationRow
        logoSrc={logo}
        icon={
          logo ? undefined : (
            <Sparkles className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          )
        }
        name={provider.name}
        onNameClick={handleNameClick}
        status={provider.status}
        statusLabel={statusLabel}
        showStatusPill={false}
        middle={
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className={`h-1.5 w-1.5 rounded-full ${indicatorClass}`} />
            {statusLabel}
          </span>
        }
      />
      {renderConfigOptions()}
    </div>
  );
};

const CliProvidersList: React.FC<CliProvidersListProps> = ({ providers, isLoading, error }) => {
  const [config, setConfig] = useState<ProviderConfig>({});

  // Load saved config from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PROVIDER_CONFIG_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setConfig(parsed);
      }
    } catch (err) {
      console.error('Failed to load provider config:', err);
    }
  }, []);

  const handleConfigChange = (
    providerId: string,
    configUpdate: Partial<ClaudeConfig | CodexConfig | DroidConfig | AmpConfig>
  ) => {
    const updated = {
      ...config,
      [providerId]: { ...config[providerId as keyof ProviderConfig], ...configUpdate },
    };
    setConfig(updated);

    // Save to localStorage
    try {
      localStorage.setItem(PROVIDER_CONFIG_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to save provider config:', err);
    }
  };

  const sortedProviders = useMemo(() => {
    const source = providers.length ? providers : BASE_CLI_PROVIDERS;
    return [...source].sort((a, b) => {
      if (a.status === 'connected' && b.status !== 'connected') return -1;
      if (b.status === 'connected' && a.status !== 'connected') return 1;
      return a.name.localeCompare(b.name);
    });
  }, [providers]);

  return (
    <div className="space-y-3">
      {error ? (
        <div className="rounded-md border border-red-200/70 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:border-red-500/40 dark:text-red-400">
          {error}
        </div>
      ) : null}

      <div className="space-y-2">
        {sortedProviders.map((provider) => renderProviderRow(provider, config, handleConfigChange))}
      </div>
    </div>
  );
};

export default CliProvidersList;
