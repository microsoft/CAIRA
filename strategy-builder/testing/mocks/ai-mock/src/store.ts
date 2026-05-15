/**
 * In-memory store for the unified AI mock server.
 *
 * Combines three API surfaces:
 * 1. Agent CRUD — create/get/update/delete/list agents by name (Foundry)
 * 2. Responses API — stateless POST /responses (shared by both variants)
 * 3. Conversations API — server-side conversation state for the Foundry variant
 *
 * Fully deterministic — IDs are generated from a counter, timestamps use a
 * fixed epoch. The Responses API logic includes multi-agent routing, specialist
 * text responses, chain walking, and call_id-based fallback matching.
 */

import type {
  Agent,
  AgentListResponse,
  AgentVersion,
  Conversation,
  ConversationDeleted,
  ConversationItem,
  ConversationParam,
  CreateResponseRequest,
  FunctionCallOutputInputItem,
  FunctionCallOutputItem,
  InputItem,
  OutputItem,
  PromptAgentDefinition,
  Response,
  ResponseStatus,
  TextOutputItem,
  ToolDefinition,
  UserInputContent
} from './types.ts';

/** Fixed epoch for deterministic timestamps (2026-01-01T00:00:00Z) */
const EPOCH = 1767225600;

let idCounter = 0;

/** Generate a deterministic ID with a prefix */
function nextId(prefix: string): string {
  idCounter++;
  return `${prefix}_${String(idCounter).padStart(8, '0')}`;
}

/** Reset the store (for testing) */
export function resetStore(): void {
  idCounter = 0;
  agents.clear();
  responses.clear();
  specialistTextResponses.clear();
  responseSpecialistMap.clear();
  conversations.clear();
  conversationItems.clear();
}

// ============================================================
// Agent CRUD storage (Foundry Agent Service)
// ============================================================

const agents = new Map<string, Agent>();

// ============================================================
// Conversations API storage
// ============================================================

const conversations = new Map<string, Conversation>();
const conversationItems = new Map<string, ConversationItem[]>();

export function createAgent(name: string, definition: PromptAgentDefinition): Agent {
  const version: AgentVersion = {
    model: definition.model,
    instructions: definition.instructions ?? '',
    tools: definition.tools ?? []
  };

  const agent: Agent = {
    object: 'agent',
    id: nextId('agent'),
    name,
    versions: { latest: version },
    created_at: EPOCH + idCounter
  };

  agents.set(name, agent);
  return agent;
}

export function getAgent(name: string): Agent | undefined {
  return agents.get(name);
}

export function updateAgent(name: string, definition: PromptAgentDefinition): Agent | undefined {
  const existing = agents.get(name);
  if (!existing) return undefined;

  const version: AgentVersion = {
    model: definition.model,
    instructions: definition.instructions ?? existing.versions.latest.instructions,
    tools: definition.tools ?? existing.versions.latest.tools
  };

  existing.versions.latest = version;
  return existing;
}

export function deleteAgent(name: string): boolean {
  return agents.delete(name);
}

export function listAgents(): AgentListResponse {
  const data = [...agents.values()];
  return {
    object: 'list',
    data,
    has_more: false
  };
}

// ============================================================
// Conversations API CRUD
// ============================================================

export function createConversation(metadata?: Record<string, string> | null): Conversation {
  const conv: Conversation = {
    id: nextId('conv'),
    object: 'conversation',
    created_at: EPOCH + idCounter,
    metadata: metadata ?? null
  };
  conversations.set(conv.id, conv);
  conversationItems.set(conv.id, []);
  return conv;
}

export function getConversation(id: string): Conversation | undefined {
  return conversations.get(id);
}

export function deleteConversation(id: string): ConversationDeleted | undefined {
  const conv = conversations.get(id);
  if (!conv) return undefined;
  conversations.delete(id);
  conversationItems.delete(id);
  return { id, object: 'conversation.deleted', deleted: true };
}

/**
 * Get the accumulated items for a conversation.
 * These are prepended to the input when responses.create() is called
 * with a conversation parameter.
 */
export function getConversationItems(conversationId: string): ConversationItem[] {
  return conversationItems.get(conversationId) ?? [];
}

/**
 * Append items to a conversation. Called after a response is created
 * with a conversation parameter — both the input items and the output
 * items are stored in the conversation.
 */
function appendConversationItems(conversationId: string, items: ConversationItem[]): void {
  const existing = conversationItems.get(conversationId);
  if (existing) {
    existing.push(...items);
  }
}

// ============================================================
// Responses API storage
// ============================================================

const responses = new Map<string, Response>();

/**
 * Tracks response IDs where a specialist agent (with resolution tools) returned
 * a text response instead of calling the resolution tool. This lets us distinguish
 * the first specialist interaction (after handoff → return text) from subsequent
 * interactions (message → call resolution tool).
 *
 * Without this state, the stateless Responses API mock can't differentiate between
 * "handoff just completed, return conversational text" and "user sent another
 * message, time to resolve the activity." A real LLM would have this context
 * from the conversation history.
 */
const specialistTextResponses = new Set<string>();

/**
 * Maps response IDs to the specialist transfer tool that was selected for them.
 * When a response contains a `transfer_to_*` function call, we record
 * `responseId → toolName` (e.g., `"resp_001" → "transfer_to_Staffing"`).
 *
 * This solves the problem where the @openai/agents SDK doesn't chain
 * `previous_response_id` within the first `run()` call. Without this cache,
 * the second `run()` (message) can't find the original transfer call by walking
 * the `previous_response_id` chain, so it falls back to keyword matching —
 * which fails for messages like "I can support adoption planning" (no staffing keywords).
 *
 * On subsequent requests, `selectTransferTool()` walks the chain and checks
 * this map first, falling back to keywords only for truly new conversations.
 */
const responseSpecialistMap = new Map<string, string>();

/**
 * Walk the previous_response_id chain to check if any ancestor response
 * is in specialistTextResponses. This handles the case where a triage
 * re-handoff creates a new response ID between the specialist's text
 * response and the current request.
 *
 * Example chain: specialist-text-resp → triage-handoff-resp → current-req
 * Direct lookup would only check triage-handoff-resp (miss). Chain walking
 * finds specialist-text-resp (hit).
 */
function hasSpecialistTextAncestor(previousResponseId: string | null | undefined): boolean {
  let currentId = previousResponseId ?? null;
  // Limit depth to prevent infinite loops (should never be more than ~10 deep)
  const maxDepth = 20;
  let depth = 0;
  while (currentId !== null && depth < maxDepth) {
    if (specialistTextResponses.has(currentId)) {
      return true;
    }
    const resp = responses.get(currentId);
    if (!resp) break;
    currentId = resp.previous_response_id ?? null;
    depth++;
  }
  return false;
}

// ---------- Response creation helpers ----------

/** Resolve UserInputContent (string or content-parts array) to a plain string */
function resolveContent(content: UserInputContent): string {
  if (typeof content === 'string') return content;
  // Array of { type: 'input_text', text: '...' } parts
  return content.map((part) => part.text).join('');
}

/** Extract user text from the request input (string or InputItem[]) */
function extractUserText(input: string | InputItem[]): string {
  if (typeof input === 'string') return input;

  // Match items with role: 'user' — regardless of whether `type` is present.
  // The SDK's getInputItems() sends { role: 'user', content: 'Hello' } (no type),
  // while the SDK's user() helper sends { type: 'message', role: 'user', content: [...] }.
  const userItems = input.filter(
    (item): item is Extract<InputItem, { role: 'user' }> => 'role' in item && item.role === 'user'
  );
  const lastUser = userItems[userItems.length - 1];
  if (!lastUser) return '';
  return resolveContent(lastUser.content);
}

/** Check if the input contains function_call_output items */
function hasFunctionCallOutputs(input: string | InputItem[]): boolean {
  if (typeof input === 'string') return false;
  return input.some((item) => 'type' in item && item.type === 'function_call_output');
}

/** Get function call outputs from input */
function getFunctionCallOutputs(input: InputItem[]): FunctionCallOutputInputItem[] {
  return input.filter(
    (item): item is FunctionCallOutputInputItem => 'type' in item && item.type === 'function_call_output'
  );
}

/**
 * Find the specialist that was called by matching `call_id` from
 * `function_call_output` input items against stored responses.
 *
 * When the SDK doesn't chain `previous_response_id` within a single `run()`
 * call (which happens when the initial `run()` has no `previousResponseId`),
 * we can't walk the response chain. Instead, we match the `call_id` from
 * the tool output back to the stored response that issued the function call.
 */
function findSpecialistByCallId(input: InputItem[]): string | undefined {
  const toolOutputs = getFunctionCallOutputs(input);
  for (const toolOutput of toolOutputs) {
    // Search all stored responses for a function call with this call_id
    for (const resp of responses.values()) {
      for (const item of resp.output) {
        if (
          item.type === 'function_call' &&
          item.call_id === toolOutput.call_id &&
          (item.name.startsWith('transfer_to_') || item.name.endsWith('_specialist'))
        ) {
          return item.name;
        }
      }
    }
  }
  return undefined;
}

/** Deterministic response text based on input */
function generateResponseText(userText: string): string {
  return `I received your message: "${userText}". How can I help further?`;
}

// ---------- Multi-agent mock helpers ----------

/** Keywords used to route to specialist agents via transfer/specialist tools */
const TRANSFER_KEYWORDS: Record<string, string[]> = {
  // OpenAI Agent SDK naming convention (transfer_to_*)
  transfer_to_Discovery: ['discovery', 'qualify', 'opportunity', 'signal', 'customer', 'pipeline'],
  transfer_to_Planning: ['planning', 'account', 'priority', 'risk', 'workstream', 'milestone'],
  transfer_to_Staffing: ['staffing', 'team', 'coverage', 'interview', 'recruit', 'role'],
  // Foundry Agent Service naming convention (*_specialist)
  discovery_specialist: ['discovery', 'qualify', 'opportunity', 'signal', 'customer', 'pipeline'],
  planning_specialist: ['planning', 'account', 'priority', 'risk', 'workstream', 'milestone'],
  staffing_specialist: ['staffing', 'team', 'coverage', 'interview', 'recruit', 'role']
};

/** Mock arguments for resolution tools (deterministic test data) */
const RESOLUTION_MOCK_ARGS: Record<string, Record<string, unknown>> = {
  resolve_discovery: {
    fit: 'qualified',
    signals_reviewed: 4,
    primary_need: 'Executive visibility into account risk.'
  },
  resolve_planning: {
    approved: true,
    focus_area: 'Executive sponsor alignment',
    next_step: 'Confirm stakeholder review'
  },
  resolve_staffing: {
    coverage_level: 'core',
    role: 'customer_success_partner',
    team_name: 'Northwind Account Team'
  }
};

/** Check if any tool in the list is a transfer_to_* or *_specialist routing tool */
function hasTransferTools(tools: ToolDefinition[]): boolean {
  return tools.some((t) => t.name.startsWith('transfer_to_') || t.name.endsWith('_specialist'));
}

/** Check if any tool in the list is a resolve_* resolution tool */
function hasResolutionTools(tools: ToolDefinition[]): boolean {
  return tools.some((t) => t.name.startsWith('resolve_'));
}

/** Get the transfer/specialist tool names from the tools list */
function getTransferToolNames(tools: ToolDefinition[]): string[] {
  return tools.filter((t) => t.name.startsWith('transfer_to_') || t.name.endsWith('_specialist')).map((t) => t.name);
}

/** Get the resolution tool names from the tools list */
function getResolutionToolNames(tools: ToolDefinition[]): string[] {
  return tools.filter((t) => t.name.startsWith('resolve_')).map((t) => t.name);
}

/**
 * Derive the resolution tool name from a transfer/specialist tool name.
 * e.g. transfer_to_Planning → resolve_planning
 *      planning_specialist  → resolve_planning
 */
function transferToResolution(transferName: string): string {
  if (transferName.endsWith('_specialist')) {
    const suffix = transferName.replace('_specialist', '');
    return `resolve_${suffix}`;
  }
  const suffix = transferName.replace('transfer_to_', '');
  return `resolve_${suffix.toLowerCase()}`;
}

/**
 * Find the active specialist's resolution tool by walking the responseSpecialistMap chain.
 * Returns the matching resolution tool name from `resolutionTools`, or undefined if not found.
 */
function findActiveResolutionTool(
  previousResponseId: string | null | undefined,
  resolutionTools: string[]
): string | undefined {
  let currentId = previousResponseId ?? null;
  const maxDepth = 20;
  let depth = 0;
  while (currentId !== null && depth < maxDepth) {
    const cachedTransfer = responseSpecialistMap.get(currentId);
    if (cachedTransfer) {
      const expected = transferToResolution(cachedTransfer);
      if (resolutionTools.includes(expected)) {
        return expected;
      }
    }
    const resp = responses.get(currentId);
    if (!resp) break;
    currentId = resp.previous_response_id ?? null;
    depth++;
  }
  return undefined;
}

/**
 * Select the right transfer_to_* tool based on user text keywords.
 * If a previous response in the conversation chain already selected a
 * transfer tool, reuse the same specialist so follow-up messages don't
 * get misrouted when they lack the original keywords.
 * Falls back to the first transfer tool if no keyword or chain match.
 */
function selectTransferTool(
  userText: string,
  transferTools: string[],
  previousResponseId: string | null | undefined
): string {
  // First: check if a previous response in this chain already selected a transfer tool.
  // This ensures follow-up messages route to the same specialist even when the
  // user's message doesn't contain the original delegation keywords.
  //
  // We check TWO sources:
  // 1. The response's output items (for transfer_to_* function calls)
  // 2. The responseSpecialistMap cache (for cases where the SDK didn't chain
  //    previous_response_id within the first run() call)
  let currentId = previousResponseId ?? null;
  const maxDepth = 20;
  let depth = 0;
  while (currentId !== null && depth < maxDepth) {
    // Check the responseSpecialistMap cache first
    const cachedTool = responseSpecialistMap.get(currentId);
    if (cachedTool && transferTools.includes(cachedTool)) {
      return cachedTool;
    }

    const resp = responses.get(currentId);
    if (!resp) break;
    // Check if this response output a transfer_to_* function call
    for (const item of resp.output) {
      if (
        item.type === 'function_call' &&
        (item.name.startsWith('transfer_to_') || item.name.endsWith('_specialist'))
      ) {
        // Found a previous transfer — reuse the same specialist if available
        if (transferTools.includes(item.name)) {
          return item.name;
        }
      }
    }
    currentId = resp.previous_response_id ?? null;
    depth++;
  }

  // No chain match — select by keywords
  const lower = userText.toLowerCase();
  for (const toolName of transferTools) {
    const keywords = TRANSFER_KEYWORDS[toolName];
    if (keywords && keywords.some((kw) => lower.includes(kw))) {
      return toolName;
    }
  }
  // Default to first transfer tool
  const firstTool = transferTools[0];
  if (!firstTool) throw new Error('No transfer tools available');
  return firstTool;
}

/**
 * Build arguments for a transfer/specialist tool call by inspecting the
 * tool's parameter schema. Different SDKs define agent-as-tool parameters
 * differently:
 *   - OpenAI Agents SDK (TS): { input: string }
 *   - MAF AsAIFunction() (C#): { query: string }
 *
 * This function finds the tool definition, extracts the first string property
 * name from its JSON Schema parameters, and uses that as the argument key.
 * Falls back to { input: userText } if the schema can't be parsed.
 */
function buildTransferToolArgs(toolName: string, tools: ToolDefinition[], userText: string): Record<string, string> {
  const toolDef = tools.find((t) => t.name === toolName);
  if (toolDef?.parameters) {
    const schema = toolDef.parameters as {
      properties?: Record<string, { type?: string }>;
    };
    if (schema.properties) {
      const firstPropName = Object.keys(schema.properties)[0];
      if (firstPropName) {
        return { [firstPropName]: userText || 'mock query' };
      }
    }
  }
  // Fallback: use "input" (the OpenAI Agents SDK default)
  return { input: userText || 'mock query' };
}

/** Generate a function call output item (used when tools are provided) */
function generateFunctionCall(tools: ToolDefinition[]): FunctionCallOutputItem | null {
  const firstTool = tools[0];
  if (!firstTool) return null;

  return {
    type: 'function_call',
    id: nextId('fc'),
    call_id: nextId('call'),
    name: firstTool.name,
    arguments: JSON.stringify({ query: 'mock query' }),
    status: 'completed'
  };
}

/**
 * Generate a function call for a specific tool by name with appropriate mock args.
 */
function generateNamedFunctionCall(toolName: string): FunctionCallOutputItem {
  const args = RESOLUTION_MOCK_ARGS[toolName] ?? { query: 'mock query' };
  return {
    type: 'function_call',
    id: nextId('fc'),
    call_id: nextId('call'),
    name: toolName,
    arguments: JSON.stringify(args),
    status: 'completed'
  };
}

/**
 * Generate conversational opening text for a specialist agent.
 * This simulates the specialist's first response after a handoff —
 * an opening prompt/description/question rather than immediately resolving.
 */
function generateSpecialistText(
  tools: ToolDefinition[],
  previousResponseId: string | null | undefined,
  input: string | InputItem[]
): string {
  const resolutionTools = getResolutionToolNames(tools);
  // Try the response chain first, then fall back to call_id matching (needed
  // when the SDK doesn't chain previous_response_id within a single run() call),
  // and finally fall back to the first resolution tool.
  let toolName = findActiveResolutionTool(previousResponseId, resolutionTools);
  if (!toolName && Array.isArray(input)) {
    const specialist = findSpecialistByCallId(input);
    if (specialist) {
      toolName = transferToResolution(specialist);
      if (!resolutionTools.includes(toolName)) toolName = undefined;
    }
  }
  toolName = toolName ?? resolutionTools[0] ?? '';
  if (toolName === 'resolve_discovery') {
    return 'Hello! Let me start with a quick example: "When every team shares the same roadmap, execution gets easier." Your turn.';
  }
  if (toolName === 'resolve_planning') {
    return 'Welcome to the planning review. I see two launch options for the account plan. Should we start with the regional rollout or the platform workstream?';
  }
  if (toolName === 'resolve_staffing') {
    return 'Let us work through staffing. What skills do you bring to the team, and which responsibilities are you ready to own?';
  }
  return 'Let us begin this workflow.';
}

// ---------- Conversation-aware response helpers ----------

/** Resolve a conversation parameter to just the ID string */
function resolveConversationId(conversation: string | ConversationParam | undefined | null): string | undefined {
  if (!conversation) return undefined;
  if (typeof conversation === 'string') return conversation;
  return conversation.id;
}

/**
 * Get the last response ID stored in a conversation.
 * This is used as an effective previous_response_id for chain-walking
 * when the request uses conversation mode instead of explicit chaining.
 */
function getLastResponseIdForConversation(conversationId: string | undefined): string | undefined {
  if (!conversationId) return undefined;
  const items = conversationItems.get(conversationId);
  if (!items || items.length === 0) return undefined;
  // Walk backwards to find the last response output item that has an ID
  // (stored as __responseId by appendConversationItems)
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item && '__responseId' in item) {
      return item.__responseId as string;
    }
  }
  return undefined;
}

/**
 * Merge conversation history with the current request input.
 * When using conversations, the request input may be just tool outputs
 * from the current turn — the conversation items provide the full context.
 * For the mock's routing logic, we need to ensure that user text and tool
 * outputs from earlier turns are visible.
 */
function mergeConversationInput(conversationId: string, requestInput: string | InputItem[]): string | InputItem[] {
  const items = conversationItems.get(conversationId);
  if (!items || items.length === 0) return requestInput;

  // If the request input is a string, it's the user's message — the mock
  // routing logic only needs the current user text plus the conversation
  // context for chain-walking (handled via effectivePreviousResponseId).
  if (typeof requestInput === 'string') return requestInput;

  // If the request input is tool outputs only (no user message), we need
  // to check conversation items for user messages that provide routing context.
  // But the mock logic already handles this via chain-walking, so just return
  // the request input as-is. The effectivePreviousResponseId handles routing.
  return requestInput;
}

export function createResponse(body: CreateResponseRequest): Response {
  // ---- Resolve conversation parameter ----
  // When a conversation is provided, we use the conversation's accumulated
  // items as context. The conversation also tracks the last response ID
  // so chain-walking for specialist routing still works.
  const conversationId = resolveConversationId(body.conversation);
  const effectivePreviousResponseId = body.previous_response_id ?? getLastResponseIdForConversation(conversationId);

  // When conversation is provided, merge conversation items with the request input
  // so the mock can see the full history (for tool output detection, etc.)
  const effectiveInput = conversationId ? mergeConversationInput(conversationId, body.input) : body.input;

  const userText = extractUserText(effectiveInput);
  const hasToolOutputs = hasFunctionCallOutputs(effectiveInput);

  let output: OutputItem[];
  let outputText: string;
  const status: ResponseStatus = 'completed';

  if (body.tools && body.tools.length > 0 && !hasToolOutputs) {
    // ---- Turn 1 (no tool outputs yet) ----

    if (hasTransferTools(body.tools)) {
      // Multi-agent: select the right transfer_to_* tool based on user text
      const transferTools = getTransferToolNames(body.tools);
      const selectedTool = selectTransferTool(userText, transferTools, effectivePreviousResponseId);
      const fnCall = generateNamedFunctionCall(selectedTool);
      // Build arguments matching the tool's parameter schema so that both
      // the OpenAI Agents SDK (expects "input") and MAF AsAIFunction()
      // (expects "query") receive the required parameter.
      const toolArgs = buildTransferToolArgs(selectedTool, body.tools, userText);
      fnCall.arguments = JSON.stringify(toolArgs);
      output = [fnCall];
      outputText = '';
    } else {
      // Single-agent with tools: call the first tool (existing behavior)
      const fnCall = generateFunctionCall(body.tools);
      if (fnCall) {
        output = [fnCall];
        outputText = '';
      } else {
        outputText = generateResponseText(userText);
        const textItem: TextOutputItem = {
          type: 'message',
          id: nextId('msg'),
          role: 'assistant',
          status: 'completed',
          content: [{ type: 'output_text', text: outputText }]
        };
        output = [textItem];
      }
    }
  } else if (hasToolOutputs && Array.isArray(effectiveInput)) {
    // ---- Turn 2+ (tool outputs present) ----

    // Check if any function_call_output is a resolution tool result.
    // Resolution tool handlers return strings containing "resolved" (e.g.,
    // "Discovery flow resolved: qualified after 4 signals."). If we already
    // submitted a resolution result, respond with text — don't call the
    // resolution tool again (which would create an infinite loop).
    const toolOutputs = getFunctionCallOutputs(effectiveInput);
    const hasResolutionOutput = toolOutputs.some(
      (t) => typeof t.output === 'string' && t.output.toLowerCase().includes('resolved')
    );

    if (body.tools && hasResolutionTools(body.tools) && !hasResolutionOutput) {
      // Specialist agent has resolution tools. Determine whether to return
      // conversational text (first interaction after handoff) or call the
      // resolution tool (subsequent message turn).
      //
      // A real LLM wouldn't call the resolution tool immediately after a
      // handoff — it would start the activity with conversational text (e.g.,
      // the opening discovery prompt) and only resolve after multiple turns.
      //
      // We track this via specialistTextResponses: if the previous response
      // in this conversation chain already returned specialist text, the next
      // interaction should trigger resolution.
      const prevId = effectivePreviousResponseId ?? null;
      const alreadyHadTextTurn = prevId !== null && hasSpecialistTextAncestor(prevId);

      if (alreadyHadTextTurn) {
        // Subsequent specialist turn: call the resolution tool
        const resolutionTools = getResolutionToolNames(body.tools);
        let resolutionTool = findActiveResolutionTool(effectivePreviousResponseId, resolutionTools);
        // Fallback: match call_id from function_call_output to find the specialist
        if (!resolutionTool && Array.isArray(effectiveInput)) {
          const specialist = findSpecialistByCallId(effectiveInput);
          if (specialist) {
            const candidate = transferToResolution(specialist);
            if (resolutionTools.includes(candidate)) resolutionTool = candidate;
          }
        }
        resolutionTool = resolutionTool ?? resolutionTools[0];
        if (!resolutionTool) throw new Error('No resolution tool found');
        const fnCall = generateNamedFunctionCall(resolutionTool);
        output = [fnCall];
        outputText = '';
      } else {
        // First specialist turn (post-handoff): return conversational text
        outputText = generateSpecialistText(body.tools, effectivePreviousResponseId, effectiveInput);
        const textItem: TextOutputItem = {
          type: 'message',
          id: nextId('msg'),
          role: 'assistant',
          status: 'completed',
          content: [{ type: 'output_text', text: outputText }]
        };
        output = [textItem];
        // Mark: the response we're about to create will be tracked so the
        // next call in this chain triggers resolution. We'll record the
        // response ID after creation below.
      }
    } else {
      // Standard tool output processing: generate text response
      const toolOutputs = getFunctionCallOutputs(effectiveInput as InputItem[]);
      const toolText = toolOutputs.map((t) => t.output).join('; ');
      outputText = `Based on tool results: ${toolText}`;

      const textItem: TextOutputItem = {
        type: 'message',
        id: nextId('msg'),
        role: 'assistant',
        status: 'completed',
        content: [{ type: 'output_text', text: outputText }]
      };
      output = [textItem];
    }
  } else {
    // Simple text response (no tools)
    outputText = generateResponseText(userText);
    const textItem: TextOutputItem = {
      type: 'message',
      id: nextId('msg'),
      role: 'assistant',
      status: 'completed',
      content: [{ type: 'output_text', text: outputText }]
    };
    output = [textItem];
  }

  const response: Response = {
    id: nextId('resp'),
    object: 'response',
    status,
    model: body.model ?? 'gpt-5.2-chat',
    output,
    output_text: outputText,
    usage: {
      input_tokens: 50,
      output_tokens: 30,
      total_tokens: 80
    },
    created_at: EPOCH + idCounter,
    error: null,
    metadata: body.metadata ?? {},
    previous_response_id: effectivePreviousResponseId ?? null
  };

  responses.set(response.id, response);

  // Track which specialist was selected for this response. When a response
  // contains a transfer_to_* or *_specialist function call, record `responseId → toolName`.
  // This allows subsequent message requests to find the specialist even when
  // the SDK doesn't chain previous_response_id within the first run() call.
  for (const item of response.output) {
    if (item.type === 'function_call' && (item.name.startsWith('transfer_to_') || item.name.endsWith('_specialist'))) {
      responseSpecialistMap.set(response.id, item.name);
      break;
    }
  }

  // Also propagate the specialist mapping to this response if its ancestor
  // had one. This handles the case where the specialist text response doesn't
  // directly reference the transfer response (broken chain), but a later
  // response in the chain does reference this specialist text response.
  if (!responseSpecialistMap.has(response.id) && effectivePreviousResponseId) {
    let ancestorId: string | null = effectivePreviousResponseId;
    const maxLookup = 20;
    let lookupDepth = 0;
    while (ancestorId && lookupDepth < maxLookup) {
      const cached = responseSpecialistMap.get(ancestorId);
      if (cached) {
        responseSpecialistMap.set(response.id, cached);
        break;
      }
      const ancestor = responses.get(ancestorId);
      if (!ancestor) break;
      ancestorId = ancestor.previous_response_id ?? null;
      lookupDepth++;
    }
  }

  // If this response was a specialist's first text turn (not a resolution tool
  // call, not a handoff, but text from an agent with resolution tools), record
  // the response ID so the next call in this chain triggers resolution.
  // Also map it in responseSpecialistMap so that message requests can find the
  // specialist even when previous_response_id chain is broken (SDK bug).
  if (
    body.tools &&
    hasResolutionTools(body.tools) &&
    response.output.length > 0 &&
    response.output[0]?.type === 'message'
  ) {
    specialistTextResponses.add(response.id);
    // If the ancestor chain already has a specialist mapping, propagate it
    // to this text response so later calls in the chain can find it.
    // Otherwise, try call_id matching (for broken chains), then fall back
    // to deriving the transfer tool name from the first resolution tool.
    const resolutionTools = getResolutionToolNames(body.tools);
    let activeRes = findActiveResolutionTool(effectivePreviousResponseId, resolutionTools);
    // Fallback: match call_id from function_call_output to find the specialist
    if (!activeRes && Array.isArray(effectiveInput)) {
      const specialist = findSpecialistByCallId(effectiveInput);
      if (specialist) {
        const candidate = transferToResolution(specialist);
        if (resolutionTools.includes(candidate)) activeRes = candidate;
      }
    }
    const resTool = activeRes ?? resolutionTools[0];
    if (resTool) {
      // Derive the routing tool name from the resolution tool name.
      // Use the same naming convention as the tools in this request:
      // *_specialist tools → discovery_specialist, transfer_to_* → transfer_to_Discovery
      const suffix = resTool.replace('resolve_', '');
      const hasSpecialistTools = body.tools?.some((t) => t.name.endsWith('_specialist'));
      const transferName = hasSpecialistTools
        ? `${suffix}_specialist`
        : `transfer_to_${suffix.charAt(0).toUpperCase()}${suffix.slice(1)}`;
      responseSpecialistMap.set(response.id, transferName);
    }
  }

  // ---- Conversation item accumulation ----
  // When using conversation mode, store the input items and output items
  // in the conversation so subsequent requests see the full history.
  if (conversationId && conversations.has(conversationId)) {
    // Store input items (user messages and tool outputs)
    if (typeof body.input === 'string') {
      appendConversationItems(conversationId, [
        { type: 'message', role: 'user', content: body.input } as ConversationItem
      ]);
    } else if (Array.isArray(body.input)) {
      appendConversationItems(conversationId, body.input as ConversationItem[]);
    }

    // Store output items (assistant messages and function calls)
    // Tag the last output item with __responseId so we can find the
    // last response in the conversation for chain-walking purposes.
    const outputItems: ConversationItem[] = response.output.map((item) => ({
      ...item
    })) as ConversationItem[];
    if (outputItems.length > 0) {
      const lastItem = outputItems[outputItems.length - 1];
      if (lastItem) {
        (lastItem as Record<string, unknown>).__responseId = response.id;
      }
    }
    appendConversationItems(conversationId, outputItems);
  }

  return response;
}

export function getResponse(id: string): Response | undefined {
  return responses.get(id);
}

export function deleteResponse(id: string): boolean {
  return responses.delete(id);
}

// ---------- SSE streaming events ----------

export interface SSEEvent {
  event: string;
  data: unknown;
}

/**
 * Generate the SSE event stream for a response.
 *
 * IMPORTANT: The OpenAI SDK's Stream class parses `JSON.parse(sse.data)` and
 * uses the `type` property on the resulting object to determine the event kind.
 * The SSE `event:` field is NOT used for Responses API events. Every data
 * payload MUST include a `type` field matching the SSE event name.
 *
 * Each event also gets a monotonically increasing `sequence_number` — the SDK
 * expects this field to be present.
 */
export function getResponseStreamEvents(response: Response): SSEEvent[] {
  const events: SSEEvent[] = [];
  let seq = 0;

  // response.created
  events.push({
    event: 'response.created',
    data: {
      type: 'response.created',
      sequence_number: seq++,
      response: {
        ...response,
        status: 'in_progress' as ResponseStatus,
        output: [],
        output_text: ''
      }
    }
  });

  // response.in_progress
  events.push({
    event: 'response.in_progress',
    data: {
      type: 'response.in_progress',
      sequence_number: seq++,
      response: {
        ...response,
        status: 'in_progress' as ResponseStatus,
        output: [],
        output_text: ''
      }
    }
  });

  // Process each output item
  for (let i = 0; i < response.output.length; i++) {
    const item = response.output[i];
    if (!item) continue;

    // response.output_item.added
    events.push({
      event: 'response.output_item.added',
      data: { type: 'response.output_item.added', sequence_number: seq++, output_index: i, item }
    });

    if (item.type === 'message') {
      // response.content_part.added
      for (let c = 0; c < item.content.length; c++) {
        events.push({
          event: 'response.content_part.added',
          data: {
            type: 'response.content_part.added',
            sequence_number: seq++,
            output_index: i,
            content_index: c,
            part: { type: 'output_text', text: '' }
          }
        });
      }

      // Stream text content token by token
      for (let c = 0; c < item.content.length; c++) {
        const contentBlock = item.content[c];
        if (!contentBlock) continue;
        if (contentBlock.type === 'output_text') {
          const words = contentBlock.text.split(' ');
          for (let w = 0; w < words.length; w++) {
            const chunk = w === 0 ? (words[w] ?? '') : ` ${words[w] ?? ''}`;
            events.push({
              event: 'response.output_text.delta',
              data: {
                type: 'response.output_text.delta',
                sequence_number: seq++,
                output_index: i,
                content_index: c,
                delta: chunk
              }
            });
          }

          // response.output_text.done
          events.push({
            event: 'response.output_text.done',
            data: {
              type: 'response.output_text.done',
              sequence_number: seq++,
              output_index: i,
              content_index: c,
              text: contentBlock.text
            }
          });

          // response.content_part.done
          events.push({
            event: 'response.content_part.done',
            data: {
              type: 'response.content_part.done',
              sequence_number: seq++,
              output_index: i,
              content_index: c,
              part: { type: 'output_text', text: contentBlock.text }
            }
          });
        }
      }
    } else if (item.type === 'function_call') {
      // Stream function call arguments as deltas
      const args = item.arguments;
      events.push({
        event: 'response.function_call_arguments.delta',
        data: {
          type: 'response.function_call_arguments.delta',
          sequence_number: seq++,
          output_index: i,
          item_id: item.id,
          delta: args
        }
      });

      events.push({
        event: 'response.function_call_arguments.done',
        data: {
          type: 'response.function_call_arguments.done',
          sequence_number: seq++,
          output_index: i,
          item_id: item.id,
          arguments: args
        }
      });
    }

    // response.output_item.done
    events.push({
      event: 'response.output_item.done',
      data: { type: 'response.output_item.done', sequence_number: seq++, output_index: i, item }
    });
  }

  // response.completed
  events.push({
    event: 'response.completed',
    data: {
      type: 'response.completed',
      sequence_number: seq++,
      response
    }
  });

  return events;
}
