# CAIRA

CAIRA (Composable AI Reference Architectures) is a small reference library for agents building Azure AI solutions. The primary entrypoint is the CAIRA skill: install the skill, let your coding agent inspect this repository, and have it copy or adapt only the reference pieces that fit your scenario.

Each directory under `reference-architectures/` is an independent reference component that should be easy to read, validate, copy, and modify.

## Quickstart

Install the skill from your project directory:

```bash
bunx skills add github.com/microsoft/CAIRA/skills
```

or:

```bash
npx skills add github.com/microsoft/CAIRA/skills
```

Then ask your agent to use CAIRA for your scenario, for example:

```text
Create an agentic monitoring system to detect security-related issues in a configured GitHub repository using Foundry, an API, and a React frontend with a dashboard.
```

## Reference components

| Path | Purpose |
|------|---------|
| `reference-architectures/iac/foundry/` | Terraform for a Foundry account, project, and model deployment. |
| `reference-architectures/iac/container-apps/` | Terraform for Azure Container Apps hosting exactly two apps: API and frontend. |
| `reference-architectures/app/api/typescript/openai-agents-sdk/` | Agentic API reference for Typescript using the OpenAI Agents SDK. |
| `reference-architectures/app/api/typescript/foundry-agent-service/` | Agentic API reference for Typescript using Foundry Agent Service. |
| `reference-architectures/app/api/csharp/microsoft-agent-framework/` | Agentic API reference for C# and Microsoft Agent Framework. |
| `reference-architectures/app/frontend/typescript/react/` | Minimal React frontend with a small BFF proxy to the API. |

## Contributor workflow

Install dependencies and validate all reference components:

```bash
task bootstrap
task validate
```

Validation is intentionally component-local: TypeScript components use npm scripts, C# uses .NET build, Terraform uses `fmt/init/validate`, and each app container has a Dockerfile that can be built independently. You can also run pieces independently with `task security`, `task validate:code`, and `task validate:containers`. Dependency audits and Trivy scans are available separately with `task validate:audit`, `task security:trivy`, and `task validate:containers:trivy`.

The CAIRA skill test can be run locally with `task test:skill`. It installs the skill into a fresh empty workspace, runs the README example prompt through GitHub Copilot CLI in unattended mode, then asks Copilot to verify the generated result.

For the weekly GitHub Actions run, the workflow signs in to Azure with OIDC, gets a short-lived Azure AI Foundry token from the Azure CLI, and configures Copilot CLI BYOK provider environment variables (`COPILOT_PROVIDER_BASE_URL`, `COPILOT_PROVIDER_MODEL_ID`, and optionally `COPILOT_PROVIDER_WIRE_API`) for an OpenAI-compatible Foundry endpoint. The OIDC service principal should have the least-privilege **Cognitive Services OpenAI User** role at the Azure AI Foundry / Azure OpenAI resource that hosts the configured deployment.

## Developing CAIRA

For information related to developing CAIRA, start with the documentation in [`docs/`](docs/). It includes contributor guidance, local environment setup, troubleshooting notes, and the repository security posture.
