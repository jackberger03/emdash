import { BrowserWindow, globalShortcut } from 'electron';
import { join } from 'path';
import { isDev } from '../utils/dev';

let floatingWindow: BrowserWindow | null = null;
let currentWorkspaceId: string | null = null;

export function createFloatingWindow(): BrowserWindow {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.show();
    floatingWindow.focus();
    return floatingWindow;
  }

  floatingWindow = new BrowserWindow({
    width: 400,
    height: 600,
    minWidth: 300,
    minHeight: 400,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true, // Don't show in taskbar/dock
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, '..', 'preload.js'),
    },
    show: false,
  });

  if (isDev) {
    floatingWindow.loadURL('http://localhost:3000/#/floating-chat');
  } else {
    floatingWindow.loadFile(join(__dirname, '..', '..', 'renderer', 'index.html'), {
      hash: '/floating-chat',
    });
  }

  // Show when ready
  floatingWindow.once('ready-to-show', () => {
    floatingWindow?.show();
  });

  // Keep reference after close (hidden instead of destroyed)
  floatingWindow.on('close', (e) => {
    if (floatingWindow && !floatingWindow.isDestroyed()) {
      e.preventDefault();
      floatingWindow.hide();
    }
  });

  return floatingWindow;
}

export function toggleFloatingWindow(): void {
  if (!floatingWindow || floatingWindow.isDestroyed()) {
    createFloatingWindow();
  } else if (floatingWindow.isVisible()) {
    floatingWindow.hide();
  } else {
    floatingWindow.show();
    floatingWindow.focus();
  }
}

export function getFloatingWindow(): BrowserWindow | null {
  return floatingWindow;
}

export function setFloatingWorkspace(workspaceId: string): void {
  currentWorkspaceId = workspaceId;
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.webContents.send('floating:workspace-changed', workspaceId);
  }
}

export function getFloatingWorkspace(): string | null {
  return currentWorkspaceId;
}

export function registerFloatingHotkey(): void {
  // Register Command+Shift+Space (Mac) or Ctrl+Shift+Space (Windows/Linux)
  const hotkey = process.platform === 'darwin' ? 'Command+Shift+Space' : 'Ctrl+Shift+Space';

  const success = globalShortcut.register(hotkey, () => {
    toggleFloatingWindow();
  });

  if (success) {
    console.log(`Floating window hotkey registered: ${hotkey}`);
  } else {
    console.error('Failed to register floating window hotkey');
  }
}

export function unregisterFloatingHotkey(): void {
  globalShortcut.unregisterAll();
}

export function destroyFloatingWindow(): void {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.destroy();
    floatingWindow = null;
  }
}
