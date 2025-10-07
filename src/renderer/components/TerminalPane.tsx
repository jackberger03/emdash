import React, { useEffect, useRef, useMemo } from 'react';
import { Terminal } from '@xterm/xterm';

type Props = {
  id: string;
  cwd?: string;
  cols?: number;
  rows?: number;
  shell?: string;
  className?: string;
  variant?: 'dark' | 'light';
  keepAlive?: boolean;
  logSession?: boolean;
  onActivity?: () => void;
};

const TerminalPaneComponent: React.FC<Props> = ({
  id,
  cwd,
  cols = 80,
  rows = 24,
  shell,
  className,
  variant = 'dark',
  keepAlive = false,
  logSession = true,
  onActivity,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const disposeFns = useRef<Array<() => void>>([]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      console.error('TerminalPane: No container element found');
      return;
    }

    console.log('TerminalPane: Creating terminal, container dimensions:', {
      width: el.offsetWidth,
      height: el.offsetHeight,
      clientWidth: el.clientWidth,
      clientHeight: el.clientHeight,
    });

    const isLight = variant === 'light';
    const term = new Terminal({
      convertEol: true,
      cursorBlink: true,
      disableStdin: false,
      cols: cols,
      rows: rows,
      theme: isLight
        ? {
            // Light theme: black text on white bg; keep orange accents
            background: '#ffffff',
            foreground: '#000000',
            cursor: '#000000',
            selectionBackground: '#00000022',
            black: '#000000',
            red: '#000000',
            green: '#000000',
            yellow: '#f59e0b', // keep orange
            blue: '#000000',
            magenta: '#000000',
            cyan: '#000000',
            white: '#000000',
            brightBlack: '#4b5563',
            brightRed: '#000000',
            brightGreen: '#000000',
            brightYellow: '#f59e0b', // keep orange
            brightBlue: '#000000',
            brightMagenta: '#000000',
            brightCyan: '#000000',
            brightWhite: '#000000',
          }
        : {
            // Dark theme (existing strict monochrome)
            background: '#000000',
            foreground: '#ffffff',
            cursor: '#ffffff',
            selectionBackground: '#ffffff33',
            black: '#000000',
            red: '#ffffff',
            green: '#ffffff',
            yellow: '#ffffff',
            blue: '#ffffff',
            magenta: '#ffffff',
            cyan: '#ffffff',
            white: '#ffffff',
            brightBlack: '#bfbfbf',
            brightRed: '#ffffff',
            brightGreen: '#ffffff',
            brightYellow: '#ffffff',
            brightBlue: '#ffffff',
            brightMagenta: '#ffffff',
            brightCyan: '#ffffff',
            brightWhite: '#ffffff',
          },
      allowTransparency: false,
      scrollback: 1000,
    });
    termRef.current = term;
    term.open(el);
    term.focus();
    setTimeout(() => term.focus(), 0);

    const keyDisp = term.onData((data) => {
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.log('xterm onData', JSON.stringify(data));
      }
      try {
        onActivity && onActivity();
      } catch {}
      window.electronAPI.ptyInput({ id, data });
    });
    const keyDisp2 = term.onKey((ev) => {
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.log('xterm onKey', ev.key);
      }
    });

    // Listen for history first, then live data, then start/attach to PTY
    const offHistory = (window as any).electronAPI.onPtyHistory?.(id, (data: string) => {
      term.write(data);
    });
    const offData = window.electronAPI.onPtyData(id, (data) => {
      term.write(data);
    });
    const handleResize = () => {
      if (termRef.current && el) {
        const { width, height } = el.getBoundingClientRect();
        const newCols = Math.max(20, Math.floor(width / 9));
        const newRows = Math.max(10, Math.floor(height / 17));

        if (newCols !== cols || newRows !== rows) {
          termRef.current.resize(newCols, newRows);
          window.electronAPI.ptyResize({ id, cols: newCols, rows: newRows });
        }
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(el);

    disposeFns.current.push(() => keyDisp.dispose());
    if (offHistory) disposeFns.current.push(offHistory);
    disposeFns.current.push(offData);
    disposeFns.current.push(() => keyDisp2.dispose());
    disposeFns.current.push(() => resizeObserver.disconnect());

    // Start PTY session after listeners are attached so we don't miss initial output/history
    (async () => {
      try {
        const res = await window.electronAPI.ptyStart({
          id,
          cwd,
          cols,
          rows,
          shell,
          // Disable persistent logging when requested by caller
          disableLog: !logSession,
        });
        if (!res?.ok) {
          term.writeln('\x1b[31mFailed to start PTY:\x1b[0m ' + (res as any)?.error);
        }
      } catch (e: any) {
        term.writeln('\x1b[31mError starting PTY:\x1b[0m ' + (e?.message || String(e)));
      }
    })();

    return () => {
      if (!keepAlive) {
        window.electronAPI.ptyKill(id);
      }
      disposeFns.current.forEach((fn) => fn());
      term.dispose();
      termRef.current = null;
    };
  }, [id, cwd, cols, rows, variant, keepAlive, shell]);

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
    >
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          minHeight: '0',
          overflow: 'hidden',
        }}
      />
    </div>
  );
};

export const TerminalPane = React.memo(TerminalPaneComponent);

export default TerminalPane;
