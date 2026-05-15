/**
 * Unit tests for the schema validator.
 *
 * Tests validation of JSON objects against named OpenAPI component schemas
 * from the backend-api.openapi.yaml spec.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { validateSchema, resetSchemaCache } from '../src/helpers/schema-validator.ts';
import { SCHEMAS } from '../src/fixtures/activity-fixtures.ts';

afterEach(() => {
  resetSchemaCache();
});

describe('validateSchema', () => {
  // ─── Valid objects ──────────────────────────────────────────────────

  describe('valid objects', () => {
    it('validates a valid ActivityConversation', async () => {
      const result = await validateSchema(SCHEMAS.ActivityConversation, {
        id: 'conv_001',
        mode: 'discovery',
        status: 'active',
        createdAt: '2026-01-15T10:30:00.000Z',
        lastMessageAt: '2026-01-15T10:30:00.000Z',
        messageCount: 0
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('validates an ActivityConversation with optional outcome', async () => {
      const result = await validateSchema(SCHEMAS.ActivityConversation, {
        id: 'conv_002',
        mode: 'planning',
        status: 'resolved',
        outcome: {
          tool: 'resolve_planning',
          result: {
            approved: true,
            focus_area: 'Executive sponsor alignment',
            next_step: 'Confirm stakeholder review'
          }
        },
        createdAt: '2026-01-15T10:30:00.000Z',
        lastMessageAt: '2026-01-15T11:00:00.000Z',
        messageCount: 5
      });

      expect(result.valid).toBe(true);
    });

    it('validates a valid ActivityConversationStarted', async () => {
      const result = await validateSchema(SCHEMAS.ActivityConversationStarted, {
        id: 'conv_003',
        mode: 'staffing',
        status: 'active',
        syntheticMessage: 'Recommend the right team staffing coverage for this account.',
        createdAt: '2026-01-15T10:30:00.000Z'
      });

      expect(result.valid).toBe(true);
    });

    it('validates a valid ActivityConversationDetail', async () => {
      const result = await validateSchema(SCHEMAS.ActivityConversationDetail, {
        id: 'conv_004',
        mode: 'discovery',
        status: 'resolved',
        outcome: {
          tool: 'resolve_discovery',
          result: {
            fit: 'qualified',
            signals_reviewed: 4,
            primary_need: 'Executive visibility into account risk.'
          }
        },
        createdAt: '2026-01-15T10:30:00.000Z',
        lastMessageAt: '2026-01-15T10:35:00.000Z',
        messageCount: 2,
        messages: [
          {
            id: 'msg_1',
            role: 'user',
            content: 'Hello!',
            createdAt: '2026-01-15T10:30:00.000Z'
          },
          {
            id: 'msg_2',
            role: 'assistant',
            content: 'Arr!',
            createdAt: '2026-01-15T10:31:00.000Z',
            usage: { promptTokens: 5, completionTokens: 1 }
          }
        ]
      });

      expect(result.valid).toBe(true);
    });

    it('validates a valid ActivityConversationList', async () => {
      const result = await validateSchema(SCHEMAS.ActivityConversationList, {
        conversations: [
          {
            id: 'conv_001',
            mode: 'discovery',
            status: 'active',
            createdAt: '2026-01-15T10:30:00.000Z',
            lastMessageAt: '2026-01-15T10:30:00.000Z',
            messageCount: 0
          }
        ],
        offset: 0,
        limit: 20,
        total: 1
      });

      expect(result.valid).toBe(true);
    });

    it('validates a valid ActivityMessage', async () => {
      const result = await validateSchema(SCHEMAS.ActivityMessage, {
        id: 'msg_123',
        role: 'assistant',
        content: 'Welcome to the workspace!',
        createdAt: '2026-01-15T10:30:00.000Z',
        usage: { promptTokens: 10, completionTokens: 8 }
      });

      expect(result.valid).toBe(true);
    });

    it('validates a ActivityMessage with optional resolution', async () => {
      const result = await validateSchema(SCHEMAS.ActivityMessage, {
        id: 'msg_456',
        role: 'assistant',
        content: 'The opportunity looks qualified.',
        createdAt: '2026-01-15T10:30:00.000Z',
        usage: { promptTokens: 10, completionTokens: 8 },
        resolution: {
          tool: 'resolve_discovery',
          result: {
            fit: 'qualified',
            signals_reviewed: 4,
            primary_need: 'Executive visibility into account risk.'
          }
        }
      });

      expect(result.valid).toBe(true);
    });

    it('validates a valid ActivityStats', async () => {
      const result = await validateSchema(SCHEMAS.ActivityStats, {
        totalConversations: 42,
        activeConversations: 7,
        resolvedConversations: 35,
        byMode: {
          discovery: { total: 15, active: 3, resolved: 12 },
          planning: { total: 20, active: 2, resolved: 18 },
          staffing: { total: 7, active: 2, resolved: 5 }
        }
      });

      expect(result.valid).toBe(true);
    });

    it('validates a valid ModeStats', async () => {
      const result = await validateSchema(SCHEMAS.ModeStats, {
        total: 15,
        active: 3,
        resolved: 12
      });

      expect(result.valid).toBe(true);
    });

    it('validates a valid HealthResponse', async () => {
      const result = await validateSchema(SCHEMAS.HealthResponse, {
        status: 'healthy',
        dependencies: [{ name: 'agent-container', status: 'healthy', latencyMs: 12 }]
      });

      expect(result.valid).toBe(true);
    });

    it('validates a valid ErrorResponse', async () => {
      const result = await validateSchema(SCHEMAS.ErrorResponse, {
        code: 'not_found',
        message: 'ActivityConversation not found'
      });

      expect(result.valid).toBe(true);
    });
  });

  // ─── Invalid objects ────────────────────────────────────────────────

  describe('invalid objects', () => {
    it('rejects an ActivityConversation missing required fields', async () => {
      const result = await validateSchema(SCHEMAS.ActivityConversation, {
        id: 'conv_001'
        // missing mode, status, createdAt, lastMessageAt, messageCount
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects an ActivityConversation with invalid mode enum', async () => {
      const result = await validateSchema(SCHEMAS.ActivityConversation, {
        id: 'conv_001',
        mode: 'duel', // not in enum: [discovery, planning, staffing]
        status: 'active',
        createdAt: '2026-01-15T10:30:00.000Z',
        lastMessageAt: '2026-01-15T10:30:00.000Z',
        messageCount: 0
      });

      expect(result.valid).toBe(false);
    });

    it('rejects an ActivityConversation with invalid status enum', async () => {
      const result = await validateSchema(SCHEMAS.ActivityConversation, {
        id: 'conv_001',
        mode: 'discovery',
        status: 'finished', // not in enum: [active, resolved]
        createdAt: '2026-01-15T10:30:00.000Z',
        lastMessageAt: '2026-01-15T10:30:00.000Z',
        messageCount: 0
      });

      expect(result.valid).toBe(false);
    });

    it('rejects a ActivityMessage with invalid role', async () => {
      const result = await validateSchema(SCHEMAS.ActivityMessage, {
        id: 'msg_123',
        role: 'manager', // Not in enum: [user, assistant, system]
        content: 'Thanks.',
        createdAt: '2026-01-15T10:30:00.000Z'
      });

      expect(result.valid).toBe(false);
    });

    it('rejects an empty object as HealthResponse', async () => {
      const result = await validateSchema(SCHEMAS.HealthResponse, {});

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('status'))).toBe(true);
    });

    it('rejects HealthResponse with invalid status enum', async () => {
      const result = await validateSchema(SCHEMAS.HealthResponse, {
        status: 'unknown'
      });

      expect(result.valid).toBe(false);
    });

    it('rejects ActivityStats missing byMode', async () => {
      const result = await validateSchema(SCHEMAS.ActivityStats, {
        totalConversations: 10,
        activeConversations: 5,
        resolvedConversations: 5
        // missing byMode
      });

      expect(result.valid).toBe(false);
    });

    it('rejects ActivityOutcome missing tool field', async () => {
      const result = await validateSchema(SCHEMAS.ActivityOutcome, {
        result: { fit: 'qualified' }
        // missing tool
      });

      expect(result.valid).toBe(false);
    });
  });

  // ─── Edge cases ─────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('returns error for non-existent schema name', async () => {
      const result = await validateSchema('NonExistentSchema', {});

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('not found');
    });

    it('validates an empty conversation list', async () => {
      const result = await validateSchema(SCHEMAS.ActivityConversationList, {
        conversations: [],
        offset: 0,
        limit: 20,
        total: 0
      });

      expect(result.valid).toBe(true);
    });

    it('validates ActivityMessage without optional usage', async () => {
      const result = await validateSchema(SCHEMAS.ActivityMessage, {
        id: 'msg_123',
        role: 'user',
        content: 'Hello!',
        createdAt: '2026-01-15T10:30:00.000Z'
      });

      expect(result.valid).toBe(true);
    });

    it('validates ActivityConversationDetail without optional outcome', async () => {
      const result = await validateSchema(SCHEMAS.ActivityConversationDetail, {
        id: 'conv_005',
        mode: 'planning',
        status: 'active',
        createdAt: '2026-01-15T10:30:00.000Z',
        lastMessageAt: '2026-01-15T10:30:00.000Z',
        messageCount: 1,
        messages: [
          {
            id: 'msg_1',
            role: 'user',
            content: 'What should the account plan prioritize?',
            createdAt: '2026-01-15T10:30:00.000Z'
          }
        ]
      });

      expect(result.valid).toBe(true);
    });
  });
});
