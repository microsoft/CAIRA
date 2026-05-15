# Architecture

## System overview

Each current CAIRA deployment strategy is a three-container application with Terraform-managed infrastructure:

```text
                    +------------+
                    |  Frontend  |  :8080
                    | (BFF + SPA)|
                    +-----+------+
                          |
                     HTTP | /api/*
                    proxy |
                    +-----v-----+
                    |    API    |  :4000
                    |(Business Ops)
                    +-----+-----+
                          |
              Bearer token| /conversations/*
                  (Entra) |
                          |
                    +-----v-----+
                    |   Agent   |  :3000
                    |(Agent Runtime)
                    +-----+-----+
                          |
              Bearer token| SDK calls
                  (Entra) |
                          |
                    +-----v-----+
                    |  Azure AI |
                    |  Foundry  |
                    +-----------+
```

The diagram above is conceptual: it names the responsibilities and network flow,
not a specific framework choice. The generated deployment strategies currently
implement those responsibilities with a React-based frontend/BFF, TypeScript
Fastify services in the two TypeScript strategies, and ASP.NET Core plus
Microsoft Agent Framework in the C# strategy.

### Multi-agent architecture

The three current agent variants use **different orchestration patterns** to coordinate three specialist agents:

**OpenAI Agent SDK — Coordinator + Agent-as-Tool:**

```text
                    ┌─────────────────────────────────┐
                    │         Agent Container          │
                    │                                   │
User message ──────▶  Coordinator Agent (sole talker)      │
                    │    │                              │
                    │    ├── tool ──▶ discovery_specialist │──▶ LLM ──▶ resolve_discovery()
                    │    ├── tool ──▶ planning_specialist│──▶ LLM ──▶ resolve_planning()
                    │    ├── tool ──▶ staffing_specialist   │──▶ LLM ──▶ resolve_staffing()
                    │    └── (can also respond directly when no specialist call is needed)
                    └─────────────────────────────────┘
```

- **Coordinator agent** — the sole conversational agent. Talks to the user directly, invokes specialist tools when an activity is active, and calls resolution tools when the activity concludes.
- Specialists are wrapped with `.asTool()` — they are tools, not agents the user talks to. They receive input from the coordinator, call the LLM, and return content to the coordinator.
- The coordinator has **6 tools**: 3 specialist agent-tools (`discovery_specialist`, `planning_specialist`, `staffing_specialist`) + 3 resolution FunctionTools (`resolve_discovery`, `resolve_planning`, `resolve_staffing`).
- No triage agent, no handoffs, no re-triage.

**Foundry Agent Service — Triage + Connected Agents:**

```text
                    ┌─────────────────────────────────┐
                    │         Agent Container          │
                    │                                   │
User message ──────▶  Triage Agent                     │
                    │    │                              │
                    │    ├── handoff ──▶ Discovery         │──▶ LLM ──▶ resolve_discovery()
                    │    ├── handoff ──▶ Planning       │──▶ LLM ──▶ resolve_planning()
                    │    ├── handoff ──▶ Staffing           │──▶ LLM ──▶ resolve_staffing()
                    │    └── (fallback: general assistant) │
                    └─────────────────────────────────┘
```

- **Triage agent** — receives every message, examines conversation context, and hands off to the appropriate specialist via connected agent tools (`ToolUtility.createConnectedAgentTool`).
- **Re-triage every turn:** Each message starts with the triage agent (not sticky routing). The triage agent sees the full conversation history and decides which specialist should handle the response.

**Microsoft Agent Framework — Workflow per mode:**

```text
                    ┌─────────────────────────────────┐
                    │         Agent Container         │
                    │                                 │
User message ──────▶  Workflow runner                │
                    │    │                            │
                    │    ├── mode=discovery ─▶ Discovery workflow ─▶ resolve_discovery()
                    │    ├── mode=planning  ─▶ Planning workflow  ─▶ resolve_planning()
                    │    └── mode=staffing  ─▶ Staffing workflow  ─▶ resolve_staffing()
                    └─────────────────────────────────┘
```

- **No coordinator or triage runtime agent.** The C# implementation does not create a conversational coordinator and does not re-triage every turn.
- **Mode is selected from conversation metadata.** The workflow runner chooses one prebuilt workflow per mode (`discovery`, `planning`, `staffing`) when the conversation is created or resumed.
- **Each workflow has one specialist executor.** The selected specialist talks directly to the user, uses local knowledge and resolution tools, and resumes through workflow checkpoints across turns.

**Common to all variants:**

- **Discovery agent** — opportunity discovery specialist in the fictional sales/account-team sample
- **Planning agent** — account planning specialist in the fictional sales/account-team sample
- **Staffing agent** — account-team staffing specialist in the fictional sales/account-team sample

Each specialist agent has an **activity-specific resolution tool** (`resolve_discovery`, `resolve_planning`, `resolve_staffing`) with domain-specific parameters. When the activity reaches its natural conclusion, the agent calls its resolution tool, which emits an `activity.resolved` SSE event with structured outcome data.

### Request flow

**Starting a new activity (business operation):**

1. User picks an activity (Opportunity Discovery / Account Planning / Team Staffing) in the **frontend** activity picker
1. Frontend calls the corresponding API business operation (e.g., `POST /api/activities/discovery`)
1. API container creates a conversation on the **agent container** (`POST /conversations`) and sends a synthetic first user message aligned to the fictional sales/account-team scenario
1. Agent container routes via its variant-specific orchestration pattern (coordinator agent-tools for OpenAI, triage handoff for Foundry, or mode-selected workflow for C#) to the specialist, then generates an opening response
1. API returns the conversation ID + opening response to the frontend

**Continuing a conversation:**

1. User types a message in the **frontend** chat UI
1. Frontend BFF proxies `POST /api/activities/conversations/{id}/messages` to the **API container**
1. API container translates to `POST /conversations/{id}/messages` to the **agent container**
1. Agent container uses its framework SDK (Foundry Agent Service, OpenAI Agent SDK, or Microsoft Agent Framework) to call **Azure AI Foundry**, routing to the appropriate specialist via the variant's orchestration pattern
1. Response streams back as **Server-Sent Events (SSE)** through all layers: Agent -> API -> Frontend BFF -> Browser
1. If the agent calls a resolution tool, the stream includes an `activity.resolved` event — the API captures the outcome and passes the event through to the frontend

### Activity resolution

Activities have **definitive conclusions** captured via agent-driven tool calls. When a specialist agent determines an activity is complete, it calls its resolution tool (`resolve_discovery`, `resolve_planning`, or `resolve_staffing`). This emits an `activity.resolved` SSE event with structured outcome data. The API layer **parses** the SSE stream (not raw passthrough) to detect these events, stores the outcome, and passes the event through to the frontend. ActivityConversations gain `status` (`active`/`resolved`) and `outcome` fields. Conversations remain open after resolution.

### Streaming architecture

All streaming uses **SSE (Server-Sent Events)**, not WebSocket. SSE is chosen because the chat pattern is request/response with unidirectional streaming responses -- SSE is purpose-built for this.

SSE event format (identical at both the agent and API layers):

```text
event: message.delta
data: {"content": "Welcome "}

event: tool.called
data: {"toolName": "discovery_specialist"}

event: tool.done
data: {"toolName": "discovery_specialist"}

event: message.complete
data: {"messageId": "...", "content": "full response", "usage": {"promptTokens": 10, "completionTokens": 42}}

event: activity.resolved
data: {"tool": "resolve_discovery", "result": {"fit": "qualified", "signals_reviewed": 4, "primary_need": "..."}}

event: error
data: {"code": "agent_error", "message": "Something went wrong"}
```

The API container **parses** SSE events from the agent container to detect `activity.resolved` events and capture outcomes. All other events are passed through to the frontend.

## Component responsibilities

| Component           | Responsibility                                                                                                                                                                                                                                                                                         | Framework-aware?                           |
|---------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------|
| **Agent container** | Multi-agent orchestration (coordinator + agent-tools for OpenAI, triage + connected agents for Foundry, or per-mode workflow selection for Microsoft Agent Framework), manages conversations, calls Azure AI Foundry, and streams responses + `activity.resolved` / `tool.called` / `tool.done` events | Yes -- each variant uses a different SDK   |
| **API container**   | Business operations layer: creates conversations, sends synthetic first messages, **parses SSE stream** to capture resolution outcomes, proxies chat, retry                                                                                                                                            | No -- only knows the agent API contract    |
| **Frontend**        | BFF + SPA frontend: serves the activity picker + chat UI + outcome display, proxies `/api/*` to API, handles `activity.resolved` events. Current generated strategies implement this with React plus a BFF server.                                                                                     | No -- only knows the business API contract |
| **IaC**             | Terraform composition of the Foundry foundation plus composable Container Apps app-infra layers, backed by reusable infrastructure modules                                                                                                                                                             | No -- deploys any combination              |

## Current implementation stacks

Some technologies are shared across every current strategy, while others are
implementation-specific.

### Shared across current strategies

| Layer     | Technology             | Notes                                                                                                                                   |
|-----------|------------------------|-----------------------------------------------------------------------------------------------------------------------------------------|
| Contracts | OpenAPI 3.1.0          | Validated with Redocly CLI                                                                                                              |
| Auth      | DefaultAzureCredential | Entra ID bearer-token auth, no API keys                                                                                                 |
| Container | Docker                 | Multi-stage container builds                                                                                                            |
| IaC       | Terraform              | References macro reference architecture directories under `strategy-builder/infra/` and shared `strategy-builder/infra/modules/` inputs |

### TypeScript strategies

| Layer              | Technology | Version | Notes                                          |
|--------------------|------------|---------|------------------------------------------------|
| Runtime            | Node.js    | 24+     | Native TypeScript strip-types (no build step)  |
| Language           | TypeScript | 5.8     | Strict mode + repo-wide TS config              |
| Module system      | ESM        | --      | `"type": "module"` in all `package.json` files |
| HTTP framework     | Fastify    | 5.x     | Agent, API, and frontend (BFF) containers      |
| Frontend framework | React      | 19      | With Vite 6 bundler                            |
| Frontend build     | Vite       | 6.x     | esbuild-powered frontend build                 |
| Test framework     | Vitest     | 3.x     | Used across the TypeScript projects            |

### C# strategy

| Layer          | Technology                                    | Version | Notes                                         |
|----------------|-----------------------------------------------|---------|-----------------------------------------------|
| Runtime        | .NET                                          | 10.0    | ASP.NET Core Web SDK projects                 |
| Language       | C#                                            | --      | Used for the API and agent containers         |
| HTTP framework | ASP.NET Core Minimal API                      | --      | API and agent containers                      |
| Agent runtime  | Microsoft Agent Framework + `Azure.AI.OpenAI` | --      | Per-mode workflow orchestration for the agent |
| Test framework | NUnit + ASP.NET Core test host                | --      | Used by the C# API and agent test projects    |

## TypeScript configuration

The TypeScript deployment strategies extend `tsconfig.base.json` at the
repository root:

```json
{
  "compilerOptions": {
    "target": "ES2024",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "verbatimModuleSyntax": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "isolatedModules": true
  }
}
```

Key implications:

- **`verbatimModuleSyntax`** -- imports must use `import type { X }` for type-only imports
- **`exactOptionalPropertyTypes`** -- optional properties must explicitly include `| undefined` (e.g., `metadata?: Record<string, unknown> | undefined`)
- **`noUncheckedIndexedAccess`** -- indexing arrays/records returns `T | undefined`
- Server-side components run directly via `node` (no build step)
- The frontend uses Vite/esbuild for building (requires `typescript` as a devDependency)

## Authentication model

```text
Local development (Docker Compose):
  az login → azurecli Docker volume → azcred sidecar → IDENTITY_ENDPOINT
  → DefaultAzureCredential (ManagedIdentityCredential) → Bearer token → Azure AI Foundry

Azure deployment:
  Managed Identity → DefaultAzureCredential → Bearer token → Azure AI Foundry
```

- **No API keys anywhere.** All authentication uses Entra ID bearer tokens via `DefaultAzureCredential`.
- **Docker credential forwarding:** An **az credential sidecar** (`azcred` service) is the only container with Azure CLI. It mounts the `azurecli` Docker named volume (containing cached `az login` tokens) and serves them via HTTP `/token`. App containers set `IDENTITY_ENDPOINT` + `IMDS_ENDPOINT` env vars, which triggers `DefaultAzureCredential`'s `ManagedIdentityCredential` chain to query the sidecar. See [Getting Started](./getting-started.md#docker-credential-management-azure-logints) for setup details.
- **Credential management:** `scripts/azure-login.ts` handles injecting host Azure CLI credentials into the Docker volume using a DooD-compatible `docker create` + `docker cp` pattern (no bind mounts).
- **Credential validation:** Each container that uses `DefaultAzureCredential` exposes a `GET /identity` diagnostic endpoint. It always attempts real credential validation (ignores `SKIP_AUTH`) and returns identity claims. `scripts/identity-test-runner.ts` automates end-to-end credential validation.
- The frontend BFF (Backend for Frontend) proxies API calls and injects `Authorization: Bearer <INTER_SERVICE_TOKEN>` for BFF→API traffic.
- The API container enforces bearer headers on business routes (unless `SKIP_AUTH=true`) and forwards bearer auth on API→agent calls.
- The API container acquires tokens via `DefaultAzureCredential` when available (with an internal fallback token for local/dev compatibility).
- The agent container acquires tokens to authenticate calls to Azure AI Foundry.
- The API container is **not exposed to the public network**.
- For local development and testing, `SKIP_AUTH=true` disables bearer token validation on incoming requests.

## Project structure

This is the **strategy-builder source tree**. Consumers interact with generated deployment strategies under `deployment-strategies/`.

```text
/
├── components/                     # Reusable component source (the "lego pieces")
│   ├── agent/typescript/
│   │   ├── foundry-agent-service/  # Foundry Agent Service variant (:3000)
│   │   └── openai-agent-sdk/       # OpenAI Agent SDK variant (:3000)
│   ├── agent/csharp/
│   │   └── microsoft-agent-framework/  # Microsoft Agent Framework variant (:3000)
│   ├── api/typescript/             # Business API — TypeScript (:4000)
│   ├── api/csharp/                 # Business API — C# (:4000)
│   ├── frontend/react-typescript/  # React chat UI (:8080)
│   ├── azcred/typescript/          # Azure credential sidecar (:8079)
│   └── iac/azure-container-apps/   # Terraform IaC (generated into deployment-strategies/*/infra)
│
├── contracts/                      # OpenAPI specs + Redocly validation
│   ├── agent-api.openapi.yaml      # Agent container contract
│   └── backend-api.openapi.yaml    # Business API contract
│
├── testing/                        # Shared test infrastructure (monorepo-internal)
│   ├── contract-validator/         # OpenAPI compliance validator
│   ├── container-health/           # Docker build/run/health checker
│   ├── mocks/                      # Mock services (NOT shipped with generated deployment strategies)
│   │   └── ai-mock/                # Unified mock: Agent CRUD + Responses API (:8100)
│   └── e2e/                        # E2E test suite + helpers
│
├── scripts/                        # Repo-level tooling
│   ├── generate-strategies.ts         # Sample generator (produces deployment-strategies/)
│   ├── validate-strategies.ts         # Drift check (ensures deployment-strategies/ matches generator output)
│   ├── compose-test-runner.ts      # Compose E2E test runner
│   ├── dev-compose.ts              # Interactive dev mode (manual frontend testing with mocks)
│   ├── test-all.ts                 # Master test runner (L1-L9)
│   ├── azure-login.ts              # Docker credential management (inject/interactive/status)
│   ├── identity-test-runner.ts     # Credential validation (compose + /identity assertions)
│   ├── verify-environment.sh       # Check dev tool versions
│   └── lib/                        # Shared library code
│       ├── compose-helpers.ts      # Shared compose utilities (mock overlay, detection, logging)
│       └── generator/              # Generator library (discovery, matrix, copier, files, etc.)
│
├── deployment-strategies/                        # GENERATED OUTPUT (never hand-edit)
│   ├── typescript-foundry-agent-service/  # Generated deployment strategy
│   │   ├── agent/                  # Full copy of agent component
│   │   ├── api/                    # Full copy of API component
│   │   ├── frontend/               # Full copy of frontend component
│   │   ├── contracts/              # Copies of OpenAPI specs
│   │   ├── docker-compose.yml      # Local dev compose (local build contexts)
│   │   ├── README.md
│   │   └── ...
│   ├── typescript-openai-agent-sdk/  # Same structure, different agent
│   └── csharp-microsoft-agent-framework/  # C# variant
│
├── docs/
│   ├── guide/                      # This documentation
│   └── design/                     # Internal design docs and plan
│
├── tsconfig.base.json              # Shared TS config (all projects extend this)
├── eslint.config.mjs               # Repo-wide ESLint 9 flat config
├── .prettierrc                     # Repo-wide Prettier config
└── package.json                    # Repo-level lint/format only (no workspaces)
```

### Source tree vs. generated deployment strategies

The monorepo contains the "machinery" — components, test infrastructure, generator, scripts. The `deployment-strategies/` directory contains the "product" — self-contained projects that end users copy and use.

|                 | Source tree (`components/`, `testing/`, `scripts/`) | Generated deployment strategies (`deployment-strategies/<reference-architecture>/<name>/`) |
|-----------------|-----------------------------------------------------|--------------------------------------------------------------------------------------------|
| **Audience**    | Developers evolving the strategy builder            | Operators deploying end-to-end strategies                                                  |
| **Contains**    | Reusable component source, test infra, mocks        | Full copies of source code, compose, IaC, docs                                             |
| **Standalone?** | No — components reference shared configs            | Yes — copy the folder, have everything                                                     |
| **Mocks?**      | Yes — `testing/mocks/` for development              | No — end users connect to real Azure services                                              |
| **Generated?**  | No — hand-authored                                  | Yes — always produced by `scripts/generate-strategies.ts`                                  |

## Agent framework comparison

The agent variants implement the same API contract but use different Azure AI Foundry SDKs. A **C# variant** (Microsoft Agent Framework) is also available alongside the two TypeScript variants:

|                      | Foundry Agent Service (TS)                                                                                         | OpenAI Agent SDK (TS)                                                                                  | Microsoft Agent Framework (C#)                                     |
|----------------------|--------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------|
| **SDK**              | `@azure/ai-projects` (`AIProjectClient`) + `openai`                                                                | `@openai/agents` + `openai` (`AzureOpenAI`)                                                            | `Microsoft.Extensions.AI` + `Azure.AI.OpenAI`                      |
| **API style**        | Agent CRUD + Responses API (stateless `POST /responses`)                                                           | Responses API (stateless `POST /responses`)                                                            | Responses API (stateless `POST /responses`)                        |
| **State model**      | Client-side (conversation map in memory, chained via `previousResponseId`)                                         | Client-side (conversation map in memory, chained via `previousResponseId`)                             | Client-side (conversation map, `previousResponseId`)               |
| **Conversation =**   | Map entry (client-managed)                                                                                         | Map entry (client-managed)                                                                             | Map entry (client-managed)                                         |
| **Multi-agent**      | Triage agent + connected agents (`ToolUtility.createConnectedAgentTool`) + resolution FunctionTools -- server-side | Coordinator agent + agent-as-tool (`.asTool()`) + resolution FunctionTools -- client-side SDK run loop | Mode-selected workflows with one specialist executor per mode      |
| **Streaming events** | `response.output_text.delta`, `response.completed`                                                                 | `response.output_text.delta`, `response.completed`                                                     | `response.output_text.delta`, `response.completed`                 |
| **Auth env var**     | `AZURE_AI_PROJECT_ENDPOINT`                                                                                        | `AZURE_OPENAI_ENDPOINT` (direct resource or APIM gateway root URL)                                     | `AZURE_OPENAI_ENDPOINT` (direct resource or APIM gateway root URL) |
| **Token scope**      | Implicit via `AIProjectClient` + `getOpenAIClient()`                                                               | `https://cognitiveservices.azure.com/.default`                                                         | `https://cognitiveservices.azure.com/.default`                     |

All variants expose identical REST endpoints and SSE event formats to the API container. The API container does not know which agent framework is behind it.
