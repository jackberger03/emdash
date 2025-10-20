import { type LinearIssueSummary } from './linear';
import { type GitHubIssueSummary } from './github';

export interface WorkspaceMetadata {
  linearIssue?: LinearIssueSummary | null;
  githubIssue?: GitHubIssueSummary | null;
  initialPrompt?: string | null;
  pullRequest?: {
    number: number;
    title: string;
    url?: string;
    author?: string | null;
    branch?: string;
    baseRefName?: string;
    headRefName?: string;
  } | null;
  isDirect?: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  branch: string;
  path: string;
  status: 'active' | 'idle' | 'running';
  agentId?: string;
  metadata?: WorkspaceMetadata | null;
}

export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'agent';
  timestamp: Date;
  attachments?: string[];
}
