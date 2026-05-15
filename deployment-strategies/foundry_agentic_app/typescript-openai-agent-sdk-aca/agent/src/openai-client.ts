/**
 * OpenAI Agent SDK wrapper — orchestration layer.
 *
 * Maps the Responses API (stateless, client-side conversation state) to our
 * conversation model defined in agent-api.openapi.yaml:
 *
 *   Conversation = client-side Map entry (id + lastResponseId + messages)
 *   Message      = accumulated from RunResult / StreamedRunResult
 *   sendMessage  = run(coordinatorAgent, input, { previousResponseId })
 *
 * This file is the orchestration glue between:
 *   - agent-setup.ts      — SDK client config + agent hierarchy creation
 *   - conversation-store.ts — in-memory conversation state management
 *   - run-helpers.ts       — result extraction, SSE formatting, resolution detection
 *
 * Logging levels:
 *   info  — high-level operations (start/complete, resolution detected, errors)
 *   debug — per-item/event details (stream events, run items, tool calls)
 *   trace — raw content (text deltas, raw content parts, full response dumps)
 */

import type { Agent } from '@openai/agents';
import { run } from '@openai/agents';
import { context, trace } from '@opentelemetry/api';
import type {
  RunRawModelStreamEvent,
  RunItemStreamEvent,
  RunToolCallItem,
  RunToolCallOutputItem,
  RunMessageOutputItem
} from '@openai/agents';
import type { Config } from './config.ts';
import { ConversationStore } from './conversation-store.ts';
import type { ConversationRecord } from './conversation-store.ts';
import {
  setupAzureClient,
  createSpecialistAgents,
  RESOLUTION_TOOLS,
  SPECIALIST_TOOLS,
  type SpecialistAgents,
  type SpecialistMode
} from './agent-setup.ts';
import {
  formatSSE,
  extractTextFromResult,
  extractUsage,
  extractResolutionFromItems,
  logRunResult
} from './run-helpers.ts';
import type { CapturedResolution } from './run-helpers.ts';
import type {
  Conversation,
  ConversationDetail,
  ConversationList,
  Message,
  ActivityResolution,
  TokenUsage,
  HealthResponse,
  SSEDeltaEvent,
  SSECompleteEvent,
  SSEResolvedEvent,
  SSEToolCalledEvent,
  SSEToolDoneEvent
} from './types.ts';

// ---------------------------------------------------------------------------
// Logger interface (subset of Pino used by this module)
// ---------------------------------------------------------------------------

export interface Logger {
  trace(obj: Record<string, unknown>, msg: string): void;
  debug(obj: Record<string, unknown>, msg: string): void;
  info(obj: Record<string, unknown>, msg: string): void;
  warn(obj: Record<string, unknown>, msg: string): void;
  error(obj: Record<string, unknown>, msg: string): void;
  child(bindings: Record<string, unknown>): Logger;
}

/** No-op logger used when no logger is provided. */
const noopLogger: Logger = {
  trace() {},
  debug() {},
  info() {},
  warn() {},
  error() {},
  child() {
    return noopLogger;
  }
};

// The SDK's run() generic constraint is Agent<any, any>; keep the cast centralized.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RunnableAgent = Agent<any, any>;

// ---------------------------------------------------------------------------
// Stream state — mutable accumulator for a single streaming run
// ---------------------------------------------------------------------------

/**
 * Mutable state accumulated during a single `sendMessageStream` call.
 *
 * A new StreamState is created for every call and threaded through each
 * handler method.  This avoids instance-level mutable state that could
 * cause cross-conversation interference in concurrent requests.
 *
 * `fullContent` is built up in two ways:
 *   1. Token-by-token via `output_text_delta` events (raw model stream)
 *   2. Overwritten wholesale when a `message_output_created` event arrives
 *      with the SDK's final assembled text (see handleRunItemEvent).
 * Both paths exist because the delta stream gives us real-time SSE output,
 * but the SDK's final message is the authoritative content we persist.
 */
interface StreamState {
  readonly conversationId: string;
  readonly startTime: number;
  /** Accumulated response text — built from deltas, finalised by message_output_created. */
  fullContent: string;
  /** Token counts — only available after the stream completes. */
  usage: TokenUsage | undefined;
  /** Guards against emitting `activity.resolved` more than once per call. */
  resolvedEmitted: boolean;
  /**
   * Per-call resolution data — captured when we see a resolution tool call
   * in the stream, then emitted as an `activity.resolved` SSE event when
   * the corresponding `tool_output` arrives (or post-completion as a fallback).
   */
  localResolution: CapturedResolution | null;
  activeSpecialistTool: string;
  emitLifecycleEvents: boolean;
}

function specialistToolName(mode: SpecialistMode | undefined): string {
  switch (mode) {
    case 'planning':
      return 'planning_specialist';
    case 'staffing':
      return 'staffing_specialist';
    case 'discovery':
    default:
      return 'discovery_specialist';
  }
}

function shouldEmitLifecycleEvents(record: ConversationRecord): boolean {
  const mode = record.metadata?.['mode'];
  return mode === 'discovery' || mode === 'planning' || mode === 'staffing';
}

// ---------------------------------------------------------------------------
// OpenAI client
// ---------------------------------------------------------------------------

export interface OpenAIClientOptions {
  readonly config: Config;
  /**
   * Override the run function (for testing).
   * Must match the signature of `run()` from @openai/agents.
   */
  readonly runFn?: typeof run | undefined;
  /** Skip AzureOpenAI client setup (for testing with injected runFn) */
  readonly skipClientSetup?: boolean | undefined;
  /** Logger instance (Pino-compatible). If omitted, logging is disabled. */
  readonly logger?: Logger | undefined;
}

export class OpenAIClient {
  private specialistAgents: SpecialistAgents | undefined;
  readonly store: ConversationStore;
  private readonly config: Config;
  private readonly runFn: typeof run;
  private readonly skipClientSetup: boolean;
  private readonly log: Logger;
  private initialised = false;

  constructor(options: OpenAIClientOptions) {
    this.config = options.config;
    this.runFn = options.runFn ?? run;
    this.skipClientSetup = options.skipClientSetup ?? false;
    this.log = options.logger ?? noopLogger;
    this.store = new ConversationStore();
  }

  // ---- Initialisation ----

  /**
   * Initialise the SDK client and create the multi-agent hierarchy.
   * Must be called before any other operations.
   *
   * See agent-setup.ts for the full setup pattern (Azure client + agent
   * hierarchy with specialist tools and resolution tools).
   */
  async initialise(): Promise<void> {
    if (!this.skipClientSetup) {
      await setupAzureClient(this.config);
    }

    this.specialistAgents = createSpecialistAgents(this.config, this.log);
    this.initialised = true;
  }

  private ensureReady(): SpecialistAgents {
    if (!this.initialised || !this.specialistAgents) {
      throw new Error('OpenAIClient not initialised — call initialise() first');
    }
    return this.specialistAgents;
  }

  private selectSpecialist(record: ConversationRecord): { agent: Agent; mode?: SpecialistMode } {
    const specialists = this.ensureReady();
    const mode = record.metadata?.['mode'];
    if (mode === 'planning') {
      return { agent: specialists.planning, mode };
    }
    if (mode === 'staffing') {
      return { agent: specialists.staffing, mode };
    }
    if (mode === 'discovery') {
      return { agent: specialists.discovery, mode };
    }
    return { agent: specialists.discovery };
  }

  // ---- Conversations (delegated to ConversationStore) ----

  async createConversation(metadata?: Record<string, unknown> | undefined): Promise<Conversation> {
    this.ensureReady();
    const conversation = this.store.create(metadata);
    this.log.info({ conversationId: conversation.id }, 'Conversation created');
    return conversation;
  }

  async listConversations(offset = 0, limit = 20): Promise<ConversationList> {
    this.ensureReady();
    return this.store.list(offset, limit);
  }

  async getConversation(conversationId: string): Promise<ConversationDetail | undefined> {
    this.ensureReady();
    return this.store.get(conversationId);
  }

  // ---- Messages (non-streaming) ----

  /**
   * Send a user message and return the assistant's response (non-streaming).
   *
   * Flow:
   *   1. Record the user message in the conversation
   *   2. Call the SDK's `run()` with the coordinator agent
   *   3. Extract the response text, token usage, and any resolution
   *   4. Record the assistant message and return it
   *
   * Conversation continuity uses the Responses API's `previousResponseId`
   * mechanism: each run returns a `lastResponseId`, which we pass to the
   * next run so the model sees the full conversation history server-side.
   * We don't send message arrays — the API reconstructs context from the
   * response chain.
   */ async sendMessage(conversationId: string, content: string): Promise<Message | undefined> {
    this.ensureReady();
    const record = this.store.getRecord(conversationId);
    if (!record) return undefined;
    const selected = this.selectSpecialist(record);
    const tracer = trace.getTracer('caira.agent.openai');

    this.log.info(
      { conversationId, contentLength: content.length, agent: selected.agent.name, mode: selected.mode },
      'sendMessage started'
    );
    this.log.debug({ conversationId, content }, 'sendMessage user content');
    const startTime = Date.now();

    // Record user message
    const userMsg: Message = {
      id: ConversationStore.messageId(),
      role: 'user',
      content,
      createdAt: new Date().toISOString()
    };
    record.messages.push(userMsg);

    // Run coordinator agent — always the same agent for every message.
    // The coordinator may internally call specialist tools (discovery_specialist,
    // planning_specialist, staffing_specialist) to generate content, and/or
    // resolution tools (resolve_discovery, etc.) to end an activity with a
    // structured outcome.  The SDK handles the tool-call loop automatically.
    //
    // `previousResponseId` chains this run to the prior one so the model
    // sees the full conversation history without us sending message arrays.
    const result = await tracer.startActiveSpan('agent.send_message', async (span) => {
      span.setAttribute('conversation.id', conversationId);
      span.setAttribute('agent.name', selected.agent.name ?? 'unknown');
      if (selected.mode) {
        span.setAttribute('conversation.mode', selected.mode);
      }

      try {
        return await context.with(trace.setSpan(context.active(), span), async () =>
          this.runFn(selected.agent as RunnableAgent, content, {
            ...(record.lastResponseId ? { previousResponseId: record.lastResponseId } : {})
          })
        );
      } finally {
        span.end();
      }
    });

    const durationMs = Date.now() - startTime;

    // Log every item/response from the run for full visibility
    logRunResult(result, conversationId, durationMs, this.log);

    // Extract response text
    const responseText = extractTextFromResult(result, this.log);

    // Update conversation state
    record.lastResponseId = result.lastResponseId;
    record.updatedAt = new Date().toISOString();

    // Extract usage
    const usage = extractUsage(result);

    // Check if the coordinator called a resolution tool (e.g. resolve_discovery).
    // Resolution tools signal that an activity is complete — the frontend
    // uses this to show outcomes like "The opportunity is qualified." with
    // structured data (fit, signals_reviewed, etc.) rather than just free text.
    const cap = extractResolutionFromItems(result.newItems, this.log);
    const resolution: ActivityResolution | undefined = cap ? { tool: cap.tool, result: cap.result } : undefined;

    if (resolution) {
      this.log.info(
        { conversationId, tool: resolution.tool, outcome: resolution.result, durationMs },
        'Resolution tool called'
      );
    }

    this.log.info(
      {
        conversationId,
        durationMs,
        responseLength: responseText.length,
        hasResolution: !!resolution
      },
      'sendMessage completed'
    );
    this.log.trace(
      {
        conversationId,
        responseText: responseText.length > 500 ? responseText.substring(0, 500) + '...' : responseText
      },
      'sendMessage response content'
    );

    // Record assistant message
    const assistantMsg: Message = {
      id: ConversationStore.messageId(),
      role: 'assistant',
      content: responseText,
      createdAt: new Date().toISOString(),
      ...(usage ? { usage } : {}),
      ...(resolution ? { resolution } : {})
    };
    record.messages.push(assistantMsg);

    return assistantMsg;
  }

  // ---- Messages (streaming) ----

  /**
   * Send a message and stream the response back as Server-Sent Events (SSE).
   *
   * The caller (routes.ts) writes each SSE chunk directly to the HTTP
   * response, giving the frontend real-time token-by-token output.
   *
   * ## SDK streaming model
   *
   * When `run()` is called with `stream: true`, the SDK returns an async
   * iterable that emits two kinds of events:
   *
   * **`raw_model_stream_event`** — Low-level token stream from the model.
   *   The main one we care about is `output_text_delta`, which carries a
   *   text fragment (e.g. "Hello", " world").  We forward each delta to
   *   the client as an SSE `message.delta` event for real-time display.
   *
   * **`run_item_stream_event`** — Higher-level SDK events for complete
   *   "items" in the run.  These tell us when:
   *   - A tool was called (`tool_called` + `tool_call_item`)
   *   - A tool produced output (`tool_output` + `tool_call_output_item`)
   *   - The model produced a complete message (`message_output_created`)
   *
   * ## SSE events emitted to the client
   *
   *   `message.delta`      — A text fragment (real-time streaming)
   *   `tool.called`        — A specialist tool started (e.g. discovery_specialist)
   *   `tool.done`          — A specialist tool finished
   *   `activity.resolved`  — A resolution tool fired (activity complete with structured result)
   *   `message.complete`   — Final assembled message with full text and token usage
   *   `error`              — Something went wrong
   *
   * ## Resolution detection
   *
   * Resolution tools (resolve_discovery, resolve_planning, resolve_staffing) signal
   * that an interactive activity has concluded.  We detect them from the
   * `tool_called` event (which carries the tool name and JSON arguments),
   * then emit `activity.resolved` when the corresponding `tool_output`
   * arrives.  There's a post-completion fallback in case the tool_output
   * event doesn't fire (edge case with some SDK versions).
   */
  async sendMessageStream(conversationId: string, content: string, onChunk: (chunk: string) => void): Promise<void> {
    this.ensureReady();
    const record = this.store.getRecord(conversationId);
    if (!record) {
      this.log.warn({ conversationId }, 'sendMessageStream: conversation not found');
      onChunk(formatSSE('error', { code: 'not_found', message: 'Conversation not found' }));
      return;
    }

    const selected = this.selectSpecialist(record);
    const tracer = trace.getTracer('caira.agent.openai');

    this.log.info(
      { conversationId, contentLength: content.length, agent: selected.agent.name, mode: selected.mode },
      'sendMessageStream started'
    );
    this.log.debug({ conversationId, content }, 'sendMessageStream user content');
    const startTime = Date.now();

    // Record user message
    const userMsg: Message = {
      id: ConversationStore.messageId(),
      role: 'user',
      content,
      createdAt: new Date().toISOString()
    };
    record.messages.push(userMsg);

    const state: StreamState = {
      conversationId,
      startTime,
      fullContent: '',
      usage: undefined,
      resolvedEmitted: false,
      localResolution: null,
      activeSpecialistTool: specialistToolName(selected.mode),
      emitLifecycleEvents: shouldEmitLifecycleEvents(record)
    };

    if (state.emitLifecycleEvents) {
      const specialistStartedEvent: SSEToolCalledEvent = { toolName: state.activeSpecialistTool };
      onChunk(formatSSE('tool.called', specialistStartedEvent));
    }

    try {
      // Start the streaming run.  Same agent + chaining as sendMessage,
      // but with `stream: true` to get the async event iterable.
      const streamResult = await tracer.startActiveSpan('agent.send_message_stream', async (span) => {
        span.setAttribute('conversation.id', conversationId);
        span.setAttribute('agent.name', selected.agent.name ?? 'unknown');
        if (selected.mode) {
          span.setAttribute('conversation.mode', selected.mode);
        }

        try {
          return await context.with(trace.setSpan(context.active(), span), async () =>
            this.runFn(selected.agent as RunnableAgent, content, {
              stream: true,
              ...(record.lastResponseId ? { previousResponseId: record.lastResponseId } : {})
            })
          );
        } finally {
          span.end();
        }
      });

      // Process each event from the SDK's stream.  The two event types
      // map to the two handler methods:
      //   raw_model_stream_event → handleRawModelEvent (token deltas, model lifecycle)
      //   run_item_stream_event  → handleRunItemEvent  (tools, messages, resolution)
      for await (const event of streamResult) {
        if (event.type === 'raw_model_stream_event') {
          this.handleRawModelEvent(event as RunRawModelStreamEvent, state, onChunk);
        } else if (event.type === 'run_item_stream_event') {
          this.handleRunItemEvent(event as RunItemStreamEvent, state, onChunk);
        }
      }

      // The stream is exhausted, but the SDK may still be finalising
      // internally (e.g. running tool output handlers).  Wait for that.
      await streamResult.completed;

      // If a resolution tool was detected but no tool_output event arrived
      // to trigger emission, emit it now as a fallback.
      this.finaliseStreamResolution(state, onChunk);

      // Token usage is only available after the stream fully completes.
      this.extractStreamUsage(state, streamResult);

      // Update conversation chaining state for the next message.
      record.lastResponseId = streamResult.lastResponseId;
      record.updatedAt = new Date().toISOString();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown streaming error';
      this.log.error({ conversationId, err }, 'sendMessageStream error');
      onChunk(formatSSE('error', { code: 'agent_error', message }));
      return;
    }

    // Stream succeeded — send the final `message.complete` SSE with the
    // full assembled text and token usage, then persist the assistant message.
    this.emitCompleteAndRecord(state, record, onChunk);
  }

  // ---- Stream event handlers (private) ----
  //
  // These methods process the two types of events from the SDK's streaming
  // run.  They mutate `StreamState` as side-effects and call `onChunk` to
  // emit SSE events to the client.
  //
  // The split mirrors the SDK's own event taxonomy:
  //   handleRawModelEvent  — token-level events direct from the model
  //   handleRunItemEvent   — semantic events from the SDK's orchestration layer

  /**
   * Handle a `raw_model_stream_event`.
   *
   * These are low-level events from the model's response stream.  The SDK
   * emits many event types here (content_part_added, output_text_delta,
   * response_started, response_done, etc.) — we only act on
   * `output_text_delta` (the actual text tokens) and log the rest.
   */
  private handleRawModelEvent(
    rawEvent: RunRawModelStreamEvent,
    state: StreamState,
    onChunk: (chunk: string) => void
  ): void {
    // The SDK wraps the raw model response in a generic envelope.
    // `data.type` tells us which specific model event this is.
    const data = rawEvent.data as Record<string, unknown>;
    const dataType = data['type'] as string | undefined;

    if (dataType === 'output_text_delta') {
      // A text token from the model — the core of streaming.
      // Accumulate it into fullContent (for the final message) and
      // forward it to the client as an SSE delta for real-time display.
      const delta = data['delta'] as string | undefined;
      if (delta) {
        state.fullContent += delta;
        const sseEvent: SSEDeltaEvent = { content: delta };
        onChunk(formatSSE('message.delta', sseEvent));
        this.log.trace(
          {
            conversationId: state.conversationId,
            elapsedMs: Date.now() - state.startTime,
            delta: delta.length > 200 ? delta.substring(0, 200) + '...' : delta,
            deltaLength: delta.length,
            accumulatedLength: state.fullContent.length
          },
          'stream delta: output_text_delta'
        );
      }
    } else if (dataType === 'response_started') {
      this.log.debug(
        { conversationId: state.conversationId, elapsedMs: Date.now() - state.startTime },
        'stream event: response_started'
      );
    } else if (dataType === 'response_done') {
      const response = data['response'] as Record<string, unknown> | undefined;
      const responseOutput = response?.['output'];
      this.log.debug(
        {
          conversationId: state.conversationId,
          elapsedMs: Date.now() - state.startTime,
          responseId: response?.['id'],
          usage: response?.['usage'],
          outputCount: Array.isArray(responseOutput) ? (responseOutput as unknown[]).length : undefined
        },
        'stream event: response_done'
      );
    } else {
      this.logOtherRawEvent(data, dataType, state);
    }
  }

  /** Trace-log raw model events that aren't explicitly handled. */
  private logOtherRawEvent(data: Record<string, unknown>, dataType: string | undefined, state: StreamState): void {
    const truncatedData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (key === 'type') continue;
      if (typeof value === 'string' && value.length > 200) {
        truncatedData[key] = value.substring(0, 200) + '...';
      } else if (typeof value === 'object' && value !== null) {
        truncatedData[key] = JSON.stringify(value).substring(0, 500);
      } else {
        truncatedData[key] = value;
      }
    }
    this.log.trace(
      {
        conversationId: state.conversationId,
        dataType,
        elapsedMs: Date.now() - state.startTime,
        data: truncatedData
      },
      `stream event: ${dataType ?? 'unknown_model_event'}`
    );
  }

  /**
   * Handle a `run_item_stream_event`.
   *
   * These are higher-level events from the SDK's orchestration layer.
   * While raw model events give us individual tokens, item events tell
   * us about complete semantic units in the run:
   *
   *   tool_called  — The coordinator invoked a tool (specialist or resolution).
   *                  We emit `tool.called` SSE for specialist tools so the
   *                  frontend can show "Consulting discovery expert...".
   *                  For resolution tools, we capture the structured args
   *                  so we can emit `activity.resolved` later.
   *
   *   tool_output  — A tool finished and returned its result.
   *                  We emit `tool.done` SSE for specialist tools.
   *                  This is also when we emit `activity.resolved` for
   *                  resolution tools (the output confirms the call completed).
   *
   *   message_output_created — The model produced a complete message.
   *                  We use its content as the authoritative final text,
   *                  replacing the delta-accumulated content (which should
   *                  be identical but the SDK's version is canonical).
   */
  private handleRunItemEvent(
    itemEvent: RunItemStreamEvent,
    state: StreamState,
    onChunk: (chunk: string) => void
  ): void {
    this.logItemEvent(itemEvent, state);

    if (itemEvent.name === 'tool_called' && itemEvent.item.type === 'tool_call_item') {
      this.handleToolCalled(itemEvent.item as RunToolCallItem, state, onChunk);
    }

    if (itemEvent.name === 'tool_output' && itemEvent.item.type === 'tool_call_output_item') {
      this.handleToolOutput(itemEvent.item as RunToolCallOutputItem, state, onChunk);
    }

    if (itemEvent.item.type === 'message_output_item') {
      this.logMessageOutputDetail(itemEvent, state);
    }

    if (itemEvent.name === 'message_output_created' && itemEvent.item.type === 'message_output_item') {
      // The SDK has assembled the complete message text from all the deltas.
      // Use it as the canonical content, but only if non-empty: after a
      // resolution tool call, the SDK sometimes makes a second model request
      // whose response is an empty string, and we don't want to erase the
      // real text that was already streamed to the client.
      const msgItem = itemEvent.item as RunMessageOutputItem;
      if (msgItem.content.length > 0) {
        state.fullContent = msgItem.content;
      }
    }

    // When a tool_output arrives and we previously captured a resolution
    // tool call, emit the `activity.resolved` SSE.  We wait for tool_output
    // rather than emitting on tool_called because the tool hasn't actually
    // executed yet at that point — tool_output confirms the call completed.
    if (itemEvent.name === 'tool_output' && state.localResolution && !state.resolvedEmitted) {
      this.emitResolved(state, onChunk);
    }
  }

  /** Log every item event at debug level. */
  private logItemEvent(itemEvent: RunItemStreamEvent, state: StreamState): void {
    const itemRecord = itemEvent.item as unknown as Record<string, unknown>;
    const itemAgentObj = itemRecord['agent'] as Record<string, unknown> | undefined;
    const sourceAgentObj = itemRecord['sourceAgent'] as Record<string, unknown> | undefined;
    const itemAgent =
      (itemAgentObj?.['name'] as string | undefined) ?? (sourceAgentObj?.['name'] as string | undefined) ?? 'unknown';
    this.log.debug(
      {
        conversationId: state.conversationId,
        eventName: itemEvent.name,
        itemType: itemEvent.item.type,
        agent: itemAgent,
        elapsedMs: Date.now() - state.startTime
      },
      `stream item event: ${itemEvent.name}`
    );
  }

  /**
   * Handle a `tool_called` item event.
   *
   * The coordinator agent has two kinds of tools:
   *
   *   **Specialist tools** (discovery_specialist, planning_specialist, staffing_specialist)
   *   are sub-agents wrapped as tools via `.asTool()`.  When the coordinator calls
   *   one, the SDK runs that agent internally.  We emit `tool.called` SSE so
   *   the frontend can show a progress indicator ("Consulting discovery expert...").
   *
   *   **Resolution tools** (resolve_discovery, resolve_planning, resolve_staffing)
   *   are FunctionTools that signal an activity is complete.  Their arguments
   *   contain the structured outcome (e.g. { fit: "qualified", signals_reviewed: 4 }).
   *   We capture those args here and emit `activity.resolved` later when the
   *   tool_output confirms execution.
   */
  private handleToolCalled(toolCallItem: RunToolCallItem, state: StreamState, onChunk: (chunk: string) => void): void {
    // Extract the tool name from the SDK's raw item representation.
    // The rawItem has the shape { name: string, arguments: string, ... }
    // where arguments is a JSON-encoded string of the tool's input params.
    const toolName = (toolCallItem as unknown as Record<string, unknown>)['rawItem'] as
      | Record<string, unknown>
      | undefined;
    const name = toolName?.['name'] as string | undefined;

    // Specialist tool → emit `tool.called` SSE so the frontend can show
    // a progress indicator (e.g. "Consulting discovery expert...").
    if (name && SPECIALIST_TOOLS.has(name) && !state.activeSpecialistTool && state.emitLifecycleEvents) {
      const toolCalledEvent: SSEToolCalledEvent = { toolName: name };
      onChunk(formatSSE('tool.called', toolCalledEvent));
      this.log.debug(
        {
          conversationId: state.conversationId,
          toolName: name,
          elapsedMs: Date.now() - state.startTime
        },
        'Specialist tool called (stream)'
      );
    }

    // Resolution tool -> capture the structured arguments (e.g. { fit, signals_reviewed })
    // so we can emit `activity.resolved` later when tool_output confirms execution.
    if (name && RESOLUTION_TOOLS.has(name)) {
      const argsStr = toolName?.['arguments'] as string | undefined;
      if (argsStr) {
        try {
          const parsedArgs = JSON.parse(argsStr) as Record<string, unknown>;
          state.localResolution = { tool: name, result: parsedArgs };
        } catch {
          this.log.warn(
            { conversationId: state.conversationId, toolName: name, arguments: argsStr },
            'Failed to parse resolution tool arguments from stream event'
          );
        }
      }
    }
  }

  /**
   * Handle `tool_output` — emit `tool.done` SSE for specialist tools.
   *
   * This is the counterpart to `handleToolCalled`.  When a specialist sub-agent
   * finishes, the SDK emits a `tool_output` event.  We send `tool.done` SSE so
   * the frontend can dismiss the "Consulting discovery expert..." indicator.
   *
   * Note: resolution tool outputs are handled separately — the `activity.resolved`
   * emission is triggered in `handleRunItemEvent` after this method returns.
   */
  private handleToolOutput(
    toolOutputItem: RunToolCallOutputItem,
    state: StreamState,
    onChunk: (chunk: string) => void
  ): void {
    const toolRaw = (toolOutputItem as unknown as Record<string, unknown>)['rawItem'] as
      | Record<string, unknown>
      | undefined;
    const name = toolRaw?.['name'] as string | undefined;
    if (name && SPECIALIST_TOOLS.has(name) && !state.activeSpecialistTool && state.emitLifecycleEvents) {
      const toolDoneEvent: SSEToolDoneEvent = { toolName: name };
      onChunk(formatSSE('tool.done', toolDoneEvent));
      this.log.debug(
        {
          conversationId: state.conversationId,
          toolName: name,
          elapsedMs: Date.now() - state.startTime
        },
        'Specialist tool done (stream)'
      );
    }
  }

  /** Trace-log detailed info for message_output_item events. */
  private logMessageOutputDetail(itemEvent: RunItemStreamEvent, state: StreamState): void {
    const msgItem = itemEvent.item as RunMessageOutputItem;
    const rawItem = (msgItem as unknown as Record<string, unknown>)['rawItem'] as Record<string, unknown> | undefined;
    const rawContent = rawItem?.['content'] as unknown[] | undefined;
    this.log.trace(
      {
        conversationId: state.conversationId,
        eventName: itemEvent.name,
        contentGetterLength: msgItem.content.length,
        contentGetter: msgItem.content.substring(0, 500),
        rawContentParts: Array.isArray(rawContent)
          ? rawContent.map((p: unknown) => {
              const part = p as Record<string, unknown>;
              return {
                type: part['type'],
                textLength: typeof part['text'] === 'string' ? (part['text'] as string).length : undefined,
                text: typeof part['text'] === 'string' ? (part['text'] as string).substring(0, 200) : undefined
              };
            })
          : rawContent,
        rawContentLength: Array.isArray(rawContent) ? rawContent.length : 0
      },
      'stream item detail: message_output_item'
    );
  }

  /** Emit `activity.resolved` SSE and mark as emitted. */
  private emitResolved(state: StreamState, onChunk: (chunk: string) => void): void {
    if (!state.localResolution) return;
    const resolvedEvent: SSEResolvedEvent = {
      tool: state.localResolution.tool,
      result: state.localResolution.result
    };
    onChunk(formatSSE('activity.resolved', resolvedEvent));
    state.resolvedEmitted = true;
    this.log.info(
      {
        conversationId: state.conversationId,
        tool: state.localResolution.tool,
        outcome: state.localResolution.result
      },
      'Resolution tool called (stream)'
    );
  }

  /**
   * Post-completion fallback for resolution emission.
   *
   * Normally `activity.resolved` is emitted when the `tool_output` event
   * arrives in `handleRunItemEvent`.  But if the SDK skips the `tool_output`
   * event (observed in some SDK versions), we still have the captured
   * resolution from `handleToolCalled` — emit it now so the frontend
   * always gets notified.
   */
  private finaliseStreamResolution(state: StreamState, onChunk: (chunk: string) => void): void {
    if (state.localResolution && !state.resolvedEmitted) {
      const resolvedEvent: SSEResolvedEvent = {
        tool: state.localResolution.tool,
        result: state.localResolution.result
      };
      onChunk(formatSSE('activity.resolved', resolvedEvent));
      state.resolvedEmitted = true;
      this.log.info(
        {
          conversationId: state.conversationId,
          tool: state.localResolution.tool,
          outcome: state.localResolution.result
        },
        'Resolution tool called (stream, post-completion)'
      );
    }
  }

  /**
   * Extract token usage from the completed stream result into state.
   *
   * Usage counters are only populated after the stream fully completes
   * (after `await streamResult.completed`), which is why this is called
   * post-stream rather than during event processing.
   */
  private extractStreamUsage(
    state: StreamState,
    streamResult: {
      state: { usage: { totalTokens: number; inputTokens: number; outputTokens: number } };
    }
  ): void {
    const resultUsage = streamResult.state.usage;
    if (resultUsage && resultUsage.totalTokens > 0) {
      state.usage = {
        promptTokens: resultUsage.inputTokens,
        completionTokens: resultUsage.outputTokens
      };
    }
  }

  /**
   * Final step of a successful stream: emit `message.complete` SSE and persist
   * the assistant message to the conversation record.
   *
   * The `message.complete` event contains the full assembled text (from
   * `state.fullContent`) and token usage, giving the frontend a single
   * authoritative payload to replace the delta-accumulated preview.
   */
  private emitCompleteAndRecord(
    state: StreamState,
    record: ConversationRecord,
    onChunk: (chunk: string) => void
  ): void {
    const durationMs = Date.now() - state.startTime;
    const resolution: ActivityResolution | undefined = state.localResolution
      ? { tool: state.localResolution.tool, result: state.localResolution.result }
      : undefined;

    if (state.activeSpecialistTool && state.emitLifecycleEvents) {
      const toolDoneEvent: SSEToolDoneEvent = { toolName: state.activeSpecialistTool };
      onChunk(formatSSE('tool.done', toolDoneEvent));
    }

    const completeEvent: SSECompleteEvent = {
      messageId: ConversationStore.messageId(),
      content: state.fullContent,
      ...(state.usage ? { usage: state.usage } : {})
    };
    onChunk(formatSSE('message.complete', completeEvent));

    this.log.info(
      {
        conversationId: state.conversationId,
        durationMs,
        responseLength: state.fullContent.length,
        hasResolution: !!resolution
      },
      'sendMessageStream completed'
    );
    this.log.trace(
      { conversationId: state.conversationId, responseText: state.fullContent },
      'sendMessageStream response content'
    );

    const assistantMsg: Message = {
      id: completeEvent.messageId,
      role: 'assistant',
      content: state.fullContent,
      createdAt: new Date().toISOString(),
      ...(state.usage ? { usage: state.usage } : {}),
      ...(resolution ? { resolution } : {})
    };
    record.messages.push(assistantMsg);
  }

  // ---- Health ----

  async checkHealth(): Promise<HealthResponse> {
    try {
      this.ensureReady();

      // For the Responses API, we verify the client is configured
      // and the agent is created. A lightweight run isn't practical
      // without incurring token costs, so we just verify setup.
      const start = Date.now();
      // Verify coordinator agent exists and is configured
      const specialists = this.specialistAgents;
      if (!specialists) throw new Error('Agent not configured');
      const latencyMs = Date.now() - start;

      return {
        status: 'healthy',
        checks: [{ name: 'azure-openai', status: 'healthy', latencyMs }]
      };
    } catch {
      return {
        status: 'degraded',
        checks: [{ name: 'azure-openai', status: 'unhealthy' }]
      };
    }
  }
}
