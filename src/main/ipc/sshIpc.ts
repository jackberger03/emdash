import { ipcMain } from 'electron';
import { sshService } from '../services/SSHService';
import { log } from '../lib/logger';

export function registerSSHIpc() {
  // Test SSH connection
  ipcMain.handle(
    'ssh:testConnection',
    async (
      _,
      config: {
        host: string;
        user: string;
        remotePath: string;
        port?: number;
        keyPath?: string;
      }
    ) => {
      try {
        return await sshService.testConnection(config);
      } catch (error) {
        log.error('SSH test connection failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to test SSH connection',
        };
      }
    }
  );

  // Check if remote path exists
  ipcMain.handle(
    'ssh:checkRemotePath',
    async (
      _,
      config: {
        host: string;
        user: string;
        remotePath: string;
        port?: number;
        keyPath?: string;
      }
    ) => {
      try {
        return await sshService.checkRemotePath(config);
      } catch (error) {
        log.error('SSH check remote path failed:', error);
        return {
          exists: false,
          error: error instanceof Error ? error.message : 'Failed to check remote path',
        };
      }
    }
  );

  // Get default SSH key path
  ipcMain.handle('ssh:getDefaultKeyPath', async () => {
    try {
      return { success: true, path: sshService.getDefaultKeyPath() };
    } catch (error) {
      log.error('Failed to get default SSH key path:', error);
      return { success: false, error: 'Failed to get default SSH key path' };
    }
  });

  // List available SSH keys
  ipcMain.handle('ssh:listAvailableKeys', async () => {
    try {
      const keys = sshService.listAvailableKeys();
      return { success: true, keys };
    } catch (error) {
      log.error('Failed to list SSH keys:', error);
      return { success: false, error: 'Failed to list SSH keys', keys: [] };
    }
  });

  // Execute command over SSH
  ipcMain.handle(
    'ssh:executeCommand',
    async (
      _,
      args: {
        projectId: string;
        config: {
          host: string;
          user: string;
          remotePath: string;
          port?: number;
          keyPath?: string;
        };
        command: string;
      }
    ) => {
      try {
        return await sshService.executeCommand(args.projectId, args.config, args.command);
      } catch (error) {
        log.error('SSH command execution failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to execute SSH command',
        };
      }
    }
  );

  // List remote directories
  ipcMain.handle(
    'ssh:listDirectories',
    async (
      _,
      args: {
        config: {
          host: string;
          user: string;
          remotePath: string;
          port?: number;
          keyPath?: string;
        };
        path?: string;
      }
    ) => {
      try {
        return await sshService.listRemoteDirectories(args.config, args.path);
      } catch (error) {
        log.error('SSH list directories failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to list remote directories',
        };
      }
    }
  );
}
