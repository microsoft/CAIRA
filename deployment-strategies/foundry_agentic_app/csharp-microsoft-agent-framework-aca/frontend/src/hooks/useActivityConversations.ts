import { useState, useCallback, useEffect } from 'react';
import type { ActivityConversation, ActivityMode } from '../types.ts';
import type { ActivityClient } from '../api/activity-client.ts';

interface UseActivityConversationsResult {
  readonly conversations: readonly ActivityConversation[];
  readonly selectedId: string | null;
  readonly isLoading: boolean;
  /** The mode currently being started, or null if idle. */
  readonly loadingMode: ActivityMode | null;
  readonly error: string | null;
  /** Synthetic message for a newly started conversation (cleared after consumption). */
  readonly pendingFirstMessage: string | null;
  readonly selectActivityConversation: (id: string) => void;
  readonly startActivityConversation: (mode: ActivityMode) => Promise<void>;
  readonly clearPendingFirstMessage: () => void;
  readonly refresh: () => Promise<void>;
}

export function useActivityConversations(client: ActivityClient): UseActivityConversationsResult {
  const [conversations, setActivityConversations] = useState<readonly ActivityConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMode, setLoadingMode] = useState<ActivityMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingFirstMessage, setPendingFirstMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await client.listActivityConversations(0, 50);
      setActivityConversations(result.conversations);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load conversations';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  const startActivityConversation = useCallback(
    async (mode: ActivityMode) => {
      setIsLoading(true);
      setLoadingMode(mode);
      setError(null);
      try {
        let started;
        switch (mode) {
          case 'discovery':
            started = await client.startDiscovery();
            break;
          case 'planning':
            started = await client.startPlanning();
            break;
          case 'staffing':
            started = await client.startStaffing();
            break;
        }
        const conversation: ActivityConversation = {
          id: started.id,
          mode: started.mode,
          status: started.status,
          createdAt: started.createdAt,
          lastMessageAt: started.createdAt,
          messageCount: 0
        };
        setActivityConversations((prev) => [conversation, ...prev]);
        // Set the pending first message BEFORE setting selectedId so that
        // useChat can pick it up when it reacts to the conversationId change.
        setPendingFirstMessage(started.syntheticMessage);
        setSelectedId(started.id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to start activity conversation';
        setError(msg);
      } finally {
        setIsLoading(false);
        setLoadingMode(null);
      }
    },
    [client]
  );

  const selectActivityConversation = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const clearPendingFirstMessage = useCallback(() => {
    setPendingFirstMessage(null);
  }, []);

  // Load conversations on mount
  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    conversations,
    selectedId,
    isLoading,
    loadingMode,
    error,
    pendingFirstMessage,
    selectActivityConversation,
    startActivityConversation,
    clearPendingFirstMessage,
    refresh
  };
}
