import React from 'react';
import { Command, Settings as SettingsIcon } from 'lucide-react';
import SidebarLeftToggleButton from './SidebarLeftToggleButton';
import SidebarRightToggleButton from './SidebarRightToggleButton';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import OpenInMenu from './OpenInMenu';

interface TitlebarProps {
  onToggleSettings: () => void;
  isSettingsOpen?: boolean;
  currentPath?: string | null;
}

const Titlebar: React.FC<TitlebarProps> = ({
  onToggleSettings,
  isSettingsOpen = false,
  currentPath,
}) => {
  return (
    <header className="fixed inset-x-0 top-0 z-[80] flex h-[var(--tb,36px)] items-center justify-end bg-gray-50 pr-2 shadow-[inset_0_-1px_0_hsl(var(--border))] [-webkit-app-region:drag] dark:bg-gray-900">
      <div className="pointer-events-auto flex items-center gap-1 [-webkit-app-region:no-drag]">
        {currentPath ? <OpenInMenu path={currentPath} align="right" /> : null}
        <SidebarLeftToggleButton />
        <SidebarRightToggleButton />
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={isSettingsOpen ? 'secondary' : 'ghost'}
                size="icon"
                aria-label="Open settings"
                aria-pressed={isSettingsOpen}
                onClick={onToggleSettings}
                className="h-8 w-8 text-muted-foreground hover:bg-background/80"
              >
                <SettingsIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs font-medium">
              <span className="flex items-center gap-1">
                <Command className="h-3 w-3" aria-hidden="true" />
                <span>,</span>
              </span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </header>
  );
};

export default Titlebar;
