# API Contracts

The contracts define the REST interfaces between components. They live in the `contracts/` directory and are the source of truth for component interoperability.

## Overview

There are two OpenAPI 3.1.0 specifications:

| Contract     | File                                 | Who implements it                     | Who calls it  |
|--------------|--------------------------------------|---------------------------------------|---------------|
| Agent API    | `contracts/agent-api.openapi.yaml`   | Agent containers (all three variants) | API container |
| Business API | `contracts/backend-api.openapi.yaml` | API container                         | Frontend      |

## Agent API (`agent-api.openapi.yaml`)

The generic conversation API that all agent implementations must conform to. This is the swappability layer -- any agent that implements this contract can be placed behind the API container.

| Endpoint                                   | Method | Description                                          |
|--------------------------------------------|--------|------------------------------------------------------|
| `/conversations`                           | POST   | Create a new conversation                            |
| `/conversations`                           | GET    | List conversations (paginated: `?offset=0&limit=20`) |
| `/conversations/{conversationId}`          | GET    | Get conversation details + message history           |
| `/conversations/{conversationId}/messages` | POST   | Send a message (SSE stream or JSON response)         |
| `/health`                                  | GET    | Health check with dependency status                  |
| `/metrics`                                 | GET    | Prometheus-compatible metrics                        |

### Authentication

The agent API expects a bearer token in the `Authorization` header. The API container acquires this token via `DefaultAzureCredential`. In local development with `SKIP_AUTH=true`, token validation is bypassed.

### Streaming behavior

The `/conversations/{conversationId}/messages` endpoint supports both streaming and non-streaming responses:

- `Accept: text/event-stream` -- returns SSE stream (default)
- `Accept: application/json` -- returns complete JSON response after generation

### Request/response schemas

**Create conversation:**

```json
// POST /conversations
// Request:
{ "metadata": { "source": "web" } }   // optional

// Response (201):
{
  "id": "thread_abc123",
  "createdAt": "2026-02-13T...",
  "updatedAt": "2026-02-13T...",
  "metadata": { "source": "web" }
}
```

**Send message:**

```json
// POST /conversations/{id}/messages
// Request:
{ "content": "Hello there!" }

// Response (200, JSON mode):
{
  "id": "msg_xyz789",
  "role": "assistant",
  "content": "Welcome to the workspace!",
  "createdAt": "2026-02-13T...",
  "usage": { "promptTokens": 10, "completionTokens": 8 }
}
```

## Business API (`backend-api.openapi.yaml`)

The public business API that the frontend calls. The current sample domain is a fictional sales/account-team scenario, while the existing route and mode identifiers remain business-oriented and aligned to the activity sample. These endpoints create conversations on the agent and return a mode-specific `syntheticMessage` for the frontend to send as the first message.

> **WS-12 rework:** These endpoints replace the previous `recruit`, `staffing`, `staffing/{id}/messages`, and `planning` endpoints.

| Endpoint                                           | Method | Description                                     | Maps to agent API                   |
|----------------------------------------------------|--------|-------------------------------------------------|-------------------------------------|
| `POST /api/activities/discovery`                   | POST   | Start an opportunity discovery flow             | `POST /conversations`               |
| `POST /api/activities/planning`                    | POST   | Start an account planning flow                  | `POST /conversations`               |
| `POST /api/activities/staffing`                    | POST   | Start an account-team staffing flow             | `POST /conversations`               |
| `GET /api/activities/conversations`                | GET    | List all conversations (with mode + status)     | `GET /conversations`                |
| `GET /api/activities/conversations/{id}`           | GET    | Get conversation detail with messages + outcome | `GET /conversations/{id}`           |
| `POST /api/activities/conversations/{id}/messages` | POST   | Continue chatting (SSE stream)                  | `POST /conversations/{id}/messages` |
| `GET /api/activities/stats`                        | GET    | Activity stats per mode                         | Computed from `GET /conversations`  |
| `GET /health`                                      | GET    | Health check (includes agent health)            | Checks agent `/health` too          |

### Business operation flow

Each business operation (`discovery`, `planning`, `staffing`) follows the same pattern:

1. **Create conversation:** API calls `POST /conversations` on the agent and stores conversation metadata
1. **Return to frontend:** API returns `{ id, mode, status, syntheticMessage, createdAt }`
1. **Get first agent response:** frontend sends `syntheticMessage` to `POST /api/activities/conversations/{id}/messages`; the API forwards to `POST /conversations/{id}/messages`

```json
// POST /api/activities/discovery
// Request: (empty body or optional metadata)
{}

// Response (201):
{
  "id": "conv_abc123",
  "mode": "discovery",
  "status": "active",
  "syntheticMessage": "I am qualifying a new customer opportunity. Lead a short discovery conversation, ask targeted questions, and conclude with a concise qualification summary.",
  "createdAt": "2026-02-14T..."
}
```

```json
// GET /api/activities/conversations/{id} (after resolution)
{
  "id": "conv_abc123",
  "mode": "discovery",
  "status": "resolved",
  "outcome": {
    "result": "win",
    "summary": "Qualified the opportunity after reviewing 4 signals"
  },
  "messages": [...]
}
```

### Authentication

The business API is **not exposed to the public network** — it is only accessible from the BFF (Backend for Frontend) server. When `SKIP_AUTH=false` (default), the API validates Entra-issued bearer tokens on business endpoints for signature/JWKS, issuer, audience, expiry, and optional caller app IDs. The BFF requests a token for `API_TOKEN_SCOPE`, and the API requests a token for `AGENT_TOKEN_SCOPE` when calling the agent container.

## SSE event format

Both APIs use the same SSE event format for streaming responses:

```text
event: message.delta
data: {"content": "Welcome "}

event: message.delta
data: {"content": "welcome "}

event: message.delta
data: {"content": "back!"}

event: message.complete
data: {"messageId": "msg_xyz", "content": "Welcome back!", "usage": {"promptTokens": 10, "completionTokens": 8}}
```

### Specialist tool activity events (OpenAI variant only)

When the coordinator agent invokes a specialist agent-tool during streaming, the agent container emits `tool.called` and `tool.done` events. The frontend uses these to show specialist-specific loading text (e.g., "The discovery specialist is working..."):

```text
event: tool.called
data: {"toolName": "discovery_specialist"}

event: tool.done
data: {"toolName": "discovery_specialist"}
```

Only emitted for specialist tools (`discovery_specialist`, `planning_specialist`, `staffing_specialist`), not for resolution tools. The API container passes these events through to the frontend.

### Activity resolution event

When a specialist agent calls its resolution tool, the agent container emits an `activity.resolved` SSE event:

```text
event: activity.resolved
data: {"tool": "resolve_discovery", "result": {"fit": "qualified", "signals_reviewed": 4, "primary_need": "Executive visibility into account risk."}}
```

The API container **parses** the SSE stream (not raw passthrough) to detect `activity.resolved` events, capture outcomes, and pass them through to the frontend.

For non-streaming (JSON) responses, the `sendMessage` response includes an optional `resolution` field:

```json
{
  "id": "msg_xyz",
  "role": "assistant",
  "content": "With that, the opportunity looks well qualified.",
  "createdAt": "...",
  "usage": { "promptTokens": 50, "completionTokens": 30 },
  "resolution": {
    "tool": "resolve_discovery",
    "result": { "fit": "qualified", "signals_reviewed": 4, "primary_need": "..." }
  }
}
```

### Error event

On error during streaming:

```text
event: error
data: {"code": "agent_error", "message": "The service is temporarily unavailable"}
```

## Inter-service communication

See `contracts/INTER-SERVICE.md` for the full specification of:

- Service discovery (`AGENT_SERVICE_URL` environment variable)
- Authentication flow (DefaultAzureCredential -> bearer token)
- Retry and error handling (429/503 retry, circuit breaker, timeouts)
- SSE streaming passthrough behavior

## Validating contracts

The contracts project uses Redocly CLI for validation:

```bash
cd contracts
npm install
npm run validate    # Validates both specs against Redocly recommended ruleset
```

The `testing/contract-validator/` project validates running services against these specs at runtime. See [Testing](./testing.md) for details.
