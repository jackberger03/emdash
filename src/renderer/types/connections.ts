export type CliStatusCode = 'connected' | 'missing' | 'needs_key' | 'error';

export interface ClaudeConfig {
  skipPermissions?: boolean;
}

export interface CodexConfig {
  skipPermissions?: boolean;
}

export interface DroidConfig {
  skipPermissions?: boolean;
}

export interface AmpConfig {
  skipPermissions?: boolean;
}

export interface ProviderConfig {
  claude?: ClaudeConfig;
  codex?: CodexConfig;
  droid?: DroidConfig;
  amp?: AmpConfig;
}

export interface CliProviderStatus {
  id: string;
  name: string;
  status: CliStatusCode;
  version?: string | null;
  message?: string | null;
  docUrl?: string | null;
  command?: string | null;
}
