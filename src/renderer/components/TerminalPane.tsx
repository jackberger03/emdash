import React, { useEffect, useRef, useMemo, useCallback } from 'react';
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
  themeOverride?: any; // optional xterm theme overrides
  contentFilter?: string; // CSS filter applied to terminal content container
  keepAlive?: boolean;
  onActivity?: () => void;
  onStartError?: (message: string) => void;
  onStartSuccess?: () => void;
  sshConfig?: {
    host: string;
    user: string;
    remotePath: string;
    port?: number;
    keyPath?: string;
  };
};

const TerminalPaneComponent: React.FC<Props> = ({
  id,
  cwd,
  cols = 80,
  rows = 24,
  shell,
  className,
  variant = 'dark',
  themeOverride,
  contentFilter,
  keepAlive = false,
  onActivity,
  onStartError,
  onStartSuccess,
  sshConfig,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const disposeFns = useRef<Array<() => void>>([]);
  const selectionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCopiedSelectionRef = useRef<string>('');

  const copySelection = useCallback(async () => {
    const term = termRef.current;
    if (!term) return;
    const selection = term.getSelection();
    if (!selection) return;
    if (selection === lastCopiedSelectionRef.current) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(selection);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = selection;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      lastCopiedSelectionRef.current = selection;
    } catch (error) {
      log.debug('TerminalPane copy failed', error);
    }
  }, []);

  useEffect(() => {
    console.log('[TerminalPane] useEffect START:', { id, cwd, shell, keepAlive });

    const el = containerRef.current;
    if (!el) {
      log.error('TerminalPane: No container element found');
      return;
    }

    log.debug('TerminalPane: Creating terminal, container dimensions:', {
      width: el.offsetWidth,
      height: el.offsetHeight,
      clientWidth: el.clientWidth,
      clientHeight: el.clientHeight,
    });

    const isLight = variant === 'light';
    const baseTheme = isLight
      ? {
          // Light theme defaults
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
          // Dark theme defaults
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

    // Listen for history first, then live data, then start/attach to PTY
    const sanitizeEchoArtifacts = (chunk: string) => {
      try {
        // Strip common terminal response artifacts that sometimes get echoed by TTY in cooked mode
        // 1) Remove proper ANSI DA responses if they appear in output stream
        let s = chunk.replace(/\x1b\[\?\d+(?:;\d+)*c/g, '');
        // 2) Remove bare echoed fragments like "1;2c" or "24;80R" when ESC sequences were stripped by echo
        s = s.replace(/(^|[\s>])\d+(?:;\d+)*[cR](?=$|\s)/g, '$1');

        // 3) Aggressively remove OSC color query responses
        // These patterns match the background/foreground color queries (OSC 10, 11, etc.)
        // Remove complete sequences: 10;rgb:0000/0000/0000 or 11;rgb:ffff/ffff/ffff
        s = s.replace(/\d+;rgb:[0-9a-fA-F]+\/[0-9a-fA-F]+\/[0-9a-fA-F]+/g, '');
        // Remove partial sequences at start/end: rgb:ffff/ffff or just ffff after rgb pattern
        s = s.replace(/rgb:[0-9a-fA-F]+(?:\/[0-9a-fA-F]+)*/g, '');
        // Remove trailing hex fragments that look like color components (4 hex digits)
        s = s.replace(/(?:^|\s)([0-9a-fA-F]{4})(?=\s|$)/g, ' ');
        // Remove OSC with escape sequences
        s = s.replace(/\x1b\]\d+;[^\x07\x1b]*\x07?/g, '');
        // Remove DEC private reports like ESC > 1;2c and stray fallbacks
        s = s.replace(/\x1b\[>\d+(?:;\d+)*c/g, '');
        s = s.replace(/>[_\?]?\d+(?:;\d+)*c/g, '');
        // Clean up multiple spaces/newlines that might be left
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
    const selectionDisp = term.onSelectionChange(() => {
      if (selectionDebounceRef.current) {
        clearTimeout(selectionDebounceRef.current);
      }
      selectionDebounceRef.current = setTimeout(() => {
        copySelection();
      }, 80);
    });
    const offExit = window.electronAPI.onPtyExit(id, (info) => {
      try {
        // If the process exits very quickly after start, it's likely the CLI wasn't found
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
    disposeFns.current.push(() => selectionDisp.dispose());
    disposeFns.current.push(() => keyDisp2.dispose());
    disposeFns.current.push(() => resizeObserver.disconnect());

    // Start PTY session after listeners are attached so we don't miss initial output/history
    const startTsRef = { current: Date.now() } as { current: number };
    (async () => {
      try {
        console.log('[TerminalPane] Starting PTY:', { id, cwd, shell });

        const res = await window.electronAPI.ptyStart({
          id,
          cwd,
          cols,
          rows,
          shell,
          sshConfig,
        });
        console.log('[TerminalPane] PTY start result:', {
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
          console.log('[TerminalPane] PTY started successfully:', id);

          // Inject minimal prompt command after shell starts
          // Small delay to ensure shell is ready
          setTimeout(() => {
            // Get first 4 characters of directory name for prompt
            let dirPrefix = '';
            if (cwd) {
              const dirName = cwd.split('/').filter(Boolean).pop() || '';
              dirPrefix = dirName.slice(0, 4);
            }
            // Set prompt for both zsh (PROMPT) and bash (PS1)
            const promptCmd = `PROMPT="${dirPrefix}> "; PS1="${dirPrefix}> "; clear\n`;
            window.electronAPI.ptyInput({ id, data: promptCmd });
          }, 150);

          try {
            onStartSuccess && onStartSuccess();
          } catch {}
        }
      } catch (e: any) {
        console.error('[TerminalPane] Error starting PTY:', { id, error: e });
        term.writeln('\x1b[31mError starting PTY:\x1b[0m ' + (e?.message || String(e)));
        try {
          onStartError && onStartError(e?.message || String(e));
        } catch {}
      }
    })();

    return () => {
      console.log('[TerminalPane] Cleanup START:', { id, keepAlive });

      if (!keepAlive) {
        console.log('[TerminalPane] Killing PTY:', id);
        window.electronAPI.ptyKill(id);
        console.log('[TerminalPane] PTY kill called:', id);
      } else {
        console.log('[TerminalPane] Skipping PTY kill (keepAlive=true):', id);
      }
      disposeFns.current.forEach((fn) => fn());
      term.dispose();
      termRef.current = null;
      if (selectionDebounceRef.current) {
        clearTimeout(selectionDebounceRef.current);
        selectionDebounceRef.current = null;
      }
      console.log('[TerminalPane] Cleanup END:', id);
    };
  }, [id, cwd, cols, rows, variant, keepAlive, shell, copySelection]);

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
        // Allow dropping files onto the terminal surface
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
          // Insert absolute paths (quoted) into the PTY, separated by spaces
          const escaped = paths.map((p) => `'${p.replace(/'/g, "'\\''")}'`).join(' ');
          window.electronAPI.ptyInput({ id, data: escaped });
          termRef.current?.focus();
        } catch {
          // ignore
        }
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

export const TerminalPane = React.memo(TerminalPaneComponent);

export default TerminalPane;
