import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Loader2, X, Check, Folder, ChevronLeft } from 'lucide-react';

interface SSHConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: {
    enabled: boolean;
    host: string;
    user: string;
    remotePath: string;
    port?: number;
    keyPath?: string;
  }) => void;
  initialConfig?: {
    enabled: boolean;
    host: string;
    user: string;
    remotePath: string;
    port?: number;
    keyPath?: string;
  };
}

export const SSHConfigModal: React.FC<SSHConfigModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialConfig,
}) => {
  const [connectionString, setConnectionString] = useState(
    initialConfig ? `${initialConfig.user}@${initialConfig.host}` : ''
  );
  const [host, setHost] = useState(initialConfig?.host ?? '');
  const [user, setUser] = useState(initialConfig?.user ?? '');
  const [port, setPort] = useState(initialConfig?.port ?? 22);
  const [keyPath, setKeyPath] = useState('');
  const [remotePath, setRemotePath] = useState(initialConfig?.remotePath ?? '');

  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState('');

  const [currentPath, setCurrentPath] = useState('~');
  const [directories, setDirectories] = useState<string[]>([]);
  const [isLoadingDirs, setIsLoadingDirs] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadDefaultKeyPath();
    }
  }, [isOpen]);

  const loadDefaultKeyPath = async () => {
    try {
      const api = (window as any).electronAPI;
      const result = await api.sshGetDefaultKeyPath();
      if (result.success && result.path) {
        setKeyPath(result.path);
      }
    } catch (error) {
      console.error('Failed to load default key path:', error);
    }
  };

  const parseConnectionString = (connStr: string) => {
    // Parse user@host or user@host:port
    const match = connStr.match(/^([^@]+)@([^:]+)(?::(\d+))?$/);
    if (match) {
      return {
        user: match[1],
        host: match[2],
        port: match[3] ? parseInt(match[3]) : 22,
      };
    }
    return null;
  };

  const handleConnect = async () => {
    const parsed = parseConnectionString(connectionString);
    if (!parsed) {
      setConnectionError('Invalid format. Use: user@host or user@host:port');
      return;
    }

    setUser(parsed.user);
    setHost(parsed.host);
    setPort(parsed.port);
    setIsConnecting(true);
    setConnectionError('');

    try {
      const api = (window as any).electronAPI;

      // Test connection
      const testResult = await api.sshTestConnection({
        host: parsed.host,
        user: parsed.user,
        remotePath: '~',
        port: parsed.port,
        keyPath,
      });

      if (!testResult.success) {
        setConnectionError(testResult.error || 'Connection failed');
        setIsConnected(false);
        return;
      }

      // Connection successful - load home directory
      setIsConnected(true);
      await loadDirectories('~');
    } catch (error) {
      setConnectionError('Failed to connect. Check your SSH configuration.');
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  };

  const loadDirectories = async (path: string) => {
    setIsLoadingDirs(true);
    try {
      const api = (window as any).electronAPI;
      const result = await api.sshListDirectories({
        config: { host, user, remotePath: path, port, keyPath },
        path,
      });

      if (result.success) {
        setCurrentPath(result.currentPath || path);
        setDirectories(result.directories || []);
      }
    } catch (error) {
      console.error('Failed to load directories:', error);
    } finally {
      setIsLoadingDirs(false);
    }
  };

  const navigateUp = async () => {
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
    await loadDirectories(parentPath);
  };

  const navigateToDirectory = async (dirName: string) => {
    const newPath = `${currentPath}/${dirName}`.replace(/\/+/g, '/');
    await loadDirectories(newPath);
  };

  const selectCurrentDirectory = () => {
    setRemotePath(currentPath);
  };

  const handleSave = () => {
    onSave({
      enabled: true,  // Always enabled if we're in the dialog
      host,
      user,
      remotePath,
      port,
      keyPath,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative mx-4 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg bg-background shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-6">
          <h2 className="text-xl font-semibold">Connect to SSH Server</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {/* Connection String Input */}
            {!isConnected && (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    SSH Connection
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={connectionString}
                      onChange={(e) => setConnectionString(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && connectionString) {
                          handleConnect();
                        }
                      }}
                      placeholder="user@192.168.1.100 or user@host:2222"
                      className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      disabled={isConnecting}
                      autoFocus
                    />
                    <Button
                      onClick={handleConnect}
                      disabled={!connectionString || isConnecting}
                    >
                      {isConnecting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        'Connect'
                      )}
                    </Button>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Enter your SSH connection (e.g., jack@192.168.1.103)
                  </p>
                </div>

                {connectionError && (
                  <Alert variant="destructive">
                    <AlertTitle>Connection Error</AlertTitle>
                    <AlertDescription>{connectionError}</AlertDescription>
                  </Alert>
                )}

                <Alert>
                  <AlertTitle>Note</AlertTitle>
                  <AlertDescription>
                    Make sure your SSH key is configured and the remote server is accessible.
                    The app will use your default SSH key automatically.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* Directory Browser */}
            {isConnected && (
              <div className="space-y-4">
                <Alert variant="default" className="bg-green-500/10 border-green-500/20">
                  <Check className="h-4 w-4 text-green-500" />
                  <AlertTitle className="text-green-500">Connected</AlertTitle>
                  <AlertDescription>
                    Connected to {user}@{host}. Browse and select your project folder.
                  </AlertDescription>
                </Alert>

                {/* Current Path and Select Button */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Current:</span>
                    <code className="rounded bg-muted px-2 py-1 text-sm">
                      {remotePath || currentPath}
                    </code>
                  </div>
                  <Button
                    size="sm"
                    onClick={selectCurrentDirectory}
                    disabled={remotePath === currentPath}
                  >
                    {remotePath === currentPath ? 'Selected' : 'Use This Folder'}
                  </Button>
                </div>

                {/* Directory List */}
                <div className="rounded-lg border border-border">
                  <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2">
                    <span className="text-sm font-medium">Browse: {currentPath}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={navigateUp}
                      disabled={currentPath === '/' || isLoadingDirs}
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      Up
                    </Button>
                  </div>

                  <div className="max-h-64 overflow-y-auto">
                    {isLoadingDirs ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : directories.length === 0 ? (
                      <div className="py-8 text-center text-sm text-muted-foreground">
                        No subdirectories found
                      </div>
                    ) : (
                      <div className="divide-y divide-border">
                        {directories.map((dir) => (
                          <button
                            key={dir}
                            onClick={() => navigateToDirectory(dir)}
                            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-muted/50 transition-colors"
                          >
                            <Folder className="h-4 w-4 text-blue-500" />
                            <span>{dir}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsConnected(false);
                    setDirectories([]);
                    setCurrentPath('~');
                  }}
                >
                  Disconnect
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border p-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!remotePath}
          >
            Save Configuration
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SSHConfigModal;
