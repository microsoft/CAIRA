<!-- META
title: AI Foundry Terraform Module
description: Deploys an Azure AI Foundry account, model deployments, and an AI Foundry Project.
author: CAIRA Team
ms.date: 08/14/2025
ms.topic: module
estimated_reading_time: 5
keywords:
  - azure ai foundry
  - terraform module
  - model deployments
  - ai project
  - application insights
  - rbac
  - agent capability host
-->

# AI Foundry Terraform Module

Deploys an Azure AI Foundry account, model deployments, and an AI Foundry Project. Optionally connects Application Insights and wires Agent Capability Host connections to Cosmos DB, Storage, and Azure AI Search, including required RBAC assignments.

## Overview

This module provisions:

- Azure AI Foundry account
- One or more model deployments on the account
- An AI Foundry Project
- Optional Application Insights connection to the Project
- Optional Agent Capability Host for Agents and connections to Cosmos DB, Storage, and AI Search
- Optional RBAC setup for the Project identity on the connected services (including data-plane Cosmos roles and conditional Storage role assignment)

Designed to be used directly or with the `common_models` module to supply model deployment specs.

### Agent Conversation Flow

```mermaid
sequenceDiagram
    participant User
    participant Agent as Agent Capability Host
    participant Models as Model Deployments
    participant CosmosDB as Cosmos DB
    participant AISearch as AI Search
    participant AzStorage as Azure Storage

    User->>Agent: Send Message
    Agent->>CosmosDB: Load Thread Context
    Agent->>AISearch: Retrieve Knowledge
    Agent->>Models: Generate Response
    Models-->>Agent: AI Response
    Agent->>AzStorage: Store Files (if any)
    Agent->>CosmosDB: Save Thread Update
    Agent-->>User: Return Response
```

### Knowledge Retrieval (RAG) Flow

```mermaid
sequenceDiagram
    participant Agent as Agent Capability Host
    participant Models as Model Deployments
    participant CosmosDB as Cosmos DB
    participant AISearch as AI Search

    Agent->>AISearch: Query Vector Database
    AISearch-->>Agent: Relevant Documents
    Agent->>Models: Prompt + Context
    Models-->>Agent: Grounded Response
    Agent->>CosmosDB: Store Enhanced Thread
```

## Usage

### Private networking (VNet injection)

To deploy AI Foundry in private mode and inject the Agents capability into an existing subnet, set:

- `public_network_access = "Disabled"`
- `agent_network_injection_subnet_id = "/subscriptions/<subId>/resourceGroups/<rg>/providers/Microsoft.Network/virtualNetworks/<vnet>/subnets/<subnet>"`

When using private endpoints for connected services (Cosmos DB, Storage, AI Search), provide their standard endpoints; private DNS will resolve to private IPs inside your VNet.

### Minimal example

```terraform
data "azurerm_resource_group" "rg" {
  name = "my-rg"
}

module "common_models" {
  source = "../../modules/common_models"
}

module "ai_foundry" {
  source = "../../modules/ai_foundry"

  ai_foundry_name   = "my-aif-account"
  location          = "swedencentral"
  resource_group_id = data.azurerm_resource_group.rg.id

  # Optional project fields (defaults shown)
  project_name         = "default-project"
  project_display_name = "Default Project"
  project_description  = "Default Project description"

  # Provide at least one model deployment
  model_deployments = [
    module.common_models.gpt_4_1,
    module.common_models.text_embedding_3_large
  ]

  # Application Insights connection is required (supply from your existing AI/LAW setup)
  application_insights = {
    resource_id       = azurerm_application_insights.appi.id
    name              = azurerm_application_insights.appi.name
    connection_string = azurerm_application_insights.appi.connection_string
  }

  # Omit agent_capability_host_connections to skip agent wiring
}
```

### With agent capability host connections (BYO resources)

```terraform
module "ai_foundry" {
  # ...as above...

  agent_capability_host_connections = {
    cosmos_db = {
      resource_id         = azurerm_cosmosdb_account.cosmos.id
      resource_group_name = azurerm_cosmosdb_account.cosmos.resource_group_name
      name                = azurerm_cosmosdb_account.cosmos.name
      endpoint            = azurerm_cosmosdb_account.cosmos.endpoint
      location            = var.location
    }
    storage_account = {
      resource_id           = azurerm_storage_account.sa.id
      name                  = azurerm_storage_account.sa.name
      primary_blob_endpoint = azurerm_storage_account.sa.primary_blob_endpoint
      location              = var.location
    }
    ai_search = {
      resource_id = azapi_resource.search.id
      name        = azapi_resource.search.name
      location    = var.location
    }
  }
}
```

Notes:

- The module grants the Project identity RBAC on Cosmos DB (Cosmos DB Operator), Storage (Storage Blob Data Contributor + conditional Storage Blob Data Owner for project containers), and Search (Search Index Data Contributor, Search Service Contributor). It also creates Cosmos SQL data-plane role assignments on three collections used by agents.
- The module uses timed waits to allow identity propagation and RBAC consistency before binding the capability host.

## Agent Subnet Cleanup

**Critical for Destroy Operations:**

When using agent subnet injection (`agents_subnet_id`), Azure creates a Container App Environment that establishes service association links to the subnet. These links prevent subnet deletion until they are cleaned up by Azure. This process can take several minutes after the AI Foundry resource is deleted.

<!-- BEGIN_TF_DOCS -->
## Requirements

| Name      | Version        |
|-----------|----------------|
| terraform | >= 1.13, < 2.0 |
| azapi     | ~> 2.6         |
| azurerm   | ~> 4.40        |
| random    | ~> 3.7         |
| time      | ~> 0.13        |

## Providers

| Name    | Version |
|---------|---------|
| azapi   | ~> 2.6  |
| azurerm | ~> 4.40 |
| time    | ~> 0.13 |

## Resources

| Name                                                                                                                                                   | Type        |
|--------------------------------------------------------------------------------------------------------------------------------------------------------|-------------|
| [azapi_resource.ai_foundry](https://registry.terraform.io/providers/Azure/azapi/latest/docs/resources/resource)                                        | resource    |
| [azapi_resource.ai_foundry_capability_host](https://registry.terraform.io/providers/Azure/azapi/latest/docs/resources/resource)                        | resource    |
| [azapi_resource.appinsights_connection](https://registry.terraform.io/providers/Azure/azapi/latest/docs/resources/resource)                            | resource    |
| [azapi_resource_action.purge_ai_foundry](https://registry.terraform.io/providers/Azure/azapi/latest/docs/resources/resource_action)                    | resource    |
| [azurerm_cognitive_deployment.model_deployments](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/cognitive_deployment) | resource    |
| [azurerm_private_endpoint.ai_foundry_pe](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/private_endpoint)             | resource    |
| [time_sleep.wait_ai_foundry](https://registry.terraform.io/providers/hashicorp/time/latest/docs/resources/sleep)                                       | resource    |
| [time_sleep.wait_before_delete_capability_host](https://registry.terraform.io/providers/hashicorp/time/latest/docs/resources/sleep)                    | resource    |
| [time_sleep.wait_before_purge](https://registry.terraform.io/providers/hashicorp/time/latest/docs/resources/sleep)                                     | resource    |
| [azurerm_client_config.current](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/client_config)                      | data source |
| [azurerm_private_dns_zone.ai_services](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/private_dns_zone)            | data source |
| [azurerm_private_dns_zone.cognitive](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/private_dns_zone)              | data source |
| [azurerm_private_dns_zone.openai](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/private_dns_zone)                 | data source |

## Inputs

| Name                  | Description                                                                 | Type                                                                                                                                                                                                                                                                                          | Default | Required |
|-----------------------|-----------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------|:--------:|
| application\_insights | Configuration for Application Insights connection.                          | <pre>object({<br/>    resource_id       = string<br/>    name              = string<br/>    connection_string = string<br/>  })</pre>                                                                                                                                                         | n/a     |   yes    |
| location              | The Azure region where the AI Foundry resource will be deployed.            | `string`                                                                                                                                                                                                                                                                                      | n/a     |   yes    |
| model\_deployments    | A map of model deployments to be created in the AI Foundry resource.        | <pre>list(object({<br/>    name    = string<br/>    version = string<br/>    format  = string<br/>    sku = optional(object({<br/>      name     = string<br/>      capacity = number<br/>      }), {<br/>      name     = "GlobalStandard"<br/>      capacity = 1<br/>    })<br/>  }))</pre> | n/a     |   yes    |
| name                  | The name of the AI Foundry resource.                                        | `string`                                                                                                                                                                                                                                                                                      | n/a     |   yes    |
| resource\_group\_id   | The ID of the resource group where the AI Foundry resource will be created. | `string`                                                                                                                                                                                                                                                                                      | n/a     |   yes    |
| agents\_subnet\_id    | Optional subnet ID to inject the AI Foundry Agents capability host.         | `string`                                                                                                                                                                                                                                                                                      | `null`  |    no    |
| foundry\_subnet\_id   | Optional subnet ID to inject the AI Foundry.                                | `string`                                                                                                                                                                                                                                                                                      | `null`  |    no    |
| sku                   | The SKU for the AI Foundry resource.                                        | `string`                                                                                                                                                                                                                                                                                      | `"S0"`  |    no    |
| tags                  | A list of tags to apply to the AI Foundry resource.                         | `map(string)`                                                                                                                                                                                                                                                                                 | `null`  |    no    |

## Outputs

| Name                                 | Description                                  |
|--------------------------------------|----------------------------------------------|
| ai\_foundry\_endpoint                | The endpoint URL of the AI Foundry account.  |
| ai\_foundry\_id                      | The resource ID of the AI Foundry account.   |
| ai\_foundry\_model\_deployments\_ids | The IDs of the AI Foundry model deployments. |
| ai\_foundry\_name                    | The name of the AI Foundry account.          |
<!-- END_TF_DOCS -->
