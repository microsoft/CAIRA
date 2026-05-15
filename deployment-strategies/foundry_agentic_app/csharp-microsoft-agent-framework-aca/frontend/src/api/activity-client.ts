/**
 * HTTP/SSE client for the business activity API.
 *
 * Calls the business API endpoints defined in contracts/backend-api.openapi.yaml.
 * Supports both JSON responses and SSE streaming for message.
 */

import type {
  ActivityStats,
  ActivityConversationDetail,
  ActivityConversationList,
  ActivityMode,
  ActivityConversationStarted,
  ErrorResponse,
  HealthResponse,
  ActivityMessage,
  SSEEvent
} from '../types.ts';

export interface ActivityClientConfig {
  readonly baseUrl: string;
}

export class ActivityApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly details?: Record<string, unknown> | undefined
  ) {
    super(`API error ${String(status)}: ${code}`);
    this.name = 'ActivityApiError';
  }
}

export class ActivityClient {
  private readonly baseUrl: string;

  constructor(config: ActivityClientConfig) {
    // Strip trailing slash
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
  }

  // ---- Business operations: start conversations ----

  /**
   * POST /api/activities/discovery — Start an opportunity discovery activity.
   */
  async startDiscovery(): Promise<ActivityConversationStarted> {
    return this.startActivityConversation('discovery');
  }

  /**
   * POST /api/activities/planning — Start an account planning activity.
   */
  async startPlanning(): Promise<ActivityConversationStarted> {
    return this.startActivityConversation('planning');
  }

  /**
   * POST /api/activities/staffing — Start a staffing activity.
   */
  async startStaffing(): Promise<ActivityConversationStarted> {
    return this.startActivityConversation('staffing');
  }

  // ---- ActivityConversation management ----

  /**
   * GET /api/activities/conversations — List conversations.
   */
  async listActivityConversations(offset?: number, limit?: number): Promise<ActivityConversationList> {
    const params = new URLSearchParams();
    if (offset !== undefined) params.set('offset', String(offset));
    if (limit !== undefined) params.set('limit', String(limit));

    const query = params.toString();
    const url = `${this.baseUrl}/activities/conversations${query ? `?${query}` : ''}`;
    const response = await fetch(url);
    return this.handleJson<ActivityConversationList>(response);
  }

  /**
   * GET /api/activities/conversations/{conversationId} — Get conversation detail with messages.
   */
  async getActivityConversation(conversationId: string): Promise<ActivityConversationDetail> {
    const response = await fetch(`${this.baseUrl}/activities/conversations/${encodeURIComponent(conversationId)}`);
    return this.handleJson<ActivityConversationDetail>(response);
  }

  // ---- Message (send message) ----

  /**
   * POST /api/activities/conversations/{conversationId}/messages — Send a message (JSON response).
   */
  async message(conversationId: string, message: string): Promise<ActivityMessage> {
    const response = await fetch(
      `${this.baseUrl}/activities/conversations/${encodeURIComponent(conversationId)}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      }
    );
    return this.handleJson<ActivityMessage>(response);
  }

  /**
   * POST /api/activities/conversations/{conversationId}/messages — Send a message (SSE streaming).
   *
   * Returns an async generator that yields SSE events as they arrive.
   * Uses fetch + ReadableStream (not EventSource, since message is POST).
   *
   * Pass an `AbortSignal` to cancel the in-flight request (e.g. on unmount
   * or when the conversation is deleted).
   */
  async *messageStream(conversationId: string, message: string, signal?: AbortSignal): AsyncGenerator<SSEEvent> {
    const response = await fetch(
      `${this.baseUrl}/activities/conversations/${encodeURIComponent(conversationId)}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream'
        },
        body: JSON.stringify({ message }),
        ...(signal ? { signal } : {})
      }
    );

    if (!response.ok) {
      await this.throwApiError(response);
    }

    if (!response.body) {
      throw new ActivityApiError(response.status, 'no_body', undefined);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      for (;;) {
        if (signal?.aborted) break;
        const result = await reader.read();
        if (result.done) break;

        buffer += decoder.decode(result.value, { stream: true });

        // Parse SSE events from buffer — events are separated by double newlines
        const parts = buffer.split('\n\n');
        // Last part may be incomplete
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const event = this.parseSSEEvent(part);
          if (event) {
            yield event;
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        const event = this.parseSSEEvent(buffer);
        if (event) {
          yield event;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // ---- Stats ----

  /**
   * GET /api/activities/stats — Get activity statistics.
   */
  async getStats(): Promise<ActivityStats> {
    const response = await fetch(`${this.baseUrl}/activities/stats`);
    return this.handleJson<ActivityStats>(response);
  }

  // ---- Health ----

  /**
   * GET /health — Health check.
   */
  async getHealth(): Promise<HealthResponse> {
    // Health is at root level, not under /activities
    const healthUrl = this.baseUrl.replace(/\/api$/, '') + '/health';
    const response = await fetch(healthUrl);
    return this.handleJson<HealthResponse>(response);
  }

  // ---------- Private helpers ----------

  private async startActivityConversation(mode: ActivityMode): Promise<ActivityConversationStarted> {
    const endpoint = `${this.baseUrl}/activities/${mode}`;
    const response = await fetch(endpoint, { method: 'POST' });
    return this.handleJson<ActivityConversationStarted>(response);
  }

  private async handleJson<T>(response: Response): Promise<T> {
    if (!response.ok) {
      await this.throwApiError(response);
    }
    return (await response.json()) as T;
  }

  private async throwApiError(response: Response): Promise<never> {
    let errorBody: ErrorResponse | undefined;
    try {
      errorBody = (await response.json()) as ErrorResponse;
    } catch {
      // Not JSON
    }
    throw new ActivityApiError(
      response.status,
      errorBody?.code ?? `http_${String(response.status)}`,
      errorBody?.details
    );
  }

  /**
   * Parse a single SSE event block into a typed SSEEvent.
   *
   * SSE format:
   *   event: message.delta
   *   data: {"content": "Welcome "}
   *
   *   event: message.complete
   *   data: {"messageId": "...", "content": "...", "usage": {...}}
   *
   *   event: activity.resolved
   *   data: {"tool": "resolve_discovery", "result": {"fit": "qualified", ...}}
   *
   *   event: error
   *   data: {"code": "...", "message": "..."}
   */
  private parseSSEEvent(block: string): SSEEvent | null {
    let eventType = '';
    let data = '';

    for (const line of block.split('\n')) {
      if (line.startsWith('event: ')) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        data = line.slice(6);
      } else if (line.startsWith('data:')) {
        data = line.slice(5);
      }
    }

    if (!eventType || !data) return null;

    try {
      const parsed = JSON.parse(data) as Record<string, unknown>;

      switch (eventType) {
        case 'message.delta':
          return {
            type: 'delta',
            content: String(parsed['content'] ?? '')
          };

        case 'message.complete':
          return {
            type: 'complete',
            message: {
              id: String(parsed['messageId'] ?? ''),
              role: 'assistant',
              content: String(parsed['content'] ?? ''),
              createdAt: new Date().toISOString(),
              ...(parsed['usage']
                ? {
                    usage: parsed['usage'] as {
                      promptTokens?: number | undefined;
                      completionTokens?: number | undefined;
                    }
                  }
                : {})
            }
          };

        case 'activity.resolved':
          return {
            type: 'activity.resolved',
            outcome: {
              tool: String(parsed['tool'] ?? ''),
              result: (parsed['result'] as Record<string, unknown>) ?? {}
            }
          };

        case 'tool.called':
          return {
            type: 'tool.called',
            toolName: String(parsed['toolName'] ?? '')
          };

        case 'tool.done':
          return {
            type: 'tool.done',
            toolName: String(parsed['toolName'] ?? '')
          };

        case 'error':
          return {
            type: 'error',
            code: String(parsed['code'] ?? 'unknown'),
            message: String(parsed['message'] ?? 'Unknown error')
          };

        default:
          return null;
      }
    } catch {
      return null;
    }
  }
}

/** Default client instance using VITE_API_BASE_URL */
export const activityClient = new ActivityClient({
  baseUrl: import.meta.env['VITE_API_BASE_URL'] ?? '/api'
});
