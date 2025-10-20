import { ipcMain, Notification } from 'electron';

export function registerNotificationIpc() {
  ipcMain.handle(
    'notification:show',
    async (_event, { title, body }: { title: string; body: string }) => {
      try {
        const notification = new Notification({
          title,
          body,
          silent: false,
        });
        notification.show();
        return { success: true };
      } catch (error) {
        console.error('Failed to show notification:', error);
        return { success: false, error: String(error) };
      }
    }
  );
}
