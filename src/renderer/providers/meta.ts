export type UiProvider = 'codex' | 'claude' | 'droid' | 'gemini' | 'cursor';

export type ProviderMeta = {
  label: string;
  icon?: string; // import path to image asset
  terminalOnly: boolean;
  cli?: string; // command to launch in TerminalPane, for terminal-only providers
  helpUrl?: string; // docs link for terminal-only providers
};

export const providerMeta: Record<UiProvider | 'warp', ProviderMeta> = {
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
  // Note: extending with 'warp' here; UiProvider extended where consumed.
  warp: {
    label: 'Warp',
    icon: '../../assets/images/warp.png',
    terminalOnly: true,
    // Default to 'warp' command; users on Linux may have 'warp-cli' or 'warp-terminal'
    cli: 'warp',
    helpUrl: 'https://docs.warp.dev/developers/cli',
  },
};
