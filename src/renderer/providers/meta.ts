export type UiProvider =
  | 'codex'
  | 'claude'
  | 'droid'
  | 'gemini'
  | 'cursor'
  | 'warp'
  | 'codex-cli'
  | 'claude-cli';

export type ProviderMeta = {
  label: string;
  icon?: string; // import path to image asset
  terminalOnly: boolean;
  cli?: string; // command to launch in TerminalPane, for terminal-only providers
  helpUrl?: string; // docs link for terminal-only providers
};

export const providerMeta: Record<UiProvider, ProviderMeta> = {
  codex: {
    label: 'Codex',
    icon: '../../assets/images/openai.png',
    terminalOnly: false,
  },
  claude: {
    label: 'Claude Code',
    icon: '../../assets/images/claude.png',
    terminalOnly: false,
  },
  'claude-cli': {
    label: 'Claude (CLI)',
    icon: '../../assets/images/claude.png',
    terminalOnly: true,
    cli: 'claude',
    helpUrl: 'https://www.npmjs.com/package/@anthropic-ai/claude-code',
  },
  droid: {
    label: 'Droid',
    icon: '../../assets/images/factorydroid.png',
    terminalOnly: true,
    cli: 'droid',
    helpUrl: 'https://docs.factory.ai/cli/getting-started/quickstart',
  },
  gemini: {
    label: 'Gemini',
    icon: '../../assets/images/gemini.png',
    terminalOnly: true,
    cli: 'gemini',
    helpUrl: 'https://github.com/google-gemini/gemini-cli',
  },
  cursor: {
    label: 'Cursor',
    icon: '../../assets/images/cursorlogo.png',
    terminalOnly: true,
    cli: 'cursor-agent',
    helpUrl: 'https://cursor.com/install',
  },
  warp: {
    label: 'Warp',
    icon: '../../assets/images/warp.png',
    terminalOnly: true,
    cli: 'warp',
    helpUrl: 'https://docs.warp.dev/developers/cli',
  },
  'codex-cli': {
    label: 'Codex (CLI)',
    icon: '../../assets/images/openai.png',
    terminalOnly: true,
    cli: 'codex',
    helpUrl: 'https://github.com/openai/codex',
  },
};
