# Testing Infrastructure

Testing is central to this project. Since development is agent-driven, every piece of work must be machine-verifiable -- no "check visually" or "verify manually" steps.

For the end-to-end contributor workflow that explains which validation depth to
use, what the PR pipeline runs, and when to escalate to Azure-backed testing,
start with `../../../docs/contributing/extending_caira.md` and
`../../../docs/developer.md`.

## Philosophy

1. **Layered validation** -- fail fast at the cheapest layer, escalate only when cheaper layers pass
1. **Deterministic** -- mock external services, no flaky tests
1. **Self-documenting** -- test names describe expected behavior, failures explain what went wrong
1. **Fast inner loop** -- per-component `npm run test` completes in seconds

## Test projects

All testing projects live under `testing/` and are self-contained (own `package.json`, `tsconfig.json`, `node_modules/`).

| Project            | Directory                     | Purpose                                                             |
|--------------------|-------------------------------|---------------------------------------------------------------------|
| Contract Validator | `testing/contract-validator/` | Validates running services against OpenAPI specs                    |
| Container Health   | `testing/container-health/`   | Builds Docker images, starts containers, validates health           |
| AI Mock            | `testing/mocks/ai-mock/`      | Unified mock: Agent CRUD + Responses API (all three agent variants) |
| E2E Suite          | `testing/e2e/`                | End-to-end test scenarios against running services                  |

### Plus component-level tests

| Component             |
|-----------------------|
| Foundry Agent Service |
| OpenAI Agent SDK      |
| API Container         |
| Frontend              |
| Scripts/Generator     |

---

## Contract Validator (`testing/contract-validator/`)

Validates that a running service conforms to its OpenAPI specification.

### How it works

1. Parses the OpenAPI 3.1.0 spec (YAML)
1. For each endpoint: sends requests, validates response status codes, headers, and body against JSON schemas
1. Supports SSE streaming endpoint validation
1. Reports per-endpoint pass/fail with detailed errors

### Usage

```bash
cd testing/contract-validator
npm install

# Validate a running service
npx tsx src/cli.ts --spec ../../contracts/agent-api.openapi.yaml --url http://localhost:3000
```

### API

```typescript
import { validateContract } from './src/validator.ts';

const results = await validateContract(specPath, baseUrl, options);
// Returns: ContractResult[] with endpoint, method, status, passed, errors[]
```

### Key files

- `src/validator.ts` -- core validation logic
- `src/parser.ts` -- OpenAPI spec parser
- `src/cli.ts` -- CLI entry point
- `src/types.ts` -- result types

---

## Container Health Validator (`testing/container-health/`)

Validates that Docker containers build, start, and respond to health checks.

### How it works

1. Builds the Docker image via `docker build`
1. Starts the container with required environment variables (from `.env.test`)
1. Polls the health endpoint with exponential backoff
1. Asserts health check returns 200
1. Stops and removes the container

### Usage

```bash
cd testing/container-health
npm install

# Validate a component's Docker container
npx tsx src/cli.ts --dockerfile ../../components/api/typescript/Dockerfile --health /health --port 4000
```

### Key files

- `src/validate-container.ts` -- orchestrates build, run, health check, cleanup
- `src/poll-health.ts` -- health endpoint polling with timeout
- `src/env-parser.ts` -- parses `.env.test` files for container environment
- `src/cli.ts` -- CLI entry point

---

## Mock Services (`testing/mocks/`)

A single unified mock server (`ai-mock`) simulates the Azure AI Foundry APIs for local testing without Azure credentials. It serves both the Foundry Agent CRUD API and the OpenAI Responses API from one process.

### Unified AI Mock (`testing/mocks/ai-mock/`)

**Port:** 8100

**Endpoints:**

| Endpoint                       | Description                                          |
|--------------------------------|------------------------------------------------------|
| `POST /agents/:name`           | Create agent (Foundry Agent CRUD)                    |
| `PATCH /agents/:name`          | Update agent                                         |
| `GET /agents/:name`            | Get agent by name                                    |
| `DELETE /agents/:name`         | Delete agent                                         |
| `GET /agents`                  | List agents                                          |
| `POST /responses`              | Create response (OpenAI-style, supports SSE)         |
| `POST /openai/responses`       | Create response (Foundry-style prefix, supports SSE) |
| `GET /responses/:id`           | Get response                                         |
| `GET /openai/responses/:id`    | Get response (Foundry-style prefix)                  |
| `DELETE /responses/:id`        | Delete response                                      |
| `DELETE /openai/responses/:id` | Delete response (Foundry-style prefix)               |
| `GET /health`                  | Health check                                         |

**SSE streaming events:** `response.created`, `response.in_progress`, `response.output_item.added`, `response.content_part.added`, `response.output_text.delta`, `response.output_text.done`, `response.content_part.done`, `response.output_item.done`, `response.function_call_arguments.delta`, `response.function_call_arguments.done`, `response.completed`

Each SSE event's JSON `data:` payload includes a `type` field matching the event name and a monotonically increasing `sequence_number`, matching the OpenAI SDK's expectations.

**Configuration headers:**

- `X-Mock-Latency: <ms>` -- add artificial latency
- `X-Mock-Error: <type>` -- inject specific error responses

```bash
cd testing/mocks/ai-mock
npm install
node src/server.ts  # Starts on :8100
```

### Mock design principles

- **Deterministic** -- same input always produces same output (no random data in responses)
- **Auth-aware** -- accepts `Authorization: Bearer <token>` headers but does not validate tokens
- **API version-aware** -- supports `?api-version=` query parameters matching Azure AI Foundry patterns
- **Stateful within a session** -- agents/responses persist in memory for the lifetime of the mock process
- **Docker-ready** -- has a Dockerfile for use in compose-based tests

---

## E2E Test Suite (`testing/e2e/`)

End-to-end tests that run against a full stack (local compose or remote Azure).

### Two test files

| File                        | Requires compose?        | Purpose                                                       |
|-----------------------------|--------------------------|---------------------------------------------------------------|
| `tests/api-client.test.ts`  | No                       | Unit tests for `ApiClient` class against a local mock backend |
| `tests/compose-e2e.test.ts` | Yes (via `E2E_BASE_URL`) | Full-stack integration tests through the BFF                  |

### 3-Tier E2E Strategy

All three tiers share the same test file (`compose-e2e.test.ts`). The only differences are the compose configuration and assertion mode:

| Tier               | Layer | Stack                  | Inference             | Azure Required          | When       |
|--------------------|-------|------------------------|-----------------------|-------------------------|------------|
| **Mock**           | L5    | Local compose + mock   | Mock services         | No                      | Every PR   |
| **Local + Azure**  | L6    | Local compose, no mock | Real Azure AI Foundry | Yes (`az login`)        | Pre-merge  |
| **Fully Deployed** | L9    | Azure Container Apps   | Real Azure AI Foundry | Yes (service principal) | Nightly CI |

### Configuration

Target URL and mode are set via environment variables:

```bash
# Unit tests (no compose stack needed)
cd testing/e2e && npm run test

# Compose E2E (set by compose-test-runner.ts automatically)
E2E_BASE_URL=http://172.18.0.5:8080 E2E_MOCK_MODE=true npm run test
```

When `E2E_BASE_URL` is not set, the compose E2E tests skip gracefully. When `E2E_MOCK_MODE=true`, tests assert deterministic mock output; otherwise they validate response shapes only (for real LLMs).

### Compose E2E test scenarios

| Scenario                       | What it tests                                                                      |
|--------------------------------|------------------------------------------------------------------------------------|
| Health                         | BFF health endpoint returns healthy                                                |
| Start discovery                | `POST /api/activities/discovery` creates an opportunity discovery activity         |
| Start planning                 | `POST /api/activities/planning` creates an account planning activity               |
| Start staffing                 | `POST /api/activities/staffing` creates an account-team staffing activity          |
| List conversations             | `GET /api/activities/conversations` includes created conversations                 |
| ActivityConversation detail    | `GET /api/activities/conversations/{id}` returns messages and status               |
| Message (JSON)                 | `POST /api/activities/conversations/{id}/messages` returns the specialist response |
| Message (SSE)                  | SSE streaming with `message.delta` and `message.complete` events                   |
| SSE delta/complete consistency | Concatenated delta content matches complete content                                |
| Stats                          | `GET /api/activities/stats` returns per-mode activity statistics                   |
| Error handling                 | 404 for non-existent conversation and message                                      |
| Lifecycle (discovery)          | Start -> message -> resolution -> verify `status: resolved` + outcome              |
| Lifecycle (planning)           | Start -> message -> resolution -> verify `status: resolved` + outcome              |
| Lifecycle (staffing)           | Start -> message -> resolution -> verify `status: resolved` + outcome              |

### Test helpers

| Helper                                             | Purpose                                              |
|----------------------------------------------------|------------------------------------------------------|
| `waitForHealthy(url, timeout)`                     | Polls `/health` until 200 or timeout                 |
| `createApiClient(baseUrl)`                         | Typed HTTP client matching the business API contract |
| `collectSSEEvents(response)`                       | Collects SSE events into array                       |
| `assertResponseMatchesSchema(response, schemaRef)` | Validates against OpenAPI schema                     |
| `requireAzureLogin()`                              | Checks `az account show`, throws with clear message  |
| `isAzureLoggedIn()`                                | Non-throwing boolean variant                         |

---

## Docker Compose Integration Tests

The compose test runner (`scripts/compose-test-runner.ts`) orchestrates full-stack E2E testing using Docker Compose.

### How it works

1. Validates sample directory has `docker-compose.yml`
1. Generates mock overlay via `generateTestOverlay()` (unless `--no-mock` for L6)
1. Starts `docker compose up -d --build` with project name `caira-test-<sample-name>`
1. Discovers **frontend container IP** via `docker inspect`
1. Waits for health at `http://<frontend-ip>:8080/health`
1. Runs `npx vitest run` in `testing/e2e/` with `E2E_BASE_URL` and optionally `E2E_MOCK_MODE=true`
1. Captures container logs on failure
1. Tears down with `docker compose down --volumes --remove-orphans`

### Usage

For most contributors, start from the repository root:

```bash
# Same fast static suite used by pull requests
task validate:pr

# Broader local app-layer validation
task strategy:test:local

# Interactive local smoke test for one generated strategy
task strategy:dev -- deployment-strategies/foundry_agentic_app/typescript-foundry-agent-service-aca

# Local stack against real Azure dependencies
task strategy:dev:azure -- deployment-strategies/foundry_agentic_app/typescript-foundry-agent-service-aca
```

Use the direct runners below when you need to target a specific layer or debug
the compose harness itself:

```bash
# Test a specific strategy variant (L5 mock mode)
node scripts/compose-test-runner.ts \
  --strategy deployment-strategies/foundry_agentic_app/typescript-foundry-agent-service-aca

# Test without mocks (L6, requires azurecli Docker volume populated via scripts/azure-login.ts)
node scripts/compose-test-runner.ts \
  --strategy deployment-strategies/foundry_agentic_app/typescript-foundry-agent-service-aca --no-mock

# Test all variants via the master test runner (L5 layer)
node scripts/test-all.ts --layer L5

# Test with real Azure inference (L6 layer)
node scripts/test-all.ts --layer L6
```

### Key files

- `scripts/compose-test-runner.ts` -- orchestrates compose-based E2E testing
- `scripts/dev-compose.ts` -- interactive dev mode for manual frontend testing (not automated tests)
- `scripts/lib/compose-helpers.ts` -- shared compose utilities (mock overlay generation, agent detection, logging)
- `scripts/test-all.ts` -- master test runner (L5 layer uses compose-test-runner)
- `deployment-strategies/*/docker-compose.yml` -- production-like compose configuration
- `deployment-strategies/*/docker-compose.test.yml` -- test overlay adding mocks and disabling auth

### Interactive dev mode (dev-compose)

For manual frontend testing, prefer the root Taskfile wrapper or call the script directly:

```bash
# Preferred from the repo root
task strategy:dev -- deployment-strategies/foundry_agentic_app/typescript-openai-agent-sdk-aca

# Advanced direct script usage
node scripts/dev-compose.ts --strategy deployment-strategies/foundry_agentic_app/typescript-openai-agent-sdk-aca
```

This starts the full stack with mocks in foreground mode (all logs stream to your terminal). Open `http://localhost:8080` to interact with the frontend. Press `Ctrl+C` for clean shutdown.

Unlike `compose-test-runner.ts`, this does **not** run any automated tests -- it is purely for interactive manual testing.

### Devcontainer support

In devcontainers / Codespaces, nested Docker networking can differ from a bare-metal host. The compose test runner auto-discovers container IPs via `docker inspect`, which keeps frontend reachability working even when published localhost ports are not the most reliable path.

---

## Running tests

### Recommended contributor entrypoints (from the repository root)

```bash
task validate:pr
task strategy:test:local
task test
task strategy:dev -- deployment-strategies/foundry_agentic_app/typescript-foundry-agent-service-aca
task strategy:test:deployed -- deployment-strategies/foundry_agentic_app/typescript-foundry-agent-service-aca
```

### Single component (fastest)

```bash
cd components/api/typescript
npm run test         # ~2 seconds
```

### Advanced targeted commands (from `strategy-builder/`)

```bash
# Run the early layers only
node scripts/test-all.ts --layer L1,L2,L3

# Full local app-layer validation
node scripts/test-all.ts

# Run the compose layer only
node scripts/test-all.ts --layer L5

# Run one specific layer
node scripts/test-all.ts --layer L2

# Run one strategy through the compose test runner
node scripts/compose-test-runner.ts \
  --strategy deployment-strategies/foundry_agentic_app/typescript-foundry-agent-service-aca
```
