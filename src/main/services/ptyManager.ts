import os from 'os';
import * as pty from 'node-pty';
import type { IPty } from 'node-pty';
import { existsSync } from 'fs';
import { join, dirname } from 'path';

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
};

const ptys = new Map<string, PtyRecord>();

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

  let useShell: string;
  let args: string[] = [];
  let useCwd: string;
  let isSSH = false;

  if (sshConfig) {
    // SSH mode: spawn SSH connection instead of local shell
    isSSH = true;
    useShell = 'ssh';

    const keyPath = sshConfig.keyPath || getDefaultSSHKeyPath();
    const port = sshConfig.port || 22;

    // Build SSH args: -i keyPath -p port user@host -t "cd remotePath && shell"
    // When a custom shell command is provided (like 'claude'), wrap it in a login shell
    // to ensure PATH and environment are loaded correctly
    const remoteCommand = shell
      ? `cd ${sshConfig.remotePath} && exec bash -l -c '${shell.replace(/'/g, "'\\''")}'`
      : `cd ${sshConfig.remotePath} && exec $SHELL`;

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
    // Local mode: spawn local shell
    const shellInput = shell || getDefaultShell();
    useCwd = cwd || process.cwd() || os.homedir();

    // Parse shell command and arguments
    // Split on spaces but respect quoted strings
    if (shellInput.includes(' ')) {
      const parts = shellInput.match(/(?:[^\s"]+|"[^"]*")+/g) || [shellInput];
      useShell = parts[0];
      args = parts.slice(1).map((arg) => arg.replace(/^"(.*)"$/, '$1'));
    } else {
      useShell = shellInput;
    }
  }

  const proc = pty.spawn(useShell, args, {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: useCwd,
    env: useEnv,
  });

  const rec: PtyRecord = { id, proc, isSSH };
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
