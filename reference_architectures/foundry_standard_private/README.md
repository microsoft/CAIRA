<!-- META
title: Azure AI Foundry - Standard Private Configuration
description: Terraform reference architecture for deploying an Azure AI Foundry environment with private networking, existing resource integration, and enhanced security for enterprise workloads.
author: CAIRA Team
ms.date: 08/26/2025
ms.topic: reference
estimated_reading_time: 6
keywords:
    - azure ai foundry
    - private endpoints
    - terraform
    - standard configuration
    - production ready
    - reference architecture
    - ai services
-->
# Azure AI Foundry - Standard Private Configuration

This Terraform configuration deploys an Azure AI Foundry environment with private networking that delivers all the capabilities of the standard configuration while adding private endpoint connectivity and subnet injection for enhanced security. It uses existing Azure Cosmos DB, Azure AI Search, and Azure Storage resources, ensuring data stays within your controlled network boundaries and access is governed according to your private networking policies.

## Overview

The Standard Private configuration is suited for:

- **Enterprise/regulated workloads** that require private networking and enhanced security controls
- **Organizations with existing Azure services** that need to integrate AI Foundry with their current Cosmos DB, Storage, and AI Search resources
- **Teams with strict network security requirements** that mandate subnet injection and private endpoint connectivity
- **Environments that need both data sovereignty and network isolation** with RBAC-based access controls

## Architecture

![Architecture Diagram](./images/architecture.drawio.svg)

| Component                                          | Purpose                            | Configuration                                                                                     |
|----------------------------------------------------|------------------------------------|---------------------------------------------------------------------------------------------------|
| **Resource Group**                                 | Logical container for resources    | Created if not provided; can use existing resource group via `resource_group_resource_id`         |
| **Azure AI Foundry Account and Project**           | Core AI platform resources         | Deployed via Terraform module; project identity managed automatically; private networking enabled |
| **Model Deployments**                              | Provides default models for agents | Uses `common_models` module; includes GPT‑4.1 model deployment                                    |
| **Log Analytics Workspace + Application Insights** | Monitoring and observability       | App Insights connected to Log Analytics Workspace; deployed and wired automatically               |
| **Existing Azure Cosmos DB Account**               | Data storage for agents            | References existing Cosmos DB via data source; explicitly wired via host connections              |
| **Existing Azure Storage Account**                 | File and blob storage for agents   | References existing Storage Account via data source; explicitly wired via host connections        |
| **Existing Azure AI Search Service**               | Search capabilities for agents     | References existing AI Search service via data source; explicitly wired via host connections      |
| **Virtual Network Integration**                    | Private networking                 | AI Foundry injected into `foundry_subnet_id`; Agents injected into `agents_subnet_id`             |

Note: This architecture requires existing Cosmos DB, Storage, and AI Search resources, and two subnets for private network injection.

## Key Features

- **🔒 Private networking**: AI Foundry and agents are injected into your existing VNet subnets for enhanced security
- **🌍 Existing resource integration**: Uses your existing Cosmos DB, Storage, and AI Search resources for complete control
- **�️ Enhanced security**: Private endpoints and subnet injection eliminate public internet exposure
- **📊 Observability**: Log Analytics and Application Insights out of the box
- **📈 Enterprise-ready**: Built for regulated workloads with strict security and compliance requirements

## Getting Started

### Prerequisites

1. **Existing network infrastructure**:
   - **Virtual Network**: An existing VNet with two subnets available for AI Foundry and Agents injection
   - **Foundry Subnet**: Subnet ID where the AI Foundry service will be injected
   - **Agents Subnet**: Subnet ID where AI Foundry Agents will be injected

1. **Existing capability host resources**:
   - **Azure Cosmos DB Account**: Existing Cosmos DB account for agent data storage
   - **Azure Storage Account**: Existing Storage Account for file and blob storage
   - **Azure AI Search Service**: Existing AI Search service for search capabilities
   - All existing resources must be in the same region as the AI Foundry deployment

1. **Active Azure subscription(s) with appropriate permissions** for the target resource group and services. Suggested roles include (depending on deployment approach):

   - **Workload Subscription**
     - **Role Based Access Control Administrator**: Needed over the resource group to create the relevant role assignments
     - **Network Contributor**: Needed over the resource group and VNet to create private endpoint resources
     - **Azure AI Account Owner**: Needed to create a cognitive services account and project
     - **Owner or Role Based Access Administrator**: Needed to assign RBAC to the existing resources (Cosmos DB, Azure AI Search, Storage)
     - **Azure AI User**: Needed to create and edit agents
     - **Cognitive Services OpenAI Contributor**: Needed to write OpenAI responses API

1. **Register resource providers** (at minimum):

    ```shell
    az provider register --namespace 'Microsoft.App'
    az provider register --namespace 'Microsoft.CognitiveServices'
    az provider register --namespace 'Microsoft.DocumentDB'
    az provider register --namespace 'Microsoft.Search'
    az provider register --namespace 'Microsoft.Storage'
    az provider register --namespace 'Microsoft.Network'
    ```

1. Sufficient quota for all resources in your target Azure region

1. Azure CLI installed and configured on your local workstation or deployment pipeline server

1. Terraform CLI version v1.13 or later on your local workstation or deployment pipeline server. This template requires the usage of both the AzureRm and AzApi Terraform providers.

### Standard Deploy

1. **Clone the repository**:

   ```shell
   git clone <repository-url>
   cd reference_architectures/foundry_standard_private
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

1. **Configure required variables**: Create a `terraform.tfvars` file or set environment variables for the required configuration:

   ```shell
   # Example terraform.tfvars
   agents_subnet_id = "/subscriptions/your-subscription-id/resourceGroups/your-rg/providers/Microsoft.Network/virtualNetworks/your-vnet/subnets/agents-subnet"
   foundry_subnet_id = "/subscriptions/your-subscription-id/resourceGroups/your-rg/providers/Microsoft.Network/virtualNetworks/your-vnet/subnets/foundry-subnet"
   existing_capability_host_resource_group_id = "/subscriptions/your-subscription-id/resourceGroups/your-existing-rg"
   existing_cosmosdb_account_name = "your-cosmos-account-name"
   existing_storage_account_name = "your-storage-account-name"
   existing_search_service_name = "your-search-service-name"
   ```

1. **Review the plan**:

   ```shell
   terraform plan
   ```

1. **Deploy the infrastructure**:

   ```shell
   terraform apply
   ```

## Controlling Dependent Services (Existing Resources Only)

This configuration is designed to use existing Azure resources for agent capability host connections (Cosmos DB, Storage, and AI Search). Unlike the standard configuration, this private networking version does not create new resources but instead connects to your existing, approved services:

1. **Existing Resources Approach** (the only option for this configuration):
   - The configuration uses the `existing_resources_agent_capability_host_connections` module to reference your existing Cosmos DB, Storage, and AI Search services.
   - The module inputs `existing_cosmosdb_account_name`, `existing_storage_account_name`, and `existing_search_service_name` specify which resources to connect to.
   - The `existing_capability_host_resource_group_id` identifies the resource group containing these existing resources.

   Example configuration (configured via `terraform.tfvars` or variables):

```hcl
agents_subnet_id                           = "/subscriptions/12345678-1234-1234-1234-123456789abc/resourceGroups/network-rg/providers/Microsoft.Network/virtualNetworks/main-vnet/subnets/agents-subnet"
foundry_subnet_id                          = "/subscriptions/12345678-1234-1234-1234-123456789abc/resourceGroups/network-rg/providers/Microsoft.Network/virtualNetworks/main-vnet/subnets/foundry-subnet"
existing_capability_host_resource_group_id = "/subscriptions/12345678-1234-1234-1234-123456789abc/resourceGroups/existing-services-rg"
existing_cosmosdb_account_name             = "my-cosmos-account"
existing_storage_account_name              = "mystorageaccount"
existing_search_service_name               = "my-search-service"
```

**Role assignments**: The AI Foundry Project uses a managed identity. The module includes role assignment wiring for the existing host connections; verify and adjust as needed in `modules/ai_foundry/agent_capability_host_connections.role_assignments.tf`. The output `ai_foundry_project_identity_principal_id` is provided for audits or custom RBAC.

**Private networking**: This configuration enables private networking by default with subnet injection for both the AI Foundry service and Agents. Public network access is disabled to ensure all communication flows through your private network. Ensure your existing Cosmos DB, Storage, and AI Search services are configured appropriately for private access if needed.

## Monitoring and Observability

- Application Insights connected to Log Analytics Workspace
- Use Log Analytics for queries/dashboards; App Insights for app performance and distributed tracing

## Cost Considerations

- In addition to AI Foundry costs, this configuration provisions Cosmos DB, Storage, and AI Search; review SKUs/retention settings
- Default LAW retention is 30 days (PerGB2018); adjust to your needs

## Troubleshooting

- **Subnet configuration errors**: Verify that `agents_subnet_id` and `foundry_subnet_id` are valid subnet resource IDs and exist in your VNet
- **Existing resource errors**: Confirm resource names and resource group IDs are correct; ensure the project identity has required RBAC on existing Cosmos DB, Storage, and AI Search resources
- **Private networking issues**: Ensure your existing resources are accessible from the specified subnets; check network security group rules and route tables
- **Resource location mismatch**: All existing resources and the AI Foundry deployment must be in the same Azure region
- **Quota/region**: Check model availability and service quotas in your target region
- **Provider registration**: Validate all required providers are registered, including `Microsoft.Network` for private networking
- **Terraform**: `terraform validate` and ensure Azure CLI context is correct (`az account show`)

---

<!-- BEGIN_TF_DOCS -->
## Requirements

| Name      | Version        |
|-----------|----------------|
| terraform | >= 1.13, < 2.0 |
| azapi     | ~> 2.6         |
| azurerm   | ~> 4.40        |
| time      | ~> 0.13        |

## Providers

| Name    | Version |
|---------|---------|
| azurerm | ~> 4.40 |

## Modules

| Name                        | Source                                                             | Version |
|-----------------------------|--------------------------------------------------------------------|---------|
| ai\_foundry                 | ../../modules/ai_foundry                                           | n/a     |
| application\_insights       | Azure/avm-res-insights-component/azurerm                           | 0.2.0   |
| capability\_host\_resources | ../../modules/existing_resources_agent_capability_host_connections | n/a     |
| common\_models              | ../../modules/common_models                                        | n/a     |
| naming                      | Azure/naming/azurerm                                               | 0.4.2   |

## Resources

| Name                                                                                                                                            | Type     |
|-------------------------------------------------------------------------------------------------------------------------------------------------|----------|
| [azurerm_log_analytics_workspace.this](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/log_analytics_workspace) | resource |
| [azurerm_resource_group.this](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/resource_group)                   | resource |

## Inputs

| Name                                            | Description                                                                                                                                                                                                 | Type          | Default                         | Required |
|-------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------|---------------------------------|:--------:|
| agents\_subnet\_id                              | The subnet ID where AI Foundry Agents will be injected.                                                                                                                                                     | `string`      | n/a                             |   yes    |
| existing\_capability\_host\_resource\_group\_id | Resource group ID that contains the existing capability host resources (Cosmos DB, Storage, AI Search).                                                                                                     | `string`      | n/a                             |   yes    |
| existing\_cosmosdb\_account\_name               | Existing Cosmos DB account name to use for agent thread and entity stores.                                                                                                                                  | `string`      | n/a                             |   yes    |
| existing\_search\_service\_name                 | Existing Azure AI Search service name to use as vector store.                                                                                                                                               | `string`      | n/a                             |   yes    |
| existing\_storage\_account\_name                | Existing Storage Account name to use for agent storage.                                                                                                                                                     | `string`      | n/a                             |   yes    |
| foundry\_subnet\_id                             | The subnet ID for the AI Foundry private endpoints.                                                                                                                                                         | `string`      | n/a                             |   yes    |
| enable\_telemetry                               | This variable controls whether or not telemetry is enabled for the module.<br/>For more information see <https://aka.ms/avm/telemetryinfo>.<br/>If it is set to false, then no telemetry will be collected. | `bool`        | `true`                          |    no    |
| location                                        | Azure region where the resource should be deployed.                                                                                                                                                         | `string`      | `"swedencentral"`               |    no    |
| monitor\_private\_link\_scope\_resource\_id     | The resource ID of the Monitor Private Link Scope to link Application Insights to.                                                                                                                          | `string`      | `null`                          |    no    |
| project\_description                            | The description of the AI Foundry project                                                                                                                                                                   | `string`      | `"Default Project description"` |    no    |
| project\_display\_name                          | The display name of the AI Foundry project                                                                                                                                                                  | `string`      | `"Default Project"`             |    no    |
| project\_name                                   | The name of the AI Foundry project                                                                                                                                                                          | `string`      | `"default-project"`             |    no    |
| resource\_group\_resource\_id                   | The resource group resource id where the module resources will be deployed. If not provided, a new resource group will be created.                                                                          | `string`      | `null`                          |    no    |
| sku                                             | The SKU for the AI Foundry resource. The default is 'S0'.                                                                                                                                                   | `string`      | `"S0"`                          |    no    |
| tags                                            | (Optional) Tags to be applied to all resources.                                                                                                                                                             | `map(string)` | `null`                          |    no    |

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
