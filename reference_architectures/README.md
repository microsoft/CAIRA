# Baseline Configurations

CAIRA provides several baseline configurations for Azure AI Foundry based solutions, so users can have a consistent, scalable, reliable deployment of Azure AI Foundry and supporting infrastructure in an accelerated time frame in support of agentic workloads.

## Basic AI Foundry

This configuration is designed as a simple development environment for common AI workloads such as generative AI application development, building autonomous AI agents capable of performing complex tasks, as well as the evaluation and testing of AI models.

**Deploys Azure AI Foundry with basic setup**

- Project and deployment for getting started
- Public networking
- Microsoft-managed file storage
- Microsoft-managed resources for storing Agents threads and messages

## Basic AI Foundry (Private)

This provides the same features of basic but exposes the Foundry APIs via private endpoints.

**Deploys Azure AI Foundry with basic private setup**

- Project and deployment for getting started
- Bring-your-own private networking
- Microsoft-managed file storage
- Microsoft-managed resources for storing Agents threads and messages

## Standard AI Foundry with Capability Host

This configuration includes everything in the Basic setup and adds explicit capability host connections for data services so you can control where agent data is stored and how it's accessed.

**Deploys Azure AI Foundry with explicit host connections for data sovereignty and compliance**

- Project and default model deployments
- Explicit agent capability host connections to Azure Cosmos DB, Azure AI Search, and Azure Storage
- Bring-your-own or module-provisioned dependent services
- Identity-first defaults (RBAC), ready for enterprise hardening
- Built-in observability via Log Analytics and Application Insights

## Standard AI Foundry with Capability Host (Private)

This configuration includes everything in the standard setup but exposes the Foundry APIs as well as the capability host resources via private endpoints.

**Deploys Azure AI Foundry with explicit host connections for data sovereignty and compliance**

- Project and default model deployments
- Explicit agent capability host connections to Azure Cosmos DB, Azure AI Search, and Azure Storage
- Bring-your-own or module-provisioned dependent services
- Bring-your-own network for capability hosts and agents to be connected to.
- Identity-first defaults (RBAC), ready for enterprise hardening
- Built-in observability via Log Analytics and Application Insights

See the reference architecture at `reference_architectures/foundry_standard`.
