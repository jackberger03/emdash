import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { log } from '../lib/logger';

type Props = {
  id: string;
  cwd?: string;
  cols?: number;
  rows?: number;
  shell?: string;
  className?: string;
  variant?: 'dark' | 'light';
  themeOverride?: any;
  contentFilter?: string;
  onActivity?: () => void;
  onStartError?: (message: string) => void;
  onStartSuccess?: () => void;
};

/**
 * ChatTerminal - Terminal specifically for AI agent/chat usage
 * Does NOT clear prompt or add command dividers like regular terminals
 */
const ChatTerminalComponent: React.FC<Props> = ({
  id,
  cwd,
  cols = 80,
  rows = 24,
  shell,
  className,
  variant = 'dark',
  themeOverride,
  contentFilter,
  onActivity,
  onStartError,
  onStartSuccess,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const disposeFns = useRef<Array<() => void>>([]);

  useEffect(() => {
    console.log('[ChatTerminal] useEffect START:', { id, cwd, shell });

    const el = containerRef.current;
    if (!el) {
      log.error('ChatTerminal: No container element found');
      return;
    }

    log.debug('ChatTerminal: Creating terminal, container dimensions:', {
      width: el.offsetWidth,
      height: el.offsetHeight,
      clientWidth: el.clientWidth,
      clientHeight: el.clientHeight,
    });

    const isLight = variant === 'light';
    const baseTheme = isLight
      ? {
          background: '#ffffff',
          foreground: '#000000',
          cursor: '#000000',
          selectionBackground: '#00000022',
          black: '#000000',
          red: '#cc0000',
          green: '#008000',
          yellow: '#a16207',
          blue: '#1d4ed8',
          magenta: '#7c3aed',
          cyan: '#0ea5e9',
          white: '#111827',
          brightBlack: '#4b5563',
          brightRed: '#ef4444',
          brightGreen: '#22c55e',
          brightYellow: '#f59e0b',
          brightBlue: '#3b82f6',
          brightMagenta: '#8b5cf6',
          brightCyan: '#22d3ee',
          brightWhite: '#111827',
        }
      : {
          background: '#1f2937',
          foreground: '#ffffff',
          cursor: '#ffffff',
          selectionBackground: '#ffffff33',
          black: '#1f2937',
          red: '#ff6b6b',
          green: '#2ecc71',
          yellow: '#f1c40f',
          blue: '#3498db',
          magenta: '#9b59b6',
          cyan: '#1abc9c',
          white: '#ecf0f1',
          brightBlack: '#bfbfbf',
          brightRed: '#ff6b6b',
          brightGreen: '#2ecc71',
          brightYellow: '#f1c40f',
          brightBlue: '#3498db',
          brightMagenta: '#9b59b6',
          brightCyan: '#1abc9c',
          brightWhite: '#ffffff',
        };
    const theme = { ...(baseTheme as any), ...(themeOverride || {}) } as any;

    const term = new Terminal({
      convertEol: true,
      cursorBlink: true,
      disableStdin: false,
      cols: cols,
      rows: rows,
      theme,
      allowTransparency: false,
      scrollback: 1000,
    });
    termRef.current = term;
    term.open(el);
    term.focus();
    setTimeout(() => term.focus(), 0);

    // NO command dividers for chat terminal - agents need raw output
    const keyDisp = term.onData((data) => {
      log.debug('xterm onData', JSON.stringify(data));
      try {
        onActivity && onActivity();
      } catch {}
      window.electronAPI.ptyInput({ id, data });
    });

    const keyDisp2 = term.onKey((ev) => {
      log.debug('xterm onKey', ev.key);
    });

    const sanitizeEchoArtifacts = (chunk: string) => {
      try {
        let s = chunk.replace(/\x1b\[\?\d+(?:;\d+)*c/g, '');
        s = s.replace(/(^|[\s>])\d+(?:;\d+)*[cR](?=$|\s)/g, '$1');
        s = s.replace(/\d+;rgb:[0-9a-fA-F]+\/[0-9a-fA-F]+\/[0-9a-fA-F]+/g, '');
        s = s.replace(/rgb:[0-9a-fA-F]+(?:\/[0-9a-fA-F]+)*/g, '');
        s = s.replace(/(?:^|\s)([0-9a-fA-F]{4})(?=\s|$)/g, ' ');
        s = s.replace(/\x1b\]\d+;[^\x07\x1b]*\x07?/g, '');
        s = s.replace(/\n\s*\n/g, '\n');
        return s;
      } catch {
        return chunk;
      }
    };

    const offHistory = (window as any).electronAPI.onPtyHistory?.(id, (data: string) => {
      term.write(sanitizeEchoArtifacts(data));
    });
    const offData = window.electronAPI.onPtyData(id, (data) => {
      term.write(sanitizeEchoArtifacts(data));
    });
    const offExit = window.electronAPI.onPtyExit(id, (info) => {
      try {
        const elapsed = Date.now() - startTsRef.current;
        if (elapsed < 1500 && onStartError) {
          onStartError(`PTY exited early (code ${info?.exitCode ?? 'n/a'})`);
        }
      } catch {}
    });

    const handleResize = () => {
      if (termRef.current && el) {
        // Skip resize if element is hidden (display: none or 0 dimensions)
        const { width, height } = el.getBoundingClientRect();
        if (width === 0 || height === 0) {
          return;
        }

        const newCols = Math.max(20, Math.floor(width / 9));
        const newRows = Math.max(10, Math.floor(height / 17));

        if (newCols !== cols || newRows !== rows) {
          try {
            termRef.current.resize(newCols, newRows);
            window.electronAPI.ptyResize({ id, cols: newCols, rows: newRows });
          } catch (err) {
            // Silently ignore resize errors (PTY might be closed)
            log.debug('Failed to resize PTY:', id, err);
          }
        }
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(el);

    disposeFns.current.push(() => keyDisp.dispose());
    if (offHistory) disposeFns.current.push(offHistory);
    disposeFns.current.push(offData);
    disposeFns.current.push(offExit);
    disposeFns.current.push(() => keyDisp2.dispose());
    disposeFns.current.push(() => resizeObserver.disconnect());

    const startTsRef = { current: Date.now() } as { current: number };
    (async () => {
      try {
        console.log('[ChatTerminal] Starting PTY:', { id, cwd, shell });

        const res = await window.electronAPI.ptyStart({
          id,
          cwd,
          cols,
          rows,
          shell,
        });

        console.log('[ChatTerminal] PTY start result:', {
          id,
          ok: res?.ok,
          error: (res as any)?.error,
        });

        if (!res?.ok) {
          term.writeln('\x1b[31mFailed to start PTY:\x1b[0m ' + (res as any)?.error);
          try {
            onStartError && onStartError((res as any)?.error || 'Failed to start PTY');
          } catch {}
        }

        if (res?.ok) {
          console.log('[ChatTerminal] PTY started successfully:', id);
          // NO prompt clearing for chat terminals - AI agents need the real shell
          try {
            onStartSuccess && onStartSuccess();
          } catch {}
        }
      } catch (e: any) {
        console.error('[ChatTerminal] Error starting PTY:', { id, error: e });
        term.writeln('\x1b[31mError starting PTY:\x1b[0m ' + (e?.message || String(e)));
        try {
          onStartError && onStartError(e?.message || String(e));
        } catch {}
      }
    })();

    return () => {
      console.log('[ChatTerminal] Cleanup START:', id);
      // Always kill chat terminal PTYs on unmount
      window.electronAPI.ptyKill(id);
      disposeFns.current.forEach((fn) => fn());
      term.dispose();
      termRef.current = null;
      console.log('[ChatTerminal] Cleanup END:', id);
    };
  }, [id]); // Only remount when terminal ID changes, not on prop changes

  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: '100%',
        minHeight: '0',
        backgroundColor: variant === 'light' ? '#ffffff' : '#000000',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
      onClick={() => termRef.current?.focus()}
      onMouseDown={() => termRef.current?.focus()}
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={(e) => {
        try {
          e.preventDefault();
          const dt = e.dataTransfer;
          if (!dt || !dt.files || dt.files.length === 0) return;
          const paths: string[] = [];
          for (let i = 0; i < dt.files.length; i++) {
            const file = dt.files[i] as any;
            const p: string | undefined = file?.path;
            if (p) paths.push(p);
          }
          if (paths.length === 0) return;
          const escaped = paths.map((p) => `'${p.replace(/'/g, "'\\''")}'`).join(' ');
          window.electronAPI.ptyInput({ id, data: escaped });
          termRef.current?.focus();
        } catch {}
      }}
    >
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          minHeight: '0',
          overflow: 'hidden',
          filter: contentFilter || undefined,
        }}
      />
    </div>
  );
};

export const ChatTerminal = React.memo(ChatTerminalComponent);

export default ChatTerminal;
