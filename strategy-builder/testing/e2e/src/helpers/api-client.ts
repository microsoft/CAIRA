/**
 * Typed HTTP client for the CAIRA backend API.
 *
 * Maps to the endpoints defined in contracts/backend-api.openapi.yaml v2.0.0.
 * Provides typed request/response methods for each operation.
 *
 * Multi-agent endpoints:
 *   POST /api/activities/discovery       — start opportunity discovery
 *   POST /api/activities/planning        — start account planning
 *   POST /api/activities/staffing        — start team staffing
 *   GET  /api/activities/conversations      — list all conversations
 *   GET  /api/activities/conversations/:id  — get conversation detail
 *   POST /api/activities/conversations/:id/messages — continue chatting
 *   GET  /api/activities/stats           — activity stats
 *   GET  /health                     — health check
 */

// ─── Response types (matching OpenAPI schemas) ──────────────────────────

export type ActivityMode = 'discovery' | 'planning' | 'staffing';
export type ActivityStatus = 'active' | 'resolved';

export interface ActivityOutcome {
  tool: string;
  result: Record<string, unknown>;
}

export interface ActivityConversation {
  id: string;
  mode: ActivityMode;
  status: ActivityStatus;
  outcome?: ActivityOutcome | undefined;
  createdAt: string;
  lastMessageAt: string;
  messageCount: number;
}

export interface ActivityConversationStarted {
  id: string;
  mode: ActivityMode;
  status: ActivityStatus;
  syntheticMessage: string;
  createdAt: string;
}

export interface ActivityConversationDetail extends ActivityConversation {
  messages: ActivityMessage[];
}

export interface ActivityConversationList {
  conversations: ActivityConversation[];
  offset: number;
  limit: number;
  total: number;
}

export interface ActivityMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  usage?: TokenUsage | undefined;
  resolution?: ActivityOutcome | undefined;
}

export interface TokenUsage {
  promptTokens?: number | undefined;
  completionTokens?: number | undefined;
}

export interface ModeStats {
  total: number;
  active: number;
  resolved: number;
}

export interface ActivityStats {
  totalConversations: number;
  activeConversations: number;
  resolvedConversations: number;
  byMode: {
    discovery: ModeStats;
    planning: ModeStats;
    staffing: ModeStats;
  };
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  dependencies?: DependencyHealth[] | undefined;
}

export interface DependencyHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs?: number | undefined;
}

export interface ErrorResponse {
  code: string;
  message: string;
  details?: Record<string, unknown> | undefined;
}

// ─── API Client ─────────────────────────────────────────────────────────

export interface ApiClientOptions {
  /** Base URL of the backend API (default: E2E_BASE_URL env or http://localhost:4000) */
  baseUrl?: string | undefined;
  /** Request timeout in ms (default: 10000) */
  timeoutMs?: number | undefined;
}

/** Raw response from the API client, including status and headers */
export interface ApiResponse<T> {
  status: number;
  headers: Headers;
  body: T;
}

function stripTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47) {
    end--;
  }
  return value.slice(0, end);
}

export class ApiClient {
  readonly baseUrl: string;
  readonly timeoutMs: number;

  constructor(options?: ApiClientOptions) {
    this.baseUrl = stripTrailingSlashes(options?.baseUrl ?? process.env['E2E_BASE_URL'] ?? 'http://localhost:4000');
    this.timeoutMs = options?.timeoutMs ?? 10_000;
  }

  // ─── Business Operations (start conversations) ─────────────────────────

  /** POST /api/activities/discovery — start opportunity discovery */
  async startDiscovery(): Promise<ApiResponse<ActivityConversationStarted>> {
    return this.request<ActivityConversationStarted>('/api/activities/discovery', { method: 'POST' });
  }

  /** POST /api/activities/planning — start account planning */
  async startPlanning(): Promise<ApiResponse<ActivityConversationStarted>> {
    return this.request<ActivityConversationStarted>('/api/activities/planning', { method: 'POST' });
  }

  /** POST /api/activities/staffing — start team staffing */
  async startStaffing(): Promise<ApiResponse<ActivityConversationStarted>> {
    return this.request<ActivityConversationStarted>('/api/activities/staffing', { method: 'POST' });
  }

  // ─── ActivityConversation Management ───────────────────────────────────────────

  /** GET /api/activities/conversations — list all conversations */
  async listActivityConversations(options?: {
    offset?: number | undefined;
    limit?: number | undefined;
  }): Promise<ApiResponse<ActivityConversationList>> {
    const params = new URLSearchParams();
    if (options?.offset !== undefined) params.set('offset', String(options.offset));
    if (options?.limit !== undefined) params.set('limit', String(options.limit));
    const qs = params.toString();
    return this.request<ActivityConversationList>(`/api/activities/conversations${qs ? `?${qs}` : ''}`);
  }

  /** GET /api/activities/conversations/{conversationId} — get conversation detail with messages */
  async getActivityConversation(conversationId: string): Promise<ApiResponse<ActivityConversationDetail>> {
    return this.request<ActivityConversationDetail>(`/api/activities/conversations/${conversationId}`);
  }

  // ─── Message (continue chatting) ─────────────────────────────────────

  /** POST /api/activities/conversations/{conversationId}/messages — send a message (JSON response) */
  async message(conversationId: string, message: string): Promise<ApiResponse<ActivityMessage>> {
    return this.request<ActivityMessage>(`/api/activities/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ message })
    });
  }

  /**
   * POST /api/activities/conversations/{conversationId}/messages — send a message (SSE stream).
   *
   * Returns the raw Response object for SSE processing.
   * Use `sseCollector` to collect events from the response.
   */
  async messageStream(conversationId: string, message: string): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/api/activities/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream'
        },
        body: JSON.stringify({ message }),
        signal: controller.signal
      });

      // Don't clear timeout here — let the caller handle the stream within the timeout
      // But we do clear it to avoid leaks; stream consumption has its own timeout
      clearTimeout(timeout);
      return response;
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  // ─── Stats ──────────────────────────────────────────────────────────

  /** GET /api/activities/stats — get activity statistics */
  async getStats(): Promise<ApiResponse<ActivityStats>> {
    return this.request<ActivityStats>('/api/activities/stats');
  }

  // ─── Health ─────────────────────────────────────────────────────────

  /** GET /health — health check */
  async getHealth(): Promise<ApiResponse<HealthResponse>> {
    return this.request<HealthResponse>('/health');
  }

  /**
   * Raw request that returns status + headers + parsed body.
   * Returns ErrorResponse body for non-2xx responses.
   */
  async rawRequest(path: string, init?: RequestInit): Promise<ApiResponse<unknown>> {
    return this.request<unknown>(path, init);
  }

  // ─── Internal ───────────────────────────────────────────────────────

  private async request<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal
      });
      clearTimeout(timeout);

      const contentType = response.headers.get('content-type') ?? '';
      let body: T;

      if (contentType.includes('application/json')) {
        body = (await response.json()) as T;
      } else {
        // For non-JSON responses, return text as-is (cast to T)
        body = (await response.text()) as T;
      }

      return { status: response.status, headers: response.headers, body };
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }
}
