/**
 * E2E test helpers — public API.
 */

export { waitForHealthy, type WaitForHealthyOptions, type WaitForHealthyResult } from './helpers/wait-for-healthy.ts';
export {
  ApiClient,
  type ApiClientOptions,
  type ApiResponse,
  type ActivityMessage,
  type TokenUsage,
  type HealthResponse,
  type DependencyHealth,
  type ErrorResponse
} from './helpers/api-client.ts';
export {
  collectSSEEvents,
  type SSEEvent,
  type SSECollectorOptions,
  type SSECollectorResult
} from './helpers/sse-collector.ts';
export { validateSchema, resetSchemaCache, type SchemaValidationResult } from './helpers/schema-validator.ts';
export { isAzureLoggedIn, requireAzureLogin } from './helpers/azure-guard.ts';
