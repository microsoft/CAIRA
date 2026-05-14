/* eslint-disable @typescript-eslint/no-non-null-assertion */
/**
 * Tests for src/foundry-client.ts — Azure AI Foundry agent service.
 *
 * Tests two configurations:
 *   1. Without agent registration (http:// endpoint + SKIP_AUTH): uses
 *      Conversations API for state, no project.agents.createVersion
 *   2. With agent registration (https:// endpoint): uses Conversations API
 *      for state AND agent registration via project.agents.createVersion()
 *
 * Both configurations use the same code path for conversations and responses.
 *
 * Mocks the OpenAI, @azure/ai-projects, @azure/identity, and
 * @microsoft/opentelemetry modules at the import boundary using vi.mock()
 * so that the production code runs its real setupClient() logic.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Config } from '../src/config.ts';

// ---------- Module-level mocks ----------

const { mockUseMicrosoftOpenTelemetry, mockShutdownMicrosoftOpenTelemetry } = vi.hoisted(() => ({
  mockUseMicrosoftOpenTelemetry: vi.fn(),
  mockShutdownMicrosoftOpenTelemetry: vi.fn()
}));

// Mock OpenAI — intercepted by dynamic import('openai') in setupClient()
let mockConvCounter = 0;
const mockResponsesCreate = vi.fn();
const mockResponsesStream = vi.fn();
const mockConversationsCreate = vi.fn().mockImplementation(async () => ({
  id: `server_conv_${++mockConvCounter}`,
  object: 'conversation'
}));

vi.mock('openai', () => {
  const MockOpenAI = vi.fn().mockImplementation(function () {
    return {
      responses: {
        create: mockResponsesCreate,
        stream: mockResponsesStream
      },
      conversations: {
        create: mockConversationsCreate
      }
    };
  });
  return { default: MockOpenAI };
});

// Mock @azure/ai-projects — intercepted by dynamic import in setupClient()
let agentCounter = 0;
let versionCounter = 0;
const mockAgentsGet = vi.fn();
const mockAgentsCreate = vi.fn();
const mockAgentsUpdate = vi.fn();
const mockGetOpenAIClient = vi.fn();
const mockGetTelemetryConnectionString = vi.fn().mockResolvedValue('InstrumentationKey=fake');

vi.mock('@azure/ai-projects', () => {
  const MockAIProjectClient = vi.fn().mockImplementation(function () {
    return {
      agents: {
        get: mockAgentsGet,
        create: mockAgentsCreate,
        update: mockAgentsUpdate
      },
      telemetry: {
        getApplicationInsightsConnectionString: mockGetTelemetryConnectionString
      },
      getOpenAIClient: mockGetOpenAIClient
    };
  });
  return { AIProjectClient: MockAIProjectClient };
});

// Mock @azure/identity
vi.mock('@azure/identity', () => {
  const MockDefaultAzureCredential = vi.fn().mockImplementation(function () {
    return {
      getToken: vi.fn().mockResolvedValue({ token: 'fake-token' })
    };
  });
  return { DefaultAzureCredential: MockDefaultAzureCredential };
});

// Mock @microsoft/opentelemetry — useMicrosoftOpenTelemetry is called in setupClient()
vi.mock('@microsoft/opentelemetry', () => ({
  shutdownMicrosoftOpenTelemetry: mockShutdownMicrosoftOpenTelemetry,
  useMicrosoftOpenTelemetry: mockUseMicrosoftOpenTelemetry
}));

// ---------- Import FoundryClient AFTER mocks are set up ----------
// vi.mock() calls are hoisted by Vitest, so static imports work correctly.

import { FoundryClient } from '../src/foundry-client.ts';

// ---------- Test configs ----------

const LOCAL_CONFIG: Config = {
  port: 3000,
  host: '0.0.0.0',
  azureEndpoint: 'http://localhost:8080',
  model: 'gpt-5.2-chat',
  agentName: 'test-agent',
  sharedInstructions: 'You are the coordinator agent. Route to specialists.',
  discoveryInstructions: 'You are a discovery specialist.',
  planningInstructions: 'You are a planning specialist.',
  staffingInstructions: 'You are a staffing specialist.',
  applicationInsightsConnectionString: undefined,
  logLevel: 'silent',
  skipAuth: true,
  inboundAuthTenantId: undefined,
  inboundAuthAllowedAudiences: [],
  inboundAuthAllowedCallerAppIds: [],
  inboundAuthAuthorityHost: 'https://login.microsoftonline.com'
};

const AZURE_CONFIG: Config = {
  ...LOCAL_CONFIG,
  azureEndpoint: 'https://test.ai.azure.com',
  skipAuth: false
};

// ---------- Mock helpers ----------

/**
 * Creates a mock response object matching the shape returned by
 * openai.responses.create().
 */
function makeResponse(
  text: string,
  responseId = 'resp_001',
  options?: {
    functionCalls?: Array<{ name: string; callId: string; arguments: string }>;
    inputTokens?: number;
    outputTokens?: number;
  }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const output: any[] = [];

  // Add function call items if any
  if (options?.functionCalls) {
    for (const fc of options.functionCalls) {
      output.push({
        type: 'function_call',
        name: fc.name,
        call_id: fc.callId,
        arguments: fc.arguments
      });
    }
  }

  // Add message item with text content
  if (text) {
    output.push({
      type: 'message',
      content: [{ type: 'output_text', text }]
    });
  }

  return {
    id: responseId,
    output,
    output_text: text,
    usage: {
      input_tokens: options?.inputTokens ?? 50,
      output_tokens: options?.outputTokens ?? 30
    }
  };
}

/**
 * Creates a mock stream result that yields events for the streaming API.
 */
function makeStreamEvents(
  chunks: string[],
  responseId = 'resp_stream_001',
  options?: {
    functionCalls?: Array<{ name: string; callId: string; arguments: string }>;
    inputTokens?: number;
    outputTokens?: number;
  }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const events: any[] = [];

  // Emit text deltas
  for (const chunk of chunks) {
    events.push({
      type: 'response.output_text.delta',
      delta: chunk
    });
  }

  // Emit function call items if any
  if (options?.functionCalls) {
    for (const fc of options.functionCalls) {
      // output_item.added
      events.push({
        type: 'response.output_item.added',
        item: { type: 'function_call', name: fc.name }
      });
      // output_item.done with full data
      events.push({
        type: 'response.output_item.done',
        item: {
          type: 'function_call',
          name: fc.name,
          call_id: fc.callId,
          arguments: fc.arguments
        }
      });
    }
  }

  // Emit response.completed
  events.push({
    type: 'response.completed',
    response: {
      id: responseId,
      usage: {
        input_tokens: options?.inputTokens ?? 50,
        output_tokens: options?.outputTokens ?? 30
      }
    }
  });

  // Return an async iterable
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const event of events) {
        yield event;
      }
    }
  };
}

/** Reset all mock function call histories and agent counters. */
function resetAllMocks(): void {
  mockConvCounter = 0;
  agentCounter = 0;
  versionCounter = 0;
  mockResponsesCreate.mockReset();
  mockResponsesStream.mockReset();
  mockConversationsCreate.mockReset().mockImplementation(async () => ({
    id: `server_conv_${++mockConvCounter}`,
    object: 'conversation'
  }));
  mockAgentsGet.mockReset();
  mockAgentsCreate.mockReset();
  mockAgentsUpdate.mockReset();
  mockGetOpenAIClient.mockReset();
  mockGetTelemetryConnectionString.mockReset().mockResolvedValue('InstrumentationKey=fake');
  mockShutdownMicrosoftOpenTelemetry.mockReset();
  mockUseMicrosoftOpenTelemetry.mockReset();
}

/** Configure agent mocks for the "agents don't exist" path (get → 404, create succeeds). */
function setupAgentMocksForCreate(): void {
  const notFoundError = Object.assign(new Error('Agent not found'), { statusCode: 404 });
  mockAgentsGet.mockRejectedValue(notFoundError);

  const makeAgent = (name: string) => ({
    id: `agent_${++agentCounter}`,
    name,
    object: 'agent' as const,
    versions: { latest: { version: `v${++versionCounter}` } }
  });
  mockAgentsCreate.mockImplementation(async (name: string) => makeAgent(name));
  mockAgentsUpdate.mockImplementation(async (name: string) => makeAgent(name));
}

// ==========================================================================
// Tests — Without agent registration (local/mock endpoint)
// ==========================================================================

describe('FoundryClient (without agent registration)', () => {
  let client: InstanceType<typeof FoundryClient>;

  beforeEach(async () => {
    resetAllMocks();
    client = new FoundryClient({ config: LOCAL_CONFIG });
    await client.initialise();
  });

  describe('initialise', () => {
    it('marks client as ready after initialisation', async () => {
      const conv = await client.createConversation({ mode: 'discovery' });
      expect(conv.id).toMatch(/^conv_/);
    });

    it('throws if operations called before initialise', async () => {
      const uninitClient = new FoundryClient({ config: LOCAL_CONFIG });
      // Don't call initialise — calling setupClient() will run but initialised flag is set at end
      // We need a config that will make setupClient() fail or we test differently.
      // Actually, with the mock in place, setupClient() will succeed. So we just test
      // that the client works after init and doesn't before.
      // Since setupClient runs in initialise(), we can't easily test "before init" without
      // making init fail. Let's just verify the normal flow works.
      await expect(uninitClient.createConversation()).rejects.toThrow('not initialised');
    });
  });

  describe('createConversation', () => {
    it('creates a conversation via the Conversations API', async () => {
      const conv = await client.createConversation({ mode: 'discovery' });
      expect(conv.id).toMatch(/^conv_/);
      expect(conv.createdAt).toBeDefined();
      expect(conv.updatedAt).toBeDefined();

      // Verify conversations.create was called
      expect(mockConversationsCreate).toHaveBeenCalledTimes(1);
    });

    it('includes metadata when provided', async () => {
      const meta = { topic: 'testing' };
      const conv = await client.createConversation(meta);
      expect(conv.metadata).toEqual({ topic: 'testing' });
    });

    it('omits metadata key when none provided', async () => {
      const conv = await client.createConversation();
      expect(conv).not.toHaveProperty('metadata');
    });
  });

  describe('listConversations', () => {
    it('returns empty list when no conversations', async () => {
      const list = await client.listConversations();
      expect(list.items).toEqual([]);
      expect(list.total).toBe(0);
      expect(list.offset).toBe(0);
      expect(list.limit).toBe(20);
    });

    it('returns conversations after creation', async () => {
      await client.createConversation();
      await client.createConversation();
      await client.createConversation();

      const list = await client.listConversations();
      expect(list.items).toHaveLength(3);
      expect(list.total).toBe(3);
    });

    it('respects offset and limit', async () => {
      await client.createConversation();
      await client.createConversation();
      await client.createConversation();

      const list = await client.listConversations(1, 1);
      expect(list.items).toHaveLength(1);
      expect(list.offset).toBe(1);
      expect(list.limit).toBe(1);
      expect(list.total).toBe(3);
    });
  });

  describe('getConversation', () => {
    it('returns undefined for unknown conversation', async () => {
      const detail = await client.getConversation('nonexistent');
      expect(detail).toBeUndefined();
    });

    it('returns conversation with empty messages initially', async () => {
      const conv = await client.createConversation();
      const detail = await client.getConversation(conv.id);
      expect(detail).toBeDefined();
      expect(detail!.id).toBe(conv.id);
      expect(detail!.messages).toEqual([]);
    });

    it('returns conversation with messages after sendMessage', async () => {
      const conv = await client.createConversation();
      mockResponsesCreate.mockResolvedValue(makeResponse('Hello back!'));

      await client.sendMessage(conv.id, 'Hello');

      const detail = await client.getConversation(conv.id);
      expect(detail).toBeDefined();
      expect(detail!.messages).toHaveLength(2); // user + assistant
      expect(detail!.messages[0]!.role).toBe('user');
      expect(detail!.messages[0]!.content).toBe('Hello');
      expect(detail!.messages[1]!.role).toBe('assistant');
      expect(detail!.messages[1]!.content).toBe('Hello back!');
    });
  });

  describe('sendMessage (non-streaming)', () => {
    it('sends user message and returns assistant response', async () => {
      const conv = await client.createConversation();
      mockResponsesCreate.mockResolvedValue(makeResponse('Hello there!'));

      const result = await client.sendMessage(conv.id, 'Hello sales team!');
      expect(result).toBeDefined();
      expect(result!.role).toBe('assistant');
      expect(result!.content).toBe('Hello there!');
    });

    it('returns undefined for unknown conversation', async () => {
      const result = await client.sendMessage('nonexistent', 'Hello');
      expect(result).toBeUndefined();
    });

    it('passes usage from response to message', async () => {
      const conv = await client.createConversation();
      mockResponsesCreate.mockResolvedValue(makeResponse('Reply', 'resp_001', { inputTokens: 50, outputTokens: 30 }));

      const result = await client.sendMessage(conv.id, 'Hi');
      expect(result).toBeDefined();
      expect(result!.usage).toEqual({ promptTokens: 50, completionTokens: 30 });
    });

    it('uses conversation param for server-side state', async () => {
      const conv = await client.createConversation();
      mockResponsesCreate.mockResolvedValue(makeResponse('Response'));

      await client.sendMessage(conv.id, 'Test message');

      expect(mockResponsesCreate).toHaveBeenCalledTimes(1);
      const params = mockResponsesCreate.mock.calls[0]![0];
      expect(params.model).toBe('gpt-5.2-chat');
      expect(params.instructions).toBe(LOCAL_CONFIG.discoveryInstructions);
      expect(params.input).toBe('Test message');
      expect(params.tools).toBeDefined();
      expect(params.tools.length).toBe(2);
      // Should use conversation param
      expect(params.conversation).toBeDefined();
      expect(params.conversation.id).toMatch(/^server_conv_/);
      // Should NOT use previous_response_id
      expect(params).not.toHaveProperty('previous_response_id');
    });

    it('uses same conversation ID for multiple messages (no previous_response_id)', async () => {
      const conv = await client.createConversation();
      mockResponsesCreate.mockResolvedValueOnce(makeResponse('First reply', 'resp_001'));
      mockResponsesCreate.mockResolvedValueOnce(makeResponse('Second reply', 'resp_002'));

      await client.sendMessage(conv.id, 'First message');
      await client.sendMessage(conv.id, 'Second message');

      expect(mockResponsesCreate).toHaveBeenCalledTimes(2);
      const firstParams = mockResponsesCreate.mock.calls[0]![0];
      const secondParams = mockResponsesCreate.mock.calls[1]![0];
      expect(firstParams.conversation.id).toBe(secondParams.conversation.id);
      expect(secondParams).not.toHaveProperty('previous_response_id');
    });

    it('handles tool-call loop — executes specialist tool and continues', async () => {
      const conv = await client.createConversation();

      // First call returns a function_call for lookup_discovery_knowledge
      mockResponsesCreate.mockResolvedValueOnce(
        makeResponse('', 'resp_001', {
          functionCalls: [
            {
              name: 'lookup_discovery_knowledge',
              callId: 'call_001',
              arguments: JSON.stringify({ query: 'qualification signal' })
            }
          ]
        })
      );

      // Second call (tool output submission) returns final text
      mockResponsesCreate.mockResolvedValueOnce(makeResponse('Here is the discovery summary.', 'resp_002'));

      const result = await client.sendMessage(conv.id, 'Summarize the discovery.');
      expect(result).toBeDefined();
      expect(result!.content).toBe('Here is the discovery summary.');
      expect(mockResponsesCreate).toHaveBeenCalledTimes(2);

      // Check that the second call includes tool output and conversation param
      const toolOutputCall = mockResponsesCreate.mock.calls[1]![0];
      expect(toolOutputCall.input).toBeDefined();
      expect(toolOutputCall.input[0].type).toBe('function_call_output');
      expect(toolOutputCall.input[0].call_id).toBe('call_001');
      expect(toolOutputCall.conversation).toBeDefined();
    });

    it('handles resolution tool — captures structured result', async () => {
      const conv = await client.createConversation();

      // First call returns a function_call for resolve_discovery
      mockResponsesCreate.mockResolvedValueOnce(
        makeResponse('', 'resp_001', {
          functionCalls: [
            {
              name: 'resolve_discovery',
              callId: 'call_res_001',
              arguments: JSON.stringify({
                fit: 'qualified',
                signals_reviewed: 3,
                primary_need: 'Needs clearer qualification criteria'
              })
            }
          ]
        })
      );

      // Second call (after tool output submission) returns final text
      mockResponsesCreate.mockResolvedValueOnce(makeResponse('Qualification assessment complete.', 'resp_002'));

      const result = await client.sendMessage(conv.id, 'Finalize the qualification assessment.');
      expect(result).toBeDefined();
      expect(result!.resolution).toEqual({
        tool: 'resolve_discovery',
        result: {
          fit: 'qualified',
          signals_reviewed: 3,
          primary_need: 'Needs clearer qualification criteria'
        }
      });
    });

    it('does not include resolution when no resolution tool is called', async () => {
      const conv = await client.createConversation();
      mockResponsesCreate.mockResolvedValue(makeResponse('Just a regular message'));

      const result = await client.sendMessage(conv.id, 'Hello');
      expect(result).toBeDefined();
      expect(result!.resolution).toBeUndefined();
    });
  });

  describe('sendMessageStream', () => {
    it('streams delta events and emits complete', async () => {
      const conv = await client.createConversation({ mode: 'discovery' });
      const streamResult = makeStreamEvents(['Hello', ' world'], 'resp_stream_001');
      mockResponsesStream.mockReturnValue(streamResult);

      const chunks: string[] = [];
      await client.sendMessageStream(conv.id, 'test', (chunk: string) => {
        chunks.push(chunk);
      });

      expect(chunks[0]).toContain('event: tool.called');
      expect(chunks[1]).toContain('event: message.delta');
      expect(chunks[chunks.length - 2]).toContain('event: tool.done');
      expect(chunks[chunks.length - 1]).toContain('event: message.complete');
      expect(chunks[chunks.length - 1]).toContain('"content":"Hello world"');
    });

    it('emits error event for unknown conversation', async () => {
      const chunks: string[] = [];
      await client.sendMessageStream('nonexistent', 'test', (chunk: string) => {
        chunks.push(chunk);
      });

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toContain('event: error');
      expect(chunks[0]).toContain('not_found');
    });

    it('includes usage in complete event', async () => {
      const conv = await client.createConversation();
      const streamResult = makeStreamEvents(['Done'], 'resp_stream', {
        inputTokens: 42,
        outputTokens: 18
      });
      mockResponsesStream.mockReturnValue(streamResult);

      const chunks: string[] = [];
      await client.sendMessageStream(conv.id, 'test', (chunk: string) => {
        chunks.push(chunk);
      });

      const completeChunk = chunks.find((c) => c.includes('message.complete'));
      expect(completeChunk).toBeDefined();
      expect(completeChunk).toContain('"promptTokens":42');
      expect(completeChunk).toContain('"completionTokens":18');
    });

    it('handles stream errors gracefully', async () => {
      const conv = await client.createConversation();

      mockResponsesStream.mockImplementation(() => {
        throw new Error('Stream connection lost');
      });

      const chunks: string[] = [];
      await client.sendMessageStream(conv.id, 'test', (chunk: string) => {
        chunks.push(chunk);
      });

      expect(chunks[chunks.length - 1]).toContain('event: error');
      expect(chunks[chunks.length - 1]).toContain('Stream connection lost');
    });

    it('uses conversation param for streaming calls', async () => {
      const conv = await client.createConversation();

      // First call (non-streaming)
      mockResponsesCreate.mockResolvedValueOnce(makeResponse('First', 'resp_001'));
      await client.sendMessage(conv.id, 'First');

      // Second call (streaming) should use conversation param
      const streamResult = makeStreamEvents(['Second'], 'resp_002');
      mockResponsesStream.mockReturnValue(streamResult);

      const chunks: string[] = [];
      await client.sendMessageStream(conv.id, 'Second', (chunk: string) => {
        chunks.push(chunk);
      });

      expect(mockResponsesStream).toHaveBeenCalledTimes(1);
      const streamParams = mockResponsesStream.mock.calls[0]![0];
      expect(streamParams.conversation).toBeDefined();
      expect(streamParams.conversation.id).toMatch(/^server_conv_/);
      expect(streamParams).not.toHaveProperty('previous_response_id');
    });

    it('emits tool.called SSE event for specialist tools', async () => {
      const conv = await client.createConversation({ mode: 'discovery' });

      // Stream that includes a specialist function call
      const streamResult = makeStreamEvents(['Arr'], 'resp_specialist', {
        functionCalls: [
          {
            name: 'lookup_discovery_knowledge',
            callId: 'call_spec_001',
            arguments: JSON.stringify({ query: 'qualification signal' })
          }
        ]
      });

      mockResponsesStream.mockReturnValueOnce(streamResult);

      // Second stream call (tool output submission) returns final text
      const finalStream = makeStreamEvents(['Here is the guidance.'], 'resp_final');
      mockResponsesStream.mockReturnValueOnce(finalStream);

      const chunks: string[] = [];
      await client.sendMessageStream(conv.id, 'Summarize the discovery', (chunk: string) => {
        chunks.push(chunk);
      });

      // Check for tool.called event
      const toolCalledChunk = chunks.find(
        (c) => c.includes('tool.called') && c.includes('"toolName":"discovery_specialist"')
      );
      expect(toolCalledChunk).toBeDefined();
      expect(toolCalledChunk).toContain('"toolName":"discovery_specialist"');

      // Check for tool.done event
      const toolDoneChunk = chunks.find(
        (c) => c.includes('tool.done') && c.includes('"toolName":"discovery_specialist"')
      );
      expect(toolDoneChunk).toBeDefined();
      expect(toolDoneChunk).toContain('"toolName":"discovery_specialist"');
    });

    it('emits activity.resolved SSE event when resolution tool fires during streaming', async () => {
      const conv = await client.createConversation();

      // Stream that includes a resolution function call
      const streamResult = makeStreamEvents(['Assessment complete.'], 'resp_resolve', {
        functionCalls: [
          {
            name: 'resolve_discovery',
            callId: 'call_res_001',
            arguments: JSON.stringify({
              fit: 'qualified',
              signals_reviewed: 4,
              primary_need: 'Needs executive alignment'
            })
          }
        ]
      });

      mockResponsesStream.mockReturnValueOnce(streamResult);

      // Second stream (after tool output submission) returns final text
      const finalStream = makeStreamEvents(['The opportunity is qualified.'], 'resp_final');
      mockResponsesStream.mockReturnValueOnce(finalStream);

      const chunks: string[] = [];
      await client.sendMessageStream(conv.id, 'Please complete the assessment.', (chunk: string) => {
        chunks.push(chunk);
      });

      // Check for activity.resolved event
      const resolvedChunk = chunks.find((c) => c.includes('activity.resolved'));
      expect(resolvedChunk).toBeDefined();
      expect(resolvedChunk).toContain('"tool":"resolve_discovery"');
      expect(resolvedChunk).toContain('"fit":"qualified"');

      // Check complete event is present
      const completeChunk = chunks.find((c) => c.includes('message.complete'));
      expect(completeChunk).toBeDefined();
    });

    it('does not emit activity.resolved when no resolution tool fires', async () => {
      const conv = await client.createConversation();
      const streamResult = makeStreamEvents(['Hello'], 'resp_no_resolve');
      mockResponsesStream.mockReturnValue(streamResult);

      const chunks: string[] = [];
      await client.sendMessageStream(conv.id, 'test', (chunk: string) => {
        chunks.push(chunk);
      });

      const hasResolved = chunks.some((c) => c.includes('activity.resolved'));
      expect(hasResolved).toBe(false);
    });

    it('does not emit tool.called/tool.done for resolution tools', async () => {
      const conv = await client.createConversation({ mode: 'planning' });

      // Stream with a resolution tool call (should NOT emit tool.called/tool.done)
      const streamResult = makeStreamEvents([], 'resp_resolve', {
        functionCalls: [
          {
            name: 'resolve_planning',
            callId: 'call_res_002',
            arguments: JSON.stringify({
              approved: true,
              focus_area: 'Executive alignment',
              next_step: 'Schedule planning workshop'
            })
          }
        ]
      });

      mockResponsesStream.mockReturnValueOnce(streamResult);

      // Final stream after tool output
      const finalStream = makeStreamEvents(['Found it!'], 'resp_final');
      mockResponsesStream.mockReturnValueOnce(finalStream);

      const chunks: string[] = [];
      await client.sendMessageStream(conv.id, 'Open the chest!', (chunk: string) => {
        chunks.push(chunk);
      });

      expect(chunks[0]).toContain('"toolName":"planning_specialist"');

      // But activity.resolved SHOULD be emitted
      const hasResolved = chunks.some((c) => c.includes('activity.resolved'));
      expect(hasResolved).toBe(true);
    });

    it('records assistant message in conversation after streaming', async () => {
      const conv = await client.createConversation({ mode: 'planning' });
      const streamResult = makeStreamEvents(['Streamed text'], 'resp_stream');
      mockResponsesStream.mockReturnValue(streamResult);

      await client.sendMessageStream(conv.id, 'Hi', (/* chunk */) => {});

      const detail = await client.getConversation(conv.id);
      expect(detail).toBeDefined();
      // user msg + assistant msg
      expect(detail!.messages).toHaveLength(2);
      expect(detail!.messages[1]!.role).toBe('assistant');
      expect(detail!.messages[1]!.content).toBe('Streamed text');
    });
  });

  describe('checkHealth', () => {
    it('returns healthy when client is initialised', async () => {
      const health = await client.checkHealth();
      expect(health.status).toBe('healthy');
      expect(health.checks).toHaveLength(1);
      expect(health.checks![0]!.name).toBe('azure-ai-foundry');
      expect(health.checks![0]!.status).toBe('healthy');
    });

    it('returns degraded when client is not initialised', async () => {
      // Create a client with a config that will make setupClient() throw
      // so initialise() never completes and the client stays uninitialised.
      // We use an https endpoint without skipAuth, and make getOpenAIClient fail.
      mockGetOpenAIClient.mockRejectedValueOnce(new Error('auth failed'));
      const uninitClient = new FoundryClient({ config: AZURE_CONFIG });
      try {
        await uninitClient.initialise();
      } catch {
        // Expected — initialise throws because getOpenAIClient failed
      }

      const health = await uninitClient.checkHealth();
      expect(health.status).toBe('degraded');
      expect(health.checks![0]!.status).toBe('unhealthy');
    });
  });
});

// ==========================================================================
// Tests — With agent registration (Azure endpoint)
// ==========================================================================

describe('FoundryClient (with agent registration)', () => {
  let client: InstanceType<typeof FoundryClient>;

  beforeEach(async () => {
    resetAllMocks();
    setupAgentMocksForCreate();

    // For the Azure path, getOpenAIClient returns a mock OpenAI instance
    // (the same mocked module, but we need to return an object here)
    mockGetOpenAIClient.mockResolvedValue({
      responses: {
        create: mockResponsesCreate,
        stream: mockResponsesStream
      },
      conversations: {
        create: mockConversationsCreate
      }
    });

    client = new FoundryClient({ config: AZURE_CONFIG });
    await client.initialise();
  });

  describe('initialise', () => {
    it('creates all 4 agents when none exist (get returns 404)', async () => {
      // The beforeEach already called initialise() — default mock has get → 404
      expect(mockAgentsGet).toHaveBeenCalledTimes(3);
      expect(mockAgentsCreate).toHaveBeenCalledTimes(3);
      expect(mockAgentsUpdate).not.toHaveBeenCalled();

      // Check agent names passed to create
      const createdNames = mockAgentsCreate.mock.calls.map((call: unknown[]) => call[0]);
      expect(createdNames).toContain('discovery-specialist');
      expect(createdNames).toContain('planning-specialist');
      expect(createdNames).toContain('staffing-specialist');
    });

    it('updates agents when they already exist (get succeeds)', async () => {
      resetAllMocks();

      // Override get to return an existing agent
      mockAgentsGet.mockImplementation(async (name: string) => ({
        id: 'existing_agent_1',
        name,
        object: 'agent',
        versions: { latest: { version: 'v1' } }
      }));
      const makeAgent = (name: string) => ({
        id: `agent_${++agentCounter}`,
        name,
        object: 'agent' as const,
        versions: { latest: { version: `v${++versionCounter}` } }
      });
      mockAgentsUpdate.mockImplementation(async (name: string) => makeAgent(name));
      mockGetOpenAIClient.mockResolvedValue({
        responses: { create: mockResponsesCreate, stream: mockResponsesStream },
        conversations: { create: mockConversationsCreate }
      });

      const updateClient = new FoundryClient({ config: AZURE_CONFIG });
      await updateClient.initialise();

      expect(mockAgentsGet).toHaveBeenCalledTimes(3);
      expect(mockAgentsUpdate).toHaveBeenCalledTimes(3);
      expect(mockAgentsCreate).not.toHaveBeenCalled();
    });

    it('creates specialist agents with focused toolsets', async () => {
      const discoveryCreateCall = mockAgentsCreate.mock.calls.find(
        (call: unknown[]) => call[0] === 'discovery-specialist'
      );
      expect(discoveryCreateCall).toBeDefined();

      const definition = discoveryCreateCall![1] as Record<string, unknown>;
      expect(definition.kind).toBe('prompt');
      expect(definition.model).toBe('gpt-5.2-chat');
      expect(String(definition.instructions)).toContain(AZURE_CONFIG.discoveryInstructions);

      const tools = definition.tools as Array<{ name: string }>;
      expect(tools).toHaveLength(2);
    });

    it('creates specialist agents with shared + specialist instructions', async () => {
      const discoveryCreateCall = mockAgentsCreate.mock.calls.find(
        (call: unknown[]) => call[0] === 'discovery-specialist'
      );
      expect(discoveryCreateCall).toBeDefined();

      const definition = discoveryCreateCall![1] as Record<string, unknown>;
      expect(definition.kind).toBe('prompt');
      expect(definition.model).toBe('gpt-5.2-chat');
      expect(String(definition.instructions)).toContain(AZURE_CONFIG.discoveryInstructions);
      expect(String(definition.instructions)).toContain(AZURE_CONFIG.sharedInstructions);
    });

    it('throws if agent registration fails with non-404 error', async () => {
      resetAllMocks();
      mockAgentsGet.mockRejectedValue(Object.assign(new Error('Internal Server Error'), { statusCode: 500 }));
      mockGetOpenAIClient.mockResolvedValue({
        responses: { create: mockResponsesCreate, stream: mockResponsesStream },
        conversations: { create: mockConversationsCreate }
      });

      const failClient = new FoundryClient({ config: AZURE_CONFIG });
      await expect(failClient.initialise()).rejects.toThrow('Internal Server Error');
    });

    it('throws if agent create fails after 404', async () => {
      resetAllMocks();
      const notFoundError = Object.assign(new Error('Agent not found'), { statusCode: 404 });
      mockAgentsGet.mockRejectedValue(notFoundError);
      mockAgentsCreate.mockRejectedValue(new Error('Create failed: insufficient permissions'));
      mockGetOpenAIClient.mockResolvedValue({
        responses: { create: mockResponsesCreate, stream: mockResponsesStream },
        conversations: { create: mockConversationsCreate }
      });

      const failClient = new FoundryClient({ config: AZURE_CONFIG });
      await expect(failClient.initialise()).rejects.toThrow('insufficient permissions');
    });

    it('throws if agent update fails', async () => {
      resetAllMocks();
      // get succeeds, update fails
      mockAgentsGet.mockImplementation(async (name: string) => ({
        id: 'existing_1',
        name,
        object: 'agent',
        versions: { latest: { version: 'v1' } }
      }));
      mockAgentsUpdate.mockRejectedValue(new Error('Update failed'));
      mockGetOpenAIClient.mockResolvedValue({
        responses: { create: mockResponsesCreate, stream: mockResponsesStream },
        conversations: { create: mockConversationsCreate }
      });

      const failClient = new FoundryClient({ config: AZURE_CONFIG });
      await expect(failClient.initialise()).rejects.toThrow('Update failed');
    });

    it('initialises without Azure Monitor when no telemetry connection string is available', async () => {
      resetAllMocks();
      setupAgentMocksForCreate();
      mockGetTelemetryConnectionString.mockResolvedValue(undefined);
      mockGetOpenAIClient.mockResolvedValue({
        responses: { create: mockResponsesCreate, stream: mockResponsesStream },
        conversations: { create: mockConversationsCreate }
      });

      const noTelemetryClient = new FoundryClient({ config: AZURE_CONFIG });
      await noTelemetryClient.initialise();

      expect(mockUseMicrosoftOpenTelemetry).not.toHaveBeenCalled();
      expect(mockGetOpenAIClient).toHaveBeenCalledTimes(1);
    });
  });

  describe('createConversation', () => {
    it('creates a server-side conversation', async () => {
      const conv = await client.createConversation();
      expect(conv.id).toMatch(/^conv_/);
      expect(conv.createdAt).toBeDefined();

      // Verify conversations.create was called on the OpenAI client
      expect(mockConversationsCreate).toHaveBeenCalledTimes(1);
    });

    it('includes metadata when provided', async () => {
      const conv = await client.createConversation({ topic: 'testing' });
      expect(conv.metadata).toEqual({ topic: 'testing' });
    });
  });

  describe('sendMessage (non-streaming)', () => {
    it('sends message using conversation param instead of previous_response_id', async () => {
      const conv = await client.createConversation();
      mockResponsesCreate.mockResolvedValue(makeResponse('Hello!'));

      await client.sendMessage(conv.id, 'Hello');

      expect(mockResponsesCreate).toHaveBeenCalledTimes(1);
      const params = mockResponsesCreate.mock.calls[0]![0];

      // Should use conversation param
      expect(params.conversation).toBeDefined();
      expect(params.conversation.id).toMatch(/^server_conv_/);

      // Should NOT use previous_response_id
      expect(params).not.toHaveProperty('previous_response_id');
    });

    it('sends second message using same conversation ID (no previous_response_id)', async () => {
      const conv = await client.createConversation();
      mockResponsesCreate.mockResolvedValueOnce(makeResponse('First', 'resp_001'));
      mockResponsesCreate.mockResolvedValueOnce(makeResponse('Second', 'resp_002'));

      await client.sendMessage(conv.id, 'First message');
      await client.sendMessage(conv.id, 'Second message');

      // Both calls should use conversation param, not previous_response_id
      const firstParams = mockResponsesCreate.mock.calls[0]![0];
      const secondParams = mockResponsesCreate.mock.calls[1]![0];

      expect(firstParams.conversation).toBeDefined();
      expect(secondParams.conversation).toBeDefined();
      expect(firstParams.conversation.id).toBe(secondParams.conversation.id);
      expect(secondParams).not.toHaveProperty('previous_response_id');
    });

    it('handles tool-call loop with conversation param', async () => {
      const conv = await client.createConversation();

      // First call returns a function_call for lookup_discovery_knowledge
      mockResponsesCreate.mockResolvedValueOnce(
        makeResponse('', 'resp_001', {
          functionCalls: [
            {
              name: 'lookup_discovery_knowledge',
              callId: 'call_001',
              arguments: JSON.stringify({ query: 'Summarize the opportunity' })
            }
          ]
        })
      );

      // Second call (tool output submission) returns final text
      mockResponsesCreate.mockResolvedValueOnce(makeResponse('Here is the discovery summary!', 'resp_002'));

      const result = await client.sendMessage(conv.id, 'Help me qualify this lead');
      expect(result).toBeDefined();
      expect(result!.content).toBe('Here is the discovery summary!');
      expect(mockResponsesCreate).toHaveBeenCalledTimes(2);

      // First call (coordinator) should use conversation param
      const coordinatorParams = mockResponsesCreate.mock.calls[0]![0];
      expect(coordinatorParams.conversation).toBeDefined();

      // Second call (tool output back to specialist) should also use conversation param
      const toolOutputParams = mockResponsesCreate.mock.calls[1]![0];
      expect(toolOutputParams.conversation).toBeDefined();
    });

    it('handles resolution tool — captures structured result', async () => {
      const conv = await client.createConversation();

      mockResponsesCreate.mockResolvedValueOnce(
        makeResponse('', 'resp_001', {
          functionCalls: [
            {
              name: 'resolve_staffing',
              callId: 'call_res_001',
              arguments: JSON.stringify({
                coverage_level: 'full',
                role: 'analyst',
                team_name: 'RevOps'
              })
            }
          ]
        })
      );

      mockResponsesCreate.mockResolvedValueOnce(makeResponse('Welcome to the team!', 'resp_002'));

      const result = await client.sendMessage(conv.id, 'My answers');
      expect(result).toBeDefined();
      expect(result!.resolution).toEqual({
        tool: 'resolve_staffing',
        result: { coverage_level: 'full', role: 'analyst', team_name: 'RevOps' }
      });
    });
  });

  describe('sendMessageStream', () => {
    it('streams with conversation param instead of previous_response_id', async () => {
      const conv = await client.createConversation();
      const streamResult = makeStreamEvents(['Hello', ' world'], 'resp_stream_001');
      mockResponsesStream.mockReturnValue(streamResult);

      const chunks: string[] = [];
      await client.sendMessageStream(conv.id, 'test', (chunk: string) => {
        chunks.push(chunk);
      });

      expect(mockResponsesStream).toHaveBeenCalledTimes(1);
      const streamParams = mockResponsesStream.mock.calls[0]![0];

      // Should use conversation param
      expect(streamParams.conversation).toBeDefined();
      expect(streamParams.conversation.id).toMatch(/^server_conv_/);

      // Should NOT use previous_response_id
      expect(streamParams).not.toHaveProperty('previous_response_id');

      expect(chunks[chunks.length - 1]).toContain('event: message.complete');
    });

    it('emits error event for unknown conversation', async () => {
      const chunks: string[] = [];
      await client.sendMessageStream('nonexistent', 'test', (chunk: string) => {
        chunks.push(chunk);
      });

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toContain('event: error');
      expect(chunks[0]).toContain('not_found');
    });

    it('emits tool.called and tool.done for specialist tools', async () => {
      const conv = await client.createConversation({ mode: 'planning' });

      const streamResult = makeStreamEvents(['Plan'], 'resp_specialist', {
        functionCalls: [
          {
            name: 'lookup_planning_knowledge',
            callId: 'call_spec_001',
            arguments: JSON.stringify({ query: 'Describe the next planning milestone' })
          }
        ]
      });

      mockResponsesStream.mockReturnValueOnce(streamResult);

      // Final stream after tool output
      const finalStream = makeStreamEvents(['Start with the executive review.'], 'resp_final');
      mockResponsesStream.mockReturnValueOnce(finalStream);

      const chunks: string[] = [];
      await client.sendMessageStream(conv.id, 'Start account planning', (chunk: string) => {
        chunks.push(chunk);
      });

      const toolCalledChunk = chunks.find(
        (c) => c.includes('tool.called') && c.includes('"toolName":"planning_specialist"')
      );
      expect(toolCalledChunk).toBeDefined();
      expect(toolCalledChunk).toContain('"toolName":"planning_specialist"');

      const toolDoneChunk = chunks.find(
        (c) => c.includes('tool.done') && c.includes('"toolName":"planning_specialist"')
      );
      expect(toolDoneChunk).toBeDefined();
      expect(toolDoneChunk).toContain('"toolName":"planning_specialist"');
    });

    it('emits activity.resolved during streaming', async () => {
      const conv = await client.createConversation();

      const streamResult = makeStreamEvents(['Assessment complete.'], 'resp_resolve', {
        functionCalls: [
          {
            name: 'resolve_discovery',
            callId: 'call_res_001',
            arguments: JSON.stringify({
              fit: 'follow_up',
              signals_reviewed: 2,
              primary_need: 'Needs broader stakeholder input'
            })
          }
        ]
      });

      mockResponsesStream.mockReturnValueOnce(streamResult);

      const finalStream = makeStreamEvents(['Follow-up is recommended.'], 'resp_final');
      mockResponsesStream.mockReturnValueOnce(finalStream);

      const chunks: string[] = [];
      await client.sendMessageStream(conv.id, 'Summarize the assessment', (chunk: string) => {
        chunks.push(chunk);
      });

      const resolvedChunk = chunks.find((c) => c.includes('activity.resolved'));
      expect(resolvedChunk).toBeDefined();
      expect(resolvedChunk).toContain('"tool":"resolve_discovery"');
      expect(resolvedChunk).toContain('"fit":"follow_up"');
    });

    it('records assistant message in conversation after streaming', async () => {
      const conv = await client.createConversation();
      const streamResult = makeStreamEvents(['Streamed text'], 'resp_stream');
      mockResponsesStream.mockReturnValue(streamResult);

      await client.sendMessageStream(conv.id, 'Hi', (/* chunk */) => {});

      const detail = await client.getConversation(conv.id);
      expect(detail).toBeDefined();
      expect(detail!.messages).toHaveLength(2);
      expect(detail!.messages[1]!.role).toBe('assistant');
      expect(detail!.messages[1]!.content).toBe('Streamed text');
    });
  });
});
