import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execFileAsync = promisify(execFile);

export type GitChange = {
  path: string;
  status: string;
  additions: number;
  deletions: number;
  isStaged: boolean;
};

export async function getStatus(workspacePath: string): Promise<GitChange[]> {
  // Return empty if not a git repo
  try {
    await execFileAsync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: workspacePath,
    });
  } catch {
    return [];
  }

  const { stdout: statusOutput } = await execFileAsync('git', ['status', '--porcelain'], {
    cwd: workspacePath,
  });

  if (!statusOutput.trim()) return [];

  const changes: GitChange[] = [];
  const statusLines = statusOutput
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .filter((l) => l.length > 0);

  for (const line of statusLines) {
    const statusCode = line.substring(0, 2);
    let filePath = line.substring(3);
    if (statusCode.includes('R') && filePath.includes('->')) {
      const parts = filePath.split('->');
      filePath = parts[parts.length - 1].trim();
    }

    let status = 'modified';
    if (statusCode.includes('A') || statusCode.includes('?')) status = 'added';
    else if (statusCode.includes('D')) status = 'deleted';
    else if (statusCode.includes('R')) status = 'renamed';
    else if (statusCode.includes('M')) status = 'modified';

    // Check if file is staged (first character of status code indicates staged changes)
    const isStaged = statusCode[0] !== ' ' && statusCode[0] !== '?';

    if (filePath.endsWith('codex-stream.log')) continue;

    let additions = 0;
    let deletions = 0;

    const sumNumstat = (stdout: string) => {
      const lines = stdout
        .trim()
        .split('\n')
        .filter((l) => l.trim().length > 0);
      for (const l of lines) {
        const p = l.split('\t');
        if (p.length >= 2) {
          const addStr = p[0];
          const delStr = p[1];
          const a = addStr === '-' ? 0 : parseInt(addStr, 10) || 0;
          const d = delStr === '-' ? 0 : parseInt(delStr, 10) || 0;
          additions += a;
          deletions += d;
        }
      }
    };

    try {
      const staged = await execFileAsync('git', ['diff', '--numstat', '--cached', '--', filePath], {
        cwd: workspacePath,
      });
      if (staged.stdout && staged.stdout.trim()) sumNumstat(staged.stdout);
    } catch {}

    try {
      const unstaged = await execFileAsync('git', ['diff', '--numstat', '--', filePath], {
        cwd: workspacePath,
      });
      if (unstaged.stdout && unstaged.stdout.trim()) sumNumstat(unstaged.stdout);
    } catch {}

    if (additions === 0 && deletions === 0 && statusCode.includes('?')) {
      const absPath = path.join(workspacePath, filePath);
      try {
        const stat = fs.existsSync(absPath) ? fs.statSync(absPath) : undefined;
        if (stat && stat.isFile()) {
          const buf = fs.readFileSync(absPath);
          let count = 0;
          for (let i = 0; i < buf.length; i++) if (buf[i] === 0x0a) count++;
          additions = count;
        }
      } catch {}
    }

    changes.push({ path: filePath, status, additions, deletions, isStaged });
  }

  return changes;
}

export async function stageFile(workspacePath: string, filePath: string): Promise<void> {
  await execFileAsync('git', ['add', '--', filePath], { cwd: workspacePath });
}

export async function revertFile(
  workspacePath: string,
  filePath: string
): Promise<{ action: 'unstaged' | 'reverted' }> {
  // Check if file is staged
  try {
    const { stdout: stagedStatus } = await execFileAsync(
      'git',
      ['diff', '--cached', '--name-only', '--', filePath],
      {
        cwd: workspacePath,
      }
    );

    if (stagedStatus.trim()) {
      // File is staged, unstage it (but keep working directory changes)
      await execFileAsync('git', ['reset', 'HEAD', '--', filePath], { cwd: workspacePath });
      return { action: 'unstaged' };
    }
  } catch {
    // Ignore errors, continue with checkout
  }

  // File is not staged, revert working directory changes
  await execFileAsync('git', ['checkout', 'HEAD', '--', filePath], { cwd: workspacePath });
  return { action: 'reverted' };
}

// Get changes between current branch and a base branch (for PR workspaces)
export async function getPRBranchChanges(
  workspacePath: string,
  baseBranch: string
): Promise<GitChange[]> {
  try {
    // Ensure it's a git repo
    await execFileAsync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: workspacePath,
    });
  } catch {
    return [];
  }

  try {
    // First, get committed PR changes (from base to HEAD)
    const { stdout: committedDiffOutput } = await execFileAsync(
      'git',
      ['diff', '--name-status', `origin/${baseBranch}...HEAD`],
      { cwd: workspacePath }
    );

    const committedFiles = new Set<string>();
    const changes: GitChange[] = [];

    if (committedDiffOutput.trim()) {
      const diffLines = committedDiffOutput
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      for (const line of diffLines) {
        const parts = line.split('\t');
        if (parts.length < 2) continue;

        const statusCode = parts[0];
        let filePath = parts[1];

        // Handle renames
        if (statusCode.startsWith('R') && parts.length >= 3) {
          filePath = parts[2]; // Use the new name for renamed files
        }

        let status = 'modified';
        if (statusCode.startsWith('A')) status = 'added';
        else if (statusCode.startsWith('D')) status = 'deleted';
        else if (statusCode.startsWith('R')) status = 'renamed';
        else if (statusCode.startsWith('M')) status = 'modified';

        if (filePath.endsWith('codex-stream.log')) continue;

        committedFiles.add(filePath);

        // Get numstat for additions/deletions
        let additions = 0;
        let deletions = 0;

        try {
          const { stdout: numstatOutput } = await execFileAsync(
            'git',
            ['diff', '--numstat', `origin/${baseBranch}...HEAD`, '--', filePath],
            { cwd: workspacePath }
          );

          const numstatLines = numstatOutput
            .trim()
            .split('\n')
            .filter((l) => l.trim().length > 0);

          for (const l of numstatLines) {
            const p = l.split('\t');
            if (p.length >= 2) {
              const addStr = p[0];
              const delStr = p[1];
              const a = addStr === '-' ? 0 : parseInt(addStr, 10) || 0;
              const d = delStr === '-' ? 0 : parseInt(delStr, 10) || 0;
              additions += a;
              deletions += d;
            }
          }
        } catch {
          // Ignore numstat errors
        }

        // Mark committed PR changes as "staged" to differentiate from local changes
        changes.push({ path: filePath, status, additions, deletions, isStaged: true });
      }
    }

    // Now get local uncommitted changes in working directory
    const { stdout: statusOutput } = await execFileAsync('git', ['status', '--porcelain'], {
      cwd: workspacePath,
    });

    if (statusOutput.trim()) {
      const statusLines = statusOutput
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      for (const line of statusLines) {
        if (line.length < 3) continue;

        const stagedCode = line[0];
        const unstagedCode = line[1];
        const filePath = line.substring(3);

        if (filePath.endsWith('codex-stream.log')) continue;

        // Skip if this file is already tracked as a committed change
        if (committedFiles.has(filePath)) continue;

        let status = 'modified';
        const code = unstagedCode !== ' ' ? unstagedCode : stagedCode;

        if (code === 'A' || code === '?') status = 'added';
        else if (code === 'D') status = 'deleted';
        else if (code === 'M') status = 'modified';

        // Get numstat for local changes
        let additions = 0;
        let deletions = 0;

        try {
          const { stdout: numstatOutput } = await execFileAsync(
            'git',
            ['diff', '--numstat', 'HEAD', '--', filePath],
            { cwd: workspacePath }
          );

          const numstatLines = numstatOutput
            .trim()
            .split('\n')
            .filter((l) => l.trim().length > 0);

          for (const l of numstatLines) {
            const p = l.split('\t');
            if (p.length >= 2) {
              const addStr = p[0];
              const delStr = p[1];
              const a = addStr === '-' ? 0 : parseInt(addStr, 10) || 0;
              const d = delStr === '-' ? 0 : parseInt(delStr, 10) || 0;
              additions += a;
              deletions += d;
            }
          }
        } catch {
          // Ignore numstat errors
        }

        // Mark local uncommitted changes as not staged
        changes.push({ path: filePath, status, additions, deletions, isStaged: false });
      }
    }

    return changes;
  } catch (error) {
    console.error('Error getting PR branch changes:', error);
    return [];
  }
}

export async function stageAll(workspacePath: string): Promise<void> {
  await execFileAsync('git', ['add', '-A'], { cwd: workspacePath });
}

export async function unstageAll(workspacePath: string): Promise<void> {
  await execFileAsync('git', ['reset', 'HEAD', '--'], { cwd: workspacePath });
}

export async function gitCommit(
  workspacePath: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await execFileAsync('git', ['commit', '-m', message], { cwd: workspacePath });
    return { success: true };
  } catch (error: any) {
    if (error.message && /nothing to commit/i.test(error.message)) {
      return { success: false, error: 'Nothing to commit' };
    }
    throw error;
  }
}

export async function gitPush(
  workspacePath: string
): Promise<{ success: boolean; branch?: string; error?: string }> {
  try {
    // Try regular push first
    await execFileAsync('git', ['push'], { cwd: workspacePath });
    const { stdout: branchOut } = await execFileAsync('git', ['branch', '--show-current'], {
      cwd: workspacePath,
    });
    return { success: true, branch: branchOut.trim() };
  } catch (error: any) {
    // If push fails, try setting upstream
    try {
      const { stdout: branchOut } = await execFileAsync('git', ['branch', '--show-current'], {
        cwd: workspacePath,
      });
      const branch = branchOut.trim();
      await execFileAsync('git', ['push', '--set-upstream', 'origin', branch], {
        cwd: workspacePath,
      });
      return { success: true, branch };
    } catch (upstreamError: any) {
      return {
        success: false,
        error: upstreamError.message || 'Failed to push to remote',
      };
    }
  }
}

export async function gitPull(
  workspacePath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await execFileAsync('git', ['pull'], { cwd: workspacePath });
    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to pull from remote',
    };
  }
}

export async function gitSync(
  workspacePath: string,
  commitMessage?: string
): Promise<{ success: boolean; error?: string; branch?: string }> {
  try {
    // 1. Commit if there are staged changes
    if (commitMessage) {
      try {
        await execFileAsync('git', ['commit', '-m', commitMessage], { cwd: workspacePath });
      } catch (error: any) {
        if (!error.message || !/nothing to commit/i.test(error.message)) {
          throw error;
        }
      }
    }

    // 2. Pull
    try {
      await execFileAsync('git', ['pull', '--rebase'], { cwd: workspacePath });
    } catch (pullError: any) {
      // If pull fails due to no upstream, continue to push
      if (!/no tracking information/i.test(pullError.message)) {
        throw pullError;
      }
    }

    // 3. Push
    const { stdout: branchOut } = await execFileAsync('git', ['branch', '--show-current'], {
      cwd: workspacePath,
    });
    const branch = branchOut.trim();

    try {
      await execFileAsync('git', ['push'], { cwd: workspacePath });
    } catch {
      // Set upstream if needed
      await execFileAsync('git', ['push', '--set-upstream', 'origin', branch], {
        cwd: workspacePath,
      });
    }

    return { success: true, branch };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Sync failed',
    };
  }
}

export async function getFileDiff(
  workspacePath: string,
  filePath: string
): Promise<{ lines: Array<{ left?: string; right?: string; type: 'context' | 'add' | 'del' }> }> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['diff', '--no-color', '--unified=2000', 'HEAD', '--', filePath],
      { cwd: workspacePath }
    );

    const linesRaw = stdout.split('\n');
    const result: Array<{ left?: string; right?: string; type: 'context' | 'add' | 'del' }> = [];
    for (const line of linesRaw) {
      if (!line) continue;
      if (
        line.startsWith('diff ') ||
        line.startsWith('index ') ||
        line.startsWith('--- ') ||
        line.startsWith('+++ ') ||
        line.startsWith('@@')
      )
        continue;
      const prefix = line[0];
      const content = line.slice(1);
      if (prefix === ' ') result.push({ left: content, right: content, type: 'context' });
      else if (prefix === '-') result.push({ left: content, type: 'del' });
      else if (prefix === '+') result.push({ right: content, type: 'add' });
      else result.push({ left: line, right: line, type: 'context' });
    }

    if (result.length === 0) {
      try {
        const abs = path.join(workspacePath, filePath);
        if (fs.existsSync(abs)) {
          const content = fs.readFileSync(abs, 'utf8');
          return { lines: content.split('\n').map((l) => ({ right: l, type: 'add' as const })) };
        } else {
          const { stdout: prev } = await execFileAsync('git', ['show', `HEAD:${filePath}`], {
            cwd: workspacePath,
          });
          return { lines: prev.split('\n').map((l) => ({ left: l, type: 'del' as const })) };
        }
      } catch {
        return { lines: [] };
      }
    }

    return { lines: result };
  } catch {
    try {
      const abs = path.join(workspacePath, filePath);
      const content = fs.readFileSync(abs, 'utf8');
      const lines = content.split('\n');
      return { lines: lines.map((l) => ({ right: l, type: 'add' as const })) };
    } catch {
      try {
        const { stdout } = await execFileAsync(
          'git',
          ['diff', '--no-color', '--unified=2000', 'HEAD', '--', filePath],
          { cwd: workspacePath }
        );
        const linesRaw = stdout.split('\n');
        const result: Array<{ left?: string; right?: string; type: 'context' | 'add' | 'del' }> =
          [];
        for (const line of linesRaw) {
          if (!line) continue;
          if (
            line.startsWith('diff ') ||
            line.startsWith('index ') ||
            line.startsWith('--- ') ||
            line.startsWith('+++ ') ||
            line.startsWith('@@')
          )
            continue;
          const prefix = line[0];
          const content = line.slice(1);
          if (prefix === ' ') result.push({ left: content, right: content, type: 'context' });
          else if (prefix === '-') result.push({ left: content, type: 'del' });
          else if (prefix === '+') result.push({ right: content, type: 'add' });
          else result.push({ left: line, right: line, type: 'context' });
        }
        if (result.length === 0) {
          try {
            const { stdout: prev } = await execFileAsync('git', ['show', `HEAD:${filePath}`], {
              cwd: workspacePath,
            });
            return { lines: prev.split('\n').map((l) => ({ left: l, type: 'del' as const })) };
          } catch {
            return { lines: [] };
          }
        }
        return { lines: result };
      } catch {
        return { lines: [] };
      }
    }
  }
}
