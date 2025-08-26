<!-- META
title: Azure AI Foundry - Standard Private Configuration
description: Terraform reference architecture for deploying a standard Azure AI Foundry environment with private endpoints, enhanced security, and production-ready features.
author: CAIRA Team
ms.date: 08/20/2025
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
| foundry\_subnet\_id                             | The subnet ID where the AI Foundry will be injected.                                                                                                                                                        | `string`      | n/a                             |   yes    |
| enable\_telemetry                               | This variable controls whether or not telemetry is enabled for the module.<br/>For more information see <https://aka.ms/avm/telemetryinfo>.<br/>If it is set to false, then no telemetry will be collected. | `bool`        | `true`                          |    no    |
| location                                        | Azure region where the resource should be deployed.                                                                                                                                                         | `string`      | `"swedencentral"`               |    no    |
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
