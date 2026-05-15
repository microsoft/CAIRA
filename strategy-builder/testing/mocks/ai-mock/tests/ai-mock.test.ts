/**
 * Unit tests for the unified AI mock server.
 *
 * Tests all API surfaces:
 * 1. Agent CRUD — /agents (create, get, update, delete, list) — Foundry Agent Service
 * 2. Responses API — /responses (create, get, delete) with SSE streaming
 * 3. /openai/responses prefix — Foundry-style Responses API path
 * 4. Auth, mock controls, determinism, multi-agent routing
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { registerRoutes, resetStore } from '../src/index.ts';
import type { Agent, AgentListResponse, Response } from '../src/types.ts';

let app: FastifyInstance;
let baseUrl: string;

const AUTH_HEADER = { authorization: 'Bearer test-token' };

beforeAll(async () => {
  app = Fastify({ logger: false });
  registerRoutes(app);
  baseUrl = await app.listen({ port: 0, host: '127.0.0.1' });
}, 30_000);

afterEach(() => {
  resetStore();
});

afterAll(async () => {
  await app.close();
});

// ---------- Helpers ----------

async function post<T>(path: string, body?: unknown): Promise<{ status: number; body: T }> {
  const init: RequestInit =
    body !== undefined
      ? {
          method: 'POST',
          headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }
      : { method: 'POST', headers: { ...AUTH_HEADER } };

  const res = await fetch(`${baseUrl}${path}`, init);
  return { status: res.status, body: (await res.json()) as T };
}

async function patch<T>(path: string, body: unknown): Promise<{ status: number; body: T }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'PATCH',
    headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return { status: res.status, body: (await res.json()) as T };
}

async function get<T>(path: string): Promise<{ status: number; body: T }> {
  const res = await fetch(`${baseUrl}${path}`, { headers: AUTH_HEADER });
  return { status: res.status, body: (await res.json()) as T };
}

async function del(path: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'DELETE',
    headers: AUTH_HEADER
  });
  return { status: res.status, body: (await res.json()) as unknown };
}

// ---------- Health ----------

describe('GET /health', () => {
  it('returns healthy status (no auth required)', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('healthy');
  });
});

// ---------- Auth ----------

describe('Authentication', () => {
  it('rejects agent creation without Bearer token', async () => {
    const res = await fetch(`${baseUrl}/agents/test-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-5.2-chat' })
    });
    expect(res.status).toBe(401);
  });

  it('rejects response creation without Bearer token', async () => {
    const res = await fetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: 'hello' })
    });
    expect(res.status).toBe(401);
  });

  it('accepts requests with Bearer token', async () => {
    const { status } = await post<Response>('/responses', { input: 'hello' });
    expect(status).toBe(200);
  });

  it('allows skipping auth with X-Mock-Skip-Auth on agent routes', async () => {
    const res = await fetch(`${baseUrl}/agents/test-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-mock-skip-auth': '1' },
      body: JSON.stringify({ model: 'gpt-5.2-chat' })
    });
    expect(res.status).toBe(200);
  });

  it('allows skipping auth with X-Mock-Skip-Auth on response routes', async () => {
    const res = await fetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-mock-skip-auth': '1' },
      body: JSON.stringify({ input: 'hello' })
    });
    expect(res.status).toBe(200);
  });
});

// ============================================================
// Agent CRUD
// ============================================================

describe('Agent CRUD', () => {
  describe('POST /agents/:name — create', () => {
    it('creates an agent with model and instructions', async () => {
      const { status, body } = await post<Agent>('/agents/coordinator', {
        model: 'gpt-5.2-chat',
        instructions: 'You are a sales coordinator'
      });
      expect(status).toBe(200);
      expect(body.object).toBe('agent');
      expect(body.id).toMatch(/^agent_/);
      expect(body.name).toBe('coordinator');
      expect(body.versions.latest.model).toBe('gpt-5.2-chat');
      expect(body.versions.latest.instructions).toBe('You are a sales coordinator');
      expect(body.versions.latest.tools).toEqual([]);
      expect(body.created_at).toBeGreaterThan(0);
    });

    it('creates an agent with tools', async () => {
      const tools = [
        {
          type: 'function',
          name: 'get_weather',
          description: 'Get weather',
          parameters: { type: 'object', properties: {} },
          strict: true
        }
      ];
      const { body } = await post<Agent>('/agents/tool-agent', {
        model: 'gpt-5.2-chat',
        tools
      });
      expect(body.versions.latest.tools).toHaveLength(1);
      expect(body.versions.latest.tools[0]?.name).toBe('get_weather');
      expect(body.versions.latest.tools[0]?.strict).toBe(true);
    });

    it('defaults model to gpt-5.2-chat when not specified', async () => {
      const { body } = await post<Agent>('/agents/default-model', {});
      expect(body.versions.latest.model).toBe('gpt-5.2-chat');
    });

    it('defaults instructions to empty string when not specified', async () => {
      const { body } = await post<Agent>('/agents/no-instructions', { model: 'gpt-5.2-chat' });
      expect(body.versions.latest.instructions).toBe('');
    });
  });

  describe('GET /agents/:name — get', () => {
    it('returns a previously created agent', async () => {
      await post<Agent>('/agents/my-agent', { model: 'gpt-5.2-chat', instructions: 'Be helpful' });
      const { status, body } = await get<Agent>('/agents/my-agent');
      expect(status).toBe(200);
      expect(body.name).toBe('my-agent');
      expect(body.versions.latest.instructions).toBe('Be helpful');
    });

    it('returns 404 for unknown agent', async () => {
      const { status } = await get('/agents/nonexistent');
      expect(status).toBe(404);
    });
  });

  describe('PATCH /agents/:name — update', () => {
    it('updates an existing agent', async () => {
      await post<Agent>('/agents/updatable', { model: 'gpt-5.2-chat', instructions: 'V1' });
      const { status, body } = await patch<Agent>('/agents/updatable', {
        model: 'gpt-5-nano',
        instructions: 'V2'
      });
      expect(status).toBe(200);
      expect(body.versions.latest.model).toBe('gpt-5-nano');
      expect(body.versions.latest.instructions).toBe('V2');
    });

    it('preserves existing instructions when not specified in update', async () => {
      await post<Agent>('/agents/partial', {
        model: 'gpt-5.2-chat',
        instructions: 'Keep me'
      });
      const { body } = await patch<Agent>('/agents/partial', { model: 'gpt-5-nano' });
      expect(body.versions.latest.model).toBe('gpt-5-nano');
      expect(body.versions.latest.instructions).toBe('Keep me');
    });

    it('returns 404 when updating a nonexistent agent', async () => {
      const { status } = await patch('/agents/ghost', { model: 'gpt-5.2-chat' });
      expect(status).toBe(404);
    });
  });

  describe('DELETE /agents/:name — delete', () => {
    it('deletes an existing agent', async () => {
      await post<Agent>('/agents/doomed', { model: 'gpt-5.2-chat' });
      const { status, body } = await del('/agents/doomed');
      expect(status).toBe(200);
      expect(body).toEqual({ name: 'doomed', object: 'agent.deleted', deleted: true });

      const { status: getStatus } = await get('/agents/doomed');
      expect(getStatus).toBe(404);
    });

    it('returns 404 when deleting a nonexistent agent', async () => {
      const { status } = await del('/agents/ghost');
      expect(status).toBe(404);
    });
  });

  describe('GET /agents — list', () => {
    it('returns empty list initially', async () => {
      const { status, body } = await get<AgentListResponse>('/agents');
      expect(status).toBe(200);
      expect(body.object).toBe('list');
      expect(body.data).toHaveLength(0);
      expect(body.has_more).toBe(false);
    });

    it('returns all created agents', async () => {
      await post('/agents/agent-a', { model: 'gpt-5.2-chat' });
      await post('/agents/agent-b', { model: 'gpt-5-nano' });

      const { body } = await get<AgentListResponse>('/agents');
      expect(body.data).toHaveLength(2);
      const names = body.data.map((a) => a.name);
      expect(names).toContain('agent-a');
      expect(names).toContain('agent-b');
    });
  });
});

// ============================================================
// Responses API — basic (tested under /responses)
// ============================================================

describe('POST /responses', () => {
  it('creates a response with string input', async () => {
    const { status, body } = await post<Response>('/responses', {
      input: 'What is TypeScript?'
    });
    expect(status).toBe(200);
    expect(body.id).toMatch(/^resp_/);
    expect(body.object).toBe('response');
    expect(body.status).toBe('completed');
    expect(body.output_text).toContain('What is TypeScript?');
    expect(body.output.length).toBeGreaterThan(0);
    expect(body.output[0]?.type).toBe('message');
    expect(body.error).toBeNull();
  });

  it('creates a response with array input (message items)', async () => {
    const { status, body } = await post<Response>('/responses', {
      input: [{ type: 'message', role: 'user', content: 'Hello from array input' }]
    });
    expect(status).toBe(200);
    expect(body.output_text).toContain('Hello from array input');
  });

  it('uses the specified model', async () => {
    const { body } = await post<Response>('/responses', {
      input: 'test',
      model: 'gpt-5.2-chat'
    });
    expect(body.model).toBe('gpt-5.2-chat');
  });

  it('defaults to gpt-5.2-chat model', async () => {
    const { body } = await post<Response>('/responses', { input: 'test' });
    expect(body.model).toBe('gpt-5.2-chat');
  });

  it('stores metadata', async () => {
    const { body } = await post<Response>('/responses', {
      input: 'test',
      metadata: { session: 'abc123' }
    });
    expect(body.metadata).toEqual({ session: 'abc123' });
  });

  it('tracks previous_response_id for conversation continuity', async () => {
    const { body: first } = await post<Response>('/responses', { input: 'first message' });
    const { body: second } = await post<Response>('/responses', {
      input: 'second message',
      previous_response_id: first.id
    });
    expect(second.previous_response_id).toBe(first.id);
  });

  it('returns 400 when input is missing', async () => {
    const { status } = await post('/responses', {});
    expect(status).toBe(400);
  });

  it('returns 400 when input is empty string', async () => {
    const { status } = await post('/responses', { input: '' });
    expect(status).toBe(400);
  });

  it('includes usage info', async () => {
    const { body } = await post<Response>('/responses', { input: 'test' });
    expect(body.usage).toBeDefined();
    expect(body.usage.input_tokens).toBeGreaterThan(0);
    expect(body.usage.output_tokens).toBeGreaterThan(0);
    expect(body.usage.total_tokens).toBe(body.usage.input_tokens + body.usage.output_tokens);
  });
});

// ---------- Tool calls ----------

describe('Tool call flow', () => {
  const tools = [
    {
      type: 'function' as const,
      name: 'get_weather',
      description: 'Get weather for a location',
      parameters: { type: 'object', properties: { location: { type: 'string' } } }
    }
  ];

  it('returns function_call when tools are provided', async () => {
    const { status, body } = await post<Response>('/responses', {
      input: 'What is the weather in Paris?',
      tools
    });
    expect(status).toBe(200);
    expect(body.output.length).toBe(1);
    expect(body.output[0]?.type).toBe('function_call');

    const fnCall = body.output[0] as { type: string; name: string; call_id: string };
    expect(fnCall.name).toBe('get_weather');
    expect(fnCall.call_id).toMatch(/^call_/);
  });

  it('returns text response after function_call_output', async () => {
    // First request: get function call
    const { body: firstResp } = await post<Response>('/responses', {
      input: 'What is the weather?',
      tools
    });
    const fnCall = firstResp.output[0] as { call_id: string };

    // Second request: submit tool output
    const { status, body } = await post<Response>('/responses', {
      input: [
        { type: 'message', role: 'user', content: 'What is the weather?' },
        { type: 'function_call_output', call_id: fnCall.call_id, output: 'Sunny, 22°C' }
      ],
      tools
    });
    expect(status).toBe(200);
    expect(body.output[0]?.type).toBe('message');
    expect(body.output_text).toContain('Sunny, 22°C');
  });
});

// ---------- GET /responses/:id ----------

describe('GET /responses/:id', () => {
  it('returns a previously created response', async () => {
    const { body: created } = await post<Response>('/responses', { input: 'test' });
    const { status, body } = await get<Response>(`/responses/${created.id}`);
    expect(status).toBe(200);
    expect(body.id).toBe(created.id);
  });

  it('returns 404 for unknown response', async () => {
    const { status } = await get('/responses/resp_unknown');
    expect(status).toBe(404);
  });
});

// ---------- DELETE /responses/:id ----------

describe('DELETE /responses/:id', () => {
  it('deletes a response', async () => {
    const { body: created } = await post<Response>('/responses', { input: 'test' });
    const { status } = await del(`/responses/${created.id}`);
    expect(status).toBe(200);

    const { status: getStatus } = await get(`/responses/${created.id}`);
    expect(getStatus).toBe(404);
  });

  it('returns 404 for unknown response', async () => {
    const { status } = await del('/responses/resp_unknown');
    expect(status).toBe(404);
  });
});

// ============================================================
// /openai/responses prefix (Foundry-style path)
// ============================================================

describe('/openai/responses prefix', () => {
  it('POST /openai/responses creates a response', async () => {
    const { status, body } = await post<Response>('/openai/responses', {
      input: 'Hello via Foundry prefix'
    });
    expect(status).toBe(200);
    expect(body.id).toMatch(/^resp_/);
    expect(body.output_text).toContain('Hello via Foundry prefix');
  });

  it('GET /openai/responses/:id retrieves a response', async () => {
    const { body: created } = await post<Response>('/openai/responses', { input: 'test' });
    const { status, body } = await get<Response>(`/openai/responses/${created.id}`);
    expect(status).toBe(200);
    expect(body.id).toBe(created.id);
  });

  it('DELETE /openai/responses/:id deletes a response', async () => {
    const { body: created } = await post<Response>('/openai/responses', { input: 'test' });
    const { status } = await del(`/openai/responses/${created.id}`);
    expect(status).toBe(200);
    const { status: getStatus } = await get(`/openai/responses/${created.id}`);
    expect(getStatus).toBe(404);
  });

  it('returns 400 when input is missing', async () => {
    const { status } = await post('/openai/responses', {});
    expect(status).toBe(400);
  });

  it('shares store with /responses (same server)', async () => {
    // Create via /responses
    const { body: created } = await post<Response>('/responses', {
      input: 'created via /responses'
    });
    // Retrieve via /openai/responses
    const { status, body } = await get<Response>(`/openai/responses/${created.id}`);
    expect(status).toBe(200);
    expect(body.id).toBe(created.id);
  });

  it('SSE streaming works via /openai/responses', async () => {
    const res = await fetch(`${baseUrl}/openai/responses`, {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: 'Stream via prefix', stream: true })
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const text = await res.text();
    expect(text).toContain('event: response.created');
    expect(text).toContain('event: response.completed');
    expect(text).toContain('Stream via prefix');
    expect(text).toContain('data: [DONE]');
  });

  it('rejects /openai/responses without auth', async () => {
    const res = await fetch(`${baseUrl}/openai/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: 'hello' })
    });
    expect(res.status).toBe(401);
  });

  it('tool calls work via /openai/responses', async () => {
    const tools = [
      {
        type: 'function' as const,
        name: 'get_weather',
        description: 'Get weather',
        parameters: { type: 'object', properties: {} }
      }
    ];
    const { body } = await post<Response>('/openai/responses', {
      input: 'What is the weather?',
      tools
    });
    expect(body.output[0]?.type).toBe('function_call');
    const fnCall = body.output[0] as { name: string };
    expect(fnCall.name).toBe('get_weather');
  });
});

// ---------- SSE Streaming ----------

describe('SSE Streaming', () => {
  it('returns SSE events when stream: true', async () => {
    const res = await fetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: 'Stream this please', stream: true })
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const text = await res.text();

    // Should contain expected SSE events
    expect(text).toContain('event: response.created');
    expect(text).toContain('event: response.in_progress');
    expect(text).toContain('event: response.output_item.added');
    expect(text).toContain('event: response.output_text.delta');
    expect(text).toContain('event: response.output_text.done');
    expect(text).toContain('event: response.content_part.added');
    expect(text).toContain('event: response.content_part.done');
    expect(text).toContain('event: response.output_item.done');
    expect(text).toContain('event: response.completed');
    // End-of-stream is just `data: [DONE]` without an event field
    expect(text).toContain('data: [DONE]');
  });

  it('SSE events contain valid JSON data with type field', async () => {
    const res = await fetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: 'Stream test', stream: true })
    });

    const text = await res.text();
    const events = text
      .split('\n\n')
      .filter((block) => block.includes('data:'))
      .map((block) => {
        const eventLine = block.split('\n').find((l) => l.startsWith('event:'));
        const dataLine = block.split('\n').find((l) => l.startsWith('data:'));
        return {
          event: eventLine?.slice('event:'.length).trim() ?? '',
          data: dataLine?.slice('data:'.length).trim() ?? ''
        };
      });

    // All non-DONE events should have valid JSON data with a type field
    for (const evt of events) {
      if (evt.data === '[DONE]') continue;
      const parsed = JSON.parse(evt.data) as { type: string; sequence_number: number };
      expect(parsed.type).toBe(evt.event);
      expect(typeof parsed.sequence_number).toBe('number');
    }
  });

  it('SSE text deltas contain content chunks', async () => {
    const res = await fetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: 'Stream chunks please', stream: true })
    });

    const text = await res.text();
    const deltaBlocks = text.split('\n\n').filter((block) => block.includes('event: response.output_text.delta'));

    expect(deltaBlocks.length).toBeGreaterThan(0);

    for (const block of deltaBlocks) {
      const dataLine = block.split('\n').find((l) => l.startsWith('data:'));
      if (!dataLine) continue;
      const data = JSON.parse(dataLine.slice('data:'.length).trim()) as {
        type: string;
        delta: string;
        output_index: number;
        content_index: number;
        sequence_number: number;
      };
      expect(data.type).toBe('response.output_text.delta');
      expect(typeof data.delta).toBe('string');
      expect(typeof data.output_index).toBe('number');
      expect(typeof data.content_index).toBe('number');
      expect(typeof data.sequence_number).toBe('number');
    }
  });

  it('SSE response.completed wraps response in response field', async () => {
    const res = await fetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: 'Check completed event', stream: true })
    });

    const text = await res.text();
    const completedBlock = text.split('\n\n').find((block) => block.includes('event: response.completed'));

    expect(completedBlock).toBeDefined();
    const dataLine = completedBlock?.split('\n').find((l) => l.startsWith('data:'));
    const data = JSON.parse(dataLine?.slice('data:'.length).trim() ?? '{}') as {
      type: string;
      sequence_number: number;
      response: { id: string; status: string; output: unknown[] };
    };
    expect(data.type).toBe('response.completed');
    expect(data.response).toBeDefined();
    expect(data.response.id).toMatch(/^resp_/);
    expect(data.response.status).toBe('completed');
    expect(data.response.output.length).toBeGreaterThan(0);
  });

  it('streams function_call events when tools are provided', async () => {
    const tools = [
      {
        type: 'function' as const,
        name: 'get_info',
        description: 'Get info',
        parameters: { type: 'object', properties: {} }
      }
    ];

    const res = await fetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: 'Use tool', stream: true, tools })
    });

    const text = await res.text();
    expect(text).toContain('event: response.function_call_arguments.delta');
    expect(text).toContain('event: response.function_call_arguments.done');
    expect(text).toContain('event: response.output_item.added');
    expect(text).toContain('event: response.output_item.done');
    expect(text).toContain('event: response.completed');
  });
});

// ---------- Mock Controls ----------

describe('Mock Controls', () => {
  it('X-Mock-Error injects an error response on agent routes', async () => {
    const res = await fetch(`${baseUrl}/agents/test`, {
      method: 'POST',
      headers: {
        ...AUTH_HEADER,
        'Content-Type': 'application/json',
        'x-mock-error': '503'
      },
      body: JSON.stringify({ model: 'gpt-5.2-chat' })
    });
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('mock_injected_error');
  });

  it('X-Mock-Error injects an error response on response routes', async () => {
    const res = await fetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: {
        ...AUTH_HEADER,
        'Content-Type': 'application/json',
        'x-mock-error': '500'
      },
      body: JSON.stringify({ input: 'test' })
    });
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('mock_injected_error');
  });

  it('X-Mock-Latency adds delay', async () => {
    const start = performance.now();
    await post('/responses', { input: 'fast' });
    const baselineDuration = performance.now() - start;

    resetStore();

    const start2 = performance.now();
    const res = await fetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: {
        ...AUTH_HEADER,
        'Content-Type': 'application/json',
        'x-mock-latency': '100'
      },
      body: JSON.stringify({ input: 'slow' })
    });
    const delayedDuration = performance.now() - start2;
    expect(res.status).toBe(200);
    expect(delayedDuration - baselineDuration).toBeGreaterThan(50);
  });
});

// ---------- Determinism ----------

describe('Determinism', () => {
  it('produces same agent IDs after reset', async () => {
    const { body: a1 } = await post<Agent>('/agents/coordinator', { model: 'gpt-5.2-chat' });

    resetStore();

    const { body: a2 } = await post<Agent>('/agents/coordinator', { model: 'gpt-5.2-chat' });
    expect(a2.id).toBe(a1.id);
  });

  it('produces same response IDs after reset', async () => {
    const { body: r1 } = await post<Response>('/responses', { input: 'hello' });

    resetStore();

    const { body: r2 } = await post<Response>('/responses', { input: 'hello' });
    expect(r2.id).toBe(r1.id);
    expect(r2.output_text).toBe(r1.output_text);
  });
});

// ---------- SDK wire format compatibility ----------

describe('SDK wire format — extractUserText', () => {
  it('echoes user text from plain string input', async () => {
    const { body } = await post<Response>('/responses', { input: 'Hello world' });
    expect(body.output_text).toContain('Hello world');
  });

  it('echoes user text from array input with type: message', async () => {
    const { body } = await post<Response>('/responses', {
      input: [{ type: 'message', role: 'user', content: 'Typed message input' }]
    });
    expect(body.output_text).toContain('Typed message input');
  });

  it('echoes user text from array input WITHOUT type field (SDK getInputItems format)', async () => {
    const { body } = await post<Response>('/responses', {
      input: [{ role: 'user', content: 'Minimal input without type' }]
    });
    expect(body.output_text).toContain('Minimal input without type');
  });

  it('echoes user text when content is an array of input_text parts', async () => {
    const { body } = await post<Response>('/responses', {
      input: [
        {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'Content parts input' }]
        }
      ]
    });
    expect(body.output_text).toContain('Content parts input');
  });

  it('echoes user text when content is array parts WITHOUT type field on item', async () => {
    const { body } = await post<Response>('/responses', {
      input: [
        {
          role: 'user',
          content: [{ type: 'input_text', text: 'Minimal with parts' }]
        }
      ]
    });
    expect(body.output_text).toContain('Minimal with parts');
  });

  it('concatenates multiple content parts into one string', async () => {
    const { body } = await post<Response>('/responses', {
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: 'Part one ' },
            { type: 'input_text', text: 'Part two' }
          ]
        }
      ]
    });
    expect(body.output_text).toContain('Part one Part two');
  });

  it('uses the LAST user item when multiple are present', async () => {
    const { body } = await post<Response>('/responses', {
      input: [
        { role: 'user', content: 'First message' },
        { role: 'user', content: 'Second message' }
      ]
    });
    expect(body.output_text).toContain('Second message');
    expect(body.output_text).not.toContain('First message');
  });

  it('returns tool-based text when no user items exist in array input', async () => {
    const { body } = await post<Response>('/responses', {
      input: [{ type: 'function_call_output', call_id: 'call_123', output: 'tool result' }]
    });
    expect(body.output_text).toContain('tool result');
  });

  it('SSE streaming works with minimal input (no type field)', async () => {
    const res = await fetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: [{ role: 'user', content: 'Stream with minimal input' }],
        stream: true
      })
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const text = await res.text();
    expect(text).toContain('event: response.completed');
    expect(text).toContain('Stream with minimal input');
  });
});

// ---------- Multi-agent: Handoff + Resolution tools ----------

describe('Multi-agent handoff flow', () => {
  const transferTools = [
    {
      type: 'function' as const,
      name: 'transfer_to_Discovery',
      description: 'Transfer to Discovery agent',
      parameters: { type: 'object', properties: {} }
    },
    {
      type: 'function' as const,
      name: 'transfer_to_Planning',
      description: 'Transfer to Planning agent',
      parameters: { type: 'object', properties: {} }
    },
    {
      type: 'function' as const,
      name: 'transfer_to_Staffing',
      description: 'Transfer to Staffing agent',
      parameters: { type: 'object', properties: {} }
    }
  ];

  it('routes to Discovery agent when user text contains "discovery"', async () => {
    const { body } = await post<Response>('/responses', {
      input: 'Sing me a discovery!',
      tools: transferTools
    });
    expect(body.output.length).toBe(1);
    expect(body.output[0]?.type).toBe('function_call');
    const fnCall = body.output[0] as { name: string };
    expect(fnCall.name).toBe('transfer_to_Discovery');
  });

  it('routes to Planning agent when user text contains "planning"', async () => {
    const { body } = await post<Response>('/responses', {
      input: "Let's go on a planning hunt!",
      tools: transferTools
    });
    const fnCall = body.output[0] as { name: string };
    expect(fnCall.name).toBe('transfer_to_Planning');
  });

  it('routes to Staffing agent when user text contains "staffing"', async () => {
    const { body } = await post<Response>('/responses', {
      input: 'I want to join the staffing',
      tools: transferTools
    });
    const fnCall = body.output[0] as { name: string };
    expect(fnCall.name).toBe('transfer_to_Staffing');
  });

  it('falls back to first transfer tool when no keyword match', async () => {
    const { body } = await post<Response>('/responses', {
      input: 'Hello there!',
      tools: transferTools
    });
    const fnCall = body.output[0] as { name: string };
    expect(fnCall.name).toBe('transfer_to_Discovery');
  });

  it('routes based on keyword "sing" to Discovery', async () => {
    const { body } = await post<Response>('/responses', {
      input: 'Can you sing for me?',
      tools: transferTools
    });
    const fnCall = body.output[0] as { name: string };
    expect(fnCall.name).toBe('transfer_to_Discovery');
  });

  it('routes based on keyword "enlist" to Staffing', async () => {
    const { body } = await post<Response>('/responses', {
      input: 'I want to join the staffing interview',
      tools: transferTools
    });
    const fnCall = body.output[0] as { name: string };
    expect(fnCall.name).toBe('transfer_to_Staffing');
  });
});

describe('Multi-agent resolution tool flow', () => {
  const resolveDiscoveryTools = [
    {
      type: 'function' as const,
      name: 'resolve_discovery',
      description: 'Resolve discovery activity',
      parameters: { type: 'object', properties: {} }
    }
  ];

  const resolvePlanningTools = [
    {
      type: 'function' as const,
      name: 'resolve_planning',
      description: 'Resolve planning activity',
      parameters: { type: 'object', properties: {} }
    }
  ];

  const resolveStaffingTools = [
    {
      type: 'function' as const,
      name: 'resolve_staffing',
      description: 'Resolve staffing interview',
      parameters: { type: 'object', properties: {} }
    }
  ];

  it('returns text on FIRST specialist turn (post-handoff), not resolution tool', async () => {
    const { body } = await post<Response>('/responses', {
      input: [
        { type: 'message', role: 'user', content: 'Start opportunity discovery.' },
        { type: 'function_call_output', call_id: 'call_handoff', output: '' }
      ],
      tools: resolveDiscoveryTools,
      instructions: 'You are the Discovery agent'
    });

    expect(body.output.length).toBe(1);
    expect(body.output[0]?.type).toBe('message');
    expect(body.output_text).toContain('example');
  });

  it('calls resolve_discovery on SECOND specialist turn', async () => {
    // First specialist turn: returns text
    const { body: firstResp } = await post<Response>('/responses', {
      input: [
        { type: 'message', role: 'user', content: 'Start opportunity discovery.' },
        { type: 'function_call_output', call_id: 'call_handoff', output: '' }
      ],
      tools: resolveDiscoveryTools
    });
    expect(firstResp.output[0]?.type).toBe('message');

    // Second specialist turn: with previous_response_id pointing to text response
    const { body } = await post<Response>('/responses', {
      input: [
        { type: 'message', role: 'user', content: 'That summary works.' },
        { type: 'function_call_output', call_id: 'call_handoff2', output: '' }
      ],
      tools: resolveDiscoveryTools,
      previous_response_id: firstResp.id
    });

    expect(body.output.length).toBe(1);
    expect(body.output[0]?.type).toBe('function_call');
    const fnCall = body.output[0] as { name: string; arguments: string };
    expect(fnCall.name).toBe('resolve_discovery');

    const args = JSON.parse(fnCall.arguments) as Record<string, unknown>;
    expect(args).toHaveProperty('fit', 'qualified');
    expect(args).toHaveProperty('signals_reviewed', 4);
    expect(args).toHaveProperty('primary_need');
  });

  it('calls resolve_planning with mock args on second turn', async () => {
    const { body: firstResp } = await post<Response>('/responses', {
      input: [
        { type: 'message', role: 'user', content: 'Explore the cave' },
        { type: 'function_call_output', call_id: 'call_handoff', output: '' }
      ],
      tools: resolvePlanningTools
    });
    expect(firstResp.output[0]?.type).toBe('message');

    const { body } = await post<Response>('/responses', {
      input: [
        { type: 'message', role: 'user', content: 'Head east!' },
        { type: 'function_call_output', call_id: 'call_handoff2', output: '' }
      ],
      tools: resolvePlanningTools,
      previous_response_id: firstResp.id
    });

    const fnCall = body.output[0] as { name: string; arguments: string };
    expect(fnCall.name).toBe('resolve_planning');

    const args = JSON.parse(fnCall.arguments) as Record<string, unknown>;
    expect(args).toHaveProperty('approved', true);
    expect(args).toHaveProperty('focus_area');
    expect(args).toHaveProperty('next_step');
  });

  it('calls resolve_staffing with mock args on second turn', async () => {
    const { body: firstResp } = await post<Response>('/responses', {
      input: [
        { type: 'message', role: 'user', content: 'I can support adoption planning.' },
        { type: 'function_call_output', call_id: 'call_handoff', output: '' }
      ],
      tools: resolveStaffingTools
    });
    expect(firstResp.output[0]?.type).toBe('message');

    const { body } = await post<Response>('/responses', {
      input: [
        { type: 'message', role: 'user', content: 'I know the stars!' },
        { type: 'function_call_output', call_id: 'call_handoff2', output: '' }
      ],
      tools: resolveStaffingTools,
      previous_response_id: firstResp.id
    });

    const fnCall = body.output[0] as { name: string; arguments: string };
    expect(fnCall.name).toBe('resolve_staffing');

    const args = JSON.parse(fnCall.arguments) as Record<string, unknown>;
    expect(args).toHaveProperty('coverage_level', 'core');
    expect(args).toHaveProperty('role', 'customer_success_partner');
    expect(args).toHaveProperty('team_name', 'Northwind Account Team');
  });

  it('returns text response after resolution tool output is submitted (final turn)', async () => {
    const { body } = await post<Response>('/responses', {
      input: [
        { type: 'message', role: 'user', content: 'That was fun!' },
        {
          type: 'function_call_output',
          call_id: 'call_resolve',
          output: 'Discovery flow resolved: qualified after 4 signals.'
        }
      ]
    });

    expect(body.output[0]?.type).toBe('message');
    expect(body.output_text).toContain('Discovery flow resolved');
  });
});

describe('Multi-agent full 4-turn flow', () => {
  it('completes a full handoff → text → resolution → text flow', async () => {
    const transferTools = [
      {
        type: 'function' as const,
        name: 'transfer_to_Discovery',
        description: 'Transfer to Discovery',
        parameters: { type: 'object', properties: {} }
      }
    ];
    const resolutionTools = [
      {
        type: 'function' as const,
        name: 'resolve_discovery',
        description: 'Resolve discovery',
        parameters: { type: 'object', properties: {} }
      }
    ];

    // Turn 1: triage → handoff
    const { body: turn1 } = await post<Response>('/responses', {
      input: 'Sing me a discovery!',
      tools: transferTools
    });
    expect(turn1.output[0]?.type).toBe('function_call');
    const handoffCall = turn1.output[0] as { name: string; call_id: string };
    expect(handoffCall.name).toBe('transfer_to_Discovery');

    // Turn 2: specialist → conversational text (NOT resolution)
    const { body: turn2 } = await post<Response>('/responses', {
      input: [
        { type: 'message', role: 'user', content: 'Sing me a discovery!' },
        { type: 'function_call_output', call_id: handoffCall.call_id, output: '' }
      ],
      tools: resolutionTools,
      instructions: 'You are the Discovery agent',
      previous_response_id: turn1.id
    });
    expect(turn2.output[0]?.type).toBe('message');
    expect(turn2.output_text.length).toBeGreaterThan(10);

    // Turn 3: specialist → resolution tool call (subsequent interaction)
    const { body: turn3 } = await post<Response>('/responses', {
      input: [
        { type: 'message', role: 'user', content: 'Great example!' },
        { type: 'function_call_output', call_id: 'call_retriage', output: '' }
      ],
      tools: resolutionTools,
      instructions: 'You are the Discovery agent',
      previous_response_id: turn2.id
    });
    expect(turn3.output[0]?.type).toBe('function_call');
    const resolveCall = turn3.output[0] as { name: string; call_id: string; arguments: string };
    expect(resolveCall.name).toBe('resolve_discovery');

    // Turn 4: resolution result → text response
    const resolveOutput = 'Discovery flow resolved: qualified after 4 signals.';
    const { body: turn4 } = await post<Response>('/responses', {
      input: [{ type: 'function_call_output', call_id: resolveCall.call_id, output: resolveOutput }],
      previous_response_id: turn3.id
    });
    expect(turn4.output[0]?.type).toBe('message');
    expect(turn4.output_text).toContain('Discovery flow resolved');
  });
});

describe('Multi-agent SSE streaming with handoff', () => {
  it('streams function_call events for transfer tools', async () => {
    const transferTools = [
      {
        type: 'function' as const,
        name: 'transfer_to_Planning',
        description: 'Transfer to Planning',
        parameters: { type: 'object', properties: {} }
      }
    ];

    const res = await fetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: "Let's find some planning!",
        tools: transferTools,
        stream: true
      })
    });

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('event: response.function_call_arguments.delta');
    expect(text).toContain('event: response.function_call_arguments.done');
    expect(text).toContain('event: response.completed');
    expect(text).toContain('transfer_to_Planning');
  });

  it('streams text on first specialist turn, resolution on second', async () => {
    const resolutionTools = [
      {
        type: 'function' as const,
        name: 'resolve_staffing',
        description: 'Resolve staffing',
        parameters: { type: 'object', properties: {} }
      }
    ];

    // First specialist turn (streaming): should get text, not resolution
    const res1 = await fetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: [
          { type: 'message', role: 'user', content: 'I can support adoption planning.' },
          { type: 'function_call_output', call_id: 'call_handoff', output: '' }
        ],
        tools: resolutionTools,
        stream: true
      })
    });

    expect(res1.status).toBe(200);
    const text1 = await res1.text();
    expect(text1).toContain('event: response.output_text.delta');
    expect(text1).not.toContain('event: response.function_call_arguments.delta');
    expect(text1).toContain('event: response.completed');

    // Extract response ID from completed event for previous_response_id
    const completedBlock = text1.split('\n\n').find((block) => block.includes('event: response.completed'));
    const dataLine = completedBlock?.split('\n').find((l) => l.startsWith('data:'));
    const completedData = JSON.parse(dataLine?.slice('data:'.length).trim() ?? '{}') as {
      response: { id: string };
    };
    const firstRespId = completedData.response.id;

    // Second specialist turn (streaming): should get resolution tool call
    const res2 = await fetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: [
          { type: 'message', role: 'user', content: 'I know the stars!' },
          { type: 'function_call_output', call_id: 'call_handoff2', output: '' }
        ],
        tools: resolutionTools,
        previous_response_id: firstRespId,
        stream: true
      })
    });

    expect(res2.status).toBe(200);
    const text2 = await res2.text();
    expect(text2).toContain('event: response.function_call_arguments.delta');
    expect(text2).toContain('resolve_staffing');
    expect(text2).toContain('core');
    expect(text2).toContain('customer_success_partner');
  });
});

// ---------- Agent CRUD + Responses API interaction ----------

describe('Agent CRUD and Responses API are independent', () => {
  it('creating agents does not affect responses', async () => {
    await post('/agents/test-agent', { model: 'gpt-5.2-chat' });
    const { status, body } = await post<Response>('/responses', { input: 'Hello' });
    expect(status).toBe(200);
    expect(body.output_text).toContain('Hello');
  });

  it('creating responses does not affect agents', async () => {
    await post<Response>('/responses', { input: 'Hello' });
    const { status, body } = await get<AgentListResponse>('/agents');
    expect(status).toBe(200);
    expect(body.data).toHaveLength(0);
  });

  it('reset clears both agents and responses', async () => {
    await post('/agents/test-agent', { model: 'gpt-5.2-chat' });
    const { body: resp } = await post<Response>('/responses', { input: 'Hello' });

    resetStore();

    const { body: agents } = await get<AgentListResponse>('/agents');
    expect(agents.data).toHaveLength(0);

    const { status } = await get(`/responses/${resp.id}`);
    expect(status).toBe(404);
  });
});

// ---------- Response format validation ----------

describe('Response format validation', () => {
  it('response object has correct shape', async () => {
    const { body } = await post<Record<string, unknown>>('/responses', {
      input: 'What is TypeScript?',
      model: 'gpt-5.2-chat'
    });

    expect(body['id']).toMatch(/^resp_/);
    expect(body['object']).toBe('response');
    expect(body['status']).toBe('completed');
    expect(body['model']).toBe('gpt-5.2-chat');
    expect(Array.isArray(body['output'])).toBe(true);
    expect(typeof body['output_text']).toBe('string');
    expect(body['error']).toBeNull();
    expect(typeof body['created_at']).toBe('number');
    expect(typeof body['metadata']).toBe('object');

    const usage = body['usage'] as Record<string, unknown>;
    expect(typeof usage['input_tokens']).toBe('number');
    expect(typeof usage['output_tokens']).toBe('number');
    expect(typeof usage['total_tokens']).toBe('number');
  });

  it('text output item has correct shape', async () => {
    const { body } = await post<{ output: Array<Record<string, unknown>> }>('/responses', {
      input: 'Hello'
    });

    const item = body.output[0];
    expect(item?.['type']).toBe('message');
    expect(item?.['id']).toMatch(/^msg_/);
    expect(item?.['role']).toBe('assistant');
    expect(Array.isArray(item?.['content'])).toBe(true);

    const content = (item?.['content'] as Array<{ type: string; text: string }> | undefined)?.[0];
    expect(content?.type).toBe('output_text');
    expect(typeof content?.text).toBe('string');
  });

  it('function_call output item has correct shape', async () => {
    const { body } = await post<{ output: Array<Record<string, unknown>> }>('/responses', {
      input: 'Call a tool',
      tools: [
        {
          type: 'function',
          name: 'lookup',
          description: 'Look something up',
          parameters: { type: 'object' }
        }
      ]
    });

    const item = body.output[0];
    expect(item?.['type']).toBe('function_call');
    expect(item?.['id']).toMatch(/^fc_/);
    expect(item?.['call_id']).toMatch(/^call_/);
    expect(item?.['name']).toBe('lookup');
    expect(typeof item?.['arguments']).toBe('string');
    expect(() => JSON.parse((item?.['arguments'] as string) ?? '{}')).not.toThrow();
  });

  it('agent object has correct shape', async () => {
    const { body } = await post<Record<string, unknown>>('/agents/test-coordinator', {
      model: 'gpt-5.2-chat',
      instructions: 'You are a sales coordinator'
    });

    expect(body['id']).toMatch(/^agent_/);
    expect(body['object']).toBe('agent');
    expect(body['name']).toBe('test-coordinator');
    expect(typeof body['created_at']).toBe('number');

    const versions = body['versions'] as { latest: Record<string, unknown> };
    expect(versions.latest['model']).toBe('gpt-5.2-chat');
    expect(versions.latest['instructions']).toBe('You are a sales coordinator');
    expect(Array.isArray(versions.latest['tools'])).toBe(true);
  });

  it('both /responses and /openai/responses produce identical shapes', async () => {
    const { body: r1 } = await post<Record<string, unknown>>('/responses', {
      input: 'Shape test',
      model: 'gpt-5.2-chat'
    });

    resetStore();

    const { body: r2 } = await post<Record<string, unknown>>('/openai/responses', {
      input: 'Shape test',
      model: 'gpt-5.2-chat'
    });

    // Both should have identical top-level keys
    const keys1 = Object.keys(r1).sort();
    const keys2 = Object.keys(r2).sort();
    expect(keys1).toEqual(keys2);

    // Both should have same static fields
    expect(r1['object']).toBe(r2['object']);
    expect(r1['status']).toBe(r2['status']);
    expect(r1['model']).toBe(r2['model']);
  });

  it('SSE events use standard format (event: + data: + blank line)', async () => {
    const res = await fetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: 'Format test', stream: true })
    });
    const text = await res.text();
    const blocks = text.split('\n\n').filter((b) => b.trim().length > 0);

    for (const block of blocks) {
      const lines = block.split('\n');
      const hasData = lines.some((l) => l.startsWith('data:'));
      expect(hasData).toBe(true);
      // All blocks except the final [DONE] sentinel should have an event: line
      const isDone = lines.some((l) => l.trim() === 'data: [DONE]');
      if (!isDone) {
        const hasEvent = lines.some((l) => l.startsWith('event:'));
        expect(hasEvent).toBe(true);
      }
    }
  });
});

// ============================================================
// Conversations API tests
// ============================================================

describe('Conversations API', () => {
  describe('CRUD', () => {
    it('creates a conversation', async () => {
      const { status, body } = await post<{ id: string; object: string; created_at: number }>('/conversations');
      expect(status).toBe(200);
      expect(body.object).toBe('conversation');
      expect(body.id).toMatch(/^conv_/);
      expect(body.created_at).toBeGreaterThan(0);
    });

    it('creates a conversation with metadata', async () => {
      const { status, body } = await post<{
        id: string;
        object: string;
        metadata: Record<string, string> | null;
      }>('/conversations', { metadata: { topic: 'sales' } });
      expect(status).toBe(200);
      expect(body.metadata).toEqual({ topic: 'sales' });
    });

    it('retrieves a conversation by ID', async () => {
      const created = await post<{ id: string }>('/conversations');
      const { status, body } = await get<{ id: string; object: string }>(`/conversations/${created.body.id}`);
      expect(status).toBe(200);
      expect(body.id).toBe(created.body.id);
      expect(body.object).toBe('conversation');
    });

    it('returns 404 for nonexistent conversation', async () => {
      const { status } = await get<unknown>('/conversations/conv_nonexistent');
      expect(status).toBe(404);
    });

    it('deletes a conversation', async () => {
      const created = await post<{ id: string }>('/conversations');
      const { status, body } = await del(`/conversations/${created.body.id}`);
      expect(status).toBe(200);
      expect(body).toEqual({
        id: created.body.id,
        object: 'conversation.deleted',
        deleted: true
      });

      // Verify it's gone
      const { status: getStatus } = await get<unknown>(`/conversations/${created.body.id}`);
      expect(getStatus).toBe(404);
    });

    it('returns 404 when deleting nonexistent conversation', async () => {
      const { status } = await del('/conversations/conv_nonexistent');
      expect(status).toBe(404);
    });
  });

  describe('/openai/conversations prefix', () => {
    it('creates a conversation via /openai/conversations', async () => {
      const { status, body } = await post<{ id: string; object: string }>('/openai/conversations');
      expect(status).toBe(200);
      expect(body.object).toBe('conversation');
      expect(body.id).toMatch(/^conv_/);
    });

    it('retrieves via /openai/conversations', async () => {
      const created = await post<{ id: string }>('/openai/conversations');
      const { status, body } = await get<{ id: string }>(`/openai/conversations/${created.body.id}`);
      expect(status).toBe(200);
      expect(body.id).toBe(created.body.id);
    });

    it('deletes via /openai/conversations', async () => {
      const created = await post<{ id: string }>('/openai/conversations');
      const { status } = await del(`/openai/conversations/${created.body.id}`);
      expect(status).toBe(200);
    });
  });

  describe('conversation-aware responses', () => {
    it('creates a response with conversation parameter (simple text)', async () => {
      // Create a conversation
      const conv = await post<{ id: string }>('/conversations');

      // Send a message using the conversation
      const { status, body } = await post<{ id: string; output_text: string; output: unknown[] }>('/responses', {
        input: 'Hello team!',
        conversation: { id: conv.body.id }
      });
      expect(status).toBe(200);
      expect(body.output_text).toContain('Hello team!');
    });

    it('accumulates conversation items across multiple responses', async () => {
      // Create a conversation
      const conv = await post<{ id: string }>('/conversations');

      // First message
      const r1 = await post<{ id: string; output_text: string }>('/responses', {
        input: 'Hello',
        conversation: { id: conv.body.id }
      });
      expect(r1.status).toBe(200);

      // Second message — the conversation context includes the first message
      const r2 = await post<{ id: string; output_text: string }>('/responses', {
        input: 'How are you?',
        conversation: { id: conv.body.id }
      });
      expect(r2.status).toBe(200);
      // The response should reference the second user message
      expect(r2.body.output_text).toContain('How are you?');
    });

    it('supports multi-agent routing with conversation parameter', async () => {
      // Create a conversation
      const conv = await post<{ id: string }>('/conversations');

      // Send a message that triggers specialist routing
      const r1 = await post<{ id: string; output: Array<{ type: string; name?: string }> }>('/responses', {
        input: 'I want to sing a discovery!',
        tools: [
          {
            type: 'function',
            name: 'discovery_specialist',
            description: 'Discovery specialist',
            parameters: {}
          },
          {
            type: 'function',
            name: 'planning_specialist',
            description: 'Planning specialist',
            parameters: {}
          }
        ],
        conversation: { id: conv.body.id }
      });
      expect(r1.status).toBe(200);
      expect(r1.body.output).toHaveLength(1);
      expect(r1.body.output[0]?.type).toBe('function_call');
      expect(r1.body.output[0]?.name).toBe('discovery_specialist');
    });

    it('supports tool-call loop with conversation (specialist text then resolution)', async () => {
      // Create a conversation
      const conv = await post<{ id: string }>('/conversations');

      // Turn 1: route to specialist
      const r1 = await post<{
        id: string;
        output: Array<{ type: string; name?: string; call_id?: string }>;
      }>('/responses', {
        input: 'I want to sing a discovery!',
        tools: [
          {
            type: 'function',
            name: 'discovery_specialist',
            description: 'Discovery',
            parameters: {}
          }
        ],
        conversation: { id: conv.body.id }
      });
      expect(r1.body.output[0]?.type).toBe('function_call');
      const callId1 = r1.body.output[0]?.call_id;

      // Turn 2: submit tool output (specialist handoff result), specialist has resolution tools
      const r2 = await post<{ id: string; output: Array<{ type: string }>; output_text: string }>('/responses', {
        input: [{ type: 'function_call_output', call_id: callId1, output: 'Specialist ready' }],
        tools: [
          {
            type: 'function',
            name: 'resolve_discovery',
            description: 'Resolve discovery',
            parameters: {}
          }
        ],
        conversation: { id: conv.body.id }
      });
      // First specialist turn should return text (not call resolution tool)
      expect(r2.body.output[0]?.type).toBe('message');
      expect(r2.body.output_text).toContain('example');

      // Turn 3: another message — should now call the resolution tool
      const r3 = await post<{ id: string; output: Array<{ type: string; name?: string }> }>('/responses', {
        input: [{ type: 'message', role: 'user', content: 'Through storms and gales we sail!' }],
        tools: [
          {
            type: 'function',
            name: 'resolve_discovery',
            description: 'Resolve discovery',
            parameters: {}
          }
        ],
        conversation: { id: conv.body.id }
      });
      expect(r3.body.output[0]?.type).toBe('function_call');
      expect(r3.body.output[0]?.name).toBe('resolve_discovery');
    });

    it('supports streaming with conversation parameter', async () => {
      // Create a conversation
      const conv = await post<{ id: string }>('/conversations');

      // Stream a response using the conversation
      const res = await fetch(`${baseUrl}/responses`, {
        method: 'POST',
        headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: 'Tell me a story',
          stream: true,
          conversation: { id: conv.body.id }
        })
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('text/event-stream');

      const text = await res.text();
      expect(text).toContain('event: response.created');
      expect(text).toContain('event: response.completed');
      expect(text).toContain('event: response.output_text.delta');
      expect(text).toContain('[DONE]');
    });

    it('works with string conversation parameter (just the ID)', async () => {
      const conv = await post<{ id: string }>('/conversations');
      const { status, body } = await post<{ id: string; output_text: string }>('/responses', {
        input: 'Hello',
        conversation: conv.body.id
      });
      expect(status).toBe(200);
      expect(body.output_text).toContain('Hello');
    });

    it('works with /openai/responses and conversation', async () => {
      const conv = await post<{ id: string }>('/openai/conversations');
      const { status, body } = await post<{ id: string; output_text: string }>('/openai/responses', {
        input: 'Hello',
        conversation: { id: conv.body.id }
      });
      expect(status).toBe(200);
      expect(body.output_text).toContain('Hello');
    });
  });
});

// ---------- API surface completeness ----------

describe('API surface completeness', () => {
  it('HAS /responses endpoint', async () => {
    const res = await fetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: 'test' })
    });
    expect(res.status).toBe(200);
  });

  it('HAS /openai/responses endpoint', async () => {
    const res = await fetch(`${baseUrl}/openai/responses`, {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: 'test' })
    });
    expect(res.status).toBe(200);
  });

  it('HAS /agents endpoint (Agent CRUD)', async () => {
    const res = await fetch(`${baseUrl}/agents/surface-test`, {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-5.2-chat' })
    });
    expect(res.status).toBe(200);
  });

  it('does NOT have /assistants endpoint', async () => {
    const res = await fetch(`${baseUrl}/assistants`, {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'test' })
    });
    expect(res.status).toBe(404);
  });

  it('does NOT have /threads endpoint', async () => {
    const res = await fetch(`${baseUrl}/threads`, {
      method: 'POST',
      headers: { ...AUTH_HEADER }
    });
    expect(res.status).toBe(404);
  });

  it('HAS /conversations endpoint (Conversations API)', async () => {
    const res = await fetch(`${baseUrl}/conversations`, {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    expect(res.status).toBe(200);
  });

  it('HAS /openai/conversations endpoint (Foundry-style Conversations API)', async () => {
    const res = await fetch(`${baseUrl}/openai/conversations`, {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    expect(res.status).toBe(200);
  });
});
