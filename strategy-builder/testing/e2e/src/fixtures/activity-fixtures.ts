/**
 * Canned business messages and expected response patterns for E2E tests.
 *
 * These fixtures provide:
 * - Sample user messages to send to the business API
 * - Expected response patterns for validating business-oriented responses
 * - Schema names for OpenAPI validation
 * - SSE event type sequences
 */

// ─── User messages ──────────────────────────────────────────────────────

/** Sample user messages for message tests */
export const ACTIVITY_MESSAGES = {
  /** Generic greeting — works for any activity mode */
  greeting: 'Hello team, what should we focus on?',
  /** Discovery-flavored message */
  discovery: 'Help me qualify this new customer opportunity.',
  /** Planning-flavored message */
  planning: 'Which account plan should we prioritize next?',
  /** Staffing-flavored message */
  staffing: 'Recommend the right team coverage for this engagement.',
  /** Short message for echo/regression tests */
  short: 'Thanks.',
  /** Long message for stress tests */
  long: 'Walk me through a detailed account strategy, including stakeholders, milestones, risks, and staffing recommendations.'
} as const;

// ─── Schema names (matching backend-api.openapi.yaml components/schemas) ─

export const SCHEMAS = {
  ActivityConversation: 'ActivityConversation',
  ActivityConversationStarted: 'ActivityConversationStarted',
  ActivityConversationDetail: 'ActivityConversationDetail',
  ActivityConversationList: 'ActivityConversationList',
  ActivityOutcome: 'ActivityOutcome',
  ActivityMessage: 'ActivityMessage',
  ActivityStats: 'ActivityStats',
  ModeStats: 'ModeStats',
  HealthResponse: 'HealthResponse',
  ErrorResponse: 'ErrorResponse',
  TokenUsage: 'TokenUsage'
} as const;

// ─── SSE event sequences ────────────────────────────────────────────────

/** Expected SSE event types for a successful streaming message */
export const SSE_EVENT_SEQUENCE = {
  /** Events that must appear at least once (contractually guaranteed) */
  required: ['message.complete'] as const,
  /** Events that may optionally appear (model-dependent) */
  optional: ['message.delta', 'error', 'activity.resolved', 'tool.called', 'tool.done'] as const,
  /** Valid event types (anything else is unexpected) */
  valid: ['message.delta', 'message.complete', 'error', 'activity.resolved', 'tool.called', 'tool.done'] as const
} as const;

// ─── Error codes ────────────────────────────────────────────────────────

/** Expected error codes from the API */
export const ERROR_CODES = {
  notFound: 'not_found',
  badRequest: 'bad_request',
  agentError: 'agent_error',
  agentUnavailable: 'agent_unavailable',
  rateLimited: 'rate_limited',
  internalError: 'internal_error'
} as const;

// ─── Test IDs ───────────────────────────────────────────────────────────

/** An ID that definitely doesn't exist in any backend */
export const NON_EXISTENT_CONVERSATION_ID = 'nonexistent_activity_conversation_000';
