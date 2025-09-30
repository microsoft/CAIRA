<!-- META
title: Azure AI Foundry - Standard Configuration
description: This Terraform configuration deploys an Azure AI Foundry environment that delivers all the capabilities of the basic configuration and adds enterprise features for data sovereignty and resource compliance.
author: CAIRA Team
ms.date: 08/14/2025
ms.topic: architecture
estimated_reading_time: 9
keywords:
  - reference architecture
  - azure ai foundry
  - standard configuration
  - terraform
  - rbac
  - data sovereignty
  - resource compliance
  - model deployments
-->

# Azure AI Foundry - Standard Configuration

This Terraform configuration deploys an Azure AI Foundry environment that delivers all the capabilities of the basic configuration and adds features that supports data sovereignty and resource compliance. It lets you explicitly control which Azure Cosmos DB, Azure AI Search, and Azure Storage resources your agents use, so data stays where you need it and access is governed according to your policies.

## Overview

The Standard configuration is suited for:

- **Enterprise/regulated workloads** that need explicit control over data placement and dependencies
- **Teams standardizing on shared platform services** (Search, Cosmos DB, Storage) across projects
- **Environments that need stronger identity-first and RBAC-based access controls**

## Architecture

![Architecture Diagram](./images/architecture.drawio.svg)

| Component                                          | Purpose                            | Configuration                                                                                 |
|----------------------------------------------------|------------------------------------|-----------------------------------------------------------------------------------------------|
| **Resource Group**                                 | Logical container for resources    | Created if not provided; can use existing resource group via `resource_group_resource_id`     |
| **Azure AI Foundry Account and Project**           | Core AI platform resources         | Deployed via Terraform module; project identity managed automatically                         |
| **Model Deployments**                              | Provides default models for agents | Uses `common_models` module; includes GPT‑4.1, o4‑mini, text-embedding-3-large                |
| **Log Analytics Workspace + Application Insights** | Monitoring and observability       | App Insights connected to Log Analytics Workspace; deployed and wired automatically           |
| **Azure Cosmos DB Account**                        | Data storage for agents            | Provisioned or referenced via `dependant_resources.tf`; explicitly wired via host connections |
| **Azure Storage Account**                          | File and blob storage for agents   | Provisioned or referenced via `dependant_resources.tf`; explicitly wired via host connections |
| **Azure AI Search Service**                        | Search capabilities for agents     | Provisioned or referenced via `dependant_resources.tf`; explicitly wired via host connections |

Note: The architecture diagram is similar in shape to the basic configuration with the addition that agent capability host connections are explicitly bound to Cosmos DB, Storage, and Search you select or provide.

## Key Features

- **🌍 Data sovereignty**: Choose the exact Cosmos DB, Storage, and Search resources the agents will use
- **🔒Resource compliance**: Identity-first defaults (e.g., local authentication disabled where possible), ready to tighten networking and encryption
- **📊Observability**: Log Analytics and Application Insights out of the box
- **📈Extensible**: Swap default dependent resources for existing, approved ones via data sources

## Getting Started

### Prerequisites

1. **Active Azure subscription(s) with appropriate permissions** for the target resource group and services. Suggested roles include (depending on deployment approach):

   - **Workload Subscription**
     - **Role Based Access Control Administrator**: Needed over the resource group to create the relevant role assignments
     - **Network Contributor**: Needed over the resource group to create virtual network and Private Endpoint resources
     - **Azure AI Account Owner**: Needed to create a cognitive services account and project
     - **Owner or Role Based Access Administrator**: Needed to assign RBAC to the required resources (Cosmos DB, Azure AI Search, Storage)
     - **Azure AI User**: Needed to create and edit agents
     - **Cognitive Services OpenAI Contributor**: Needed to write OpenAI responses API

1. **Register resource providers** (at minimum):

    ```shell
    az provider register --namespace 'Microsoft.CognitiveServices'
    az provider register --namespace 'Microsoft.DocumentDB'
    az provider register --namespace 'Microsoft.Search'
    az provider register --namespace 'Microsoft.Storage'
    ```

1. Sufficient quota for all resources in your target Azure region

1. Azure CLI installed and configured on your local workstation or deployment pipeline server

1. Terraform CLI version v1.13 or later on your local workstation or deployment pipeline server. This template requires the usage of both the AzureRm and AzApi Terraform providers.

### Standard Deploy

1. **Clone the repository**:

   ```shell
   git clone <repository-url>
   cd reference_architectures/foundry_standard
   ```

1. **Login to your Azure subscription**

    ```shell
    az login
    ```

1. **Set your active subscription**

    ```shell
    az account set --subscription "<your_subscription_id>"
    ```

1. **Export the subscription ID as an environment variable to make it available to the AzureRM and AzAPI Terraform providers**

    ```shell
    export ARM_SUBSCRIPTION_ID=$(az account show --query id -o tsv)
    ```

1. **Initialize Terraform**:

   ```shell
   terraform init
   ```

1. **Review the plan**:

   ```shell
   terraform plan
   ```

1. **Deploy the infrastructure**:

   ```shell
   terraform apply
   ```

## Controlling Dependent Services (Data Sovereignty)

This configuration wires agent capability host connections to Cosmos DB, Storage, and AI Search. You have two paths:

1. **Default** (create new dependent resources)
   - The file `dependant_resources.tf` provisions Cosmos DB, Storage, and AI Search in the same resource group/region.
   - The module input `agent_capability_host_connections` in `main.tf` connects the agent to these newly created resources.

1. **Bring Your Own** (use existing, compliant resources)
   - Replace the resources in `dependant_resources.tf` with data sources that reference approved/shared services, and wire those into `agent_capability_host_connections` in `main.tf`.
   - Example (replace names/ids accordingly):

```terraform
data "azurerm_cosmosdb_account" "cosmosdb" {
  name                = "<existing-cosmos-name>"
  resource_group_name = "<existing-rg>"
}

data "azurerm_storage_account" "sa" {
  name                = "<existing-storage-name>"
  resource_group_name = "<existing-rg>"
}

data "azapi_resource" "search" {
  type      = "Microsoft.Search/searchServices@2025-05-01"
  name      = "<existing-search-name>"
  parent_id = "/subscriptions/<subId>/resourceGroups/<existing-rg>"
}

module "ai_foundry" {
  # ...existing inputs...
  agent_capability_host_connections = {
    cosmos_db = {
      resource_id         = data.azurerm_cosmosdb_account.cosmosdb.id
      name                = data.azurerm_cosmosdb_account.cosmosdb.name
      endpoint            = data.azurerm_cosmosdb_account.cosmosdb.endpoint
      location            = var.location
      resource_group_name = "<existing-rg>"
    }
    storage_account = {
      resource_id           = data.azurerm_storage_account.sa.id
      name                  = data.azurerm_storage_account.sa.name
      location              = var.location
      primary_blob_endpoint = data.azurerm_storage_account.sa.primary_blob_endpoint
    }
    ai_search = {
      resource_id = data.azapi_resource.search.id
      name        = data.azapi_resource.search.name
      location    = var.location
    }
  }
}
```

**Role assignments**: The AI Foundry Project uses a managed identity. The module includes role assignment wiring for the provided host connections; verify and adjust as needed in `modules/ai_foundry/agent_capability_host_connections.role_assignments.tf`. The output `ai_foundry_project_identity_principal_id` is provided for audits or custom RBAC.

**Networking and compliance**: Defaults keep public network access enabled for simplicity. For stricter environments, apply your organization's policies (private endpoints/VNET integration, customer-managed keys, firewall rules) and update the resources accordingly.

## Monitoring and Observability

- Application Insights connected to Log Analytics Workspace
- Use Log Analytics for queries/dashboards; App Insights for app performance and distributed tracing

## Cost Considerations

- In addition to AI Foundry costs, this configuration provisions Cosmos DB, Storage, and AI Search; review SKUs/retention settings
- Default LAW retention is 30 days (PerGB2018); adjust to your needs

## Troubleshooting

- **BYO resource errors**: Confirm resource IDs/names/regions; ensure the project identity has required RBAC on Cosmos DB, Storage, and Search
- **Quota/region**: Check model availability and service quotas in your target region
- **Provider registration**: Validate all required providers are registered
- **Terraform**: `terraform validate` and ensure Azure CLI context is correct (`az account show`)

---

<!-- BEGIN_TF_DOCS -->
## Requirements

| Name      | Version        |
|-----------|----------------|
| terraform | >= 1.13, < 2.0 |
| azapi     | ~> 2.6         |
| azurerm   | ~> 4.40        |

## Providers

| Name    | Version |
|---------|---------|
| azurerm | ~> 4.40 |

## Modules

| Name                        | Source                                                        | Version |
|-----------------------------|---------------------------------------------------------------|---------|
| ai\_foundry                 | ../../modules/ai_foundry                                      | n/a     |
| application\_insights       | Azure/avm-res-insights-component/azurerm                      | 0.2.0   |
| capability\_host\_resources | ../../modules/new_resources_agent_capability_host_connections | n/a     |
| common\_models              | ../../modules/common_models                                   | n/a     |
| naming                      | Azure/naming/azurerm                                          | 0.4.2   |

## Resources

| Name                                                                                                                                            | Type     |
|-------------------------------------------------------------------------------------------------------------------------------------------------|----------|
| [azurerm_log_analytics_workspace.this](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/log_analytics_workspace) | resource |
| [azurerm_resource_group.this](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/resource_group)                   | resource |

## Inputs

| Name                          | Description                                                                                                                                                                                                 | Type          | Default                         | Required |
|-------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------|---------------------------------|:--------:|
| enable\_telemetry             | This variable controls whether or not telemetry is enabled for the module.<br/>For more information see <https://aka.ms/avm/telemetryinfo>.<br/>If it is set to false, then no telemetry will be collected. | `bool`        | `true`                          |    no    |
| location                      | Azure region where the resource should be deployed.                                                                                                                                                         | `string`      | `"swedencentral"`               |    no    |
| project\_description          | The description of the AI Foundry project                                                                                                                                                                   | `string`      | `"Default Project description"` |    no    |
| project\_display\_name        | The display name of the AI Foundry project                                                                                                                                                                  | `string`      | `"Default Project"`             |    no    |
| project\_name                 | The name of the AI Foundry project                                                                                                                                                                          | `string`      | `"default-project"`             |    no    |
| resource\_group\_resource\_id | The resource group resource id where the module resources will be deployed. If not provided, a new resource group will be created.                                                                          | `string`      | `null`                          |    no    |
| sku                           | The SKU for the AI Foundry resource. The default is 'S0'.                                                                                                                                                   | `string`      | `"S0"`                          |    no    |
| tags                          | (Optional) Tags to be applied to all resources.                                                                                                                                                             | `map(string)` | `null`                          |    no    |

## Outputs

| Name                                          | Description                                                                  |
|-----------------------------------------------|------------------------------------------------------------------------------|
| agent\_capability\_host\_connections          | The connections used for the agent capability host.                          |
| ai\_foundry\_endpoint                         | The endpoint URL of the AI Foundry account.                                  |
| ai\_foundry\_id                               | The resource ID of the AI Foundry account.                                   |
| ai\_foundry\_model\_deployments\_ids          | The IDs of the AI Foundry model deployments.                                 |
| ai\_foundry\_name                             | The name of the AI Foundry account.                                          |
| ai\_foundry\_project\_id                      | The resource ID of the AI Foundry Project.                                   |
| ai\_foundry\_project\_identity\_principal\_id | The principal ID of the AI Foundry project system-assigned managed identity. |
| ai\_foundry\_project\_name                    | The name of the AI Foundry Project.                                          |
| application\_insights\_id                     | The resource ID of the Application Insights instance.                        |
| log\_analytics\_workspace\_id                 | The resource ID of the Log Analytics workspace.                              |
| resource\_group\_id                           | The resource ID of the resource group.                                       |
| resource\_group\_name                         | The name of the resource group.                                              |
<!-- END_TF_DOCS -->
