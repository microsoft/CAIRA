/**
 * Chat hook — thin projection layer over the per-conversation state map.
 *
 * Returns the same `UseChatResult` interface that components expect, but
 * reads state from the `useConversationStates` map rather than owning it.
 * This means switching conversations is instant (no re-fetch, no state loss)
 * and background conversations keep streaming independently.
 */

import { useCallback, useEffect, useRef } from 'react';
import type { ActivityOutcome, ActivityMessage } from '../types.ts';
import type { UseConversationStatesResult } from './useConversationStates.ts';

interface UseChatOptions {
  /** When false, uses JSON request/response instead of SSE streaming (default: true). */
  readonly streaming?: boolean;
  /**
   * Synthetic message for a newly started conversation.
   * When set together with a new conversationId, useChat will skip the
   * getActivityConversation fetch and instead show this as the first user bubble,
   * then stream the agent's opening response via messageStream.
   */
  readonly pendingFirstMessage?: string | null;
  /** Callback to clear the pending first message after it has been consumed. */
  readonly onPendingFirstMessageConsumed?: () => void;
}

export interface UseChatResult {
  readonly messages: readonly ActivityMessage[];
  readonly streamingContent: string;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly outcome: ActivityOutcome | null;
  readonly activeSpecialist: string | null;
  readonly sendMessage: (message: string) => Promise<void>;
}

const EMPTY_MESSAGES: readonly ActivityMessage[] = [];

export function useChat(
  store: UseConversationStatesResult,
  conversationId: string | null,
  options: UseChatOptions = {}
): UseChatResult {
  // Use refs for pending first message to avoid re-triggering the effect
  // when the parent clears it (which would cause an infinite loop).
  const pendingFirstMessageRef = useRef(options.pendingFirstMessage ?? null);
  pendingFirstMessageRef.current = options.pendingFirstMessage ?? null;

  const onConsumedRef = useRef(options.onPendingFirstMessageConsumed);
  onConsumedRef.current = options.onPendingFirstMessageConsumed;

  // When conversationId changes, either stream the first message or load from server.
  useEffect(() => {
    if (!conversationId) return;

    const pendingMessage = pendingFirstMessageRef.current;

    if (pendingMessage) {
      // New conversation — stream the first message.
      onConsumedRef.current?.();
      store.streamFirstMessage(conversationId, pendingMessage);
    } else {
      // Existing conversation — load from server (no-op if already loaded).
      store.loadConversation(conversationId);
    }
  }, [store, conversationId]);

  // Project the selected conversation's state.
  const state = conversationId ? store.getState(conversationId) : null;

  const sendMessage = useCallback(
    async (message: string) => {
      if (!conversationId) return;
      await store.sendMessage(conversationId, message);
    },
    [store, conversationId]
  );

  return {
    messages: state?.messages ?? EMPTY_MESSAGES,
    streamingContent: state?.streamingContent ?? '',
    isLoading: state?.isLoading ?? false,
    error: state?.error ?? null,
    outcome: state?.outcome ?? null,
    activeSpecialist: state?.activeSpecialist ?? null,
    sendMessage
  };
}
