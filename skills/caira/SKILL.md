---
name: caira
description: Primary entrypoint for coding agents using CAIRA as reference material to design and build generative AI solutions like agents and chatbots that use Azure AI, Azure OpenAI, Foundry and/or models from OpenAI (gpt), Anthropic (claude Opus, Sonnet and Haiku) or other models available in Foundry, tailored to a user's scenario.
compatibility: Requires network access to github.com, api.github.com, and raw.githubusercontent.com.
metadata:
  author: Microsoft
  version: "0.4.0"
---

# CAIRA

Install this skill when a user wants to build or extend a generative AI solution. This skill is the primary entrypoint for using CAIRA: the agent should inspect the CAIRA repository as reference material and adapt what it finds into a user-specific solution instead of defaulting to editing the CAIRA repository itself.

## Entrypoint model

- Default to helping the user build or adapt their own solution, not to changing CAIRA itself.
- Treat the CAIRA repository as live reference material that the agent can inspect at runtime.
- Only treat the CAIRA repository itself as the target workspace when the user explicitly asks to modify CAIRA itself.

## Core rules

- Every scenario that requires some kind of OpenAI-compatible endpoints should use them from CAIRA's Foundry reference architecture unless the user explicitly wants to use their own endpoints or another approach. Don't create standalone Azure OpenAI services or resources. The main entrypoint for LLM-based capabilities should be the Foundry architecture in CAIRA, and the agent should adapt that architecture into the user's scenario instead of defaulting to building a new one from scratch.
- Treat the CAIRA repository as the source-of-truth reference library.
- Start with `deployment-strategies/` and `docs/` as the main reference entry points for end-to-end guidance and runnable patterns.
- Use `strategy-builder/` only when the deployment strategies or docs do not answer the question, or when you need the underlying source-of-truth implementation details behind a generated strategy.
- Default to creating or modifying files in the user's target workspace, not inside CAIRA, unless the user explicitly wants to change CAIRA itself.
- Before generating files in the user's repo, ask whether they want to copy the needed CAIRA assets into their repo (`copy` mode) or keep a dependency on the CAIRA repo (`reference` mode).
- Use `main` as the default discovery ref when browsing CAIRA.
- If the user chooses `reference` mode, ask whether they have a preferred CAIRA release, tag, or commit. If they do not, prefer a concrete pinned ref (release tag first, then commit SHA) instead of leaving generated references on `main`.
- Discover the current reference architectures, modules, and deployment strategies at runtime instead of hardcoding lists.
- Reason across the whole product surface: layered reference-architecture infra, application components, and generated deployment strategies.
- Map discovered CAIRA assets to the user's scenario before generating code, infrastructure, or recommendations.
- Explain which CAIRA assets influenced the recommendation or generated output.
- Prefer passwordless Azure authentication unless the user explicitly requests another approach.
- Determine what the user already has before proposing or generating a full end-to-end implementation.
- Reuse existing user assets when possible, such as Foundry resources, projects, endpoints, Application Insights instances, API Management instances, and app layers.
- Before proposing or generating app-layer changes, ask which app components are actually needed, such as frontend, API, agent service/container, capability host, or other app-facing services.
- For each needed app component, ask how the user wants to run it right now: local process/container only, existing hosting they already have, or new Azure-hosted deployment.
- For each needed app component, ask whether its supporting dependencies are already provided or need to be created, such as container registry, hosting environment, identities, endpoints, secrets/config, storage, and observability.
- If the user wants a component to run locally for now, do not default to Azure deployment, registry creation, hosted infrastructure, or CI/CD wiring for that component.
- If a component is containerized and the user already has a registry, reuse it; only add registry creation when the user explicitly needs it.
- Treat CAIRA's sample activities, mode names, and fictional business content as sample-only. Never copy sample-domain prompts or UX text as real business logic unless the user explicitly asks for sample content.
- Exclude CAIRA internal testing and deployed-validation overlay assets from the default reference set unless the user explicitly asks for testing infrastructure.
- Treat deployment strategies as composable slices, not all-or-nothing bundles. Copy or adapt only the slices the user actually needs.
- Do not bring a whole CAIRA strategy into the target solution just to disable most of it later. Prefer omitting unused slices entirely.
- If the user wants APIM / AI gateway behavior, include the whole APIM slice together: Terraform resources, outputs, environment wiring, deploy/test wiring, and any related docs or policies.
- If the user does not want APIM, ignore that slice completely and remove APIM-specific code, variables, outputs, and documentation from the target solution instead of carrying them in a disabled state.
- Apply the same selective-slice rule to every major feature area: observability, private networking, capability hosts, extra projects, testing overlays, frontend, API, and agent containers.

## Minimal intake before proposing changes

Do the smallest intake that still lets you choose the right slices. At minimum, determine:

1. **Outcome** — what the user is actually trying to ship or fix.
1. **Existing assets** — what they already have and want to keep.
1. **Needed slices** — which CAIRA components are in scope versus explicitly out of scope.
1. **Runtime target** — local-only, existing hosting, or new Azure deployment.
1. **Adoption mode** — `copy` mode or `reference` mode.

If any of those are unknown, do not default to a full end-to-end CAIRA clone.

## Component intake matrix

Use this matrix to avoid overbuilding:

| Component          | Determine if needed                                                                     | Reuse-first questions                                                              | Typical CAIRA sources                                                                           |
|--------------------|-----------------------------------------------------------------------------------------|------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------|
| Frontend           | Does the user need a user-facing web app at all?                                        | Existing SPA? Existing BFF? Existing auth/session model?                           | `deployment-strategies/.../frontend/`, `strategy-builder/components/frontend/react-typescript/` |
| API                | Is a business API needed between UI/callers and the agent?                              | Existing REST API? Existing gateway? Existing conversation/state layer?            | `deployment-strategies/.../api/`, `strategy-builder/components/api/`                            |
| Agent container    | Does the user need a new agent runtime, or only prompt/tool changes in an existing one? | Existing agent service? Existing Foundry/OpenAI endpoint? Existing container host? | `deployment-strategies/.../agent/`, `strategy-builder/components/agent/`                        |
| Capability host    | Is the user specifically using a Foundry Agent Service capability-host pattern?         | Existing capability host or MCP-style host already present?                        | `deployment-strategies/.../infra/`, `strategy-builder/infra/reference-architectures/`           |
| Observability      | Do they need telemetry hookup only, or a whole platform slice?                          | Existing App Insights? Existing OTEL collector? Existing dashboards/alerts?        | strategy READMEs, infra modules, app component env/config                                       |
| APIM / AI gateway  | Do they need governance, policy, or gateway-based endpoint exposure?                    | Existing APIM instance? Existing AI gateway conventions?                           | strategy `infra/`, APIM outputs/docs                                                            |
| Private networking | Do they need private endpoints/network isolation now?                                   | Existing VNet, DNS, hub-spoke, or private endpoint standards?                      | reference architecture + infra modules                                                          |

## Copy mode vs reference mode

Choose a mode explicitly before generating files:

### Copy mode

Use `copy` mode when:

- the user wants to own and edit the assets directly
- the solution needs meaningful customization beyond light wiring
- the user does not want a runtime dependency on the CAIRA repo
- a single slice should be lifted into an existing codebase

In copy mode:

- copy only the selected slices
- remove unrelated files, env vars, outputs, docs, and tests
- rewrite sample-domain prompts/content to the user's scenario unless they explicitly want CAIRA sample content

### Reference mode

Use `reference` mode when:

- the user wants to stay close to upstream CAIRA
- they only need infra/module references, env contracts, or a small number of files
- they prefer updates to flow from a pinned CAIRA release or commit

In reference mode:

- pin to a concrete release tag or commit SHA
- document the exact CAIRA paths and pinned ref used
- avoid generating references to `main` unless the user explicitly wants floating dependencies

## Slice selection rules

Treat each major concern as a selectable slice with supporting wiring:

- frontend
- API
- agent container
- capability host
- observability
- APIM / AI gateway
- private networking
- testing / validation overlays

For every selected slice:

- include the wiring that makes it actually runnable end to end
- include the required env vars, identities, outputs, and docs

For every unselected slice:

- omit it completely
- do not leave dead flags, unused outputs, placeholder docs, or disabled modules behind

## Reuse of user-owned existing assets

Prefer reusing what the user already owns before creating new CAIRA-shaped infrastructure.

### Reuse-first order

1. Existing Foundry/OpenAI-compatible endpoints
1. Existing hosting environments
1. Existing identities and auth wiring
1. Existing observability resources
1. Existing API gateways / APIM
1. Existing private-networking patterns

Only add CAIRA assets for the gaps that remain after that reuse pass.

## Provenance rules

When recommending or generating a slice, explain where it came from:

- cite the exact CAIRA path(s)
- say whether the asset came from `deployment-strategies/`, `docs/`, or `strategy-builder/`
- explain why that slice was selected and what was intentionally left out
- if adapting from a generated strategy, say which source component backs it

Good provenance example:

> Use the API slice from `deployment-strategies/foundry_agentic_app/typescript-openai-agent-sdk-aca/api/` as the runnable reference, backed by `strategy-builder/components/api/typescript/` for source-of-truth edits. Omit the frontend and APIM slices because the user already has a web app and does not want a gateway.

## Partial adoption decision patterns

### Agent-only + existing Foundry

Use when the user already has:

- a Foundry project or Azure OpenAI endpoint
- hosting for the agent, or a plan to host only that component
- no need for CAIRA frontend or business API

Then:

- reuse the existing endpoint/project
- take only the chosen agent container slice
- keep only the agent's required env/auth wiring
- omit frontend, API, APIM, and unrelated infra unless explicitly requested

### Observability hookup only

Use when the user already has app code and hosting, but needs telemetry alignment.

Then:

- inspect existing OTEL/App Insights setup first
- copy only the observability env/config and any minimal infra wiring required
- do not import the full reference architecture or app stack just to add telemetry

### Existing hosting + new agent

Use when the user already has a platform such as ACA, AKS, App Service, or another container host.

Then:

- treat hosting as provided
- adapt only the agent container plus the required identity/env contract
- add registry creation only if the user lacks an existing registry
- keep deployment docs scoped to that host instead of copying the full CAIRA deployment strategy

## What not to do

- Do not copy a whole CAIRA strategy when the user needs only one or two slices.
- Do not recreate Foundry, APIM, observability, or hosting resources the user already has.
- Do not leave sample-domain prompts, labels, or fictional UX text in a production-facing user solution by default.
- Do not include testing overlays, private networking, capability hosts, or APIM just because they exist in CAIRA.
- Do not recommend a full end-to-end stack until you have confirmed the user actually needs every layer.

## Dynamic discovery workflow

1. Resolve the discovery ref: use `main` by default when browsing CAIRA. If the user later chooses `reference` mode for generated dependencies, pin those generated references to a specific release tag or commit instead of leaving them on `main`.
1. Inspect the user's project and requirements first to determine which architecture slices are missing versus already present.
1. Build a per-component intake matrix for each app component in scope, such as frontend, API, agent service/container, capability host, and other app services. For each component, ask whether it is needed, how it should run, and whether its supporting assets are already provided or need creation.
1. If a component should run locally for now, keep that component local-first and omit Azure deployment wiring, registry creation, hosted infrastructure, and CI/CD wiring unless the user explicitly asks for them.
1. If a component is containerized, ask whether it should stay local, use an existing registry, or require a new registry plus image push flow.
1. Ask whether the user wants `copy` mode (copy CAIRA assets into their repo) or `reference` mode (keep a dependency on the CAIRA repo) before generating files.
1. If the user chooses `reference` mode, ask whether they want a specific CAIRA release, tag, or commit. If they do not care, resolve a concrete pinned ref yourself, preferring a release tag and falling back to a commit SHA.
1. Identify feature slices and their supporting files before copying anything. For example, treat APIM, observability, private networking, capability hosts, app layers, and testing overlays as separate selectable slices.
1. Discover available assets from repository APIs in this order:
   - `deployment-strategies/`
   - `docs/`
   - `strategy-builder/infra/reference-architectures/`
   - `strategy-builder/infra/modules/`
   - `strategy-builder/infra/testing/`
   - `strategy-builder/`
1. Treat the generated deployment strategies and the docs as the default working reference. Only drop into `strategy-builder/` when you need deeper implementation details, reference-architecture internals, or source-of-truth files that are not already surfaced by the generated strategies and docs.
1. Inspect the default reference architecture first (`strategy-builder/infra/reference-architectures/foundry_agentic_app/`), starting with `README.md`, `main.tf`, `application_platform.tf`, `agent_service.tf`, `api_service.tf`, `frontend_service.tf`, `dependant_resources.tf`, and the referenced modules, unless the user's requirements clearly demand a different discovered option.
1. Treat advanced capability-host, private-networking, and extra-project patterns as opt-in. Do not copy them by default when the basic sample already fits the user's scenario.
1. Treat selective adoption as a first-class path. Decide whether the user needs only infra, only app code, only observability hookup, only endpoint wiring, or a full end-to-end sample.
1. For every selected slice, include the supporting wiring that makes it actually work end-to-end. For every unselected slice, leave it out rather than copying it in a disabled form.
1. Exclude `testing_overlay.tf`, `testing_variables.tf`, `testing_outputs.tf`, and related internal testing assets unless the user explicitly asks for testing or validation resources.
1. Inspect the relevant files for the chosen architecture or strategy.
1. Translate the discovered CAIRA patterns into a user-specific recommendation, design, or implementation plan.
1. Present the recommendation plus trade-offs before generating changes.

## Partial adoption checklist

- Check whether the user already has a Foundry account or project.
- Check whether the user already has application hosting and only needs agent/app code.
- Check whether the user already has observability resources and only needs OTEL/App Insights hookup.
- Check whether the user already has API Management and only needs AI gateway exposure or policies.
- Check whether the user only needs resource IDs, endpoints, or environment settings from the architecture.
- For each app component in scope, check whether the user wants or needs it at all:
  - frontend
  - API
  - agent service / container
  - capability host for Foundry Agent Service-specific standard (not basic) deployment
  - other app-facing services
- For each needed app component, check how it should run right now:
  - local process
  - local container
  - existing hosting the user already has
  - new Azure-hosted deployment
- For each needed app component, check whether its required dependencies are provided or should be created:
  - container registry
  - hosting environment
  - identities / auth wiring
  - endpoints / ingress
  - secrets / configuration
  - storage / data dependencies
  - observability wiring
- If a component is containerized, check whether the user already has a Docker/container registry and whether images should stay local or be pushed there.
- If the user wants a component to stay local for now, avoid adding Azure deployment artifacts or registry wiring for that component.
- Check whether the user prefers `copy` mode or `reference` mode for CAIRA assets in their repo.
- If they prefer `reference` mode, check whether they already require a specific CAIRA release, tag, or commit; otherwise propose the concrete pinned ref you will use.
- Check whether each optional slice is explicitly in scope or out of scope:
  - APIM / AI gateway
  - observability
  - private networking
  - capability hosts
  - frontend
  - API
  - agent container
- For each out-of-scope slice, avoid copying its related files, variables, outputs, and docs into the target solution.

## Source-of-truth URLs

- Repository root: <https://github.com/microsoft/CAIRA>
- Default discovery ref: `main` unless the user explicitly asks to browse another ref.
- Reference-mode generated module or file URLs should use a concrete pinned ref, not `main`, unless the user explicitly asks for a floating dependency.
- Latest release page (for pinned `reference` mode dependencies): <https://github.com/microsoft/CAIRA/releases/latest>
- Deployment strategies listing API: `GET /repos/microsoft/CAIRA/contents/deployment-strategies?ref=main`
- Docs listing API: `GET /repos/microsoft/CAIRA/contents/docs?ref=main`
- Reference architectures listing API: `GET /repos/microsoft/CAIRA/contents/strategy-builder/infra/reference-architectures?ref=main`
- Modules listing API: `GET /repos/microsoft/CAIRA/contents/strategy-builder/infra/modules?ref=main`
- Infra testing listing API: `GET /repos/microsoft/CAIRA/contents/strategy-builder/infra/testing?ref=main`
- Strategy builder listing API: `GET /repos/microsoft/CAIRA/contents/strategy-builder?ref=main`
