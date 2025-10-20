import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Loader2, X, Check, AlertCircle } from 'lucide-react';

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
  const [enabled, setEnabled] = useState(initialConfig?.enabled ?? false);
  const [host, setHost] = useState(initialConfig?.host ?? '');
  const [user, setUser] = useState(initialConfig?.user ?? '');
  const [remotePath, setRemotePath] = useState(initialConfig?.remotePath ?? '');
  const [port, setPort] = useState(initialConfig?.port?.toString() ?? '22');
  const [keyPath, setKeyPath] = useState(initialConfig?.keyPath ?? '');
  const [availableKeys, setAvailableKeys] = useState<string[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadAvailableKeys();
      loadDefaultKeyPath();
    }
  }, [isOpen]);

  const loadAvailableKeys = async () => {
    const api = (window as any).electronAPI;
    const result = await api.sshListAvailableKeys();
    if (result.success && result.keys) {
      setAvailableKeys(result.keys);
    }
  };

  const loadDefaultKeyPath = async () => {
    if (!keyPath) {
      const api = (window as any).electronAPI;
      const result = await api.sshGetDefaultKeyPath();
      if (result.success && result.path) {
        setKeyPath(result.path);
      }
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const api = (window as any).electronAPI;
      const result = await api.sshTestConnection({
        host,
        user,
        remotePath,
        port: port ? parseInt(port) : 22,
        keyPath,
      });

      setTestResult(result);
    } catch (error) {
      setTestResult({ success: false, error: 'Failed to test connection' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    onSave({
      enabled,
      host,
      user,
      remotePath,
      port: port ? parseInt(port) : undefined,
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
          <h2 className="text-xl font-semibold">SSH Configuration</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {/* Enable SSH */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="ssh-enabled"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="ssh-enabled" className="text-sm font-medium">
                Enable SSH for this project
              </label>
            </div>

            {enabled && (
              <>
                {/* Host */}
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Host <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="example.com or 192.168.1.100"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                {/* User */}
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    User <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    placeholder="username"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                {/* Remote Path */}
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Remote Path <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={remotePath}
                    onChange={(e) => setRemotePath(e.target.value)}
                    placeholder="/home/username/project"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                {/* Port */}
                <div>
                  <label className="mb-1 block text-sm font-medium">Port</label>
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    placeholder="22"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                {/* SSH Key */}
                <div>
                  <label className="mb-1 block text-sm font-medium">SSH Key Path</label>
                  {availableKeys.length > 0 ? (
                    <select
                      value={keyPath}
                      onChange={(e) => setKeyPath(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {availableKeys.map((key) => (
                        <option key={key} value={key}>
                          {key}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={keyPath}
                      onChange={(e) => setKeyPath(e.target.value)}
                      placeholder="~/.ssh/id_rsa"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  )}
                </div>

                {/* Test Connection */}
                <div>
                  <Button
                    onClick={handleTest}
                    disabled={!host || !user || !remotePath || isTesting}
                    variant="outline"
                    size="sm"
                  >
                    {isTesting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      'Test Connection'
                    )}
                  </Button>

                  {testResult && (
                    <Alert
                      variant={testResult.success ? 'default' : 'destructive'}
                      className="mt-3"
                    >
                      {testResult.success ? (
                        <>
                          <Check className="h-4 w-4" />
                          <AlertTitle>Success</AlertTitle>
                          <AlertDescription>SSH connection successful!</AlertDescription>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Error</AlertTitle>
                          <AlertDescription>
                            {testResult.error || 'Connection failed'}
                          </AlertDescription>
                        </>
                      )}
                    </Alert>
                  )}
                </div>

                <Alert>
                  <AlertTitle>Note</AlertTitle>
                  <AlertDescription>
                    Make sure your SSH key is added to the remote server's authorized_keys file and
                    doesn't require a passphrase.
                  </AlertDescription>
                </Alert>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border p-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={enabled && (!host || !user || !remotePath)}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SSHConfigModal;
