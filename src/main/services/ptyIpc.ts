import { ipcMain, WebContents, app } from 'electron';
import { startPty, writePty, resizePty, killPty, getPty } from './ptyManager';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);

const owners = new Map<string, WebContents>();
const listeners = new Set<string>();
const logPrefs = new Map<string, boolean>();

// Simple scrollback buffer per PTY id, to replay when re-attaching
const buffers = new Map<string, string[]>();
const MAX_BUFFER_BYTES = 200_000; // ~200 KB
const LOG_PREFIX = 'terminal-';
const LOG_ROOT = path.join(app.getPath('userData'), 'session-logs');

// Logs are now stored under app userData, not in the repo, so no excludes are necessary.

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
        disableLog?: boolean;
      }
    ) => {
      try {
        const { id, cwd, shell, env, cols, rows } = args;
        const shouldLog = args?.disableLog ? false : true;
        logPrefs.set(id, shouldLog);
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
            if (logPrefs.get(id)) {
              try {
                const dir = LOG_ROOT;
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                const logPath = path.join(dir, `${LOG_PREFIX}${id}.log`);
                fs.appendFile(logPath, data, () => {});
              } catch {}
            }
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
        } else if (logPrefs.get(id)) {
          try {
            const logPath = path.join(LOG_ROOT, `${LOG_PREFIX}${id}.log`);
            if (fs.existsSync(logPath)) {
              const stat = fs.statSync(logPath);
              const size = stat.size;
              const start = Math.max(0, size - MAX_BUFFER_BYTES);
              const fd = fs.openSync(logPath, 'r');
              const buf = Buffer.alloc(size - start);
              fs.readSync(fd, buf, 0, buf.length, start);
              fs.closeSync(fd);
              wc.send(`pty:history:${id}`, buf.toString('utf8'));
            }
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
        for (const cmd of candidates) {
          try {
            if (platform === 'win32') {
              const { stdout } = await execFileAsync('where', [cmd]);
              if (stdout && stdout.trim()) return { ok: true, found: cmd };
            } else {
              const { stdout } = await execFileAsync('bash', ['-lc', `command -v ${cmd}`]);
              if (stdout && stdout.trim()) return { ok: true, found: stdout.trim() };
            }
          } catch {}
        }
        return { ok: true, found: null };
      } catch (e: any) {
        return { ok: false, error: String(e?.message || e) };
      }
    }
  );

  ipcMain.on('pty:resize', (_event, args: { id: string; cols: number; rows: number }) => {
    try {
      if (args.cols > 0 && args.rows > 0) resizePty(args.id, args.cols, args.rows);
    } catch (e: any) {
      // Ignore ENOTTY noise when PTY is not in a resizable state
      if (!String(e?.message || e).includes('ENOTTY')) {
        console.error('pty:resize error', e);
      }
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
}
