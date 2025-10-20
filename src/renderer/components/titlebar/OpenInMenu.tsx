import React from 'react';
import { ChevronDown, Code2 } from 'lucide-react';
import { Button } from '../ui/button';
import cursorLogo from '../../../assets/images/cursorlogo.png';
import finderLogo from '../../../assets/images/finder.png';
import terminalLogo from '../../../assets/images/terminal.png';

interface OpenInMenuProps {
  path: string;
  align?: 'left' | 'right';
}

const menuItemBase =
  'flex w-full cursor-pointer select-none items-center gap-2 rounded px-2.5 py-2 text-sm hover:bg-accent hover:text-accent-foreground';

const OpenInMenu: React.FC<OpenInMenuProps> = ({ path, align = 'right' }) => {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const callOpen = async (app: 'finder' | 'cursor' | 'vscode' | 'terminal') => {
    try {
      await (window as any).electronAPI?.openIn?.({ app, path });
    } catch {}
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 gap-1 px-2 text-muted-foreground hover:bg-background/80"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup
      >
        <span>Open in</span>
        <ChevronDown className="h-4 w-4" />
      </Button>
      {open && (
        <div
          className={[
            'absolute z-50 mt-1 min-w-[180px] rounded-md border border-border bg-popover p-1 shadow-md',
            align === 'right' ? 'right-0' : 'left-0',
          ].join(' ')}
          role="menu"
        >
          <button className={menuItemBase} role="menuitem" onClick={() => callOpen('finder')}>
            <img src={finderLogo} alt="Finder" className="h-4 w-4 rounded" />
            <span>Finder</span>
          </button>
          <button className={menuItemBase} role="menuitem" onClick={() => callOpen('cursor')}>
            <img src={cursorLogo} alt="Cursor" className="h-4 w-4" />
            <span>Cursor</span>
          </button>
          <button className={menuItemBase} role="menuitem" onClick={() => callOpen('terminal')}>
            <img src={terminalLogo} alt="Terminal" className="h-4 w-4 rounded" />
            <span>Terminal</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default OpenInMenu;
