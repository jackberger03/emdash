import os from 'os';
import * as pty from 'node-pty';
import type { IPty } from 'node-pty';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';
import { createHash } from 'crypto';

export interface SSHConfig {
  host: string;
  user: string;
  remotePath: string;
  port?: number;
  keyPath?: string;
}

type PtyRecord = {
  id: string;
  proc: IPty;
  isSSH?: boolean;
  isTmux?: boolean;
  tmuxSession?: string;
  tmuxSocketPath?: string;
  tmuxBinary?: string;
};

const ptys = new Map<string, PtyRecord>();

type TmuxDetection = {
  available: boolean;
  binary?: string;
  version?: string;
  error?: string;
};

let cachedTmuxDetection: TmuxDetection | null = null;

function detectTmux(): TmuxDetection {
  if (cachedTmuxDetection) {
    return cachedTmuxDetection;
  }

  const preferred = process.env.EMDASH_TMUX_PATH || process.env.TMUX || undefined;
  const candidates = [preferred, '/opt/homebrew/bin/tmux', '/usr/local/bin/tmux', 'tmux'].filter(
    (v): v is string => !!v
  );

  for (const bin of candidates) {
    try {
      const res = spawnSync(bin, ['-V'], { encoding: 'utf8' });
      if (res.status === 0) {
        cachedTmuxDetection = {
          available: true,
          binary: bin,
          version: res.stdout.trim() || res.stderr.trim() || undefined,
        };
        return cachedTmuxDetection;
      }
    } catch (err: any) {
      // Keep searching other candidates but remember the failure
      cachedTmuxDetection = {
        available: false,
        binary: bin,
        error: err?.message || String(err),
      };
    }
  }

  cachedTmuxDetection = { available: false };
  return cachedTmuxDetection;
}

function buildTmuxIdentifiers(id: string): { session: string; socket: string } {
  const hash = createHash('sha1').update(id).digest('hex').slice(0, 12);
  const cleaned = id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const suffix = cleaned ? cleaned.slice(-12) : 'sess';
  const session = `emdash_${suffix}_${hash}`;
  const socket = `emdash-${hash}.sock`;
  return { session, socket };
}

function ensureSocketDir(): { dir: string; configPath: string } {
  const dir = join(os.tmpdir(), 'emdash-tmux');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const configPath = join(dir, 'tmux.conf');
  const lines = [`set-option -g status off`, `set-option -g set-titles on`, `set-option -g mouse off`];
  writeFileSync(configPath, lines.join('\n'), { encoding: 'utf8' });

  return { dir, configPath };
}

function parseCommand(input: string): { command: string; args: string[] } {
  const parts = input.match(/(?:[^\s"]+|"[^"]*")+?/g) || [input];
  const [command, ...rest] = parts;
  const args = rest.map((arg) => arg.replace(/^"(.*)"$/, '$1'));
  return { command, args };
}

function getDefaultShell(): string {
  if (process.platform === 'win32') {
    // Prefer ComSpec (usually cmd.exe) or fallback to PowerShell
    return process.env.ComSpec || 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
  }
  return process.env.SHELL || '/bin/bash';
}

function getDefaultSSHKeyPath(): string {
  const sshDir = join(os.homedir(), '.ssh');
  const commonKeys = ['id_ed25519', 'id_ecdsa', 'id_rsa', 'id_dsa'];

  for (const keyName of commonKeys) {
    const keyPath = join(sshDir, keyName);
    if (existsSync(keyPath)) {
      return keyPath;
    }
  }

  return join(sshDir, 'id_ed25519');
}

export function startPty(options: {
  id: string;
  cwd?: string;
  shell?: string;
  env?: NodeJS.ProcessEnv;
  cols?: number;
  rows?: number;
  sshConfig?: SSHConfig;
}): IPty {
  const { id, cwd, shell, env, cols = 80, rows = 24, sshConfig } = options;

  const useEnv = { TERM: 'xterm-256color', ...process.env, ...(env || {}) };

  let useShell = '';
  let args: string[] = [];
  let useCwd = cwd || process.cwd() || os.homedir();
  let isSSH = false;
  let isTmux = false;
  let tmuxSession: string | undefined;
  let tmuxSocketPath: string | undefined;
  let tmuxBinary: string | undefined;

  if (sshConfig) {
    // SSH mode: spawn SSH connection instead of local shell
    isSSH = true;
    useShell = 'ssh';

    const keyPath = sshConfig.keyPath || getDefaultSSHKeyPath();
    const port = sshConfig.port || 22;
    const remotePath = sshConfig.remotePath?.trim() ? sshConfig.remotePath.trim() : '~';
    const { session, socket } = buildTmuxIdentifiers(id);
    const remoteSocketDir = '$HOME/.emdash-tmux';
    const remoteSocketPath = `${remoteSocketDir}/${socket}`;
    const initialCols = Math.max(20, cols);
    const initialRows = Math.max(10, rows);
    const remoteShellCommand = (shell || '$SHELL -i -l').trim();
    const remoteDirEscaped = remotePath.replace(/'/g, "'\\''");

    // Escape single quotes for use inside the outer single-quoted remote script
    let remoteCommandEscaped: string;
    if (shell) {
      const parsedRemote = parseCommand(remoteShellCommand);
      const tokens = [parsedRemote.command, ...parsedRemote.args];
      remoteCommandEscaped = tokens
        .map((token) => token.replace(/'/g, "'\\''"))
        .join(' ');
    } else {
      remoteCommandEscaped = '$SHELL -i -l';
    }

    const remoteScriptParts = [
      `__EMDASH_SOCKET=\"${remoteSocketPath}\"`,
      `__EMDASH_SESSION=\"${session}\"`,
      `__EMDASH_DIR='${remoteDirEscaped}'`,
      `__EMDASH_CONF=\"${remoteSocketDir}/tmux.conf\"`,
      'if command -v tmux >/dev/null 2>&1; then',
      '  mkdir -p "$(dirname \"$__EMDASH_SOCKET\")"',
      '  if [ ! -f "$__EMDASH_CONF" ]; then printf %s\\n "set-option -g status off" "set-option -g set-titles on" "set-option -g mouse off" > "$__EMDASH_CONF"; fi',
      `  tmux -f "$__EMDASH_CONF" -S "$__EMDASH_SOCKET" has-session -t "$__EMDASH_SESSION" 2>/dev/null || tmux -f "$__EMDASH_CONF" -S "$__EMDASH_SOCKET" new-session -d -s "$__EMDASH_SESSION" -x ${initialCols} -y ${initialRows} -c "$__EMDASH_DIR" ${remoteCommandEscaped}`,
      '  tmux -f "$__EMDASH_CONF" -S "$__EMDASH_SOCKET" attach-session -t "$__EMDASH_SESSION"',
      'else',
      `  cd "$__EMDASH_DIR" && exec ${remoteCommandEscaped}`,
      'fi',
    ];
    const remoteScript = remoteScriptParts.join(' ; ');
    const remoteCommand = `sh -lc '${remoteScript.replace(/'/g, "'\\''")}'`;

    args = [
      '-i',
      keyPath,
      '-p',
      String(port),
      '-o',
      'StrictHostKeyChecking=no', // Auto-accept host keys
      '-o',
      'ServerAliveInterval=60', // Keep connection alive
      `${sshConfig.user}@${sshConfig.host}`,
      '-t', // Force PTY allocation
      remoteCommand,
    ];

    // For SSH, cwd is local (doesn't matter much, but use home)
    useCwd = os.homedir();
  } else {
    // Local mode: spawn tmux-backed shell when available
    if (process.platform === 'win32') {
      throw new Error('tmux is required for local terminals (Windows not supported yet)');
    }
    if (process.env.EMDASH_DISABLE_TMUX === '1') {
      throw new Error('tmux support is mandatory; remove EMDASH_DISABLE_TMUX to continue');
    }

    const tmuxInfo = detectTmux();
    if (!tmuxInfo.available || !tmuxInfo.binary) {
      throw new Error(
        'tmux binary not found. Install tmux or set EMDASH_TMUX_PATH to the tmux executable.'
      );
    }

    const { session, socket } = buildTmuxIdentifiers(id);
    const { dir: socketDir, configPath } = ensureSocketDir();
    const socketPath = join(socketDir, socket);
    const initialCols = Math.max(20, cols);
    const initialRows = Math.max(10, rows);

    useShell = tmuxInfo.binary;
    args = [
      '-f',
      configPath,
      '-S',
      socketPath,
      'new-session',
      '-A',
      '-s',
      session,
      '-x',
      String(initialCols),
      '-y',
      String(initialRows),
    ];
    if (useCwd) {
      args.push('-c', useCwd);
    }

    const shellTokens = parseCommand(shell || getDefaultShell());
    args.push('--', shellTokens.command, ...shellTokens.args);

    isTmux = true;
    tmuxSession = session;
    tmuxSocketPath = socketPath;
    tmuxBinary = tmuxInfo.binary;
  }

  const proc = pty.spawn(useShell, args, {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: useCwd,
    env: useEnv,
  });

  const rec: PtyRecord = {
    id,
    proc,
    isSSH,
    isTmux,
    tmuxSession,
    tmuxSocketPath,
    tmuxBinary,
  };
  ptys.set(id, rec);
  return proc;
}

export function writePty(id: string, data: string): void {
  const rec = ptys.get(id);
  if (!rec) return;
  rec.proc.write(data);
}

export function resizePty(id: string, cols: number, rows: number): void {
  const rec = ptys.get(id);
  if (!rec) return;
  rec.proc.resize(cols, rows);
}

export function killPty(id: string): void {
  const rec = ptys.get(id);
  if (!rec) return;
  try {
    if (rec.isTmux && rec.tmuxBinary && rec.tmuxSession && rec.tmuxSocketPath) {
      try {
        spawnSync(rec.tmuxBinary, [
          '-S',
          rec.tmuxSocketPath,
          'kill-session',
          '-t',
          rec.tmuxSession,
        ]);
      } catch {
        // Ignore cleanup errors so we still tear down the PTY below
      }
    }
    rec.proc.kill();
  } finally {
    ptys.delete(id);
  }
}

export function hasPty(id: string): boolean {
  return ptys.has(id);
}

export function getPty(id: string): IPty | undefined {
  return ptys.get(id)?.proc;
}

export function cleanAllTmuxSessions(): {
  success: boolean;
  cleaned: number;
  errors: string[];
} {
  const tmuxInfo = detectTmux();
  const errors: string[] = [];
  let cleaned = 0;

  if (!tmuxInfo.available || !tmuxInfo.binary) {
    return {
      success: false,
      cleaned: 0,
      errors: ['tmux is not available on this system'],
    };
  }

  const { dir: socketDir } = ensureSocketDir();

  try {
    // List all tmux sessions using the emdash socket directory
    const listResult = spawnSync(tmuxInfo.binary, ['list-sessions'], {
      encoding: 'utf8',
      cwd: socketDir,
    });

    // Also kill sessions that might be using our socket files
    const fs = require('fs');
    const socketFiles = fs.readdirSync(socketDir).filter((f: string) => f.startsWith('emdash-'));

    for (const socketFile of socketFiles) {
      const socketPath = join(socketDir, socketFile);
      try {
        const sessionsResult = spawnSync(
          tmuxInfo.binary,
          ['-S', socketPath, 'list-sessions'],
          { encoding: 'utf8' }
        );

        if (sessionsResult.status === 0 && sessionsResult.stdout) {
          const sessions = sessionsResult.stdout
            .split('\n')
            .filter((line) => line.trim())
            .map((line) => line.split(':')[0])
            .filter((name) => name.startsWith('emdash_'));

          for (const sessionName of sessions) {
            try {
              const killResult = spawnSync(
                tmuxInfo.binary,
                ['-S', socketPath, 'kill-session', '-t', sessionName],
                { encoding: 'utf8' }
              );

              if (killResult.status === 0) {
                cleaned++;
              } else {
                errors.push(`Failed to kill session ${sessionName}: ${killResult.stderr}`);
              }
            } catch (err: any) {
              errors.push(`Error killing session ${sessionName}: ${err.message}`);
            }
          }
        }

        // Clean up socket file if no sessions remain
        try {
          fs.unlinkSync(socketPath);
        } catch {
          // Socket might still be in use, that's okay
        }
      } catch (err: any) {
        errors.push(`Error processing socket ${socketFile}: ${err.message}`);
      }
    }

    return {
      success: true,
      cleaned,
      errors,
    };
  } catch (err: any) {
    return {
      success: false,
      cleaned,
      errors: [`Failed to clean tmux sessions: ${err.message}`],
    };
  }
}
