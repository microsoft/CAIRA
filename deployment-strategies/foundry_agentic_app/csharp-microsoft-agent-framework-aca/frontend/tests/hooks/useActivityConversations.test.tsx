/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useActivityConversations } from '../../src/hooks/useActivityConversations.ts';
import type { ActivityClient } from '../../src/api/activity-client.ts';
import type { ActivityConversationList, ActivityConversation, ActivityConversationStarted } from '../../src/types.ts';

const CONVERSATION: ActivityConversation = {
  id: 'conv-1',
  mode: 'discovery',
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
  lastMessageAt: '2026-01-02T00:00:00Z',
  messageCount: 3
};

const CONVERSATION_LIST: ActivityConversationList = {
  conversations: [CONVERSATION],
  offset: 0,
  limit: 50,
  total: 1
};

const STARTED_CONVERSATION: ActivityConversationStarted = {
  id: 'conv-new',
  mode: 'planning',
  status: 'active',
  syntheticMessage:
    'I need an account plan for an active customer. Guide me through priorities, risks, and next steps, then conclude with a concise planning summary.',
  createdAt: '2026-01-01T00:00:00Z'
};

function createMockClient(): ActivityClient {
  return {
    listActivityConversations: vi.fn().mockResolvedValue(CONVERSATION_LIST),
    startDiscovery: vi.fn().mockResolvedValue(STARTED_CONVERSATION),
    startPlanning: vi.fn().mockResolvedValue(STARTED_CONVERSATION),
    startStaffing: vi.fn().mockResolvedValue(STARTED_CONVERSATION),
    getActivityConversation: vi.fn(),
    message: vi.fn(),
    messageStream: vi.fn(),
    getStats: vi.fn(),
    getHealth: vi.fn()
  } as any;
}

describe('useActivityConversations', () => {
  let mockClient: ActivityClient;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  it('loads conversations on mount', async () => {
    const { result } = renderHook(() => useActivityConversations(mockClient));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.conversations).toEqual([CONVERSATION]);
    expect(mockClient.listActivityConversations).toHaveBeenCalledWith(0, 50);
  });

  it('starts with loading state', () => {
    (mockClient.listActivityConversations as any).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useActivityConversations(mockClient));
    expect(result.current.isLoading).toBe(true);
  });

  it('sets error on load failure', async () => {
    (mockClient.listActivityConversations as any).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useActivityConversations(mockClient));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.conversations).toEqual([]);
  });

  it('starts a discovery conversation and selects it', async () => {
    const discoveryStarted: ActivityConversationStarted = {
      ...STARTED_CONVERSATION,
      mode: 'discovery',
      id: 'conv-discovery'
    };
    (mockClient.startDiscovery as any).mockResolvedValue(discoveryStarted);

    const { result } = renderHook(() => useActivityConversations(mockClient));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.startActivityConversation('discovery');
    });

    expect(result.current.selectedId).toBe('conv-discovery');
    expect(result.current.conversations[0]?.id).toBe('conv-discovery');
    expect(result.current.conversations[0]?.mode).toBe('discovery');
    expect(mockClient.startDiscovery).toHaveBeenCalled();
  });

  it('starts a planning conversation via startPlanning', async () => {
    const { result } = renderHook(() => useActivityConversations(mockClient));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.startActivityConversation('planning');
    });

    expect(mockClient.startPlanning).toHaveBeenCalled();
    expect(result.current.selectedId).toBe('conv-new');
  });

  it('starts a staffing conversation via startStaffing', async () => {
    const staffingStarted: ActivityConversationStarted = {
      ...STARTED_CONVERSATION,
      mode: 'staffing',
      id: 'conv-staffing'
    };
    (mockClient.startStaffing as any).mockResolvedValue(staffingStarted);

    const { result } = renderHook(() => useActivityConversations(mockClient));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.startActivityConversation('staffing');
    });

    expect(mockClient.startStaffing).toHaveBeenCalled();
    expect(result.current.selectedId).toBe('conv-staffing');
  });

  it('sets error on start failure', async () => {
    (mockClient.startDiscovery as any).mockRejectedValue(new Error('Start failed'));

    const { result } = renderHook(() => useActivityConversations(mockClient));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.startActivityConversation('discovery');
    });

    expect(result.current.error).toBe('Start failed');
  });

  it('selects an activity conversation', async () => {
    const { result } = renderHook(() => useActivityConversations(mockClient));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.selectActivityConversation('conv-1');
    });

    expect(result.current.selectedId).toBe('conv-1');
  });

  it('refreshes conversations', async () => {
    const { result } = renderHook(() => useActivityConversations(mockClient));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // First call is from mount
    expect(mockClient.listActivityConversations).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockClient.listActivityConversations).toHaveBeenCalledTimes(2);
  });

  it('exposes loadingMode as null when idle', async () => {
    const { result } = renderHook(() => useActivityConversations(mockClient));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.loadingMode).toBeNull();
  });

  it('sets loadingMode to the mode being started', async () => {
    // Make startDiscovery hang so we can observe loadingMode mid-flight
    let resolveStart!: (value: any) => void;
    (mockClient.startDiscovery as any).mockReturnValue(
      new Promise((resolve) => {
        resolveStart = resolve;
      })
    );

    const { result } = renderHook(() => useActivityConversations(mockClient));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Start the conversation (don't await)
    let startPromise: Promise<void>;
    act(() => {
      startPromise = result.current.startActivityConversation('discovery');
    });

    // loadingMode should be 'discovery' while in-flight
    expect(result.current.loadingMode).toBe('discovery');

    // Resolve it
    await act(async () => {
      resolveStart(STARTED_CONVERSATION);
      await startPromise;
    });

    // loadingMode should be null after completion
    expect(result.current.loadingMode).toBeNull();
  });

  it('clears loadingMode on start failure', async () => {
    (mockClient.startDiscovery as any).mockRejectedValue(new Error('Start failed'));

    const { result } = renderHook(() => useActivityConversations(mockClient));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.startActivityConversation('discovery');
    });

    expect(result.current.loadingMode).toBeNull();
    expect(result.current.error).toBe('Start failed');
  });

  // ---- pendingFirstMessage tests ----

  it('sets pendingFirstMessage after starting an activity conversation', async () => {
    const { result } = renderHook(() => useActivityConversations(mockClient));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Initially null
    expect(result.current.pendingFirstMessage).toBeNull();

    await act(async () => {
      await result.current.startActivityConversation('planning');
    });

    expect(result.current.pendingFirstMessage).toBe(STARTED_CONVERSATION.syntheticMessage);
  });

  it('clearPendingFirstMessage resets pendingFirstMessage to null', async () => {
    const { result } = renderHook(() => useActivityConversations(mockClient));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.startActivityConversation('planning');
    });

    expect(result.current.pendingFirstMessage).not.toBeNull();

    act(() => {
      result.current.clearPendingFirstMessage();
    });

    expect(result.current.pendingFirstMessage).toBeNull();
  });

  it('does not set pendingFirstMessage on start failure', async () => {
    (mockClient.startDiscovery as any).mockRejectedValue(new Error('Start failed'));

    const { result } = renderHook(() => useActivityConversations(mockClient));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.startActivityConversation('discovery');
    });

    expect(result.current.pendingFirstMessage).toBeNull();
  });

  it('sets messageCount to 0 for a newly started activity conversation', async () => {
    const { result } = renderHook(() => useActivityConversations(mockClient));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.startActivityConversation('planning');
    });

    const newActivityConversation = result.current.conversations.find((a) => a.id === 'conv-new');
    expect(newActivityConversation).toBeDefined();
    expect(newActivityConversation?.messageCount).toBe(0);
  });
});
