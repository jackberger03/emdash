import { ipcMain } from 'electron';
import { log } from '../lib/logger';
import { OpenRouterService } from '../services/OpenRouterService';

const openRouterService = new OpenRouterService();

export function registerOpenRouterIpc() {
  // Generate commit message from staged changes
  ipcMain.handle(
    'openrouter:generate-commit-message',
    async (_, args: { workspacePath: string; model?: string }) => {
      try {
        log.info('Generating commit message with OpenRouter', { workspacePath: args.workspacePath });
        const result = await openRouterService.generateCommitMessage({
          workspacePath: args.workspacePath,
          model: args.model,
        });
        return result;
      } catch (error: any) {
        log.error('Failed to generate commit message:', error);
        return {
          success: false,
          error: error.message || 'Unknown error occurred',
        };
      }
    }
  );

  // Set OpenRouter API key
  ipcMain.handle('openrouter:set-api-key', async (_, apiKey: string) => {
    try {
      await openRouterService.setApiKey(apiKey);
      log.info('OpenRouter API key saved successfully');
      return { success: true };
    } catch (error: any) {
      log.error('Failed to save OpenRouter API key:', error);
      return {
        success: false,
        error: error.message || 'Failed to save API key',
      };
    }
  });

  // Get OpenRouter API key status
  ipcMain.handle('openrouter:has-api-key', async () => {
    try {
      const hasKey = await openRouterService.hasApiKey();
      return { success: true, hasKey };
    } catch (error: any) {
      log.error('Failed to check OpenRouter API key status:', error);
      return {
        success: false,
        hasKey: false,
        error: error.message || 'Failed to check API key status',
      };
    }
  });

  // Get OpenRouter API key (for displaying in settings)
  ipcMain.handle('openrouter:get-api-key', async () => {
    try {
      const apiKey = await openRouterService.getApiKey();
      return { success: true, apiKey };
    } catch (error: any) {
      log.error('Failed to get OpenRouter API key:', error);
      return {
        success: false,
        error: error.message || 'Failed to get API key',
      };
    }
  });
}
