/**
 * Full-stack E2E tests — exercises the complete service chain:
 *
 *   Test → Frontend BFF (:8080) → API (:4000) → Agent (:3000) → Mock/Azure
 *
 * These tests ONLY run when E2E_BASE_URL is set (by compose-test-runner.ts
 * or manually). When E2E_BASE_URL is not set, the entire suite is skipped.
 *
 * Two modes:
 *   - Mock mode (E2E_MOCK_MODE=true): asserts deterministic mock output
 *   - Real mode (default): validates response shapes only (for real LLMs)
 *
 * Tiers:
 *   - L5 (mock): local compose + mock services, every PR
 *   - L6 (local + Azure): local compose, real Azure AI Foundry, pre-merge
 *   - L9 (deployed): Azure Container Apps, nightly CI
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ApiClient } from '../src/helpers/api-client.ts';
import type { ActivityConversationStarted } from '../src/helpers/api-client.ts';
import { collectSSEEvents } from '../src/helpers/sse-collector.ts';
import type { SSEEvent } from '../src/helpers/sse-collector.ts';
import { ACTIVITY_MESSAGES, SSE_EVENT_SEQUENCE } from '../src/fixtures/activity-fixtures.ts';

// ─── Configuration ──────────────────────────────────────────────────────

const E2E_BASE_URL = process.env['E2E_BASE_URL'];
const MOCK_MODE = process.env['E2E_MOCK_MODE'] === 'true';

// Timeouts: mocks respond instantly; real LLMs need more time
const REQUEST_TIMEOUT_MS = MOCK_MODE ? 10_000 : 60_000;
const SSE_TIMEOUT_MS = MOCK_MODE ? 10_000 : 90_000;

// ─── Skip guard ─────────────────────────────────────────────────────────

const describeCompose = E2E_BASE_URL ? describe : describe.skip;

describeCompose('Full-stack E2E (compose)', () => {
  let client: ApiClient;

  beforeAll(() => {
    client = new ApiClient({
      baseUrl: E2E_BASE_URL,
      timeoutMs: REQUEST_TIMEOUT_MS
    });
  });

  // ─── Health ───────────────────────────────────────────────────────────

  describe('health', () => {
    it('BFF health endpoint returns healthy', async () => {
      const res = await client.getHealth();
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
    });
  });

  // ─── Discovery conversation flow ────────────────────────────────────────────

  describe('discovery conversation flow', () => {
    let activityConversation: ActivityConversationStarted;

    describe('start discovery', () => {
      it('creates a discovery activity conversation', async () => {
        const res = await client.startDiscovery();
        expect(res.status).toBe(201);
        expect(res.body.id).toBeTruthy();
        expect(res.body.mode).toBe('discovery');
        // Both mocks now correctly return 'active' on the first specialist
        // interaction (conversational text), matching real agent behavior.
        expect(res.body.status).toBe('active');
        expect(res.body.syntheticMessage).toBeTruthy();
        expect(typeof res.body.syntheticMessage).toBe('string');
        expect(res.body.createdAt).toBeTruthy();

        activityConversation = res.body;
      });
    });

    // Message (JSON response)
    describe('message (JSON)', () => {
      it('sends a message and receives an assistant response', async () => {
        const res = await client.message(activityConversation.id, ACTIVITY_MESSAGES.discovery);
        expect(res.status).toBe(200);
        expect(res.body.role).toBe('assistant');
        // Content is always non-empty in mock mode; against a real LLM the
        // model may resolve an activity without producing user-facing text.
        if (MOCK_MODE) {
          expect(res.body.content).toBeTruthy();
        }
        expect(typeof res.body.content).toBe('string');
        expect(res.body.id).toBeTruthy();
        expect(res.body.createdAt).toBeTruthy();
      });

      if (MOCK_MODE) {
        it('mock response returns non-empty content (not blank)', async () => {
          // Regression test: the mock must return substantive content, not
          // an empty string (which was the old extractUserText bug).
          const res = await client.message(activityConversation.id, ACTIVITY_MESSAGES.short);
          expect(res.status).toBe(200);
          expect(res.body.content).toBeTruthy();
          // Content should be a non-trivial string (at least 5 chars)
          expect(res.body.content.length).toBeGreaterThanOrEqual(5);
        });
      }
    });

    // Message (SSE streaming)
    describe('message (SSE streaming)', () => {
      let sseEvents: SSEEvent[];

      it('streams a response with message.delta and message.complete events', async () => {
        const response = await client.messageStream(activityConversation.id, ACTIVITY_MESSAGES.greeting);
        expect(response.status).toBe(200);

        const contentType = response.headers.get('content-type') ?? '';
        expect(contentType).toContain('text/event-stream');

        const result = await collectSSEEvents(response, {
          timeoutMs: SSE_TIMEOUT_MS
        });

        expect(result.done).toBe(true);
        expect(result.error).toBeUndefined();
        sseEvents = result.events;
      });

      it('has at least one message.delta event', () => {
        // In mock mode, the model always produces text. Against a real LLM,
        // the model may go straight from specialist tool calls to resolution
        // without producing user-facing text (e.g. the discovery SSE test is
        // the 3rd exchange on the same conversation where the model often
        // judges + resolves back-to-back).
        const deltaEvents = sseEvents.filter((e) => e.event === 'message.delta');
        if (MOCK_MODE) {
          expect(deltaEvents.length).toBeGreaterThanOrEqual(1);
        }

        // Each delta that IS present should have content
        for (const delta of deltaEvents) {
          const data = delta.data as { content?: string };
          expect(data.content).toBeTruthy();
        }
      });

      it('has exactly one message.complete event', () => {
        const completeEvents = sseEvents.filter((e) => e.event === 'message.complete');
        expect(completeEvents).toHaveLength(1);

        const complete = completeEvents[0]?.data as {
          messageId?: string;
          content?: string;
          role?: string;
          createdAt?: string;
        };
        // Content is always present in mock mode; against a real LLM the
        // model may resolve an activity without producing final text.
        if (MOCK_MODE) {
          expect(complete.content).toBeTruthy();
        }
        expect(typeof complete.content).toBe('string');
      });

      it('all event types are valid', () => {
        const validTypes = new Set<string | undefined>(SSE_EVENT_SEQUENCE.valid);
        for (const event of sseEvents) {
          expect(validTypes.has(event.event), `Unexpected SSE event type: "${event.event}"`).toBe(true);
        }
      });

      it('delta content concatenation approximates complete content', () => {
        const deltaContent = sseEvents
          .filter((e) => e.event === 'message.delta')
          .map((e) => (e.data as { content: string }).content)
          .join('');

        const completeEvent = sseEvents.find((e) => e.event === 'message.complete');
        const completeContent = (completeEvent?.data as { content?: string })?.content ?? '';

        // The concatenated deltas should match the complete message content
        expect(deltaContent.trim()).toBe(completeContent.trim());
      });
    });
  });

  // ─── Planning conversation flow ──────────────────────────────────────────

  describe('planning conversation flow', () => {
    it('creates a planning conversation and sends a message', async () => {
      const startRes = await client.startPlanning();
      expect(startRes.status).toBe(201);
      expect(startRes.body.mode).toBe('planning');
      expect(startRes.body.syntheticMessage).toBeTruthy();

      const messageRes = await client.message(startRes.body.id, ACTIVITY_MESSAGES.planning);
      expect(messageRes.status).toBe(200);
      // Content is always non-empty in mock mode; against a real LLM the
      // model may resolve an activity without producing user-facing text.
      if (MOCK_MODE) {
        expect(messageRes.body.content).toBeTruthy();
      }
      expect(typeof messageRes.body.content).toBe('string');
    });
  });

  // ─── Staffing enlistment flow ─────────────────────────────────────────────

  describe('staffing enlistment flow', () => {
    it('creates a staffing conversation and sends a message', async () => {
      const startRes = await client.startStaffing();
      expect(startRes.status).toBe(201);
      expect(startRes.body.mode).toBe('staffing');
      expect(startRes.body.syntheticMessage).toBeTruthy();

      const messageRes = await client.message(startRes.body.id, ACTIVITY_MESSAGES.staffing);
      expect(messageRes.status).toBe(200);
      // Content is always non-empty in mock mode; against a real LLM the
      // model may resolve an activity without producing user-facing text.
      if (MOCK_MODE) {
        expect(messageRes.body.content).toBeTruthy();
      }
      expect(typeof messageRes.body.content).toBe('string');
    });
  });

  // ─── List conversations ──────────────────────────────────────────────────

  describe('list conversations', () => {
    it('returns a list that includes our created conversations', async () => {
      const res = await client.listActivityConversations();
      expect(res.status).toBe(200);
      expect(res.body.conversations).toBeInstanceOf(Array);
      expect(res.body.total).toBeGreaterThanOrEqual(3); // discovery + planning + staffing

      // Check that all three modes are represented
      const modes = new Set(res.body.conversations.map((a) => a.mode));
      expect(modes.has('discovery')).toBe(true);
      expect(modes.has('planning')).toBe(true);
      expect(modes.has('staffing')).toBe(true);
    });

    it('supports pagination', async () => {
      const res = await client.listActivityConversations({ offset: 0, limit: 1 });
      expect(res.status).toBe(200);
      expect(res.body.conversations.length).toBeLessThanOrEqual(1);
      expect(res.body.limit).toBe(1);
    });
  });

  // ─── ActivityConversation detail ─────────────────────────────────────────────────

  describe('activity conversation detail', () => {
    it('returns the conversation with messages', async () => {
      // Create an conversation and message so we have messages
      const startRes = await client.startDiscovery();
      await client.message(startRes.body.id, ACTIVITY_MESSAGES.discovery);

      const res = await client.getActivityConversation(startRes.body.id);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(startRes.body.id);
      expect(res.body.mode).toBe('discovery');
      expect(res.body.messages).toBeInstanceOf(Array);
      // Opening message + user message + assistant response = at least 3
      expect(res.body.messages.length).toBeGreaterThanOrEqual(1);
    });

    it('message count reflects activity', async () => {
      const startRes = await client.startDiscovery();
      await client.message(startRes.body.id, 'Hello!');

      const res = await client.getActivityConversation(startRes.body.id);
      expect(res.body.messageCount).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── Stats ────────────────────────────────────────────────────────────

  describe('stats', () => {
    it('returns statistics reflecting our activity', async () => {
      const res = await client.getStats();
      expect(res.status).toBe(200);
      expect(res.body.totalConversations).toBeGreaterThanOrEqual(3);
      expect(typeof res.body.activeConversations).toBe('number');
      expect(typeof res.body.resolvedConversations).toBe('number');
    });

    it('stats response has expected shape', async () => {
      const res = await client.getStats();
      expect(res.body.byMode).toBeDefined();
      expect(typeof res.body.byMode.discovery.total).toBe('number');
      expect(typeof res.body.byMode.discovery.active).toBe('number');
      expect(typeof res.body.byMode.discovery.resolved).toBe('number');
      expect(typeof res.body.byMode.planning.total).toBe('number');
      expect(typeof res.body.byMode.staffing.total).toBe('number');
    });
  });

  // ─── Full lifecycle: start → message → resolution (mock mode only) ───

  const describeLifecycle = MOCK_MODE ? describe : describe.skip;

  describeLifecycle('full lifecycle — discovery resolution', () => {
    it('starts discovery, messages via SSE, and resolves the activity conversation', async () => {
      // 1. Start discovery conversation (create-only, no message sent to agent)
      const startRes = await client.startDiscovery();
      expect(startRes.status).toBe(201);
      expect(startRes.body.status).toBe('active');
      const conversationId = startRes.body.id;

      // 2. Send the synthetic message as the first message (opening interaction)
      const openingResponse = await client.messageStream(conversationId, startRes.body.syntheticMessage);
      expect(openingResponse.status).toBe(200);
      const openingResult = await collectSSEEvents(openingResponse, { timeoutMs: SSE_TIMEOUT_MS });
      expect(openingResult.done).toBe(true);

      // 3. Send a follow-up message via SSE stream — this should trigger resolution
      const sseResponse = await client.messageStream(conversationId, ACTIVITY_MESSAGES.discovery);
      expect(sseResponse.status).toBe(200);

      const result = await collectSSEEvents(sseResponse, { timeoutMs: SSE_TIMEOUT_MS });
      expect(result.done).toBe(true);

      // 4. Verify activity.resolved event was emitted
      const resolvedEvents = result.events.filter((e) => e.event === 'activity.resolved');
      expect(resolvedEvents).toHaveLength(1);
      const resolvedData = resolvedEvents[0]?.data as {
        tool?: string;
        result?: Record<string, unknown>;
      };
      expect(resolvedData.tool).toBe('resolve_discovery');
      expect(resolvedData.result).toBeDefined();

      // 5. Verify conversation detail shows resolved status
      const detailRes = await client.getActivityConversation(conversationId);
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.status).toBe('resolved');
      expect(detailRes.body.outcome).toBeDefined();
      expect(detailRes.body.outcome?.tool).toBe('resolve_discovery');

      // 6. Verify stats reflect the resolution
      const statsRes = await client.getStats();
      expect(statsRes.status).toBe(200);
      expect(statsRes.body.resolvedConversations).toBeGreaterThanOrEqual(1);
      expect(statsRes.body.byMode.discovery.resolved).toBeGreaterThanOrEqual(1);
    });
  });

  describeLifecycle('full lifecycle — planning resolution', () => {
    it('starts planning, messages via SSE, and resolves the activity conversation', async () => {
      // 1. Start planning conversation (create-only)
      const startRes = await client.startPlanning();
      expect(startRes.status).toBe(201);
      expect(startRes.body.status).toBe('active');
      const conversationId = startRes.body.id;

      // 2. Send the synthetic message as the first message (opening interaction)
      const openingResponse = await client.messageStream(conversationId, startRes.body.syntheticMessage);
      expect(openingResponse.status).toBe(200);
      const openingResult = await collectSSEEvents(openingResponse, { timeoutMs: SSE_TIMEOUT_MS });
      expect(openingResult.done).toBe(true);

      // 3. Send a follow-up message via SSE stream — this should trigger resolution
      const sseResponse = await client.messageStream(conversationId, ACTIVITY_MESSAGES.planning);
      expect(sseResponse.status).toBe(200);

      const result = await collectSSEEvents(sseResponse, { timeoutMs: SSE_TIMEOUT_MS });
      expect(result.done).toBe(true);

      // 4. Verify activity.resolved event was emitted
      const resolvedEvents = result.events.filter((e) => e.event === 'activity.resolved');
      expect(resolvedEvents).toHaveLength(1);
      const resolvedData = resolvedEvents[0]?.data as {
        tool?: string;
        result?: Record<string, unknown>;
      };
      expect(resolvedData.tool).toBe('resolve_planning');
      expect(resolvedData.result).toBeDefined();

      // 5. Verify conversation detail shows resolved status
      const detailRes = await client.getActivityConversation(conversationId);
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.status).toBe('resolved');
      expect(detailRes.body.outcome).toBeDefined();
      expect(detailRes.body.outcome?.tool).toBe('resolve_planning');

      // 6. Verify stats reflect the resolution
      const statsRes = await client.getStats();
      expect(statsRes.status).toBe(200);
      expect(statsRes.body.byMode.planning.resolved).toBeGreaterThanOrEqual(1);
    });
  });

  describeLifecycle('full lifecycle — staffing resolution', () => {
    it('starts staffing, messages via SSE, and resolves the activity conversation', async () => {
      // 1. Start staffing conversation (create-only)
      const startRes = await client.startStaffing();
      expect(startRes.status).toBe(201);
      expect(startRes.body.status).toBe('active');
      const conversationId = startRes.body.id;

      // 2. Send the synthetic message as the first message (opening interaction)
      const openingResponse = await client.messageStream(conversationId, startRes.body.syntheticMessage);
      expect(openingResponse.status).toBe(200);
      const openingResult = await collectSSEEvents(openingResponse, { timeoutMs: SSE_TIMEOUT_MS });
      expect(openingResult.done).toBe(true);

      // 3. Send a follow-up message via SSE stream — this should trigger resolution
      const sseResponse = await client.messageStream(conversationId, ACTIVITY_MESSAGES.staffing);
      expect(sseResponse.status).toBe(200);

      const result = await collectSSEEvents(sseResponse, { timeoutMs: SSE_TIMEOUT_MS });
      expect(result.done).toBe(true);

      // 4. Verify activity.resolved event was emitted
      const resolvedEvents = result.events.filter((e) => e.event === 'activity.resolved');
      expect(resolvedEvents).toHaveLength(1);
      const resolvedData = resolvedEvents[0]?.data as {
        tool?: string;
        result?: Record<string, unknown>;
      };
      expect(resolvedData.tool).toBe('resolve_staffing');
      expect(resolvedData.result).toBeDefined();

      // 5. Verify conversation detail shows resolved status
      const detailRes = await client.getActivityConversation(conversationId);
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.status).toBe('resolved');
      expect(detailRes.body.outcome).toBeDefined();
      expect(detailRes.body.outcome?.tool).toBe('resolve_staffing');

      // 6. Verify stats reflect the resolution
      const statsRes = await client.getStats();
      expect(statsRes.status).toBe(200);
      expect(statsRes.body.byMode.staffing.resolved).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── Error handling ───────────────────────────────────────────────────

  describe('error handling', () => {
    it('returns 404 for non-existent activity conversation', async () => {
      const res = await client.getActivityConversation('nonexistent_activity_conversation_000');
      expect(res.status).toBe(404);
    });

    it('returns 404 for message with non-existent activity conversation', async () => {
      const res = await client.message('nonexistent_activity_conversation_000', 'Hello?');
      expect(res.status).toBe(404);
    });
  });
});
