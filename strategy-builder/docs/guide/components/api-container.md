# API Container

**Primary directory:** `components/api/typescript/`
**Alternate implementation:** `components/api/csharp/`
**Port:** 4000
**Contract:** `contracts/backend-api.openapi.yaml`

The API container is the **business operations layer**. The current sample domain is a fictional sales/account-team scenario, while the route and mode identifiers stay business-oriented and aligned to the activity sample. The API exposes business operations that create conversations on the agent container and return a mode-specific `syntheticMessage` for the frontend to send as the first message. It also proxies ongoing chat via the conversations endpoints, **parsing the SSE stream** to detect `activity.resolved` events and capture resolution outcomes. ActivityConversations gain `status` (`active`/`resolved`) and `outcome` fields. It is **agent-framework-agnostic** -- it only knows the agent API contract.

This page focuses on the current TypeScript implementation. A C# implementation
with the same contract and business behavior also exists under
`components/api/csharp/`.

## TypeScript implementation architecture

```text
components/api/typescript/
├── src/
│   ├── server.ts          # Entry point: starts Fastify, graceful shutdown
│   ├── app.ts             # Fastify factory: routes, auth config
│   ├── config.ts          # Environment variable loading + validation
│   ├── agent-client.ts    # HTTP client for the agent container (with retry + circuit breaker)
│   ├── routes.ts          # Business API route handlers + SSE passthrough
│   └── types.ts           # Types (mirrors backend-api.openapi.yaml schemas)
├── tests/
│   ├── config.test.ts     # Config loading tests
│   ├── agent-client.test.ts # Agent HTTP client tests (mocked fetch)
│   └── routes.test.ts     # Route handler tests (mocked agent client)
├── Dockerfile
├── .env.test              # Test environment variables
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── component.json
```

## How it works

### Request flow

**Starting a new activity (business operation):**

1. Frontend calls `POST /api/activities/discovery` (opportunity discovery), `/planning` (account planning), or `/staffing` (account-team staffing)
1. API creates a conversation on the agent: `POST /conversations`
1. API returns `{ id, mode, status, syntheticMessage, createdAt }` to the frontend
1. Frontend sends `syntheticMessage` via `POST /api/activities/conversations/{id}/messages` to get the first assistant response

**Continuing a conversation:**

1. Frontend calls `POST /api/activities/conversations/{id}/messages` with the user's next message
1. API translates to `POST /conversations/{id}/messages` with `{ "content": "You fight like a dairy farmer!" }`
1. If streaming: API opens SSE connection to agent, **parses events** to detect `activity.resolved` (captures outcome, stores it, passes event through), pipes remaining events to the frontend response
1. If non-streaming: API waits for JSON response from agent (which may include an optional `resolution` field), wraps it in the business response format

### Agent client (`agent-client.ts`)

The `AgentClient` class is the HTTP client that talks to the agent container:

- Base URL from `AGENT_SERVICE_URL` environment variable
- Sends bearer tokens on downstream API→agent calls when `SKIP_AUTH=false`
- Uses `DefaultAzureCredential` for token acquisition when auth is enabled
- Token scope: `AGENT_TOKEN_SCOPE` env var (defaults to the Azure AI Foundry scope)
- Retry logic for 429 (rate limit) and 503 (service unavailable)
- Circuit breaker pattern for cascading failure prevention
- SSE stream parsing: detects `activity.resolved` events from the agent, captures outcomes, passes events through to the caller

### Endpoints

> **WS-12 rework:** These endpoints replace the previous `recruit`, `staffing`, `staffing/{id}/messages`, and `planning` endpoints.

| Endpoint                                           | Method | Maps to agent API                                 | Description                                                                               |
|----------------------------------------------------|--------|---------------------------------------------------|-------------------------------------------------------------------------------------------|
| `POST /api/activities/discovery`                   | POST   | `POST /conversations`                             | Start an opportunity discovery flow (creates conversation and returns `syntheticMessage`) |
| `POST /api/activities/planning`                    | POST   | `POST /conversations`                             | Start an account planning flow (creates conversation and returns `syntheticMessage`)      |
| `POST /api/activities/staffing`                    | POST   | `POST /conversations`                             | Start an account-team staffing flow (creates conversation and returns `syntheticMessage`) |
| `GET /api/activities/conversations`                | GET    | `GET /conversations`                              | List all conversations (with `mode` + `status` fields)                                    |
| `GET /api/activities/conversations/{id}`           | GET    | `GET /conversations/{id}`                         | Get conversation detail with messages, `status`, and `outcome`                            |
| `POST /api/activities/conversations/{id}/messages` | POST   | `POST /conversations/{id}/messages`               | Continue chatting (SSE stream; parses for `activity.resolved`)                            |
| `GET /api/activities/stats`                        | GET    | Computed from `GET /conversations`                | Activity stats per mode; includes resolution counts                                       |
| `GET /health`                                      | GET    | Also calls agent `/health`                        | Health check (self + agent dependency)                                                    |
| `GET /health/deep`                                 | GET    | Calls agent `GET /conversations?offset=0&limit=1` | Deep health check for authenticated API→agent connectivity                                |
| `GET /identity`                                    | GET    | --                                                | Credential validation (returns identity claims from `DefaultAzureCredential`)             |

### Health check

The `/health` endpoint checks the API's downstream dependency via the agent `/health` endpoint:

```json
{
  "status": "healthy",
  "checks": [
    { "name": "self", "status": "healthy" },
    { "name": "agent-service", "status": "healthy", "latencyMs": 12 }
  ]
}
```

If the agent is unreachable, the API reports `degraded` (not `unhealthy`). The `/health/deep` endpoint performs an auth-required business-path probe (`GET /conversations`) to verify API→agent bearer propagation.

## Configuration

| Variable                              | Required               | Default                                        | Description                                                     |
|---------------------------------------|------------------------|------------------------------------------------|-----------------------------------------------------------------|
| `AGENT_SERVICE_URL`                   | Yes                    | --                                             | Base URL of the agent container (e.g., `http://localhost:3000`) |
| `PORT`                                | No                     | `4000`                                         | Server port                                                     |
| `HOST`                                | No                     | `0.0.0.0`                                      | Server host                                                     |
| `AGENT_TOKEN_SCOPE`                   | No                     | `https://cognitiveservices.azure.com/.default` | OAuth scope for agent tokens                                    |
| `LOG_LEVEL`                           | No                     | `info`                                         | Pino log level                                                  |
| `SKIP_AUTH`                           | No                     | `false`                                        | Explicit local/dev auth bypass                                  |
| `INBOUND_AUTH_TENANT_ID`              | When `SKIP_AUTH=false` | --                                             | Entra tenant used to derive valid issuers                       |
| `INBOUND_AUTH_ALLOWED_AUDIENCES`      | When `SKIP_AUTH=false` | --                                             | Comma-separated accepted audiences                              |
| `INBOUND_AUTH_ALLOWED_CALLER_APP_IDS` | No                     | --                                             | Optional caller application allowlist                           |
| `INBOUND_AUTH_AUTHORITY_HOST`         | No                     | `https://login.microsoftonline.com`            | Authority host override                                         |

## TypeScript implementation dependencies

- `fastify` ^5 -- HTTP framework
- `@azure/identity` ^4 -- DefaultAzureCredential for agent-to-agent auth

## TypeScript implementation tests

```bash
cd components/api/typescript
npm install && npm run test
```

- `config.test.ts` -- config loading, required vars, defaults
- `agent-client.test.ts` -- HTTP client: request formation, auth headers, retry, circuit breaker, SSE passthrough, error handling
- `routes.test.ts` -- endpoint behavior: business-operation translation, response formats, error mapping, health aggregation

The C# implementation keeps its tests under
`components/api/csharp-tests/CairaApi.Tests/` and uses the ASP.NET Core test
host instead of Fastify injection.

## TypeScript implementation Docker

```bash
# Build
docker build -t caira-api components/api/typescript

# Run
docker run -p 4000:4000 \
  -e AGENT_SERVICE_URL=http://agent:3000 \
  -e SKIP_AUTH=true \
  caira-api

# Health check
curl http://localhost:4000/health
```

The Dockerfile follows the same multi-stage pattern as the TypeScript agent
containers: dependency install stage, then lean runtime stage with `node`. The
C# API variant uses an ASP.NET Core Minimal API app with a .NET multi-stage
Docker build instead.
