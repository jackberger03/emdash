import { BrowserWindow, globalShortcut, app } from 'electron';
import { join } from 'path';
import { isDev } from '../utils/dev';
import { getMainWindow } from './window';

let floatingWindow: BrowserWindow | null = null;
let currentWorkspaceId: string | null = null;

export function createFloatingWindow(): BrowserWindow {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    // Prevent dock hiding by keeping main window visible
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (process.platform === 'darwin') {
        app.dock.show();
      }
    }
    floatingWindow.showInactive(); // Show without stealing focus
    return floatingWindow;
  }

  floatingWindow = new BrowserWindow({
    width: 450,
    height: 650,
    minWidth: 350,
    minHeight: 450,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true, // Don't show in taskbar/dock
    resizable: true,
    hasShadow: true,
    vibrancy: 'under-window', // macOS vibrancy
    visualEffectState: 'active',
    focusable: true, // Allow focus when user clicks
    parent: getMainWindow() || undefined, // Set main window as parent to maintain dock presence
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, '..', 'preload.js'),
    },
    show: false,
  });

  // Set window level to absolute highest - appears above everything including full-screen apps
  // 'screen-saver' is the highest level and will show above all full-screen windows
  floatingWindow.setAlwaysOnTop(true, 'screen-saver');

  // Make window visible on all macOS Spaces/Desktops (including full-screen apps)
  floatingWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Additional: Set window collection behavior to allow it to appear on full-screen spaces
  // This ensures it shows up even when switching to full-screen apps
  if (process.platform === 'darwin') {
    // NSWindowCollectionBehaviorCanJoinAllSpaces | NSWindowCollectionBehaviorFullScreenAuxiliary
    floatingWindow.setWindowButtonVisibility(false);
  }

  if (isDev) {
    floatingWindow.loadURL('http://localhost:3000/#/floating-chat');
  } else {
    floatingWindow.loadFile(join(__dirname, '..', '..', 'renderer', 'index.html'), {
      hash: '/floating-chat',
    });
  }

  // Show when ready - don't steal focus from main window
  floatingWindow.once('ready-to-show', () => {
    floatingWindow?.showInactive();
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
    // Show without stealing focus from main app
    floatingWindow.showInactive();
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

let currentHotkey: string | null = null;

export function registerFloatingHotkey(customHotkey?: string): void {
  // Unregister previous hotkey if any
  if (currentHotkey) {
    globalShortcut.unregister(currentHotkey);
    currentHotkey = null;
  }

  // Use custom hotkey or default
  const hotkey = customHotkey || 'CommandOrControl+Shift+Space';

  const success = globalShortcut.register(hotkey, () => {
    toggleFloatingWindow();
  });

  if (success) {
    currentHotkey = hotkey;
    console.log(`Floating window hotkey registered: ${hotkey}`);
  } else {
    console.error('Failed to register floating window hotkey:', hotkey);
  }
}

export function updateFloatingHotkey(newHotkey: string): boolean {
  try {
    registerFloatingHotkey(newHotkey);
    return true;
  } catch (error) {
    console.error('Failed to update floating hotkey:', error);
    return false;
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
