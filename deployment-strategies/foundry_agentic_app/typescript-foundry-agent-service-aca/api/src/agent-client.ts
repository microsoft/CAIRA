/**
 * HTTP client for the agent container.
 *
 * Handles:
 * - Request forwarding to the agent container
 * - Bearer token acquisition via the runtime-appropriate Azure credential
 * - Retry with exponential backoff + jitter (per INTER-SERVICE.md)
 * - Circuit breaker (5 failures, 30s cooldown)
 * - SSE streaming passthrough
 */

import type {
  AgentConversation,
  AgentConversationDetail,
  AgentConversationList,
  AgentErrorResponse,
  AgentHealthResponse,
  AgentMessage
} from './types.ts';
import { injectTraceContext } from './telemetry.ts';

// ---------- Logger interface (subset of Pino used by this module) ----------

export interface Logger {
  debug(obj: Record<string, unknown>, msg: string): void;
  info(obj: Record<string, unknown>, msg: string): void;
  warn(obj: Record<string, unknown>, msg: string): void;
  error(obj: Record<string, unknown>, msg: string): void;
  child(bindings: Record<string, unknown>): Logger;
}

/** No-op logger used when no logger is provided. */
const noopLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  child() {
    return noopLogger;
  }
};

// ---------- Types ----------

export interface AgentClientOptions {
  /** Base URL of the agent container */
  readonly baseUrl: string;
  /** Azure AD token scope for agent auth */
  readonly tokenScope?: string | undefined;
  /** Skip token acquisition (for local dev) */
  readonly skipAuth?: boolean | undefined;
  /** Token provider function (injectable for testing) */
  readonly getToken?: (() => Promise<string>) | undefined;
  /** Logger instance (Pino-compatible). Defaults to no-op. */
  readonly logger?: Logger | undefined;
}

export interface AgentClientResponse<T> {
  readonly ok: boolean;
  readonly status: number;
  readonly data?: T | undefined;
  readonly error?: { readonly code: string; readonly message: string } | undefined;
}

// ---------- Retry config (per INTER-SERVICE.md) ----------

const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 200;
const MAX_DELAY_MS = 5000;
const BACKOFF_MULTIPLIER = 2;
const JITTER_FACTOR = 0.25;

// ---------- Circuit breaker config ----------

const FAILURE_THRESHOLD = 5;
const COOLDOWN_MS = 30_000;
interface CircuitState {
  failures: number;
  lastFailure: number;
  open: boolean;
}

// ---------- Helpers ----------

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503;
}

function computeDelay(attempt: number): number {
  const base = Math.min(INITIAL_DELAY_MS * BACKOFF_MULTIPLIER ** attempt, MAX_DELAY_MS);
  const jitter = base * JITTER_FACTOR * (Math.random() * 2 - 1); // +/- 25%
  return Math.max(0, base + jitter);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeAgentBaseUrl(baseUrl: string): string {
  const parsed = new URL(baseUrl);

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Agent service URL must use http or https');
  }

  parsed.pathname = stripTrailingSlashes(parsed.pathname);
  parsed.search = '';
  parsed.hash = '';
  return stripTrailingSlashes(parsed.toString());
}

function buildAgentUrl(baseUrl: string, path: string): string {
  const parsed = new URL(baseUrl);
  const basePath = stripTrailingSlashes(parsed.pathname);
  parsed.pathname = `${basePath}${path}`;
  return parsed.toString();
}

function stripTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47) {
    end--;
  }
  return value.slice(0, end);
}

/**
 * Map agent status codes to frontend-appropriate codes per INTER-SERVICE.md.
 */
export function mapAgentStatus(agentStatus: number): number {
  switch (agentStatus) {
    case 400:
      return 400; // Bad Request -> pass through
    case 401:
      return 502; // Unauthorized -> agent auth failure is internal
    case 404:
      return 404; // Not Found -> pass through
    case 429:
      return 429; // Rate Limited -> pass through
    case 503:
      return 503; // Unavailable -> pass through
    default:
      if (agentStatus >= 500) return 502; // Other 5xx -> Bad Gateway
      return agentStatus; // Other -> pass through
  }
}

// ---------- Agent Client ----------

export class AgentClient {
  private readonly baseUrl: string;
  private readonly tokenScope: string | undefined;
  private readonly skipAuth: boolean;
  private readonly getTokenFn: (() => Promise<string>) | undefined;
  private readonly log: Logger;
  private readonly circuit: CircuitState = {
    failures: 0,
    lastFailure: 0,
    open: false
  };

  constructor(options: AgentClientOptions) {
    this.baseUrl = normalizeAgentBaseUrl(options.baseUrl);
    this.tokenScope = options.tokenScope;
    this.skipAuth = options.skipAuth ?? false;
    this.getTokenFn = options.getToken;
    this.log = options.logger ?? noopLogger;
  }

  // ---------- Public API ----------

  async createConversation(
    metadata?: Record<string, unknown> | undefined,
    traceId?: string | undefined
  ): Promise<AgentClientResponse<AgentConversation>> {
    const body = metadata ? { metadata } : undefined;
    return this.request<AgentConversation>('POST', '/conversations', body, traceId);
  }

  async listConversations(
    offset?: number | undefined,
    limit?: number | undefined
  ): Promise<AgentClientResponse<AgentConversationList>> {
    const params = new URLSearchParams();
    if (offset !== undefined) params.set('offset', String(offset));
    if (limit !== undefined) params.set('limit', String(limit));
    const qs = params.toString();
    return this.request<AgentConversationList>('GET', `/conversations${qs ? `?${qs}` : ''}`);
  }

  async getConversation(conversationId: string): Promise<AgentClientResponse<AgentConversationDetail>> {
    return this.request<AgentConversationDetail>('GET', `/conversations/${conversationId}`);
  }

  async sendMessage(
    conversationId: string,
    content: string,
    traceId?: string | undefined
  ): Promise<AgentClientResponse<AgentMessage>> {
    return this.request('POST', `/conversations/${conversationId}/messages`, { content }, traceId);
  }

  /**
   * Compound operation: create a conversation and send the first message.
   * Used by business operation endpoints (discovery, planning, staffing).
   *
   * Returns the conversation ID, creation timestamp, and the agent's opening response.
   */
  async startActivityConversation(
    syntheticMessage: string,
    metadata?: Record<string, unknown> | undefined,
    traceId?: string | undefined
  ): Promise<
    AgentClientResponse<{
      conversationId: string;
      createdAt: string;
      openingMessage: AgentMessage;
    }>
  > {
    this.log.info({ traceId, mode: metadata?.['mode'] }, 'startActivityConversation begin');

    // Step 1: Create conversation
    const createResult = await this.createConversation(metadata, traceId);
    if (!createResult.ok || !createResult.data) {
      this.log.error(
        { traceId, errorCode: createResult.error?.code, statusCode: createResult.status },
        'startActivityConversation failed — could not create conversation'
      );
      return {
        ok: false,
        status: createResult.status,
        error: createResult.error
      };
    }

    const conversationId = createResult.data.id;
    const createdAt = createResult.data.createdAt;

    // Step 2: Send synthetic first message
    const msgResult = await this.sendMessage(conversationId, syntheticMessage, traceId);
    if (!msgResult.ok || !msgResult.data) {
      this.log.error(
        { traceId, conversationId, errorCode: msgResult.error?.code, statusCode: msgResult.status },
        'startActivityConversation failed — could not send opening message'
      );
      return {
        ok: false,
        status: msgResult.status,
        error: msgResult.error
      };
    }

    this.log.info(
      { traceId, conversationId, contentLength: msgResult.data.content.length },
      'startActivityConversation complete'
    );

    return {
      ok: true,
      status: 201,
      data: {
        conversationId,
        createdAt,
        openingMessage: msgResult.data
      }
    };
  }

  /**
   * Send a message and return the raw Response for SSE streaming.
   * Does NOT go through retry/circuit breaker — streaming connections
   * are long-lived and should fail fast.
   */
  async sendMessageStream(
    conversationId: string,
    content: string,
    signal?: AbortSignal | undefined,
    traceId?: string | undefined
  ): Promise<Response> {
    const headers = await this.buildHeaders();
    headers['Accept'] = 'text/event-stream';
    headers['Content-Type'] = 'application/json';
    if (traceId) {
      headers['x-trace-id'] = traceId;
    }

    const url = buildAgentUrl(this.baseUrl, `/conversations/${encodeURIComponent(conversationId)}/messages`);
    const init: RequestInit = {
      method: 'POST',
      headers,
      body: JSON.stringify({ content })
    };
    if (signal) {
      init.signal = signal;
    }

    this.log.info({ traceId, conversationId, contentLength: content.length }, 'agent SSE stream request start');

    const response = await fetch(url, init);

    if (!response.ok) {
      this.log.error({ traceId, conversationId, statusCode: response.status }, 'agent SSE stream request failed');
    } else {
      this.log.info({ traceId, conversationId, statusCode: response.status }, 'agent SSE stream connected');
    }

    return response;
  }

  async checkHealth(): Promise<AgentClientResponse<AgentHealthResponse>> {
    // Health checks skip retry/circuit breaker — fast fail for readiness probes
    try {
      const headers = await this.buildHeaders();
      const resp = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(5000)
      });
      const data = (await resp.json()) as AgentHealthResponse;
      return { ok: resp.ok, status: resp.status, data };
    } catch {
      return {
        ok: false,
        status: 503,
        error: { code: 'agent_unreachable', message: 'Agent container health check failed' }
      };
    }
  }

  // ---------- Circuit breaker ----------

  isCircuitOpen(): boolean {
    if (!this.circuit.open) return false;
    // Check if cooldown has elapsed
    if (Date.now() - this.circuit.lastFailure >= COOLDOWN_MS) {
      // Half-open: allow one request through
      return false;
    }
    return true;
  }

  private recordSuccess(): void {
    if (this.circuit.open) {
      this.log.info({ previousState: 'open', newState: 'closed' }, 'circuit breaker closed — request succeeded');
    }
    this.circuit.failures = 0;
    this.circuit.open = false;
  }

  private recordFailure(): void {
    this.circuit.failures++;
    this.circuit.lastFailure = Date.now();
    if (this.circuit.failures >= FAILURE_THRESHOLD) {
      if (!this.circuit.open) {
        this.log.warn(
          { failures: this.circuit.failures, threshold: FAILURE_THRESHOLD },
          'circuit breaker opened — failure threshold reached'
        );
      }
      this.circuit.open = true;
    }
  }

  /** Reset circuit breaker state (for testing) */
  resetCircuit(): void {
    this.circuit.failures = 0;
    this.circuit.lastFailure = 0;
    this.circuit.open = false;
  }

  // ---------- Internal ----------

  private async buildHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = injectTraceContext({});

    if (!this.skipAuth) {
      if (!this.getTokenFn) {
        throw new Error(
          'AgentClient requires a token provider when auth is enabled. Configure AGENT_TOKEN_SCOPE or inject getToken().'
        );
      }

      const token = await this.getTokenFn();
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    traceId?: string | undefined
  ): Promise<AgentClientResponse<T>> {
    // Circuit breaker check
    if (this.isCircuitOpen()) {
      this.log.error({ traceId, method, path, circuitState: 'open' }, 'agent request rejected — circuit breaker open');
      return {
        ok: false,
        status: 503,
        error: {
          code: 'circuit_open',
          message: 'Agent container circuit breaker is open. Too many recent failures.'
        }
      };
    }

    let lastError: AgentClientResponse<T> | undefined;
    const start = Date.now();

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const headers = await this.buildHeaders();
        if (body !== undefined) {
          headers['Content-Type'] = 'application/json';
        }
        headers['Accept'] = 'application/json';
        if (traceId) {
          headers['x-trace-id'] = traceId;
        }

        const url = `${this.baseUrl}${path}`;
        const init: RequestInit = {
          method,
          headers,
          signal: AbortSignal.timeout(120_000)
        };
        if (body !== undefined) {
          init.body = JSON.stringify(body);
        }

        if (attempt === 0) {
          this.log.info({ traceId, method, path }, 'agent request start');
        }

        const resp = await fetch(url, init);
        const durationMs = Date.now() - start;

        if (resp.ok) {
          this.recordSuccess();
          const data = (await resp.json()) as T;
          this.log.info({ traceId, method, path, statusCode: resp.status, durationMs }, 'agent request complete');
          return { ok: true, status: resp.status, data };
        }

        // Parse error response
        let errorBody: AgentErrorResponse | undefined;
        try {
          errorBody = (await resp.json()) as AgentErrorResponse;
        } catch {
          // Response wasn't JSON — that's fine
        }

        const errorInfo = {
          code: errorBody?.error?.code ?? errorBody?.code ?? 'agent_error',
          message: errorBody?.error?.message ?? errorBody?.message ?? `Agent returned status ${String(resp.status)}`
        };

        // Should we retry?
        if (isRetryableStatus(resp.status) && attempt < MAX_RETRIES) {
          this.log.warn(
            {
              traceId,
              method,
              path,
              statusCode: resp.status,
              attempt: attempt + 1,
              maxRetries: MAX_RETRIES,
              errorCode: errorInfo.code
            },
            'agent request retrying'
          );
          // Check for Retry-After header on 429
          if (resp.status === 429) {
            const retryAfter = resp.headers.get('retry-after');
            if (retryAfter) {
              const delaySec = parseInt(retryAfter, 10);
              if (!isNaN(delaySec) && delaySec > 0) {
                await sleep(delaySec * 1000);
                continue;
              }
            }
          }
          await sleep(computeDelay(attempt));
          lastError = { ok: false, status: resp.status, error: errorInfo };
          continue;
        }

        // Non-retryable or exhausted retries
        if (resp.status >= 500 || !resp.ok) {
          this.recordFailure();
        }
        this.log.error(
          { traceId, method, path, statusCode: resp.status, durationMs, errorCode: errorInfo.code },
          'agent request failed'
        );
        return { ok: false, status: resp.status, error: errorInfo };
      } catch (err) {
        // Network error
        this.recordFailure();
        const message = err instanceof Error ? err.message : 'Unknown network error';
        const durationMs = Date.now() - start;

        if (attempt < MAX_RETRIES) {
          this.log.warn(
            {
              traceId,
              method,
              path,
              attempt: attempt + 1,
              maxRetries: MAX_RETRIES,
              error: message
            },
            'agent request network error — retrying'
          );
          await sleep(computeDelay(attempt));
          lastError = {
            ok: false,
            status: 502,
            error: { code: 'agent_unreachable', message }
          };
          continue;
        }

        this.log.error({ traceId, method, path, durationMs, error: message }, 'agent request failed — network error');
        return {
          ok: false,
          status: 502,
          error: { code: 'agent_unreachable', message }
        };
      }
    }

    // Should not reach here, but just in case
    return (
      lastError ?? {
        ok: false,
        status: 502,
        error: { code: 'agent_unreachable', message: 'Request failed after retries' }
      }
    );
  }
}
