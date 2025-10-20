import { Client, ClientChannel } from 'ssh2';
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { log } from '../lib/logger';

export interface SSHConfig {
  host: string;
  user: string;
  remotePath: string;
  port?: number;
  keyPath?: string;
}

export class SSHService {
  private connections: Map<string, Client> = new Map();

  /**
   * Test SSH connection with the given configuration
   */
  async testConnection(config: SSHConfig): Promise<{ success: boolean; error?: string }> {
    const client = new Client();

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        client.end();
        resolve({ success: false, error: 'Connection timeout' });
      }, 10000);

      client.on('ready', () => {
        clearTimeout(timeout);
        client.end();
        resolve({ success: true });
      });

      client.on('error', (err: Error) => {
        clearTimeout(timeout);
        log.error('SSH connection error:', err);
        resolve({ success: false, error: err.message });
      });

      try {
        const keyPath = config.keyPath || join(homedir(), '.ssh', 'id_rsa');

        if (!existsSync(keyPath)) {
          clearTimeout(timeout);
          resolve({
            success: false,
            error: `SSH key not found at ${keyPath}. Please configure your SSH key path.`
          });
          return;
        }

        const privateKey = readFileSync(keyPath);

        client.connect({
          host: config.host,
          port: config.port || 22,
          username: config.user,
          privateKey,
        });
      } catch (err) {
        clearTimeout(timeout);
        const error = err instanceof Error ? err.message : 'Failed to read SSH key';
        resolve({ success: false, error });
      }
    });
  }

  /**
   * Execute a command over SSH
   */
  async executeCommand(
    projectId: string,
    config: SSHConfig,
    command: string
  ): Promise<{ success: boolean; stdout?: string; stderr?: string; error?: string }> {
    return new Promise((resolve) => {
      const client = new Client();

      client.on('ready', () => {
        // Change to the remote directory and execute the command
        const fullCommand = `cd ${config.remotePath} && ${command}`;

        client.exec(fullCommand, (err: Error | undefined, stream: ClientChannel) => {
          if (err) {
            client.end();
            resolve({ success: false, error: err.message });
            return;
          }

          let stdout = '';
          let stderr = '';

          stream.on('close', () => {
            client.end();
            resolve({ success: true, stdout, stderr });
          });

          stream.on('data', (data: Buffer) => {
            stdout += data.toString();
          });

          stream.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
          });
        });
      });

      client.on('error', (err: Error) => {
        log.error('SSH command execution error:', err);
        resolve({ success: false, error: err.message });
      });

      try {
        const keyPath = config.keyPath || join(homedir(), '.ssh', 'id_rsa');

        if (!existsSync(keyPath)) {
          resolve({
            success: false,
            error: `SSH key not found at ${keyPath}. Please configure your SSH key path.`
          });
          return;
        }

        const privateKey = readFileSync(keyPath);

        client.connect({
          host: config.host,
          port: config.port || 22,
          username: config.user,
          privateKey,
        });
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Failed to read SSH key';
        resolve({ success: false, error });
      }
    });
  }

  /**
   * Check if project directory exists on remote host
   */
  async checkRemotePath(config: SSHConfig): Promise<{ exists: boolean; error?: string }> {
    const result = await this.executeCommand(
      'temp',
      config,
      `test -d "${config.remotePath}" && echo "exists" || echo "not_found"`
    );

    if (!result.success) {
      return { exists: false, error: result.error };
    }

    return { exists: result.stdout?.trim() === 'exists' };
  }

  /**
   * Get the default SSH key path
   */
  getDefaultKeyPath(): string {
    return join(homedir(), '.ssh', 'id_rsa');
  }

  /**
   * List available SSH keys
   */
  listAvailableKeys(): string[] {
    const sshDir = join(homedir(), '.ssh');
    try {
      const fs = require('fs');
      const files = fs.readdirSync(sshDir);
      return files
        .filter((f: string) => !f.endsWith('.pub') && f.startsWith('id_'))
        .map((f: string) => join(sshDir, f));
    } catch {
      return [];
    }
  }
}

export const sshService = new SSHService();
