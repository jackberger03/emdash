import { registerPtyIpc } from '../services/ptyIpc';
import { registerWorktreeIpc } from '../services/worktreeIpc';
import { registerFsIpc } from '../services/fsIpc';
import { setupCodexIpc } from '../services/codexIpc';

import { registerAppIpc } from './appIpc';
import { registerProjectIpc } from './projectIpc';
import { registerGithubIpc } from './githubIpc';
import { registerDatabaseIpc } from './dbIpc';
import { registerDebugIpc } from './debugIpc';
import { registerGitIpc } from './gitIpc';
import { registerAgentIpc } from './agentIpc';
import { registerLinearIpc } from './linearIpc';
import { registerConnectionsIpc } from './connectionsIpc';
import { registerUpdateIpc } from '../services/updateIpc';
import { registerTelemetryIpc } from './telemetryIpc';
import { registerNotificationIpc } from './notificationIpc';
import { registerSSHIpc } from './sshIpc';
import { registerFloatingIpc } from './floatingIpc';
import { registerOpenRouterIpc } from './openRouterIpc';

export function registerAllIpc() {
  // Core app/utility IPC
  registerAppIpc();
  registerDebugIpc();
  registerTelemetryIpc();
  registerUpdateIpc();
  registerNotificationIpc();
  registerFloatingIpc();

  // Domain IPC
  registerProjectIpc();
  registerGithubIpc();
  registerDatabaseIpc();
  registerGitIpc();
  registerSSHIpc();
  registerOpenRouterIpc();

  // Existing modules
  registerPtyIpc();
  registerWorktreeIpc();
  registerFsIpc();
  setupCodexIpc();
  registerAgentIpc();
  registerLinearIpc();
  registerConnectionsIpc();

  // console.log('✅ All IPC handlers registered');
}
