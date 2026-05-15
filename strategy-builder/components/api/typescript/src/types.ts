/**
 * Shared types for the API container.
 *
 * These map to the schemas defined in contracts/backend-api.openapi.yaml
 * and contracts/agent-api.openapi.yaml.
 */

// ---------- Agent API types (what we receive from the agent container) ----------

export interface AgentConversation {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface AgentConversationList {
  readonly items: readonly AgentConversation[];
  readonly offset: number;
  readonly limit: number;
  readonly total: number;
}

export interface AgentConversationDetail {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly metadata?: Record<string, unknown> | undefined;
  readonly messages: readonly AgentMessage[];
}

export interface AgentMessage {
  readonly id: string;
  readonly role: 'user' | 'assistant' | 'system';
  readonly content: string;
  readonly createdAt: string;
  readonly usage?: TokenUsage | undefined;
  readonly resolution?: AgentResolution | undefined;
}

export interface AgentResolution {
  readonly tool: string;
  readonly result: Record<string, unknown>;
}

export interface TokenUsage {
  readonly promptTokens?: number | undefined;
  readonly completionTokens?: number | undefined;
}

export interface AgentHealthResponse {
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly checks?: readonly AgentHealthCheck[] | undefined;
}

export interface AgentHealthCheck {
  readonly name: string;
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly latencyMs?: number | undefined;
}

export interface AgentErrorResponse {
  readonly error?:
    | {
        readonly code: string;
        readonly message: string;
      }
    | undefined;
  readonly code?: string | undefined;
  readonly message?: string | undefined;
}

// ---------- Business API types (what we return to the frontend) ----------

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
