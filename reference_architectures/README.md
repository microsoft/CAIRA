# Baseline Configurations

CAIRA provides several baseline configurations for Azure AI Foundry based solutions, so users can have a consistent, scalable, reliable deployment of Azure AI Foundry and supporting infrastructure in an accelerated time frame in support of agentic workloads.

## Basic AI Foundry

This configuration is designed as a simple development environment for common AI workloads such as generative AI application development, building autonomous AI agents capable of performing complex tasks, as well as the evaluation and testing of AI models.

**Deploys Azure AI Foundry with basic setup**

- Project and deployment for getting started
- Public networking
- Microsoft-managed file storage
- Microsoft-managed resources for storing Agents threads and messages

See the reference architecture at `reference_architectures/foundry_basic`.

## Basic AI Foundry (Private)

This provides the same features of basic but exposes the Foundry APIs via private endpoints.

**Deploys Azure AI Foundry with basic private setup**

- Project and deployment for getting started
- Bring-your-own private networking
- Microsoft-managed file storage
- Microsoft-managed resources for storing Agents threads and messages

See the reference architecture at `reference_architectures/foundry_basic_private`.

## Standard AI Foundry with Capability Host

This configuration includes everything in the Basic setup and adds explicit capability host connections for data services so you can control where agent data is stored and how it's accessed.

**Deploys Azure AI Foundry with explicit host connections for data sovereignty and compliance**

- Project and default model deployments
- Explicit agent capability host connections to Azure Cosmos DB, Azure AI Search, and Azure Storage
- Bring-your-own or module-provisioned dependent services
- Identity-first defaults (RBAC), ready for enterprise hardening
- Built-in observability via Log Analytics and Application Insights

See the reference architecture at `reference_architectures/foundry_standard`.

## Standard AI Foundry with Capability Host (Private)

This configuration includes everything in the standard setup but exposes the Foundry APIs as well as the capability host resources via private endpoints.

**Deploys Azure AI Foundry with explicit host connections for data sovereignty and compliance**

- Project and default model deployments
- Explicit agent capability host connections to Azure Cosmos DB, Azure AI Search, and Azure Storage
- Bring-your-own or module-provisioned dependent services
- Bring-your-own network for capability hosts and agents to be connected to.
- Identity-first defaults (RBAC), ready for enterprise hardening
- Built-in observability via Log Analytics and Application Insights

See the reference architecture at `reference_architectures/foundry_standard_private`.

## Available Reference Architectures

- **foundry_basic** - Public networking with portal deployment support
- **foundry_basic_private** - Basic configuration with network isolation
- **foundry_standard** - Enterprise features with Bring Your Own Resource (BYOR) approach
- **foundry_standard_private** - Enterprise configuration with protected agent support

Foundry-only use case: If you only need Azure AI Foundry (account, project, model deployments, observability) and do NOT plan to use the Agent Service, choose one of the `_basic` reference architectures (`foundry_basic` for public endpoints or `foundry_basic_private` for private networking). The `_standard` variants add agent-focused dependent resources (Cosmos DB, Storage, AI Search) and capability host connection wiring that are not required when not using the Agent service.

## Deployment Decision Matrix

| Customer Requirement   | Portal Possible | IaC Required  | Recommended RA           |
|------------------------|-----------------|---------------|--------------------------|
| Basic PoC/Development  | ✅ Yes           | ❌ No          | foundry_basic            |
| Network Isolation Only | ⚠️ Limited      | ✅ Yes         | foundry_basic_private    |
| Enterprise Features    | ⚠️ Limited      | ✅ Yes         | foundry_standard         |
| Protected Agents       | ❌ No            | ✅ Yes         | foundry_standard_private |
| Multi-Project          | ✅ Yes           | ✅ Recommended | Any RA                   |

## Resource Selection Matrix

| Reference Architecture   | AI Search | Cosmos DB | Storage Account | App Insights | Container Apps |
|--------------------------|-----------|-----------|-----------------|--------------|----------------|
| foundry_basic            | Optional  | Optional  | Required        | Required     | Not Supported  |
| foundry_basic_private    | Optional  | Optional  | Required        | Required     | Not Supported  |
| foundry_standard         | Required  | Optional  | Required        | Required     | Not Required   |
| foundry_standard_private | Required  | Required  | Required        | Required     | Required       |

## Additional Resources

For detailed networking requirements, security configurations, and deployment prerequisites, refer to the [official Azure AI Foundry documentation](https://learn.microsoft.com/en-us/azure/ai-foundry/).

For Infrastructure-as-Code implementation details, see the individual reference architecture folders in this repository.
