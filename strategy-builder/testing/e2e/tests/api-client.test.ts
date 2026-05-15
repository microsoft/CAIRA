/**
 * Unit tests for the API client.
 *
 * Uses a real Fastify server that mimics the backend API v2.0.0 to test
 * the client's request construction and response parsing.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { ApiClient } from '../src/helpers/api-client.ts';
import type { ActivityMode, ActivityConversationStarted } from '../src/helpers/api-client.ts';
import { SCHEMAS } from '../src/fixtures/activity-fixtures.ts';
import { validateSchema } from '../src/helpers/schema-validator.ts';

// ─── Mock backend server ────────────────────────────────────────────────

function createMockBackend() {
  const app = Fastify();

  // In-memory store
  interface StoredActivityConversation {
    id: string;
    mode: ActivityMode;
    status: 'active' | 'resolved';
    outcome?: { tool: string; result: Record<string, unknown> } | undefined;
    createdAt: string;
    lastMessageAt: string;
    messageCount: number;
    messages: Array<{
      id: string;
      role: string;
      content: string;
      createdAt: string;
      usage?: { promptTokens: number; completionTokens: number } | undefined;
    }>;
  }

  const conversations: StoredActivityConversation[] = [];

  let idCounter = 0;
  function nextId(): string {
    idCounter++;
    return `adv_${String(idCounter).padStart(6, '0')}`;
  }

  function msgId(): string {
    idCounter++;
    return `msg_${String(idCounter).padStart(6, '0')}`;
  }

  // Health
  app.get('/health', async () => ({
    status: 'healthy',
    dependencies: [{ name: 'agent-container', status: 'healthy', latencyMs: 12 }]
  }));

  // Start discovery
  app.post('/api/activities/discovery', async (_req, reply) => {
    return startActivityConversation('discovery', reply);
  });

  // Start planning
  app.post('/api/activities/planning', async (_req, reply) => {
    return startActivityConversation('planning', reply);
  });

  // Start staffing
  app.post('/api/activities/staffing', async (_req, reply) => {
    return startActivityConversation('staffing', reply);
  });

  // Synthetic messages (matches the real API's SYNTHETIC_MESSAGES)
  const syntheticMessages: Record<string, string> = {
    discovery: 'Lead a short discovery conversation and qualify the opportunity.',
    planning: 'Guide me through an account planning exercise with clear choices.',
    staffing: 'Recommend the right team staffing coverage for this account.'
  };

  function startActivityConversation(
    mode: ActivityMode,
    reply: { status: (code: number) => { send: (body: unknown) => unknown } }
  ) {
    const now = new Date().toISOString();
    const id = nextId();
    const adv: StoredActivityConversation = {
      id,
      mode,
      status: 'active',
      createdAt: now,
      lastMessageAt: now,
      messageCount: 0,
      messages: []
    };
    conversations.push(adv);
    return reply.status(201).send({
      id: adv.id,
      mode: adv.mode,
      status: adv.status,
      syntheticMessage: syntheticMessages[mode] ?? '',
      createdAt: adv.createdAt
    } satisfies ActivityConversationStarted);
  }

  // List conversations
  app.get('/api/activities/conversations', async (req) => {
    const query = req.query as { offset?: string; limit?: string };
    const offset = Number(query.offset ?? 0);
    const limit = Number(query.limit ?? 20);
    const page = conversations.slice(offset, offset + limit);
    return {
      conversations: page.map((a) => ({
        id: a.id,
        mode: a.mode,
        status: a.status,
        outcome: a.outcome,
        createdAt: a.createdAt,
        lastMessageAt: a.lastMessageAt,
        messageCount: a.messageCount
      })),
      offset,
      limit,
      total: conversations.length
    };
  });

  // Get conversation detail
  app.get<{ Params: { conversationId: string } }>(
    '/api/activities/conversations/:conversationId',
    async (req, reply) => {
      const adv = conversations.find((a) => a.id === req.params.conversationId);
      if (!adv) {
        return reply.status(404).send({ code: 'not_found', message: 'ActivityConversation not found' });
      }
      return {
        id: adv.id,
        mode: adv.mode,
        status: adv.status,
        outcome: adv.outcome,
        createdAt: adv.createdAt,
        lastMessageAt: adv.lastMessageAt,
        messageCount: adv.messageCount,
        messages: adv.messages
      };
    }
  );

  // Message (JSON + SSE)
  app.post<{ Params: { conversationId: string } }>(
    '/api/activities/conversations/:conversationId/messages',
    async (req, reply) => {
      const adv = conversations.find((a) => a.id === req.params.conversationId);
      if (!adv) {
        return reply.status(404).send({ code: 'not_found', message: 'ActivityConversation not found' });
      }

      const body = req.body as { message: string };
      if (!body.message) {
        return reply.status(400).send({ code: 'bad_request', message: 'Message is required' });
      }

      const accept = req.headers.accept ?? 'application/json';
      const now = new Date().toISOString();

      // Add user message
      const userMsg = {
        id: msgId(),
        role: 'user' as const,
        content: body.message,
        createdAt: now
      };
      adv.messages.push(userMsg);

      // Generate assistant response
      const assistantMsg = {
        id: msgId(),
        role: 'assistant' as const,
        content: 'That is a strong next question.',
        createdAt: now,
        usage: { promptTokens: 10, completionTokens: 8 }
      };
      adv.messages.push(assistantMsg);
      adv.messageCount = adv.messages.length;
      adv.lastMessageAt = now;

      if (accept.includes('text/event-stream')) {
        // SSE streaming
        reply.raw.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive'
        });

        reply.hijack();

        const chunks = ['That ', 'is ', 'a strong ', 'next question.'];
        for (const chunk of chunks) {
          reply.raw.write(`event: message.delta\ndata: ${JSON.stringify({ content: chunk })}\n\n`);
        }

        reply.raw.write(
          `event: message.complete\ndata: ${JSON.stringify({
            messageId: assistantMsg.id,
            content: assistantMsg.content,
            usage: assistantMsg.usage
          })}\n\n`
        );

        reply.raw.write('data: [DONE]\n\n');
        reply.raw.end();
        return;
      }

      // JSON response
      return reply.send(assistantMsg);
    }
  );

  // Stats
  app.get('/api/activities/stats', async () => {
    const byMode = (mode: ActivityMode) => {
      const matching = conversations.filter((a) => a.mode === mode);
      return {
        total: matching.length,
        active: matching.filter((a) => a.status === 'active').length,
        resolved: matching.filter((a) => a.status === 'resolved').length
      };
    };
    return {
      totalConversations: conversations.length,
      activeConversations: conversations.filter((a) => a.status === 'active').length,
      resolvedConversations: conversations.filter((a) => a.status === 'resolved').length,
      byMode: {
        discovery: byMode('discovery'),
        planning: byMode('planning'),
        staffing: byMode('staffing')
      }
    };
  });

  return app;
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe('ApiClient', () => {
  const app = createMockBackend();
  let client: ApiClient;

  beforeAll(async () => {
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    const port = Number(new URL(address).port);
    client = new ApiClient({ baseUrl: `http://127.0.0.1:${port}` });
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Health ─────────────────────────────────────────────────────────

  describe('getHealth', () => {
    it('returns healthy status', async () => {
      const res = await client.getHealth();
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
    });

    it('response matches HealthResponse schema', async () => {
      const res = await client.getHealth();
      const validation = await validateSchema(SCHEMAS.HealthResponse, res.body);
      expect(validation.valid).toBe(true);
    });
  });

  // ─── Business Operations ────────────────────────────────────────────

  describe('startDiscovery', () => {
    it('creates a discovery conversation with 201', async () => {
      const res = await client.startDiscovery();
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.mode).toBe('discovery');
      expect(res.body.status).toBe('active');
      expect(res.body.syntheticMessage).toBeDefined();
      expect(res.body.syntheticMessage).toBeTruthy();
      expect(res.body.createdAt).toBeDefined();
    });

    it('response matches ActivityConversationStarted schema', async () => {
      const res = await client.startDiscovery();
      const validation = await validateSchema(SCHEMAS.ActivityConversationStarted, res.body);
      expect(validation.valid).toBe(true);
    });
  });

  describe('startPlanning', () => {
    it('creates a planning conversation with 201', async () => {
      const res = await client.startPlanning();
      expect(res.status).toBe(201);
      expect(res.body.mode).toBe('planning');
      expect(res.body.status).toBe('active');
    });
  });

  describe('startStaffing', () => {
    it('creates a staffing conversation with 201', async () => {
      const res = await client.startStaffing();
      expect(res.status).toBe(201);
      expect(res.body.mode).toBe('staffing');
      expect(res.body.status).toBe('active');
    });
  });

  // ─── List conversations ───────────────────────────────────────────────

  describe('listActivityConversations', () => {
    it('returns a paginated list', async () => {
      const res = await client.listActivityConversations();
      expect(res.status).toBe(200);
      expect(res.body.conversations).toBeInstanceOf(Array);
      expect(res.body.total).toBeGreaterThan(0);
      expect(res.body.offset).toBe(0);
      expect(res.body.limit).toBe(20);
    });

    it('response matches ActivityConversationList schema', async () => {
      const res = await client.listActivityConversations();
      const validation = await validateSchema(SCHEMAS.ActivityConversationList, res.body);
      expect(validation.valid).toBe(true);
    });

    it('supports pagination parameters', async () => {
      const res = await client.listActivityConversations({ offset: 0, limit: 1 });
      expect(res.status).toBe(200);
      expect(res.body.conversations.length).toBeLessThanOrEqual(1);
      expect(res.body.limit).toBe(1);
    });
  });

  // ─── Message (JSON) ─────────────────────────────────────────────────

  describe('message', () => {
    let conversationId: string;

    beforeAll(async () => {
      const res = await client.startDiscovery();
      conversationId = res.body.id;
    });

    it('sends a message and gets an assistant response', async () => {
      const res = await client.message(conversationId, 'Hello team!');
      expect(res.status).toBe(200);
      expect(res.body.role).toBe('assistant');
      expect(res.body.content).toBeTruthy();
    });

    it('response matches ActivityMessage schema', async () => {
      const res = await client.message(conversationId, 'Tell me about planning!');
      const validation = await validateSchema(SCHEMAS.ActivityMessage, res.body);
      expect(validation.valid).toBe(true);
    });

    it('returns 404 for non-existent activity conversation', async () => {
      const res = await client.message('nonexistent_activity_conversation_000', 'Hello?');
      expect(res.status).toBe(404);
    });
  });

  // ─── Get conversation detail ──────────────────────────────────────────

  describe('getActivityConversation', () => {
    let conversationId: string;

    beforeAll(async () => {
      const res = await client.startDiscovery();
      conversationId = res.body.id;
      // Send a message so there are messages
      await client.message(conversationId, 'Hello!');
    });

    it('returns conversation with messages', async () => {
      const res = await client.getActivityConversation(conversationId);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(conversationId);
      expect(res.body.mode).toBe('discovery');
      expect(res.body.messages).toBeInstanceOf(Array);
      expect(res.body.messages.length).toBeGreaterThan(0);
    });

    it('response matches ActivityConversationDetail schema', async () => {
      const res = await client.getActivityConversation(conversationId);
      const validation = await validateSchema(SCHEMAS.ActivityConversationDetail, res.body);
      expect(validation.valid).toBe(true);
    });

    it('returns 404 for non-existent activity conversation', async () => {
      const res = await client.getActivityConversation('nonexistent_activity_conversation_000');
      expect(res.status).toBe(404);
    });
  });

  // ─── Stats ──────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('returns statistics', async () => {
      const res = await client.getStats();
      expect(res.status).toBe(200);
      expect(res.body.totalConversations).toBeGreaterThan(0);
      expect(typeof res.body.activeConversations).toBe('number');
      expect(typeof res.body.resolvedConversations).toBe('number');
      expect(res.body.byMode).toBeDefined();
      expect(res.body.byMode.discovery).toBeDefined();
      expect(res.body.byMode.planning).toBeDefined();
      expect(res.body.byMode.staffing).toBeDefined();
    });

    it('response matches ActivityStats schema', async () => {
      const res = await client.getStats();
      const validation = await validateSchema(SCHEMAS.ActivityStats, res.body);
      expect(validation.valid).toBe(true);
    });
  });
});
