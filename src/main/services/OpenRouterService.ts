import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface GenerateCommitMessageOptions {
  workspacePath: string;
  model?: string;
}

export interface CommitMessageResult {
  success: boolean;
  message?: string;
  error?: string;
}

export class OpenRouterService {
  private readonly SERVICE_NAME = 'emdash-openrouter';
  private readonly ACCOUNT_NAME = 'openrouter-api-key';
  private readonly DEFAULT_MODEL = 'x-ai/grok-code-fast-1';

  /**
   * Store OpenRouter API key securely
   */
  async setApiKey(apiKey: string): Promise<void> {
    try {
      const keytar = await import('keytar');
      await keytar.setPassword(this.SERVICE_NAME, this.ACCOUNT_NAME, apiKey);
    } catch (error) {
      console.error('Failed to store OpenRouter API key:', error);
      throw error;
    }
  }

  /**
   * Get stored OpenRouter API key
   */
  async getApiKey(): Promise<string | null> {
    try {
      const keytar = await import('keytar');
      return await keytar.getPassword(this.SERVICE_NAME, this.ACCOUNT_NAME);
    } catch (error) {
      console.error('Failed to retrieve OpenRouter API key:', error);
      return null;
    }
  }

  /**
   * Check if API key is configured
   */
  async hasApiKey(): Promise<boolean> {
    const apiKey = await this.getApiKey();
    return !!apiKey && apiKey.length > 0;
  }

  /**
   * Get staged git diff
   */
  private async getStagedDiff(workspacePath: string): Promise<string> {
    try {
      const { stdout } = await execFileAsync('git', ['diff', '--cached'], {
        cwd: workspacePath,
        maxBuffer: 1024 * 1024 * 10, // 10MB max
      });
      return stdout;
    } catch (error) {
      console.error('Failed to get staged diff:', error);
      throw error;
    }
  }

  /**
   * Generate commit message using OpenRouter API
   */
  async generateCommitMessage(
    options: GenerateCommitMessageOptions
  ): Promise<CommitMessageResult> {
    try {
      const apiKey = await this.getApiKey();

      if (!apiKey) {
        return {
          success: false,
          error: 'OpenRouter API key not configured. Please set your API key in settings.',
        };
      }

      // Get staged changes
      const diff = await this.getStagedDiff(options.workspacePath);

      if (!diff || diff.trim().length === 0) {
        return {
          success: false,
          error: 'No staged changes to generate commit message from.',
        };
      }

      // Prepare the prompt
      const prompt = `You are a helpful assistant that generates concise, conventional commit messages.

Based on the following git diff of staged changes, generate a commit message that:
1. Follows conventional commits format (e.g., "feat:", "fix:", "docs:", "refactor:", etc.)
2. Is concise (50 characters or less for the subject line)
3. Accurately describes what changed and why
4. Uses imperative mood (e.g., "add" not "added")

Git diff:
\`\`\`diff
${diff.slice(0, 8000)}
\`\`\`

Respond with ONLY the commit message, nothing else. No explanations, no markdown formatting, just the commit message text.`;

      // Call OpenRouter API
      const model = options.model || this.DEFAULT_MODEL;
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/generalaction/emdash',
          'X-Title': 'Emdash',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 100,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenRouter API error:', response.status, errorText);
        return {
          success: false,
          error: `OpenRouter API error: ${response.status} ${response.statusText}`,
        };
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const message = data.choices?.[0]?.message?.content?.trim();

      if (!message) {
        return {
          success: false,
          error: 'Failed to generate commit message from API response.',
        };
      }

      return {
        success: true,
        message,
      };
    } catch (error: any) {
      console.error('Failed to generate commit message:', error);
      return {
        success: false,
        error: error.message || 'Unknown error occurred',
      };
    }
  }
}
