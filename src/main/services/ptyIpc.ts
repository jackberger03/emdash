import { ipcMain, WebContents } from 'electron';
import {
  startPty,
  writePty,
  resizePty,
  killPty,
  getPty,
  cleanAllTmuxSessions,
  SSHConfig,
} from './ptyManager';
import { log } from '../lib/logger';

const owners = new Map<string, WebContents>();
const listeners = new Set<string>();

// Simple scrollback buffer per PTY id, to replay when re-attaching
const buffers = new Map<string, string[]>();
const MAX_BUFFER_BYTES = 200_000; // ~200 KB

function appendBuffer(id: string, chunk: string) {
  const arr = buffers.get(id) ?? [];
  arr.push(chunk);
  // Trim if over byte budget
  let total = arr.reduce((n, s) => n + Buffer.byteLength(s, 'utf8'), 0);
  while (arr.length > 1 && total > MAX_BUFFER_BYTES) {
    const removed = arr.shift()!;
    total -= Buffer.byteLength(removed, 'utf8');
  }
  buffers.set(id, arr);
}

export function registerPtyIpc(): void {
  ipcMain.handle(
    'pty:start',
    (
      event,
      args: {
        id: string;
        cwd?: string;
        shell?: string;
        env?: Record<string, string>;
        cols?: number;
        rows?: number;
        sshConfig?: SSHConfig;
      }
    ) => {
      try {
        const { id, cwd, shell, env, cols, rows, sshConfig } = args;
        // Reuse existing PTY if present; otherwise create new
        const existing = getPty(id);
        const proc = existing ?? startPty({ id, cwd, shell, env, cols, rows, sshConfig });
        log.debug('pty:start OK', {
          id,
          cwd,
          shell,
          cols,
          rows,
          isSSH: !!sshConfig,
          reused: !!existing,
        });
        const wc = event.sender;
        owners.set(id, wc);

        // Attach listeners once per PTY id
        if (!listeners.has(id)) {
          proc.onData((data) => {
            appendBuffer(id, data);
            owners.get(id)?.send(`pty:data:${id}`, data);
          });

          proc.onExit(({ exitCode, signal }) => {
            owners.get(id)?.send(`pty:exit:${id}`, { exitCode, signal });
            owners.delete(id);
            listeners.delete(id);
            buffers.delete(id);
          });
          listeners.add(id);
        }

        // If there's buffered history, replay it to the current owner
        const history = buffers.get(id);
        if (history && history.length) {
          try {
            wc.send(`pty:history:${id}`, history.join(''));
          } catch {}
        }

        // Signal that PTY is ready so renderer may inject initial prompt safely
        try {
          const { BrowserWindow } = require('electron');
          const windows = BrowserWindow.getAllWindows();
          windows.forEach((w: any) => w.webContents.send('pty:started', { id }));
        } catch {}

        return { ok: true };
      } catch (err: any) {
        log.error('pty:start FAIL', {
          id: args.id,
          cwd: args.cwd,
          shell: args.shell,
          error: err?.message || err,
        });
        return { ok: false, error: String(err?.message || err) };
      }
    }
  );

  ipcMain.on('pty:input', (_event, args: { id: string; data: string }) => {
    try {
      writePty(args.id, args.data);
    } catch (e) {
      log.error('pty:input error', e);
    }
  });

  ipcMain.on('pty:resize', (_event, args: { id: string; cols: number; rows: number }) => {
    try {
      resizePty(args.id, args.cols, args.rows);
    } catch (e) {
      // Resize errors are expected when terminals are hidden or closed
      // Log as debug instead of error to avoid console spam
      log.debug('pty:resize skipped (terminal likely hidden or closed)', { id: args.id, error: e });
    }
  });

  ipcMain.on('pty:kill', (_event, args: { id: string }) => {
    try {
      killPty(args.id);
      owners.delete(args.id);
      listeners.delete(args.id);
      buffers.delete(args.id);
    } catch (e) {
      log.error('pty:kill error', e);
    }
  });

  ipcMain.handle('pty:clean-all-tmux', async () => {
    try {
      log.info('Cleaning all tmux sessions...');
      const result = cleanAllTmuxSessions();
      log.info('Tmux cleanup completed', { cleaned: result.cleaned, errors: result.errors });
      return result;
    } catch (e: any) {
      log.error('pty:clean-all-tmux error', e);
      return {
        success: false,
        cleaned: 0,
        errors: [e?.message || String(e)],
      };
    }
  });
}
