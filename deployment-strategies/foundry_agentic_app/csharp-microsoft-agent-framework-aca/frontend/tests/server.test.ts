/** @vitest-environment node */

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/server.ts';

let apiMock: FastifyInstance;
let apiBaseUrl: string;
let bffApp: FastifyInstance;
let bffBaseUrl: string;
let bffSkipAuthApp: FastifyInstance;
let bffSkipAuthBaseUrl: string;
let staticDir: string;
let lastAuthorizationHeader: string | undefined;

function readAuthorizationHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

beforeAll(async () => {
  staticDir = await mkdtemp(join(tmpdir(), 'caira-frontend-static-'));
  await writeFile(join(staticDir, 'index.html'), '<html><body>frontend</body></html>', 'utf-8');

  apiMock = Fastify({ logger: false });

  // lgtm[js/missing-rate-limiting] This loopback-only Fastify server is a unit-test fixture.
  apiMock.get('/api/activities/conversations', async (request, reply) => {
    lastAuthorizationHeader = readAuthorizationHeader(request.headers['authorization']);
    if (lastAuthorizationHeader !== 'Bearer test-api-token' && lastAuthorizationHeader !== undefined) {
      await reply.status(401).send({
        code: 'unauthorized',
        message: 'Missing or invalid Authorization header'
      });
      return;
    }

    await reply.send({
      conversations: [],
      offset: 0,
      limit: 20,
      total: 0
    });
  });

  // lgtm[js/missing-rate-limiting] This loopback-only Fastify server is a unit-test fixture.
  apiMock.get('/health/deep', async (request, reply) => {
    lastAuthorizationHeader = readAuthorizationHeader(request.headers['authorization']);
    if (lastAuthorizationHeader !== 'Bearer test-api-token' && lastAuthorizationHeader !== undefined) {
      await reply.status(401).send({
        code: 'unauthorized',
        message: 'Missing or invalid Authorization header'
      });
      return;
    }

    await reply.send({
      status: 'healthy',
      dependencies: [{ name: 'agent-container-auth', status: 'healthy', latencyMs: 3 }]
    });
  });

  apiBaseUrl = await apiMock.listen({ port: 0, host: '127.0.0.1' });

  bffApp = await buildApp({
    config: {
      port: 0,
      host: '127.0.0.1',
      apiBaseUrl,
      logLevel: 'silent',
      applicationInsightsConnectionString: undefined,
      apiTokenScope: 'api://test-api/.default',
      skipAuth: false
    },
    getAccessToken: async () => 'test-api-token',
    staticDir
  });
  bffBaseUrl = await bffApp.listen({ port: 0, host: '127.0.0.1' });

  bffSkipAuthApp = await buildApp({
    config: {
      port: 0,
      host: '127.0.0.1',
      apiBaseUrl,
      logLevel: 'silent',
      applicationInsightsConnectionString: undefined,
      apiTokenScope: undefined,
      skipAuth: true
    },
    staticDir
  });
  bffSkipAuthBaseUrl = await bffSkipAuthApp.listen({ port: 0, host: '127.0.0.1' });
});

afterAll(async () => {
  await bffApp.close();
  await bffSkipAuthApp.close();
  await apiMock.close();
  await rm(staticDir, { recursive: true, force: true });
});

describe('BFF server inter-service auth', () => {
  it('injects Authorization when proxying /api requests', async () => {
    const response = await fetch(`${bffBaseUrl}/api/activities/conversations`);
    expect(response.status).toBe(200);
    expect(lastAuthorizationHeader).toBe('Bearer test-api-token');
  });

  it('returns healthy deep health when API deep auth call succeeds', async () => {
    const response = await fetch(`${bffBaseUrl}/health/deep`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      status: string;
      dependencies: Array<{ name: string; status: string }>;
    };
    expect(body.status).toBe('healthy');
    // The BFF prepends its own API dependency to the downstream API payload.
    expect(body.dependencies).toHaveLength(2);
    expect(body.dependencies[0]?.name).toBe('api-container-auth');
    expect(body.dependencies[0]?.status).toBe('healthy');
    expect(body.dependencies[1]?.name).toBe('agent-container-auth');
    expect(body.dependencies[1]?.status).toBe('healthy');
  });

  it('omits Authorization when auth bypass is enabled', async () => {
    const response = await fetch(`${bffSkipAuthBaseUrl}/api/activities/conversations`);
    expect(response.status).toBe(200);
    expect(lastAuthorizationHeader).toBeUndefined();
  });
});
