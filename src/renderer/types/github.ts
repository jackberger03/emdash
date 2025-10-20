export interface GitHubUserRef {
  login?: string | null;
  avatarUrl?: string | null;
}

export interface GitHubLabelRef {
  name?: string | null;
  color?: string | null;
}

export interface GitHubMilestoneRef {
  title?: string | null;
}

export interface GitHubIssueSummary {
  id: number;
  number: number;
  title: string;
  body?: string | null;
  url?: string | null;
  state?: 'open' | 'closed' | null;
  labels?: GitHubLabelRef[] | null;
  assignee?: GitHubUserRef | null;
  assignees?: GitHubUserRef[] | null;
  milestone?: GitHubMilestoneRef | null;
  updatedAt?: string | null;
}
