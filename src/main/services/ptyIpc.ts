import { ipcMain, WebContents } from 'electron';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);
import { startPty, writePty, resizePty, killPty, getPty } from './ptyManager';

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
      }
    ) => {
      try {
        const { id, cwd, shell, env, cols, rows } = args;
        // Reuse existing PTY if present; otherwise create new
        const existing = getPty(id);
        const proc = existing ?? startPty({ id, cwd, shell, env, cols, rows });
        console.log('pty:start OK', { id, cwd, shell, cols, rows, reused: !!existing });
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

        return { ok: true };
      } catch (err: any) {
        console.error('pty:start FAIL', {
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
      console.error('pty:input error', e);
    }
  });

  ipcMain.on('pty:resize', (_event, args: { id: string; cols: number; rows: number }) => {
    try {
      resizePty(args.id, args.cols, args.rows);
    } catch (e) {
      console.error('pty:resize error', e);
    }
  });

  ipcMain.on('pty:kill', (_event, args: { id: string }) => {
    try {
      killPty(args.id);
      owners.delete(args.id);
      listeners.delete(args.id);
      buffers.delete(args.id);
    } catch (e) {
      console.error('pty:kill error', e);
    }
  });

  ipcMain.handle(
    'cli:which',
    async (
      _event,
      args: { candidates: string[] }
    ): Promise<{ ok: boolean; found?: string | null; error?: string }> => {
      try {
        const candidates = Array.isArray(args?.candidates) ? args.candidates : [];
        if (candidates.length === 0) return { ok: true, found: null };
        const platform = os.platform();
        const binDirs: string[] =
          platform === 'darwin'
            ? ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin']
            : platform === 'linux'
              ? ['/usr/local/bin', '/usr/bin', '/bin']
              : [];

        for (const cmd of candidates) {
          try {
            if (platform === 'win32') {
              const { stdout } = await execFileAsync('where', [cmd]);
              if (stdout && stdout.trim()) return { ok: true, found: cmd };
            } else {
              const { stdout } = await execFileAsync('bash', ['-lc', `command -v ${cmd}`]);
              if (stdout && stdout.trim()) return { ok: true, found: stdout.trim() };
              // Fallback: probe common bin directories explicitly
              for (const dir of binDirs) {
                const p = path.join(dir, cmd);
                if (fs.existsSync(p)) return { ok: true, found: p };
              }
            }
          } catch {
            // try next
          }
        }
        return { ok: true, found: null };
      } catch (e: any) {
        return { ok: false, error: String(e?.message || e) };
      }
    }
  );
}
