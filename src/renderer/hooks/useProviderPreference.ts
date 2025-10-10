import { useEffect, useState } from 'react';

export type ProviderId = 'codex' | 'claude' | 'aider';

export function useProviderPreference(
  workspaceId: string,
  conversationId: string | null,
  initial: ProviderId = 'codex'
) {
  const [provider, setProvider] = useState<ProviderId>(initial);

  // Reset to initial when switching workspaces before conversation is available
  useEffect(() => {
    if (!conversationId) {
      setProvider(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, conversationId]);

  // Restore preferred provider for this conversation/workspace
  useEffect(() => {
    if (!conversationId) return;
    try {
      const convoKey = `conversationProvider:${conversationId}`;
      const saved = localStorage.getItem(convoKey) as ProviderId | null;
      if (saved) {
        setProvider(saved);
        return;
      }
      const wkKey = `workspaceProvider:${workspaceId}`;
      const wkSaved = localStorage.getItem(wkKey) as ProviderId | null;
      if (wkSaved) setProvider(wkSaved);
    } catch {}
  }, [conversationId, workspaceId]);

  // Persist provider selection per conversation and workspace
  useEffect(() => {
    if (!conversationId) return;
    try {
      localStorage.setItem(`conversationProvider:${conversationId}`, provider);
      localStorage.setItem(`workspaceProvider:${workspaceId}`, provider);
    } catch {}
  }, [provider, conversationId, workspaceId]);

  return { provider, setProvider };
}
