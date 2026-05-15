/**
 * Per-conversation state store.
 *
 * Holds a `Map<conversationId, ChatState>` so every conversation independently
 * tracks its own messages, streaming content, loading state, tool activity, and
 * resolution outcome.  Streams run in the background regardless of which
 * conversation is currently selected — switching conversations doesn't interrupt
 * anything.
 *
 * The hook exposes:
 *   - `getState(id)` — read a conversation's current state
 *   - `loadConversation(id)` — fetch messages from the server (cached if already loaded)
 *   - `streamFirstMessage(id, message)` — stream the opening agent response for a new activity conversation
 *   - `sendMessage(id, message)` — send a user message (streaming or JSON, per `streaming` flag)
 *   - `abortAll()` — cancel every in-flight stream (called on unmount)
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import type { ActivityOutcome, ActivityMessage } from '../types.ts';
import type { ActivityClient } from '../api/activity-client.ts';

// ---------------------------------------------------------------------------
// ChatState — the per-conversation state shape
// ---------------------------------------------------------------------------

export interface ChatState {
  /** Messages loaded or accumulated for this conversation. */
  messages: readonly ActivityMessage[];
  /** Text accumulated from streaming deltas (empty when not streaming). */
  streamingContent: string;
  /** True while loading messages or waiting for an agent response. */
  isLoading: boolean;
  /** Error message, if any. */
  error: string | null;
  /** Resolution outcome, if the conversation has been resolved. */
  outcome: ActivityOutcome | null;
  /** Active specialist tool name (e.g. "discovery_specialist"), or null. */
  activeSpecialist: string | null;
  /** Whether the initial message load from the server has completed. */
  loaded: boolean;
}

function createEmptyState(): ChatState {
  return {
    messages: [],
    streamingContent: '',
    isLoading: false,
    error: null,
    outcome: null,
    activeSpecialist: null,
    loaded: false
  };
}

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export interface UseConversationStatesResult {
  /** Read the current state for a conversation (returns empty defaults if unknown). */
  getState: (id: string) => ChatState;
  /** Fetch messages from the server for a conversation (no-op if already loaded/loading). */
  loadConversation: (id: string) => void;
  /** Stream the first agent response for a newly created conversation. */
  streamFirstMessage: (id: string, message: string) => void;
  /**
   * Send a user message to a conversation.
   * Uses streaming or JSON depending on the `streaming` option.
   */
  sendMessage: (id: string, message: string) => Promise<void>;
  /** Cancel all in-flight streams (for unmount cleanup). */
  abortAll: () => void;
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

export function useConversationStates(
  client: ActivityClient,
  options: { streaming: boolean }
): UseConversationStatesResult {
  // The state map lives in a ref so mutations don't cause re-renders.
  // We trigger re-renders explicitly via `tick` when we want the UI to update.
  const stateMap = useRef(new Map<string, ChatState>());

  // AbortControllers for in-flight streams, keyed by conversationId.
  const abortControllers = useRef(new Map<string, AbortController>());

  // Render trigger — incrementing this forces a re-render.
  const [, setTick] = useState(0);
  const rerender = useCallback(() => setTick((t) => t + 1), []);

  // Stable ref to `streaming` so async closures always see the latest value.
  const streamingRef = useRef(options.streaming);
  streamingRef.current = options.streaming;

  // ---- Helpers ----

  /** Get or create a conversation's state entry. */
  const ensureState = useCallback((id: string): ChatState => {
    let state = stateMap.current.get(id);
    if (!state) {
      state = createEmptyState();
      stateMap.current.set(id, state);
    }
    return state;
  }, []);

  /** Update a conversation's state and trigger a re-render. */
  const update = useCallback(
    (id: string, patch: Partial<ChatState>) => {
      const state = ensureState(id);
      Object.assign(state, patch);
      rerender();
    },
    [ensureState, rerender]
  );

  /** Cancel any existing stream for a conversation. */
  const abortStream = useCallback((id: string) => {
    const controller = abortControllers.current.get(id);
    if (controller) {
      controller.abort();
      abortControllers.current.delete(id);
    }
  }, []);

  /** Create a new AbortController for a conversation, cancelling any existing one. */
  const newAbortController = useCallback(
    (id: string): AbortController => {
      abortStream(id);
      const controller = new AbortController();
      abortControllers.current.set(id, controller);
      return controller;
    },
    [abortStream]
  );

  // ---- Process an SSE stream into state ----

  const processStream = useCallback(
    async (id: string, message: string, signal: AbortSignal) => {
      let accumulated = '';
      let completeMessage: ActivityMessage | null = null;

      try {
        for await (const event of client.messageStream(id, message, signal)) {
          if (signal.aborted) break;

          switch (event.type) {
            case 'delta':
              accumulated += event.content;
              update(id, { streamingContent: accumulated });
              break;
            case 'complete':
              completeMessage = event.message;
              break;
            case 'activity.resolved':
              update(id, { outcome: event.outcome });
              break;
            case 'tool.called':
              update(id, { activeSpecialist: event.toolName });
              break;
            case 'tool.done':
              update(id, { activeSpecialist: null });
              break;
            case 'error':
              update(id, { error: event.message });
              break;
          }
        }

        if (!signal.aborted) {
          const state = ensureState(id);
          const patches: Partial<ChatState> = {
            streamingContent: '',
            activeSpecialist: null,
            isLoading: false
          };
          if (completeMessage && completeMessage.content.trim().length > 0) {
            patches.messages = [...state.messages, completeMessage];
          }
          update(id, patches);
        }
      } catch (err) {
        if (!signal.aborted) {
          const msg = err instanceof Error ? err.message : 'Failed to send message';
          update(id, { streamingContent: '', error: msg, isLoading: false });
        }
      }
    },
    [client, ensureState, update]
  );

  // ---- Public API ----

  const getState = useCallback((id: string): ChatState => {
    return stateMap.current.get(id) ?? createEmptyState();
  }, []);

  const loadConversation = useCallback(
    (id: string) => {
      const existing = stateMap.current.get(id);
      // Don't reload if already loaded or currently loading
      if (existing?.loaded || existing?.isLoading) return;

      update(id, { isLoading: true, error: null, outcome: null });

      void (async () => {
        try {
          const detail = await client.getActivityConversation(id);
          // Check that the entry still exists (wasn't cleared)
          if (!stateMap.current.has(id)) return;
          const messages = detail.messages.filter((m) => m.role !== 'assistant' || m.content.trim().length > 0);
          update(id, {
            messages: messages,
            isLoading: false,
            loaded: true,
            ...(detail.outcome ? { outcome: detail.outcome } : {})
          });
        } catch (err) {
          if (!stateMap.current.has(id)) return;
          const msg = err instanceof Error ? err.message : 'Failed to load messages';
          update(id, { error: msg, isLoading: false, loaded: true });
        }
      })();
    },
    [client, update]
  );

  const streamFirstMessage = useCallback(
    (id: string, message: string) => {
      const controller = newAbortController(id);

      // Optimistically add the user message
      const userMessage: ActivityMessage = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: message,
        createdAt: new Date().toISOString()
      };

      update(id, {
        messages: [userMessage],
        isLoading: true,
        error: null,
        streamingContent: '',
        outcome: null,
        activeSpecialist: null,
        loaded: true // Mark as loaded — we don't need to fetch from server
      });

      if (streamingRef.current) {
        void processStream(id, message, controller.signal);
      } else {
        // Non-streaming fallback
        void (async () => {
          try {
            const response = await client.message(id, message);
            if (controller.signal.aborted) return;
            const state = ensureState(id);
            const patches: Partial<ChatState> = { isLoading: false };
            if (response.content.trim().length > 0) {
              patches.messages = [...state.messages, response];
            }
            if (response.resolution) {
              patches.outcome = response.resolution;
            }
            update(id, patches);
          } catch (err) {
            if (controller.signal.aborted) return;
            const msg = err instanceof Error ? err.message : 'Failed to send message';
            update(id, { streamingContent: '', error: msg, isLoading: false });
          }
        })();
      }
    },
    [client, ensureState, newAbortController, processStream, update]
  );

  const sendMessage = useCallback(
    async (id: string, message: string) => {
      const controller = newAbortController(id);
      const state = ensureState(id);

      // Optimistically add user message
      const userMessage: ActivityMessage = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: message,
        createdAt: new Date().toISOString()
      };

      update(id, {
        messages: [...state.messages, userMessage],
        isLoading: true,
        error: null,
        streamingContent: ''
      });

      if (streamingRef.current) {
        await processStream(id, message, controller.signal);
      } else {
        try {
          const response = await client.message(id, message);
          if (controller.signal.aborted) return;
          const currentState = ensureState(id);
          const patches: Partial<ChatState> = { isLoading: false };
          if (response.content.trim().length > 0) {
            patches.messages = [...currentState.messages, response];
          }
          if (response.resolution) {
            patches.outcome = response.resolution;
          }
          update(id, patches);
        } catch (err) {
          if (controller.signal.aborted) return;
          const msg = err instanceof Error ? err.message : 'Failed to send message';
          update(id, { streamingContent: '', error: msg, isLoading: false });
        }
      }
    },
    [ensureState, newAbortController, processStream, update]
  );

  const abortAll = useCallback(() => {
    for (const controller of abortControllers.current.values()) {
      controller.abort();
    }
    abortControllers.current.clear();
  }, []);

  return useMemo(
    () => ({
      getState,
      loadConversation,
      streamFirstMessage,
      sendMessage,
      abortAll
    }),
    [getState, loadConversation, streamFirstMessage, sendMessage, abortAll]
  );
}
