---
name: caira
description: Primary entrypoint for coding agents using CAIRA as reference material to design and build generative AI solutions with Azure AI Foundry, Azure OpenAI-compatible endpoints, agent frameworks, APIs, and frontends tailored to a user's scenario.
compatibility: Needs access to the github.com/microsoft/caira repository.
metadata:
  author: Microsoft
  version: "0.4.3"
---

# CAIRA

Use this skill when a user wants to build or extend a generative AI solution. CAIRA is a reference library, not an application generator: inspect the repository, select the smallest relevant reference components, and adapt them into the user's workspace.

## Intake before generating changes

Ask only what is needed to choose components:

1. What outcome is the user trying to build?
1. Do they already have Foundry/OpenAI endpoints, hosting, identity, observability, or frontend/API code?
1. What kind of networking isolation or security boundaries are needed?
1. Which programming languages or frameworks does the user prefer? If the user prefers something that's not directly in the CAIRA references, try to follow the same architectural patterns and design principles shown in the CAIRA reference components, but adapt them to the user's preferred languages or frameworks.
1. Which components are needed now: Foundry, Container Apps, API, frontend, or only app code? If the answer shows the user only needs one component, use only that component.

## Core rules

- Use the `reference-architectures` directory in the `github.com/microsoft/caira/` repository as the canonical source of truth. Inspect it either with the GitHub MCP server if available, through GitHub raw URLs, or clone the repository temporarily to inspect `reference-architectures/` locally.
- When reviewing the reference architectures, read the full code of the desired component. Do not limit the investigation to the README or docs. The source of truth is the code.
- Prefer small component references over full-stack copying.
- For scenarios that need OpenAI-compatible endpoints, prefer the Foundry IaC reference unless the user already has endpoints or asks for a different approach.
- Determine what the user already has before proposing new infrastructure.
- Always use managed identities or other passwordless identity patterns. NEVER USE API keys, static credentials, or secrets, unless the user explicitly asks for an API-key- or secret-based approach.
- When implementing IaC for Foundry, use the Azure Verified Module, as shown in the reference architectures. Don't use standalone Terraform resources related to Foundry unless explicitly requested.
- If an API that communicates with Foundry needs to be implemented, ALWAYS prefer using Foundry resources instead of Azure OpenAI resources, unless the user explicitly asks for Azure OpenAI. Even with the OpenAI Agents SDK.
- Before proposing repository security scans, check whether the target repository already uses or has configured Gitleaks, Trivy, or similar tools for secret, dependency, container, or IaC scanning. If similar scanning is missing, ask whether the user wants to add Gitleaks and/or Trivy scans before implementing them.
- Keep recommendations focused on the current reference components listed below.
- Explain which CAIRA paths influenced the recommendation or generated files.
- Always ask follow-up questions to narrow down the user's needs and avoid unnecessary copying of reference code.
- Before start implementing, confirm the user's scenario, needs, and which CAIRA reference components, configuration, networking, and security boundaries will be used.

## Current reference components

| Need | CAIRA reference path |
|------|----------------------|
| Foundry foundation | `reference-architectures/iac/foundry/` |
| Container Apps hosting for API + frontend | `reference-architectures/iac/container-apps/` |
| TypeScript API using OpenAI Agents SDK | `reference-architectures/app/api/typescript/openai-agents-sdk/` |
| TypeScript API using Foundry Agent Service | `reference-architectures/app/api/typescript/foundry-agent-service/` |
| C# API using Microsoft Agent Framework | `reference-architectures/app/api/csharp/microsoft-agent-framework/` |
| React frontend | `reference-architectures/app/frontend/typescript/react/` |
| Frontend/API contract | `reference-architectures/app/API_CONTRACT.md` |

## How to use CAIRA references

1. Inspect the relevant component source files.
1. Copy or adapt only the files needed for the user's stack.
1. Remove sample text, model names, env vars, or Terraform variables that do not apply to the user's scenario.
1. Preserve the component's validation style: npm scripts for TypeScript, .NET build for C#, Terraform validation for IaC, Docker builds for containers.
1. Mention the exact CAIRA paths used and what was intentionally left out.
