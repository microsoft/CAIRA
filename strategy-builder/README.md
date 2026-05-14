# CAIRA Strategy Builder

The strategy builder is the application-layer source of truth for CAIRA. It contains reusable components, contracts, templates, test tooling, and generator logic that produce the committed deployment strategies under `deployment-strategies/`.

Most users should install the CAIRA skill and let their coding agent inspect this tree as reference material. Work directly in `strategy-builder/` only when contributing to CAIRA itself.

If you are extending CAIRA with new components, variants, templates, or
deployment strategies, start with `../docs/contributing/extending_caira.md` for
the end-to-end workflow. Use this README and `docs/guide/` for the
strategy-builder-specific implementation details.

## What lives here

- `components/` — agent, API, frontend, and strategy infrastructure building blocks
- `contracts/` — API contracts shared across implementations
- `scripts/` — generation, deployment, validation, and developer tooling
- `testing/` — contract, compose, container, and end-to-end validation helpers
- `docs/` — focused guidance for strategy-builder contributors

## Common workflows

From the repository root, prefer the Taskfile wrappers:

```bash
task strategy:generate
task strategy:validate:drift
task validate:pr
task strategy:validate:pr
task strategy:test:local
task strategy:dev -- deployment-strategies/foundry_agentic_app/typescript-openai-agent-sdk-aca
task strategy:deploy -- deployment-strategies/foundry_agentic_app/typescript-openai-agent-sdk-aca
task strategy:test:deployed -- deployment-strategies/foundry_agentic_app/typescript-openai-agent-sdk-aca
```

Use `task strategy:deploy:reference` only when you are explicitly working on the shared baseline deployment or the generated `.env` synchronization flow.

If you are iterating inside a specific component, direct `npm` or `dotnet` commands inside that component directory are still fine.

## Generated output

`deployment-strategies/` is generated and committed. Do not hand-edit files there; change the source in `strategy-builder/` and regenerate instead.
