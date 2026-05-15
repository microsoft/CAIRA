/**
 * Frontend type definitions.
 *
 * These mirror the business API types defined in contracts/backend-api.openapi.yaml
 * and returned by the API container (components/api/typescript/src/types.ts).
 */

// ---------- ActivityConversation types ----------

export type ActivityMode = 'discovery' | 'planning' | 'staffing';

export type ActivityStatus = 'active' | 'resolved';

export interface ActivityOutcome {
  readonly tool: string;
  readonly result: Record<string, unknown>;
}

export interface ActivityConversation {
  readonly id: string;
  readonly mode: ActivityMode;
  readonly status: ActivityStatus;
  readonly outcome?: ActivityOutcome | undefined;
  readonly createdAt: string;
  readonly lastMessageAt: string;
  readonly messageCount: number;
}

export interface ActivityConversationStarted {
  readonly id: string;
  readonly mode: ActivityMode;
  readonly status: ActivityStatus;
  readonly syntheticMessage: string;
  readonly createdAt: string;
}

export interface ActivityConversationDetail {
  readonly id: string;
  readonly mode: ActivityMode;
  readonly status: ActivityStatus;
  readonly outcome?: ActivityOutcome | undefined;
  readonly createdAt: string;
  readonly lastMessageAt: string;
  readonly messageCount: number;
  readonly messages: readonly ActivityMessage[];
}

export interface ActivityConversationList {
  readonly conversations: readonly ActivityConversation[];
  readonly offset: number;
  readonly limit: number;
  readonly total: number;
}

export interface ActivityMessage {
  readonly id: string;
  readonly role: 'user' | 'assistant' | 'system';
  readonly content: string;
  readonly createdAt: string;
  readonly usage?: TokenUsage | undefined;
  readonly resolution?: ActivityOutcome | undefined;
}

export interface TokenUsage {
  readonly promptTokens?: number | undefined;
  readonly completionTokens?: number | undefined;
}

export interface ModeStats {
  readonly total: number;
  readonly active: number;
  readonly resolved: number;
}

export interface ActivityStats {
  readonly totalConversations: number;
  readonly activeConversations: number;
  readonly resolvedConversations: number;
  readonly byMode: {
    readonly discovery: ModeStats;
    readonly planning: ModeStats;
    readonly staffing: ModeStats;
  };
}

export interface HealthResponse {
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly dependencies?: readonly DependencyHealth[] | undefined;
}

export interface DependencyHealth {
  readonly name: string;
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly latencyMs?: number | undefined;
}

export interface ErrorResponse {
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, unknown> | undefined;
}

// ---------- SSE event types (for streaming message) ----------

export type SSEEvent =
  | { readonly type: 'delta'; readonly content: string }
  | { readonly type: 'complete'; readonly message: ActivityMessage }
  | { readonly type: 'error'; readonly code: string; readonly message: string }
  | { readonly type: 'activity.resolved'; readonly outcome: ActivityOutcome }
  | { readonly type: 'tool.called'; readonly toolName: string }
  | { readonly type: 'tool.done'; readonly toolName: string };
