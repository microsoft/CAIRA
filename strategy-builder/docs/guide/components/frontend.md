# Frontend

**Directory:** `components/frontend/react-typescript/`
**Port:** 8080 (production/Docker), 5173 (Vite dev server)
**Contract:** `contracts/backend-api.openapi.yaml` (as a consumer)

The frontend is a **React/TypeScript chat UI** with an **activity picker**. The current sample domain is a fictional sales/account-team scenario, while some internal client/route names remain business-oriented and aligned to the activity sample. Users choose an activity (Opportunity Discovery, Account Planning, Team Staffing), which starts a new conversation via a business operation. The chat UI then displays the agent's opening response and allows continued conversation. When an activity resolves (via `activity.resolved` SSE event), the frontend displays an outcome card/banner. A runtime **stream toggle** lets users switch between SSE streaming and JSON request/response mode. During streaming, specialist-specific loading indicators show which agent-tool is active.

## Architecture

```text
components/frontend/react-typescript/
├── src/
│   ├── main.tsx                    # React entry point (StrictMode + App)
│   ├── App.tsx                     # Root component: sidebar + chat + input
│   ├── types.ts                    # Frontend types (mirrors backend API schemas)
│   ├── api/
│   │   └── activity-client.ts        # Typed HTTP/SSE client for all 6 backend endpoints
│   ├── components/
│   │   ├── ActivityPicker.tsx     # Three-button activity picker (discovery, planning, staffing)
│   │   ├── ConversationList.tsx    # Sidebar: list conversations, highlight selected
│   │   ├── ChatArea.tsx            # Message display area with streaming + loading/error states
│   │   ├── OutcomeCard.tsx         # Resolution outcome card/banner
│   │   ├── MessageInput.tsx        # Text input + send button, Enter key support
│   │   ├── MessageBubble.tsx       # Single message bubble (user vs assistant styling)
│   │   └── StreamToggle.tsx        # Header toggle for streaming/JSON mode
│   ├── hooks/
│   │   ├── useConversations.ts    # List/create/select conversations, auto-loads on mount
│   │   ├── useChat.ts             # Send messages via SSE streaming, manages messages + state
│   │   └── useActivityConversations.ts       # Start activities, manage conversation state
│   └── styles/
│       └── index.css              # Tailwind CSS v4 setup (@import 'tailwindcss', @theme, base styles)
├── tests/
│   ├── setup.ts                   # @testing-library/jest-dom + scrollIntoView polyfill
│   ├── api/
│   │   └── activity-client.test.ts  # API client tests (mock globalThis.fetch)
│   ├── components/
│   │   ├── ActivityPicker.test.tsx # Activity selection tests
│   │   ├── App.test.tsx           # Integration tests
│   │   ├── MessageBubble.test.tsx  # Message rendering tests
│   │   ├── MessageInput.test.tsx   # Input handling tests
│   │   ├── ChatArea.test.tsx       # Chat area tests
│   │   ├── ConversationList.test.tsx # Conversation list tests
│   │   └── StreamToggle.test.tsx   # Stream toggle tests
│   └── hooks/
│       ├── useConversations.test.tsx # Conversation hook tests
│       ├── useChat.test.tsx        # Chat hook tests
│       └── useActivityConversations.test.tsx  # ActivityConversations hook tests
├── index.html                     # HTML shell for Vite
├── vite.config.ts                 # Vite config with dev proxy
├── vitest.config.ts               # jsdom environment for tests
├── tsconfig.json                  # Extends base, adds DOM + JSX
├── tsconfig.node.json             # For vite/vitest config files
├── Dockerfile                     # Multi-stage: node build -> Fastify BFF
├── .env.example                   # Configurable API base URL
├── component.json
└── package.json
```

## Component breakdown

### `ActivityClient` (API client)

A class-based HTTP client (`src/api/activity-client.ts`) that wraps the business API endpoints:

> **WS-12 rework:** These methods replace the previous `recruit()`, `listStaffing()`, `getStaffingMember()`, `message()`, `messageStream()`, and `getPlanning()` methods.

| Method                                       | Endpoint                                           | Returns                                                   |
|----------------------------------------------|----------------------------------------------------|-----------------------------------------------------------|
| `startDiscovery()`                           | `POST /api/activities/discovery`                   | `ActivityConversationStarted` (`id` + `syntheticMessage`) |
| `startPlanning()`                            | `POST /api/activities/planning`                    | `ActivityConversationStarted` (`id` + `syntheticMessage`) |
| `startStaffing()`                            | `POST /api/activities/staffing`                    | `ActivityConversationStarted` (`id` + `syntheticMessage`) |
| `listActivityConversations(offset?, limit?)` | `GET /api/activities/conversations`                | `ActivityConversationList`                                |
| `getActivityConversation(id)`                | `GET /api/activities/conversations/{id}`           | `ActivityConversationDetail`                              |
| `message(conversationId, message)`           | `POST /api/activities/conversations/{id}/messages` | `ActivityMessage` (JSON)                                  |
| `messageStream(conversationId, message)`     | `POST /api/activities/conversations/{id}/messages` | `AsyncGenerator<SSEEvent>` (SSE)                          |
| `getStats()`                                 | `GET /api/activities/stats`                        | `ActivityStats`                                           |
| `checkHealth()`                              | `GET /health`                                      | `HealthResponse`                                          |

**SSE implementation:** The `messageStream()` method uses `fetch()` with `ReadableStream` (not `EventSource`) because the message endpoint is a POST request. It is an async generator that parses SSE event blocks and yields typed `SSEEvent` discriminated unions (`SSEMessageDelta | SSEMessageComplete | SSEActivityResolved | SSEToolCalled | SSEToolDone | SSEError`).

### React components

| Component          | Props                                                            | Responsibility                                                                                |
|--------------------|------------------------------------------------------------------|-----------------------------------------------------------------------------------------------|
| `App`              | --                                                               | Root: wires hooks to components, manages layout, renders activity picker, streaming toggle    |
| `ActivityPicker`   | onStartDiscovery, onStartPlanning, onStartStaffing, loadingMode  | Three-button picker for choosing a sample activity; shows spinner + "Starting..." during load |
| `ConversationList` | conversations, selected, onSelect                                | Sidebar with conversation list, shows mode badge and relative time (e.g., "2 min ago")        |
| `ChatArea`         | messages, isStreaming, streamingContent, error, activeSpecialist | Displays messages with auto-scroll, specialist-specific loading text, and error state         |
| `OutcomeCard`      | outcome, mode                                                    | Displays resolution outcome as a styled card/banner in the chat area                          |
| `MessageInput`     | onSend, disabled, resolved                                       | Text input with send button, Enter key submission; shows "Activity complete" when resolved    |
| `MessageBubble`    | message                                                          | Single message: different styles for user (right-aligned) vs assistant (left-aligned)         |
| `StreamToggle`     | streaming, onChange                                              | Header toggle switch for runtime streaming/JSON mode switching                                |

### React hooks

| Hook                       | Returns                                                                      | Behavior                                                                                                                                                                                                                                                                                                                 |
|----------------------------|------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `useConversations`         | `{ conversations, selected, loading, error, select }`                        | Fetches conversation list on mount, selects conversations (no longer creates -- business operations handle creation)                                                                                                                                                                                                     |
| `useChat`                  | `{ messages, isStreaming, streamingContent, error, send, activeSpecialist }` | Sends messages via `messageStream()` (SSE) or `message()` (JSON), controlled by `streaming` option. In streaming mode, accumulates SSE deltas, tracks `activeSpecialist` via `tool.called`/`tool.done` events. Filters empty assistant messages. In JSON mode, sends a single request and appends the complete response. |
| `useActivityConversations` | `{ startDiscovery, startPlanning, startStaffing, loading, loadingMode }`     | Calls business operation endpoints, receives `syntheticMessage`, then uses message to obtain assistant responses. Tracks `loadingMode` per activity type for button loading states.                                                                                                                                      |

## Configuration

| Variable             | Required | Default                    | Description                                                                                                                          |
|----------------------|----------|----------------------------|--------------------------------------------------------------------------------------------------------------------------------------|
| `API_BASE_URL`       | Yes      | `http://api:4000`          | URL of the business API (used by BFF proxy at runtime)                                                                               |
| `VITE_API_BASE_URL`  | No       | `""` (same origin)         | API base URL at build time (only used in `npm run dev` mode)                                                                         |
| `VITE_USE_STREAMING` | No       | `true`                     | Initial default for the streaming toggle. Set to `"false"` to default to JSON mode. Can be changed at runtime via the header toggle. |
| `PORT`               | No       | `8080`                     | Port the BFF server listens on                                                                                                       |
| `HOST`               | No       | `0.0.0.0`                  | Host the BFF server binds to                                                                                                         |
| `API_TOKEN_SCOPE`    | No       | `api://caira-api/.default` | OAuth scope requested by the BFF for API calls (value varies by deployment)                                                          |
| `SKIP_AUTH`          | No       | `false`                    | Explicit local/dev auth bypass for proxied API calls                                                                                 |

In development, Vite proxies `/api` requests to `localhost:4000`:

```typescript
// vite.config.ts
server: {
  proxy: {
    '/api': 'http://localhost:4000',
    '/health': 'http://localhost:4000',
  }
}
```

## Dependencies

**Runtime:**

- `react` ^19, `react-dom` ^19

**Dev/Build:**

- `vite` ^6 -- build tool
- `@vitejs/plugin-react` ^4 -- React Fast Refresh
- `typescript` ~5.8 -- required by Vite (unlike server-side components)
- `vitest` ^3 -- test runner
- `@testing-library/react` ^16, `@testing-library/user-event` ^14, `@testing-library/jest-dom` ^6
- `jsdom` ^26 -- DOM environment for tests

## Tests

```bash
cd components/frontend/react-typescript
npm install && npm run test
```

Tests are organized by concern:

- **API client**: all HTTP methods, SSE parsing (including `tool.called`/`tool.done`), error handling
- **Components**: rendering, user interaction, loading/error states, activity picker with `loadingMode`, outcome card, stream toggle, specialist-specific loading text in ChatArea, resolved state in MessageInput
- **App integration**: full app wiring, activity flows, error banners, stream toggle integration
- **Hooks**: data fetching, state management, streaming, conversations with `loadingMode`, `activeSpecialist` tracking, empty message filtering, non-streaming mode

### Test environment notes

- **jsdom** does not implement `scrollIntoView` -- polyfilled in `tests/setup.ts`
- **`@testing-library/user-event`** must use named import `{ userEvent }` due to `verbatimModuleSyntax`
- Non-null assertions (`!`) are forbidden by ESLint -- use `as Type` cast instead

## Docker

The frontend uses a 3-stage Dockerfile: install dependencies, build the React SPA with Vite, then run a Fastify BFF server that serves the static files and proxies `/api/*` to the business API:

```dockerfile
# Stage 1: Install dependencies
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build React SPA
FROM deps AS build
COPY . .
RUN npx vite build

# Stage 3: Production BFF server
FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY src ./src
EXPOSE 8080
CMD ["node", "src/server.ts"]
```

**Why `npx vite build` instead of `tsc -b && vite build`?** The Docker build context doesn't have access to `tsconfig.base.json` (3 directories up at the repo root). Vite uses esbuild for TypeScript which doesn't need the tsconfig chain. Typechecking is done separately via `npm run typecheck` in the development workflow and CI.

### BFF server

The Fastify BFF server (`src/server.ts`) provides:

- **Static file serving:** Serves the built React SPA from `dist/` via `@fastify/static`
- **API proxy:** Proxies `/api/*` requests to the business API container via `@fastify/http-proxy`
- **Inter-service auth propagation:** Injects `Authorization: Bearer <INTER_SERVICE_TOKEN>` on all `/api/*` requests
- **SPA fallback:** Any non-file request returns `index.html` (client-side routing support)
- **Health endpoint:** `GET /health` returns `{"status":"healthy"}`
- **Deep health endpoint:** `GET /health/deep` verifies BFF→API→agent auth-required connectivity
- **Port:** 8080 (non-privileged)

```bash
# Build and run
docker build -t caira-frontend components/frontend/react-typescript
docker run -p 8080:8080 -e API_BASE_URL=http://localhost:4000 caira-frontend

# Verify
curl http://localhost:8080/health
# {"status":"healthy"}
```
