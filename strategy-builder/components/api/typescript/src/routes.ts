/**
 * Fastify route definitions for the fictional sales/account-team sample API.
 *
 * Maps business endpoints to agent container operations:
 *   POST /api/activities/discovery              -> create conv + send synthetic first msg
 *   POST /api/activities/planning            -> create conv + send synthetic first msg
 *   POST /api/activities/staffing                -> create conv + send synthetic first msg
 *   GET  /api/activities/conversations          -> GET  /conversations (enriched)
 *   GET  /api/activities/conversations/:id      -> GET  /conversations/:id (enriched)
 *   POST /api/activities/conversations/:id/messages -> POST /conversations/:id/messages (SSE parsed)
 *   GET  /api/activities/stats               -> computed from conversations
 *   GET  /health                         -> checks agent /health
 *   GET  /health/deep                    -> auth-required check of agent business endpoint
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AgentClient } from './agent-client.ts';
import { mapAgentStatus } from './agent-client.ts';
import { randomUUID } from 'node:crypto';
import { createAzureCredential } from './azure-credential.ts';
import type {
  ActivityConversation,
  ActivityConversationDetail,
  ActivityConversationList,
  ActivityMode,
  ActivityOutcome,
  ActivityConversationStarted,
  ActivityStatus,
  ActivityStats,
  ErrorResponse,
  HealthResponse,
  ActivityMessage,
  AgentConversation,
  AgentConversationDetail,
  AgentMessage
} from './types.ts';

// ---------- In-memory conversation state ----------

/**
 * Stores conversation metadata (mode, status, outcome) keyed by conversation ID.
 * In a real deployment this would be a database — here we use a simple Map.
 *
 * Exported for testing.
 */
export interface ActivityConversationRecord {
  mode: ActivityMode;
  status: ActivityStatus;
  outcome?: ActivityOutcome | undefined;
}

export const activityConversationStore = new Map<string, ActivityConversationRecord>();

/** Reset conversation store (for testing). */
export function resetActivityConversationStore(): void {
  activityConversationStore.clear();
}

// ---------- Synthetic first messages ----------

const SYNTHETIC_MESSAGES: Record<ActivityMode, string> = {
  discovery:
    'I am qualifying a new customer opportunity. Lead a short discovery conversation, ask targeted questions, and conclude with a concise qualification summary.',
  planning:
    'I need an account plan for an active customer. Guide me through priorities, risks, and next steps, then conclude with a concise planning summary.',
  staffing:
    'I need to staff an account team for a customer engagement. Interview me for the needed context and conclude with a clear staffing recommendation.'
};

// ---------- Helpers ----------

function conversationToActivityConversation(
  conv: AgentConversation,
  record: ActivityConversationRecord | undefined,
  messageCount?: number | undefined
): ActivityConversation {
  const mode = record?.mode ?? extractModeFromMetadata(conv.metadata);
  const status = record?.status ?? 'active';
  return {
    id: conv.id,
    mode,
    status,
    ...(record?.outcome ? { outcome: record.outcome } : {}),
    createdAt: conv.createdAt,
    lastMessageAt: conv.updatedAt,
    messageCount: messageCount ?? 0
  };
}

function agentMessageToActivityMessage(msg: AgentMessage): ActivityMessage {
  return {
    id: msg.id,
    role: msg.role,
    content: msg.content,
    createdAt: msg.createdAt,
    ...(msg.usage ? { usage: msg.usage } : {}),
    ...(msg.resolution ? { resolution: msg.resolution } : {})
  };
}

function conversationDetailToActivityConversationDetail(
  detail: AgentConversationDetail,
  record: ActivityConversationRecord | undefined
): ActivityConversationDetail {
  const mode = record?.mode ?? extractModeFromMetadata(detail.metadata);
  const status = record?.status ?? 'active';
  return {
    id: detail.id,
    mode,
    status,
    ...(record?.outcome ? { outcome: record.outcome } : {}),
    createdAt: detail.createdAt,
    lastMessageAt: detail.updatedAt,
    messageCount: detail.messages.length,
    messages: detail.messages.map(agentMessageToActivityMessage)
  };
}

function extractModeFromMetadata(metadata: Record<string, unknown> | undefined): ActivityMode {
  const mode = metadata?.['mode'];
  if (mode === 'discovery' || mode === 'planning' || mode === 'staffing') return mode;
  return 'discovery'; // fallback
}

/**
 * Decode the payload section of a JWT token (base64url → JSON).
 * Does NOT verify the signature — this is a diagnostic endpoint.
 */
function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) return {};
  const payload = parts[1] ?? '';
  // base64url → base64
  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  const json = Buffer.from(base64, 'base64').toString('utf-8');
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Infer identity type from JWT claims.
 */
function inferIdentityType(claims: Record<string, unknown>): string {
  // Managed identity tokens have xms_mirid claim
  if (claims['xms_mirid']) return 'managedIdentity';
  // Service principal tokens have appid but no name
  if (claims['appid'] && !claims['name']) return 'servicePrincipal';
  // User tokens have a name claim
  if (claims['name']) return 'user';
  return 'unknown';
}

function errorReply(reply: FastifyReply, status: number, code: string, message: string): void {
  const body: ErrorResponse = { code, message };
  void reply.status(status).send(body);
}

/**
 * Generate a trace ID for request correlation.
 * The API is where traces originate — each incoming request gets a UUID
 * that is forwarded to the agent container via x-trace-id header.
 */
function generateTraceId(): string {
  return randomUUID();
}

/**
 * Parse an SSE stream looking for `activity.resolved` events.
 * Writes all chunks to the raw response (passthrough) and captures
 * outcome data from any `activity.resolved` event.
 *
 * Returns the captured outcome (if any).
 */
async function pipeSSEAndCaptureOutcome(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  reply: FastifyReply
): Promise<ActivityOutcome | undefined> {
  const decoder = new TextDecoder();
  let captured: ActivityOutcome | undefined;
  let buffer = '';

  try {
    let done = false;
    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (result.value) {
        const chunk = decoder.decode(result.value, { stream: !done });
        // Write through to client immediately
        reply.raw.write(chunk);

        // Parse SSE lines looking for activity.resolved
        buffer += chunk;
        const lines = buffer.split('\n');
        // Keep the last (potentially incomplete) line in the buffer
        buffer = lines.pop() ?? '';

        let eventType: string | undefined;
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ') && eventType === 'activity.resolved') {
            try {
              const data = JSON.parse(line.slice(6)) as {
                tool: string;
                result: Record<string, unknown>;
              };
              captured = { tool: data.tool, result: data.result };
            } catch {
              // Malformed JSON — skip
            }
            eventType = undefined;
          } else if (line === '') {
            // Empty line signals end of SSE event
            eventType = undefined;
          }
        }
      }
    }
  } catch {
    // Connection dropped — send error event
    reply.raw.write(
      'event: error\ndata: {"code":"agent_connection_lost","message":"Connection to agent was interrupted"}\n\n'
    );
  }

  return captured;
}

// ---------- Route registration ----------

export function registerRoutes(app: FastifyInstance, agentClient: AgentClient): void {
  // ---- Health ----
  app.get('/health', { logLevel: 'silent' }, async (_req, reply) => {
    const start = Date.now();
    const result = await agentClient.checkHealth();
    const latencyMs = Date.now() - start;

    const agentStatus = result.ok ? 'healthy' : 'unhealthy';
    const overallStatus = result.ok ? 'healthy' : 'degraded';

    const health: HealthResponse = {
      status: overallStatus,
      dependencies: [
        {
          name: 'agent-container',
          status: agentStatus,
          latencyMs
        }
      ]
    };

    const statusCode = overallStatus === 'healthy' ? 200 : 503;
    await reply.status(statusCode).send(health);
  });

  app.get('/health/deep', { logLevel: 'silent' }, async (_req, reply) => {
    const start = Date.now();
    const result = await agentClient.listConversations(0, 1);
    const latencyMs = Date.now() - start;

    const agentStatus = result.ok ? 'healthy' : 'unhealthy';
    const overallStatus = result.ok ? 'healthy' : 'degraded';

    const health: HealthResponse = {
      status: overallStatus,
      dependencies: [
        {
          name: 'agent-container-auth',
          status: agentStatus,
          latencyMs
        }
      ]
    };

    const statusCode = overallStatus === 'healthy' ? 200 : 503;
    await reply.status(statusCode).send(health);
  });

  // ---- Business operation: start conversation ----

  async function handleStartActivityConversation(
    mode: ActivityMode,
    req: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const traceId = generateTraceId();
    const syntheticMessage = SYNTHETIC_MESSAGES[mode];
    const metadata = { mode };

    req.log.info({ traceId, mode }, 'startActivityConversation request');

    // Only create the conversation — do NOT send the first message.
    // The frontend will send syntheticMessage via the streaming message endpoint.
    const start = Date.now();
    const createResult = await agentClient.createConversation(metadata, traceId);
    const durationMs = Date.now() - start;

    if (!createResult.ok || !createResult.data) {
      const status = mapAgentStatus(createResult.status);
      req.log.error(
        { traceId, mode, statusCode: status, durationMs, errorCode: createResult.error?.code },
        'startActivityConversation failed'
      );
      errorReply(
        reply,
        status,
        createResult.error?.code ?? 'agent_error',
        createResult.error?.message ?? 'Failed to start activity conversation'
      );
      return;
    }

    const { id: conversationId, createdAt } = createResult.data;

    // Store conversation state
    const record: ActivityConversationRecord = { mode, status: 'active' };
    activityConversationStore.set(conversationId, record);

    req.log.info({ traceId, mode, conversationId, durationMs }, 'startActivityConversation complete');

    const response: ActivityConversationStarted = {
      id: conversationId,
      mode,
      status: record.status,
      syntheticMessage,
      createdAt
    };

    await reply.status(201).send(response);
  }

  // POST /api/activities/discovery
  app.post('/api/activities/discovery', async (req, reply) => {
    await handleStartActivityConversation('discovery', req, reply);
  });

  // POST /api/activities/planning
  app.post('/api/activities/planning', async (req, reply) => {
    await handleStartActivityConversation('planning', req, reply);
  });

  // POST /api/activities/staffing
  app.post('/api/activities/staffing', async (req, reply) => {
    await handleStartActivityConversation('staffing', req, reply);
  });

  // ---- GET /api/activities/conversations ----
  app.get('/api/activities/conversations', async (req, reply) => {
    const query = req.query as Record<string, string | undefined>;
    const offset = query['offset'] !== undefined ? parseInt(query['offset'], 10) : undefined;
    const limit = query['limit'] !== undefined ? parseInt(query['limit'], 10) : undefined;

    const result = await agentClient.listConversations(offset, limit);
    if (!result.ok || !result.data) {
      const status = mapAgentStatus(result.status);
      errorReply(
        reply,
        status,
        result.error?.code ?? 'agent_error',
        result.error?.message ?? 'Failed to list conversations'
      );
      return;
    }

    const conversations = result.data.items.map((c) =>
      conversationToActivityConversation(c, activityConversationStore.get(c.id))
    );

    const list: ActivityConversationList = {
      conversations,
      offset: result.data.offset,
      limit: result.data.limit,
      total: result.data.total
    };

    await reply.send(list);
  });

  // ---- GET /api/activities/conversations/:conversationId ----
  app.get('/api/activities/conversations/:conversationId', async (req, reply) => {
    const { conversationId } = req.params as { conversationId: string };

    const result = await agentClient.getConversation(conversationId);
    if (!result.ok || !result.data) {
      const status = mapAgentStatus(result.status);
      errorReply(
        reply,
        status,
        result.error?.code ?? 'agent_error',
        result.error?.message ?? 'Failed to get activity conversation'
      );
      return;
    }

    const detail = conversationDetailToActivityConversationDetail(
      result.data,
      activityConversationStore.get(conversationId)
    );
    await reply.send(detail);
  });

  // ---- POST /api/activities/conversations/:conversationId/messages ----
  app.post(
    '/api/activities/conversations/:conversationId/messages',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { conversationId } = req.params as { conversationId: string };
      const body = req.body as Record<string, unknown> | null;
      const traceId = generateTraceId();

      const message = body?.['message'];
      if (typeof message !== 'string' || message.length === 0) {
        errorReply(reply, 400, 'bad_request', 'Missing required field: message');
        return;
      }

      const acceptHeader = req.headers['accept'] ?? '';
      const wantsStream = acceptHeader.includes('text/event-stream');

      req.log.info(
        {
          traceId,
          conversationId,
          mode: wantsStream ? 'stream' : 'json',
          contentLength: message.length
        },
        'message request'
      );
      const start = Date.now();

      if (wantsStream) {
        // SSE streaming with outcome capture
        try {
          const agentResp = await agentClient.sendMessageStream(conversationId, message, undefined, traceId);

          if (!agentResp.ok) {
            // Agent returned an error — forward it
            let errorBody: { code?: string; message?: string; error?: { code?: string; message?: string } } | undefined;
            try {
              errorBody = (await agentResp.json()) as {
                code?: string;
                message?: string;
                error?: { code?: string; message?: string };
              };
            } catch {
              // Not JSON
            }
            const status = mapAgentStatus(agentResp.status);
            req.log.error(
              { traceId, conversationId, statusCode: status, durationMs: Date.now() - start },
              'message SSE failed — agent error'
            );
            errorReply(
              reply,
              status,
              errorBody?.error?.code ?? errorBody?.code ?? 'agent_error',
              errorBody?.error?.message ?? errorBody?.message ?? `Agent returned status ${String(agentResp.status)}`
            );
            return;
          }

          if (!agentResp.body) {
            req.log.error({ traceId, conversationId }, 'message SSE failed — no response body');
            errorReply(reply, 502, 'agent_error', 'Agent returned no response body for SSE stream');
            return;
          }

          // Hijack the response and pipe SSE events through while capturing outcomes
          void reply.hijack();

          reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive'
          });

          const reader = agentResp.body.getReader();
          const outcome = await pipeSSEAndCaptureOutcome(reader, reply);

          // If we captured a resolution, update conversation state
          if (outcome) {
            const record = activityConversationStore.get(conversationId);
            if (record) {
              record.status = 'resolved';
              record.outcome = outcome;
            }
          }

          req.log.info(
            { traceId, conversationId, durationMs: Date.now() - start, resolved: !!outcome },
            'message SSE complete'
          );

          reply.raw.end();
        } catch (err) {
          req.log.error(
            { traceId, conversationId, error: err instanceof Error ? err.message : String(err) },
            'message SSE failed — connection error'
          );
          errorReply(reply, 502, 'agent_unreachable', 'Failed to connect to agent container for streaming');
        }
      } else {
        // JSON response
        const result = await agentClient.sendMessage(conversationId, message, traceId);
        if (!result.ok || !result.data) {
          const status = mapAgentStatus(result.status);
          req.log.error(
            { traceId, conversationId, statusCode: status, durationMs: Date.now() - start },
            'message JSON failed'
          );
          errorReply(
            reply,
            status,
            result.error?.code ?? 'agent_error',
            result.error?.message ?? 'Failed to send message'
          );
          return;
        }

        // Check for resolution in JSON response
        if (result.data.resolution) {
          const record = activityConversationStore.get(conversationId);
          if (record) {
            record.status = 'resolved';
            record.outcome = result.data.resolution;
          }
        }

        req.log.info(
          {
            traceId,
            conversationId,
            durationMs: Date.now() - start,
            resolved: !!result.data.resolution,
            contentLength: result.data.content.length
          },
          'message JSON complete'
        );

        const activityMessage: ActivityMessage = agentMessageToActivityMessage(result.data);
        await reply.send(activityMessage);
      }
    }
  );

  // ---- GET /api/activities/stats ----
  app.get('/api/activities/stats', async (_req, reply) => {
    // Get all conversations to compute stats
    const result = await agentClient.listConversations(0, 100);
    if (!result.ok || !result.data) {
      const status = mapAgentStatus(result.status);
      errorReply(
        reply,
        status,
        result.error?.code ?? 'agent_error',
        result.error?.message ?? 'Failed to get conversation stats'
      );
      return;
    }

    const modeInit = () => ({ total: 0, active: 0, resolved: 0 });
    const counts = {
      discovery: modeInit(),
      planning: modeInit(),
      staffing: modeInit()
    };

    let totalConversations = 0;
    let activeConversations = 0;
    let resolvedConversations = 0;

    for (const conv of result.data.items) {
      const record = activityConversationStore.get(conv.id);
      const mode = record?.mode ?? extractModeFromMetadata(conv.metadata);
      const status = record?.status ?? 'active';

      totalConversations++;
      const modeStats = counts[mode];

      modeStats.total++;
      if (status === 'resolved') {
        resolvedConversations++;
        modeStats.resolved++;
      } else {
        activeConversations++;
        modeStats.active++;
      }
    }

    const stats: ActivityStats = {
      totalConversations,
      activeConversations,
      resolvedConversations,
      byMode: counts
    };

    await reply.send(stats);
  });

  // ---- GET /identity ----
  // Diagnostic endpoint — always attempts real credential validation regardless
  // of SKIP_AUTH. Works with any credential source that the runtime-selected
  // Azure credential can use.
  // supports: az CLI, managed identity, environment variables, etc.
  app.get('/identity', async (req, reply) => {
    try {
      const credential = createAzureCredential();
      const tokenResponse = await credential.getToken('https://management.azure.com/.default', {
        abortSignal: AbortSignal.timeout(5000)
      });
      if (!tokenResponse) {
        throw new Error('Failed to acquire Azure management token');
      }

      const claims = decodeJwtPayload(tokenResponse.token);
      await reply.send({
        authenticated: true,
        identity: {
          tenantId: claims['tid'] ?? null,
          objectId: claims['oid'] ?? null,
          displayName: claims['name'] ?? claims['appid'] ?? null,
          type: inferIdentityType(claims)
        }
      });
    } catch (err: unknown) {
      req.log.error({ err }, 'Failed to get identity');
      await reply.send({
        authenticated: false,
        reason: `Credential error: ${err instanceof Error ? err.message : String(err)}`
      });
    }
  });
}
