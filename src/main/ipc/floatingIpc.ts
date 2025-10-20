import { ipcMain } from 'electron';
import {
  toggleFloatingWindow,
  setFloatingWorkspace,
  getFloatingWorkspace,
  createFloatingWindow,
  updateFloatingHotkey,
} from '../app/floatingWindow';
import { log } from '../lib/logger';

export function registerFloatingIpc() {
  // Toggle floating window
  ipcMain.handle('floating:toggle', async () => {
    try {
      toggleFloatingWindow();
      return { success: true };
    } catch (error) {
      log.error('Failed to toggle floating window:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to toggle floating window',
      };
    }
  });

  // Set workspace for floating window
  ipcMain.handle('floating:setWorkspace', async (_, workspaceId: string) => {
    try {
      setFloatingWorkspace(workspaceId);
      return { success: true };
    } catch (error) {
      log.error('Failed to set floating workspace:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set floating workspace',
      };
    }
  });

  // Get current workspace
  ipcMain.handle('floating:getWorkspace', async () => {
    try {
      const workspaceId = getFloatingWorkspace();
      return { success: true, workspaceId };
    } catch (error) {
      log.error('Failed to get floating workspace:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get floating workspace',
      };
    }
  });

  // Show floating window
  ipcMain.handle('floating:show', async () => {
    try {
      createFloatingWindow();
      return { success: true };
    } catch (error) {
      log.error('Failed to show floating window:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to show floating window',
      };
    }
  });

  // Update hotkey
  ipcMain.handle('floating:updateHotkey', async (_, hotkey: string) => {
    try {
      const success = updateFloatingHotkey(hotkey);
      return { success };
    } catch (error) {
      log.error('Failed to update floating hotkey:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update floating hotkey',
      };
    }
  });
}
